import { BackupRepository } from '@/repositories/interfaces/BackupRepository.js'

/** Keeps cross-store transaction details below the Service boundary. */
export class IndexedDbBackupRepository extends BackupRepository {
  constructor(storageProvider) {
    super()
    this.storageProvider = storageProvider
  }

  async readSnapshot() {
    return this.storageProvider.readBackupSnapshot()
  }

  async replaceAll(data) {
    return this.storageProvider.replaceAll(data)
  }
}
