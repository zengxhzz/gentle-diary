import { describe, expect, it, vi } from 'vitest'
import { AttachmentService } from '@/services/media/AttachmentService.js'

function createContext() {
  const repository = {
    findById: vi.fn(async () => ({ id: 'shared-photo' })),
  }
  const dataProvider = { delete: vi.fn(async () => undefined) }
  const service = new AttachmentService(repository, {}, dataProvider)
  return { service, repository, dataProvider }
}

describe('attachment cleanup after deleting an image Block', () => {
  it('keeps binary data while a second Block still references the attachment', async () => {
    const { service, repository, dataProvider } = createContext()
    const savedDiary = {
      blocks: [{ type: 'image', attachmentId: 'shared-photo' }],
      attachmentIds: ['shared-photo'],
    }

    expect(await service.removeIfUnreferenced('shared-photo', savedDiary)).toBe(false)
    expect(repository.findById).not.toHaveBeenCalled()
    expect(dataProvider.delete).not.toHaveBeenCalled()
  })

  it('deletes both attachment variants after the final reference was saved away', async () => {
    const { service, dataProvider } = createContext()
    const savedDiary = { blocks: [{ type: 'paragraph', text: 'remaining' }], attachmentIds: [] }

    expect(await service.removeIfUnreferenced('shared-photo', savedDiary)).toBe(true)
    expect(dataProvider.delete).toHaveBeenCalledWith({ id: 'shared-photo' })
  })

  it('refuses deletion without a complete saved diary snapshot', async () => {
    const { service, dataProvider } = createContext()

    await expect(service.removeIfUnreferenced('shared-photo', null))
      .rejects.toThrow('请先保存日记')
    expect(dataProvider.delete).not.toHaveBeenCalled()
  })
})
