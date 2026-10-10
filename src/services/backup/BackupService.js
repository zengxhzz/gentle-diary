import packageJson from '../../../package.json'
import { CURRENT_SCHEMA_VERSION } from '@/database/schemas/schema.js'
import { createAttachment } from '@/models/Attachment.js'
import { normalizeDiary } from '@/models/Diary.js'
import { toDateKey } from '@/utils/date.js'

export const BACKUP_FORMAT = 'gentle-diary-backup'
export const BACKUP_VERSION = 2

export class BackupValidationError extends Error {
  constructor(message, code = 'INVALID_BACKUP') {
    super(message)
    this.name = 'BackupValidationError'
    this.code = code
  }
}

export class BackupService {
  /**
   * @param {{
   *   backupRepository: import('../../repositories/interfaces/BackupRepository.js').BackupRepository,
   *   attachmentService?: import('../media/AttachmentService.js').AttachmentService,
   *   backupFileProvider?: import('../../providers/backup/PlatformBackupFileProvider.js').PlatformBackupFileProvider,
   *   appVersion?: string,
   *   now?: () => Date,
   * }} dependencies
   */
  constructor({
    backupRepository,
    attachmentService = null,
    backupFileProvider = null,
    appVersion = packageJson.version,
    now = () => new Date(),
  }) {
    this.backupRepository = backupRepository
    this.attachmentService = attachmentService
    this.backupFileProvider = backupFileProvider
    this.appVersion = appVersion
    this.now = now
  }

  async createBackup() {
    const snapshot = await this.backupRepository.readSnapshot()
    const diaries = snapshot.diaries.map(normalizeDiary)
    const attachments = snapshot.attachments.map(createAttachment)
    const settings = snapshot.settings
    const attachmentBlobs = new Map(
      snapshot.attachmentBlobs.map((record) => [record.attachmentId, record.blob]),
    )
    const thumbnailBlobs = new Map(
      snapshot.thumbnailBlobs.map((record) => [record.attachmentId, record.blob]),
    )

    const serializedAttachments = []
    for (const attachment of attachments) {
      const blob = attachmentBlobs.get(attachment.id)
      if (!(blob instanceof Blob)) {
        throw new BackupValidationError(
          `附件 ${attachment.id} 的原始文件缺失，已停止导出，现有数据未被修改。`,
          'MISSING_ATTACHMENT_DATA',
        )
      }

      const thumbnail = thumbnailBlobs.get(attachment.id)
      const original = await blobToDataUrlWithHash(blob, attachment.mimeType)
      const thumbnailData = thumbnail instanceof Blob
        ? await blobToDataUrlWithHash(thumbnail, attachment.thumbnailMimeType)
        : null
      serializedAttachments.push({
        metadata: createAttachment(attachment),
        dataUrl: original.dataUrl,
        sha256: original.sha256,
        thumbnailDataUrl: thumbnailData?.dataUrl ?? null,
        thumbnailSha256: thumbnailData?.sha256 ?? null,
      })
    }

    const backup = {
      format: BACKUP_FORMAT,
      backupVersion: BACKUP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: this.now().toISOString(),
      appVersion: this.appVersion,
      data: {
        diaries: cloneJson(diaries),
        settings: cloneJson(settings),
        attachments: serializedAttachments,
      },
    }

    await validateAndPrepareBackup(backup)
    return backup
  }

  async createBackupFile() {
    const backup = await this.createBackup()
    const json = JSON.stringify(backup, null, 2)
    const date = toDateKey(new Date(backup.exportedAt))
    return {
      backup,
      blob: new Blob([json], { type: 'application/json' }),
      fileName: `gentle-diary-backup-${date}.json`,
    }
  }

  supportsShareDelivery() {
    return this.backupFileProvider?.supportsShareDelivery() ?? false
  }

  async getExportRecoveryStatus() {
    return await this.backupFileProvider?.getRecoveryStatus?.() ?? { state: 'idle' }
  }

  async exportBackupFile(options = {}) {
    if (!this.backupFileProvider) throw new Error('当前环境未配置备份文件导出能力。')
    const file = await this.createBackupFile()
    const delivery = await this.backupFileProvider.exportFile(file.blob, file.fileName, options)
    return { ...file, delivery }
  }

  /**
   * 第一版仅支持全量替换。所有解析、校验和 Blob 解码都在事务开始前完成。
   * @param {string} json
   * @param {{ mode?: 'replace' }} [options]
   */
  async importFromJson(json, options = {}) {
    if ((options.mode ?? 'replace') !== 'replace') {
      throw new BackupValidationError('当前版本只支持替换现有数据。', 'UNSUPPORTED_IMPORT_MODE')
    }

    let parsed
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new BackupValidationError('备份文件不是有效的 JSON。', 'INVALID_JSON')
    }

    const prepared = await validateAndPrepareBackup(parsed)
    await this.backupRepository.replaceAll(prepared)
    try {
      await this.attachmentService?.reconcileStorage()
    } catch {
      // Filesystem 只是 IndexedDB 的可重建镜像；清理失败不能把已经成功的原子导入误报为失败。
    }

    return {
      diaryCount: prepared.diaries.length,
      attachmentCount: prepared.attachments.length,
      settingsCount: prepared.settings.length,
      importedAt: this.now().toISOString(),
    }
  }

  /** @param {Blob & { text?: () => Promise<string> }} file */
  async importFromFile(file, options = {}) {
    if (!file || typeof file.text !== 'function') {
      throw new BackupValidationError('请选择有效的备份文件。', 'INVALID_FILE')
    }
    return this.importFromJson(await file.text(), options)
  }
}

/**
 * 严格校验并将 Base64 数据解码为事务可直接写入的记录。
 * 该函数没有任何持久化副作用。
 */
export async function validateAndPrepareBackup(input) {
  assertRecord(input, '备份根对象缺失。')
  if (input.format !== BACKUP_FORMAT) {
    throw new BackupValidationError('这不是本应用支持的备份文件。', 'INVALID_FORMAT')
  }
  if (![1, BACKUP_VERSION].includes(input.backupVersion)) {
    throw new BackupValidationError(
      `不支持的备份格式版本：${String(input.backupVersion)}`,
      'UNSUPPORTED_BACKUP_VERSION',
    )
  }
  if (
    !Number.isInteger(input.schemaVersion) ||
    input.schemaVersion < 1 ||
    input.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    throw new BackupValidationError(
      `不支持的数据版本：${String(input.schemaVersion)}`,
      'UNSUPPORTED_SCHEMA_VERSION',
    )
  }
  assertIsoString(input.exportedAt, '导出时间无效。')
  assertNonEmptyString(input.appVersion, '应用版本缺失。')
  assertRecord(input.data, '备份数据缺失。')
  assertArray(input.data.diaries, '日记数据格式无效。')
  assertArray(input.data.settings, '设置数据格式无效。')
  assertArray(input.data.attachments, '附件数据格式无效。')

  const diaryIds = new Set()
  const blockIds = new Set()
  const referencedAttachments = new Map()
  const diaries = input.data.diaries.map((diary, index) => {
    validateDiary(diary, index, diaryIds, blockIds, referencedAttachments)
    return normalizeDiary(diary)
  })

  const settings = validateSettings(input.data.settings)
  validateTagReferences(diaries, settings)

  const attachmentIds = new Set()
  const attachments = []
  const attachmentBlobs = []
  const thumbnailBlobs = []

  for (const [index, entry] of input.data.attachments.entries()) {
    assertRecord(entry, `附件 ${index + 1} 的结构无效。`)
    assertRecord(entry.metadata, `附件 ${index + 1} 的 metadata 缺失。`)
    const metadata = validateAttachmentMetadata(entry.metadata, index)

    if (attachmentIds.has(metadata.id)) {
      throw new BackupValidationError(`存在重复附件 ID：${metadata.id}`, 'DUPLICATE_ID')
    }
    attachmentIds.add(metadata.id)

    const reference = referencedAttachments.get(metadata.id)
    if (!reference) {
      throw new BackupValidationError(`附件 ${metadata.id} 没有日记引用。`, 'ORPHAN_ATTACHMENT')
    }
    if (reference.diaryId !== metadata.diaryId) {
      throw new BackupValidationError(
        `附件 ${metadata.id} 的 diaryId 与引用日记不一致。`,
        'INVALID_REFERENCE',
      )
    }

    const blob = dataUrlToBlob(entry.dataUrl, `附件 ${metadata.id}`)
    if (blob.type !== metadata.mimeType) {
      throw new BackupValidationError(`附件 ${metadata.id} 的 MIME 类型不一致。`, 'INVALID_ATTACHMENT_DATA')
    }
    if (metadata.size !== null && metadata.size !== blob.size) {
      throw new BackupValidationError(`附件 ${metadata.id} 的文件大小不一致。`, 'INVALID_ATTACHMENT_DATA')
    }
    if (input.backupVersion >= 2) {
      await verifyBlobSha256(blob, entry.sha256, `附件 ${metadata.id}`)
    }

    let thumbnail = null
    if (entry.thumbnailDataUrl !== null && entry.thumbnailDataUrl !== undefined) {
      thumbnail = dataUrlToBlob(entry.thumbnailDataUrl, `附件 ${metadata.id} 的缩略图`)
      if (thumbnail.type !== metadata.thumbnailMimeType) {
        throw new BackupValidationError(`附件 ${metadata.id} 的缩略图 MIME 类型不一致。`, 'INVALID_ATTACHMENT_DATA')
      }
      if (metadata.thumbnailSize !== null && metadata.thumbnailSize !== thumbnail.size) {
        throw new BackupValidationError(`附件 ${metadata.id} 的缩略图大小不一致。`, 'INVALID_ATTACHMENT_DATA')
      }
      if (input.backupVersion >= 2) {
        await verifyBlobSha256(thumbnail, entry.thumbnailSha256, `附件 ${metadata.id} 的缩略图`)
      }
    } else if (metadata.thumbnailSize !== null && metadata.thumbnailSize > 0) {
      throw new BackupValidationError(`附件 ${metadata.id} 的缩略图数据缺失。`, 'MISSING_ATTACHMENT_DATA')
    } else if (input.backupVersion >= 2 && entry.thumbnailSha256 !== null) {
      throw new BackupValidationError(`附件 ${metadata.id} 的缩略图校验值无效。`, 'INVALID_ATTACHMENT_DATA')
    }

    attachments.push(
      createAttachment({
        ...metadata,
        // 备份可跨设备恢复，不能沿用来源设备的 filesystem URI。
        // 导入数据先以事务内的 IndexedDB 二进制为唯一可信来源，后续可按需重建原生镜像。
        localUri: `indexeddb://attachment/${metadata.id}`,
        thumbnailUri: thumbnail ? `indexeddb://thumbnail/${metadata.id}` : '',
      }),
    )
    attachmentBlobs.push({ attachmentId: metadata.id, blob })
    if (thumbnail) thumbnailBlobs.push({ attachmentId: metadata.id, blob: thumbnail })
  }

  for (const attachmentId of referencedAttachments.keys()) {
    if (!attachmentIds.has(attachmentId)) {
      throw new BackupValidationError(`日记引用的附件 ${attachmentId} 缺失。`, 'MISSING_ATTACHMENT')
    }
  }

  return { diaries, attachments, attachmentBlobs, thumbnailBlobs, settings }
}

function validateDiary(diary, index, diaryIds, blockIds, referencedAttachments) {
  assertRecord(diary, `第 ${index + 1} 篇日记格式无效。`)
  const prefix = `日记 ${index + 1}`
  assertNonEmptyString(diary.id, `${prefix} 的 ID 缺失。`)
  if (diaryIds.has(diary.id)) {
    throw new BackupValidationError(`存在重复日记 ID：${diary.id}`, 'DUPLICATE_ID')
  }
  diaryIds.add(diary.id)

  assertString(diary.title, `${prefix} 的标题格式无效。`)
  assertArray(diary.blocks, `${prefix} 的 Block 格式无效。`)
  assertIsoString(diary.createdAt, `${prefix} 的创建时间无效。`)
  assertIsoString(diary.updatedAt, `${prefix} 的更新时间无效。`)
  if (typeof diary.diaryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(diary.diaryDate)) {
    throw new BackupValidationError(`${prefix} 的日期格式无效。`)
  }
  if (diary.mood !== null && typeof diary.mood !== 'string') {
    throw new BackupValidationError(`${prefix} 的心情格式无效。`)
  }
  assertStringArray(diary.tagIds, `${prefix} 的标签引用格式无效。`)
  assertBoolean(diary.favorite, `${prefix} 的收藏状态无效。`)
  assertBoolean(diary.draft, `${prefix} 的草稿状态无效。`)
  assertStringArray(diary.attachmentIds, `${prefix} 的附件引用格式无效。`)
  assertNullableRecord(diary.location, `${prefix} 的位置格式无效。`)
  assertNullableRecord(diary.weather, `${prefix} 的天气格式无效。`)
  assertRecord(diary.encryption, `${prefix} 的加密状态缺失。`)
  assertBoolean(diary.encryption.encrypted, `${prefix} 的加密状态无效。`)
  if (diary.encryption.version !== null && !Number.isInteger(diary.encryption.version)) {
    throw new BackupValidationError(`${prefix} 的加密版本无效。`)
  }
  assertRecord(diary.sync, `${prefix} 的同步状态缺失。`)
  if (!Number.isFinite(diary.sync.revision) || diary.sync.revision < 0) {
    throw new BackupValidationError(`${prefix} 的同步版本无效。`)
  }
  assertNullableString(diary.sync.deviceId, `${prefix} 的设备 ID 无效。`)
  assertNullableString(diary.sync.lastSyncedAt, `${prefix} 的同步时间无效。`)
  assertNonEmptyString(diary.sync.status, `${prefix} 的同步状态无效。`)
  assertNullableString(diary.deletedAt, `${prefix} 的删除时间无效。`)

  const imageAttachmentIds = new Set()
  diary.blocks.forEach((block, blockIndex) => {
    validateBlock(block, `${prefix} 的第 ${blockIndex + 1} 个 Block`)
    if (blockIds.has(block.id)) {
      throw new BackupValidationError(`存在重复 Block ID：${block.id}`, 'DUPLICATE_ID')
    }
    blockIds.add(block.id)
    if (block.type === 'image') imageAttachmentIds.add(block.attachmentId)
  })

  if (new Set(diary.attachmentIds).size !== diary.attachmentIds.length) {
    throw new BackupValidationError(`${prefix} 含有重复附件引用。`, 'DUPLICATE_ID')
  }
  if (!sameStringSet(imageAttachmentIds, new Set(diary.attachmentIds))) {
    throw new BackupValidationError(`${prefix} 的 Block 与 attachmentIds 不一致。`, 'INVALID_REFERENCE')
  }
  for (const attachmentId of diary.attachmentIds) {
    if (referencedAttachments.has(attachmentId)) {
      throw new BackupValidationError(`附件 ${attachmentId} 被多篇日记重复引用。`, 'INVALID_REFERENCE')
    }
    referencedAttachments.set(attachmentId, { diaryId: diary.id })
  }
}

function validateBlock(block, label) {
  assertRecord(block, `${label} 格式无效。`)
  assertNonEmptyString(block.id, `${label} 的 ID 缺失。`)
  if (!['paragraph', 'heading', 'image'].includes(block.type)) {
    throw new BackupValidationError(`${label} 的类型不受支持。`)
  }
  if (block.type === 'paragraph' || block.type === 'heading') {
    assertString(block.text, `${label} 的文本格式无效。`)
    if (block.type === 'heading' && ![1, 2, 3].includes(block.level)) {
      throw new BackupValidationError(`${label} 的标题级别无效。`)
    }
    return
  }

  assertNonEmptyString(block.attachmentId, `${label} 的附件引用缺失。`)
  if (!['float-left', 'float-right', 'center', 'full'].includes(block.layout)) {
    throw new BackupValidationError(`${label} 的图片布局无效。`)
  }
  if (!['small', 'medium', 'large', 'full'].includes(block.size)) {
    throw new BackupValidationError(`${label} 的图片尺寸无效。`)
  }
  if (block.widthRatio !== null && !Number.isFinite(block.widthRatio)) {
    throw new BackupValidationError(`${label} 的图片宽度无效。`)
  }
  if (!['original', '1:1', '4:3', '3:4', '16:9', 'custom'].includes(block.aspectRatio)) {
    throw new BackupValidationError(`${label} 的图片比例无效。`)
  }
  if (block.customAspectRatio !== null && !Number.isFinite(block.customAspectRatio)) {
    throw new BackupValidationError(`${label} 的自定义比例无效。`)
  }
  assertString(block.caption, `${label} 的图片说明格式无效。`)
}

function validateSettings(records) {
  const keys = new Set()
  return records.map((record, index) => {
    assertRecord(record, `第 ${index + 1} 项设置格式无效。`)
    assertNonEmptyString(record.key, `第 ${index + 1} 项设置缺少 key。`)
    if (!Object.hasOwn(record, 'value')) {
      throw new BackupValidationError(`设置 ${record.key} 缺少 value。`)
    }
    if (keys.has(record.key)) {
      throw new BackupValidationError(`存在重复设置 key：${record.key}`, 'DUPLICATE_ID')
    }
    keys.add(record.key)
    assertJsonValue(record.value, `设置 ${record.key} 包含无法导入的数据。`)
    return cloneJson(record)
  })
}

function validateTagReferences(diaries, settings) {
  const tagRecord = settings.find((record) => record.key === 'diary.tags')
  const tagIds = new Set()
  if (tagRecord) {
    assertArray(tagRecord.value, '标签设置格式无效。')
    tagRecord.value.forEach((tag, index) => {
      assertRecord(tag, `第 ${index + 1} 个标签格式无效。`)
      assertNonEmptyString(tag.id, `第 ${index + 1} 个标签 ID 缺失。`)
      assertNonEmptyString(tag.name, `第 ${index + 1} 个标签名称缺失。`)
      assertIsoString(tag.createdAt, `第 ${index + 1} 个标签创建时间无效。`)
      if (tagIds.has(tag.id)) {
        throw new BackupValidationError(`存在重复标签 ID：${tag.id}`, 'DUPLICATE_ID')
      }
      tagIds.add(tag.id)
    })
  }

  for (const diary of diaries) {
    for (const tagId of diary.tagIds) {
      if (!tagIds.has(tagId)) {
        throw new BackupValidationError(`日记 ${diary.id} 引用的标签 ${tagId} 缺失。`, 'INVALID_REFERENCE')
      }
    }
  }
}

function validateAttachmentMetadata(metadata, index) {
  const label = `附件 ${index + 1}`
  assertNonEmptyString(metadata.id, `${label} 的 ID 缺失。`)
  assertNonEmptyString(metadata.diaryId, `${label} 的 diaryId 缺失。`)
  if (!['image', 'audio', 'video', 'file'].includes(metadata.type)) {
    throw new BackupValidationError(`${label} 的类型不受支持。`)
  }
  assertString(metadata.localUri, `${label} 的 localUri 无效。`)
  assertString(metadata.thumbnailUri, `${label} 的 thumbnailUri 无效。`)
  assertNullableString(metadata.remoteUri, `${label} 的 remoteUri 无效。`)
  assertNonEmptyString(metadata.mimeType, `${label} 的 MIME 类型缺失。`)
  assertNonEmptyString(metadata.thumbnailMimeType, `${label} 的缩略图 MIME 类型缺失。`)
  assertString(metadata.fileName, `${label} 的文件名无效。`)
  assertNullableFiniteNumber(metadata.width, `${label} 的宽度无效。`)
  assertNullableFiniteNumber(metadata.height, `${label} 的高度无效。`)
  assertNullableNonNegativeInteger(metadata.size, `${label} 的文件大小无效。`)
  assertNullableNonNegativeInteger(metadata.thumbnailSize, `${label} 的缩略图大小无效。`)
  assertBoolean(metadata.encrypted, `${label} 的加密状态无效。`)
  assertIsoString(metadata.createdAt, `${label} 的创建时间无效。`)
  assertNullableString(metadata.deletedAt, `${label} 的删除时间无效。`)
  if (metadata.captureId !== undefined) {
    assertNullableString(metadata.captureId, `${label} 的相机恢复 ID 无效。`)
  }
  return createAttachment(metadata)
}

export async function blobToDataUrl(blob, fallbackMimeType = 'application/octet-stream') {
  if (!(blob instanceof Blob)) {
    throw new BackupValidationError('附件数据不是 Blob。', 'INVALID_ATTACHMENT_DATA')
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mimeType = blob.type || fallbackMimeType || 'application/octet-stream'
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`
}

async function blobToDataUrlWithHash(blob, fallbackMimeType) {
  if (!(blob instanceof Blob)) {
    throw new BackupValidationError('附件数据不是 Blob。', 'INVALID_ATTACHMENT_DATA')
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mimeType = blob.type || fallbackMimeType || 'application/octet-stream'
  return {
    dataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
    sha256: await sha256Hex(bytes),
  }
}

async function verifyBlobSha256(blob, expected, label) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new BackupValidationError(`${label}的 SHA-256 校验值缺失或无效。`, 'INVALID_ATTACHMENT_DATA')
  }
  const actual = await sha256Hex(new Uint8Array(await blob.arrayBuffer()))
  if (actual !== expected) {
    throw new BackupValidationError(`${label}内容校验失败，备份文件可能已损坏。`, 'INVALID_ATTACHMENT_DATA')
  }
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new BackupValidationError('当前环境不支持备份完整性校验。', 'CRYPTO_UNAVAILABLE')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function dataUrlToBlob(value, label = '附件') {
  if (typeof value !== 'string') {
    throw new BackupValidationError(`${label}数据缺失。`, 'MISSING_ATTACHMENT_DATA')
  }
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) {
    throw new BackupValidationError(`${label}不是规范的 Base64 Data URL。`, 'INVALID_ATTACHMENT_DATA')
  }

  let bytes
  try {
    bytes = base64ToBytes(match[2])
  } catch {
    throw new BackupValidationError(`${label}的 Base64 数据损坏。`, 'INVALID_ATTACHMENT_DATA')
  }
  if (!bytes.length) {
    throw new BackupValidationError(`${label}内容为空。`, 'INVALID_ATTACHMENT_DATA')
  }
  return new Blob([bytes], { type: match[1] })
}

function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = ''
    const chunkSize = 0x8000
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    }
    return btoa(binary)
  }
  if (globalThis.Buffer) return globalThis.Buffer.from(bytes).toString('base64')
  throw new BackupValidationError('当前环境不支持 Base64 编码。')
}

function base64ToBytes(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  }
  if (globalThis.Buffer) return new Uint8Array(globalThis.Buffer.from(base64, 'base64'))
  throw new BackupValidationError('当前环境不支持 Base64 解码。')
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function sameStringSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function assertRecord(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BackupValidationError(message)
  }
}

function assertArray(value, message) {
  if (!Array.isArray(value)) throw new BackupValidationError(message)
}

function assertString(value, message) {
  if (typeof value !== 'string') throw new BackupValidationError(message)
}

function assertNonEmptyString(value, message) {
  if (typeof value !== 'string' || !value) throw new BackupValidationError(message)
}

function assertNullableString(value, message) {
  if (value !== null && typeof value !== 'string') throw new BackupValidationError(message)
}

function assertBoolean(value, message) {
  if (typeof value !== 'boolean') throw new BackupValidationError(message)
}

function assertStringArray(value, message) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) {
    throw new BackupValidationError(message)
  }
}

function assertNullableRecord(value, message) {
  if (value !== null && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new BackupValidationError(message)
  }
}

function assertNullableFiniteNumber(value, message) {
  if (value !== null && !Number.isFinite(value)) throw new BackupValidationError(message)
}

function assertNullableNonNegativeInteger(value, message) {
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new BackupValidationError(message)
  }
}

function assertIsoString(value, message) {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) {
    throw new BackupValidationError(message)
  }
}

function assertJsonValue(value, message, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (!value || typeof value !== 'object' || seen.has(value)) {
    throw new BackupValidationError(message)
  }
  seen.add(value)
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value)
  for (const [, nested] of entries) assertJsonValue(nested, message, seen)
  seen.delete(value)
}
