export const DATABASE_NAME = 'gentle-diary-local'
export const CURRENT_SCHEMA_VERSION = 3

export const STORE_NAMES = {
  META: 'meta',
  DIARIES: 'diaries',
  ATTACHMENTS: 'attachments',
  ATTACHMENT_BLOBS: 'attachment_blobs',
  THUMBNAIL_BLOBS: 'thumbnail_blobs',
  SETTINGS: 'settings',
}

export const INDEX_NAMES = {
  DIARY_DATE: 'by_diaryDate',
  UPDATED_AT: 'by_updatedAt',
  DELETED_AT: 'by_deletedAt',
  ATTACHMENT_DIARY_ID: 'by_diaryId',
}


