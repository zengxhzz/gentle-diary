/** Aggregate backup contract: coherent read and atomic replace across user stores. */
export class BackupRepository {
  /** @returns {Promise<{ diaries: object[], attachments: object[], attachmentBlobs: object[], thumbnailBlobs: object[], settings: object[] }>} */
  async readSnapshot() { throw new Error('Not implemented') }

  /** Caller must validate and decode every record before starting replacement. */
  async replaceAll(_data) { throw new Error('Not implemented') }
}
