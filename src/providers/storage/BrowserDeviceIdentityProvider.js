let memoryDeviceId = null

export class BrowserDeviceIdentityProvider {
  constructor(storageKey = 'gentle-diary.deviceId') {
    this.storageKey = storageKey
  }

  get() {
    try {
      return globalThis.localStorage?.getItem(this.storageKey) ?? memoryDeviceId
    } catch {
      return memoryDeviceId
    }
  }

  /** @param {string} value */
  set(value) {
    memoryDeviceId = value
    try {
      globalThis.localStorage?.setItem(this.storageKey, value)
    } catch {
      // 私密模式下 localStorage 可能不可用，内存标识仍可保证当前会话正常。
    }
  }
}
