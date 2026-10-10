import { BrowserDeviceIdentityProvider } from '@/providers/storage/BrowserDeviceIdentityProvider.js'
import { IndexedDbStorageProvider } from '@/providers/storage/IndexedDbStorageProvider.js'
import { CapacitorMediaProvider } from '@/providers/media/CapacitorMediaProvider.js'
import { CapacitorFilesystemAttachmentProvider } from '@/providers/media/CapacitorFilesystemAttachmentProvider.js'
import { PlatformBackupFileProvider } from '@/providers/backup/PlatformBackupFileProvider.js'
import { IndexedDbAttachmentDataProvider } from '@/providers/media/IndexedDbAttachmentDataProvider.js'
import { IndexedDbAttachmentRepository } from '@/repositories/local/IndexedDbAttachmentRepository.js'
import { IndexedDbBackupRepository } from '@/repositories/local/IndexedDbBackupRepository.js'
import { IndexedDbDiaryRepository } from '@/repositories/local/IndexedDbDiaryRepository.js'
import { IndexedDbSettingsRepository } from '@/repositories/local/IndexedDbSettingsRepository.js'
import { AttachmentService } from '@/services/media/AttachmentService.js'
import { CameraRecoveryService } from '@/services/media/CameraRecoveryService.js'
import { BackupService } from '@/services/backup/BackupService.js'
import { DiaryService } from '@/services/diary/DiaryService.js'
import { DeviceIdentityService } from '@/services/device/DeviceIdentityService.js'
import { DecorationThemeService } from '@/services/theme/DecorationThemeService.js'
import { TagService } from '@/services/tag/TagService.js'

const storageProvider = new IndexedDbStorageProvider()
const diaryRepository = new IndexedDbDiaryRepository(storageProvider)
const attachmentRepository = new IndexedDbAttachmentRepository(storageProvider)
const settingsRepository = new IndexedDbSettingsRepository(storageProvider)
const backupRepository = new IndexedDbBackupRepository(storageProvider)
const deviceIdentityService = new DeviceIdentityService(new BrowserDeviceIdentityProvider())
const mediaProvider = new CapacitorMediaProvider()
const indexedDbAttachmentDataProvider = new IndexedDbAttachmentDataProvider(attachmentRepository)
const attachmentDataProvider = new CapacitorFilesystemAttachmentProvider(
  indexedDbAttachmentDataProvider,
)
const backupFileProvider = new PlatformBackupFileProvider()

const attachmentService = new AttachmentService(
  attachmentRepository,
  mediaProvider,
  attachmentDataProvider,
)
const diaryService = new DiaryService(diaryRepository, deviceIdentityService, attachmentService)
const cameraRecoveryService = new CameraRecoveryService({
  mediaProvider,
  attachmentDataProvider,
  attachmentService,
  diaryService,
  diaryRepository,
})
const backupService = new BackupService({
  backupRepository,
  attachmentService,
  backupFileProvider,
})

export const services = Object.freeze({
  storageProvider,
  diaryRepository,
  attachmentRepository,
  settingsRepository,
  backupRepository,
  deviceIdentityService,
  mediaProvider,
  diaryService,
  attachmentService,
  backupFileProvider,
  cameraRecoveryService,
  backupService,
  tagService: new TagService(settingsRepository),
  themeService: new DecorationThemeService(settingsRepository),
})



