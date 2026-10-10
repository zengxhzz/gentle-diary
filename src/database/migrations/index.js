import {
  CURRENT_SCHEMA_VERSION,
  INDEX_NAMES,
  STORE_NAMES,
} from '@/database/schemas/schema.js'

/**
 * @typedef {Object} Migration
 * @property {number} version
 * @property {(context: { database: IDBDatabase, transaction: IDBTransaction }) => void} upgrade
 */

/** @type {Migration[]} */
export const migrations = [
  {
    version: 1,
    upgrade({ database }) {
      database.createObjectStore(STORE_NAMES.META, { keyPath: 'key' })

      const diaries = database.createObjectStore(STORE_NAMES.DIARIES, { keyPath: 'id' })
      diaries.createIndex(INDEX_NAMES.DIARY_DATE, 'diaryDate', { unique: false })
      diaries.createIndex(INDEX_NAMES.UPDATED_AT, 'updatedAt', { unique: false })
      diaries.createIndex(INDEX_NAMES.DELETED_AT, 'deletedAt', { unique: false })

      const attachments = database.createObjectStore(STORE_NAMES.ATTACHMENTS, { keyPath: 'id' })
      attachments.createIndex(INDEX_NAMES.ATTACHMENT_DIARY_ID, 'diaryId', { unique: false })

      database.createObjectStore(STORE_NAMES.SETTINGS, { keyPath: 'key' })
    },
  },
  {
    version: 2,
    upgrade({ database }) {
      database.createObjectStore(STORE_NAMES.ATTACHMENT_BLOBS, { keyPath: 'attachmentId' })
    },
  },
  {
    version: 3,
    upgrade({ database }) {
      database.createObjectStore(STORE_NAMES.THUMBNAIL_BLOBS, { keyPath: 'attachmentId' })
    },
  },
]

/**
 * 按版本顺序执行迁移。已发布迁移必须只追加，不修改历史迁移。
 * @param {{ database: IDBDatabase, transaction: IDBTransaction, oldVersion: number, newVersion: number }} context
 */
export function runMigrations({ database, transaction, oldVersion, newVersion }) {
  for (const migration of migrations) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.upgrade({ database, transaction })
    }
  }

  transaction.objectStore(STORE_NAMES.META).put({
    key: 'schemaVersion',
    value: newVersion,
    updatedAt: new Date().toISOString(),
  })
}

export function assertKnownSchemaVersion(version) {
  if (!Number.isInteger(version) || version < 1 || version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported database schema version: ${version}`)
  }
}

