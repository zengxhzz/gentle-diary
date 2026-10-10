import { createId } from '@/utils/id.js'

/**
 * @typedef {Object} Attachment
 * @property {string} id
 * @property {string} diaryId
 * @property {'image' | 'audio' | 'video' | 'file'} type
 * @property {string} localUri
 * @property {string} thumbnailUri
 * @property {string | null} remoteUri
 * @property {string} mimeType
 * @property {string} thumbnailMimeType
 * @property {string} fileName
 * @property {number | null} width
 * @property {number | null} height
 * @property {number | null} size
 * @property {number | null} thumbnailSize
 * @property {boolean} encrypted
 * @property {string} createdAt
 * @property {string | null} deletedAt
 * @property {string | null} captureId
 */

/**
 * @param {Partial<Attachment> & { diaryId: string }} input
 * @returns {Attachment}
 */
export function createAttachment(input) {
  return {
    id: input.id ?? createId('attachment'),
    diaryId: input.diaryId,
    type: input.type ?? 'image',
    localUri: input.localUri ?? '',
    thumbnailUri: input.thumbnailUri ?? '',
    remoteUri: input.remoteUri ?? null,
    mimeType: input.mimeType ?? 'application/octet-stream',
    thumbnailMimeType: input.thumbnailMimeType ?? 'image/jpeg',
    fileName: input.fileName ?? '',
    width: input.width ?? null,
    height: input.height ?? null,
    size: input.size ?? null,
    thumbnailSize: input.thumbnailSize ?? null,
    encrypted: Boolean(input.encrypted),
    createdAt: input.createdAt ?? new Date().toISOString(),
    deletedAt: input.deletedAt ?? null,
    captureId: input.captureId ?? null,
  }
}
