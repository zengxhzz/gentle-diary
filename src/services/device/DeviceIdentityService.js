import { createId } from '@/utils/id.js'

export class DeviceIdentityService {
  /** @param {import('../../providers/storage/BrowserDeviceIdentityProvider.js').BrowserDeviceIdentityProvider} provider */
  constructor(provider) {
    this.provider = provider
  }

  getDeviceId() {
    const existing = this.provider.get()
    if (existing) return existing
    const deviceId = createId('device')
    this.provider.set(deviceId)
    return deviceId
  }
}
