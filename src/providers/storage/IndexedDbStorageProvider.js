import {
  CURRENT_SCHEMA_VERSION,
  DATABASE_NAME,
  STORE_NAMES,
} from '@/database/schemas/schema.js'
import { runMigrations } from '@/database/migrations/index.js'

function toStorableValue(value) {
  // 递归解包 Vue proxy，同时保留 IndexedDB 可直接存储的 Blob/ArrayBuffer。
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value
  if (Array.isArray(value)) return value.map(toStorableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toStorableValue(nestedValue)]),
    )
  }
  return value
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/**
 * 浏览器/Android WebView 共用的 IndexedDB Provider。
 * 页面不得直接使用本类，必须经 Repository 访问。
 */
export class IndexedDbStorageProvider {
  constructor(databaseName = DATABASE_NAME, schemaVersion = CURRENT_SCHEMA_VERSION) {
    this.databaseName = databaseName
    this.schemaVersion = schemaVersion
    this.databasePromise = null
  }

  async open() {
    if (this.databasePromise) return this.databasePromise

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.schemaVersion)

      request.onupgradeneeded = (event) => {
        const database = request.result
        const transaction = request.transaction
        if (!transaction) {
          reject(new Error('IndexedDB upgrade transaction is unavailable'))
          return
        }

        try {
          runMigrations({
            database,
            transaction,
            oldVersion: event.oldVersion,
            newVersion: event.newVersion ?? this.schemaVersion,
          })
        } catch (error) {
          transaction.abort()
          reject(error)
        }
      }

      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        resolve(database)
      }

      request.onerror = () => {
        this.databasePromise = null
        reject(request.error ?? new Error('Unable to open local database'))
      }

      request.onblocked = () => {
        reject(new Error('Database upgrade is blocked by another app window'))
      }
    })

    return this.databasePromise
  }

  /** @param {string} storeName */
  async get(storeName, key) {
    const database = await this.open()
    const store = database.transaction(storeName, 'readonly').objectStore(storeName)
    return requestToPromise(store.get(key))
  }

  /** @param {string} storeName */
  async getAll(storeName) {
    const database = await this.open()
    const store = database.transaction(storeName, 'readonly').objectStore(storeName)
    return requestToPromise(store.getAll())
  }

  /**
   * 在同一个只读事务中取得完整备份快照，避免并发写入导致 metadata 与二进制不一致。
   * 仅在事务完成后返回；Blob 编码和校验必须由调用方在事务外执行。
   * @returns {Promise<{ diaries: unknown[], attachments: unknown[], attachmentBlobs: unknown[], thumbnailBlobs: unknown[], settings: unknown[] }>}
   */
  async readBackupSnapshot() {
    const database = await this.open()
    const storeNames = {
      diaries: STORE_NAMES.DIARIES,
      attachments: STORE_NAMES.ATTACHMENTS,
      attachmentBlobs: STORE_NAMES.ATTACHMENT_BLOBS,
      thumbnailBlobs: STORE_NAMES.THUMBNAIL_BLOBS,
      settings: STORE_NAMES.SETTINGS,
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(Object.values(storeNames), 'readonly')
      const snapshot = {}
      let failure = null

      transaction.oncomplete = () => {
        if (failure) reject(failure)
        else resolve(snapshot)
      }
      transaction.onerror = (event) => {
        failure ??= event.target.error ?? transaction.error ?? new Error('IndexedDB snapshot read failed')
      }
      transaction.onabort = () => reject(
        failure ?? transaction.error ?? new Error('IndexedDB snapshot transaction aborted'),
      )

      try {
        // 所有请求同步排队，不能在事务内等待 Blob.arrayBuffer() 等异步工作。
        for (const [key, storeName] of Object.entries(storeNames)) {
          const request = transaction.objectStore(storeName).getAll()
          request.onsuccess = () => {
            snapshot[key] = request.result
          }
        }
      } catch (error) {
        failure = error
        transaction.abort()
      }
    })
  }

  /**
   * @param {string} storeName
   * @param {string} indexName
   * @param {IDBValidKey | IDBKeyRange} [query]
   */
  async getAllByIndex(storeName, indexName, query) {
    const database = await this.open()
    const store = database.transaction(storeName, 'readonly').objectStore(storeName)
    return requestToPromise(store.index(indexName).getAll(query))
  }

  /** @param {string} storeName */
  async put(storeName, value) {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const request = transaction.objectStore(storeName).put(toStorableValue(value))
      let result

      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'))
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  /**
   * 在同一事务中跨多个 Store 写入，用于附件 metadata + blob 的原子保存。
   * @param {Array<{ storeName: string, value: unknown }>} entries
   */
  async putMany(entries) {
    if (!entries.length) return
    const database = await this.open()
    const storeNames = [...new Set(entries.map((entry) => entry.storeName))]

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, 'readwrite')
      entries.forEach((entry) => {
        transaction.objectStore(entry.storeName).put(toStorableValue(entry.value))
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  /**
   * @param {string} storeName
   * @param {Array<unknown>} values
   */
  async putAll(storeName, values) {
    if (!values.length) return
    const database = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      values.forEach((value) => store.put(toStorableValue(value)))

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  /**
   * 在同一事务中删除全局标签及所有日记（包括草稿和回收站）的引用。
   * 读取事务内的最新记录，只更改目标标签相关的字段。
   */
  async removeTagAndReferences(settingsKey, tagId) {
    const database = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAMES.SETTINGS, STORE_NAMES.DIARIES],
        'readwrite',
      )
      const settings = transaction.objectStore(STORE_NAMES.SETTINGS)
      const diaries = transaction.objectStore(STORE_NAMES.DIARIES)
      let failure = null

      const abort = (error) => {
        failure = error
        transaction.abort()
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(
        failure ?? transaction.error ?? new Error('IndexedDB transaction aborted'),
      )

      const settingRequest = settings.get(settingsKey)
      settingRequest.onsuccess = () => {
        try {
          const record = settingRequest.result
          if (!record) return
          if (!Array.isArray(record.value)) throw new Error('Tag settings must be an array')
          const remaining = record.value.filter((tag) => tag?.id !== tagId)
          if (remaining.length !== record.value.length) {
            settings.put({ ...record, value: remaining })
          }
        } catch (error) {
          abort(error)
        }
      }

      const cursorRequest = diaries.openCursor()
      cursorRequest.onsuccess = () => {
        try {
          const cursor = cursorRequest.result
          if (!cursor) return
          const diary = cursor.value
          if (Array.isArray(diary.tagIds) && diary.tagIds.includes(tagId)) {
            cursor.update({
              ...diary,
              tagIds: diary.tagIds.filter((id) => id !== tagId),
            })
          }
          cursor.continue()
        } catch (error) {
          abort(error)
        }
      }
    })
  }

  /**
   * 用一个事务替换所有用户数据。调用方必须在进入本方法前完成校验。
   * IndexedDB 的事务回滚保证清空和写入不会留下半份导入数据。
   * @param {{ diaries: unknown[], attachments: unknown[], attachmentBlobs: unknown[], thumbnailBlobs: unknown[], settings: unknown[] }} data
   */
  async replaceAll(data) {
    const database = await this.open()
    const storeNames = [
      STORE_NAMES.DIARIES,
      STORE_NAMES.ATTACHMENTS,
      STORE_NAMES.ATTACHMENT_BLOBS,
      STORE_NAMES.THUMBNAIL_BLOBS,
      STORE_NAMES.SETTINGS,
      STORE_NAMES.META,
    ]

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, 'readwrite')
      const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]))

      transaction.onerror = () => reject(transaction.error ?? new Error('导入事务失败'))
      transaction.onabort = () => reject(transaction.error ?? new Error('导入事务已回滚'))
      transaction.oncomplete = () => resolve()

      try {
        storeNames.forEach((name) => stores[name].clear())
        data.diaries.forEach((value) => stores[STORE_NAMES.DIARIES].put(toStorableValue(value)))
        data.attachments.forEach((value) => stores[STORE_NAMES.ATTACHMENTS].put(toStorableValue(value)))
        data.attachmentBlobs.forEach((value) => stores[STORE_NAMES.ATTACHMENT_BLOBS].put(toStorableValue(value)))
        data.thumbnailBlobs.forEach((value) => stores[STORE_NAMES.THUMBNAIL_BLOBS].put(toStorableValue(value)))
        data.settings.forEach((value) => stores[STORE_NAMES.SETTINGS].put(toStorableValue(value)))
        stores[STORE_NAMES.META].put({
          key: 'schemaVersion',
          value: this.schemaVersion,
          updatedAt: new Date().toISOString(),
        })
      } catch (error) {
        transaction.abort()
        reject(error)
      }
    })
  }

  async close() {
    if (!this.databasePromise) return
    const database = await this.databasePromise
    database.close()
    this.databasePromise = null
  }

  /**
   * 在同一事务中跨多个 Store 删除。
   * @param {Array<{ storeName: string, key: IDBValidKey }>} entries
   */
  async deleteMany(entries) {
    if (!entries.length) return
    const database = await this.open()
    const storeNames = [...new Set(entries.map((entry) => entry.storeName))]

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, 'readwrite')
      entries.forEach((entry) => {
        transaction.objectStore(entry.storeName).delete(entry.key)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  /** @param {string} storeName */
  async delete(storeName, key) {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).delete(key)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }
}



