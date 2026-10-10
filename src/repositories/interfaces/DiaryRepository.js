/**
 * Diary Repository 契约。上层 Service 只依赖此接口语义。
 * @interface
 */
export class DiaryRepository {
  async findById(_id) { throw new Error('Not implemented') }
  async findActiveByDate(_diaryDate) { throw new Error('Not implemented') }
  async findLatestDraft() { throw new Error('Not implemented') }
  async listAll() { throw new Error('Not implemented') }
  async save(_diary) { throw new Error('Not implemented') }
  async deletePermanently(_id) { throw new Error('Not implemented') }
}
