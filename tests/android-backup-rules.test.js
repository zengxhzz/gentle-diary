import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readAndroidFile = (relativePath) =>
  readFileSync(new URL(`../android/app/src/main/${relativePath}`, import.meta.url), 'utf8')

describe('Android private diary backup policy', () => {
  it('disables automatic backup and registers both extraction rule formats', () => {
    const manifest = readAndroidFile('AndroidManifest.xml')
    expect(manifest).toContain('android:allowBackup="false"')
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"')
    expect(manifest).toContain('android:fullBackupContent="@xml/full_backup_content"')
  })

  it('excludes all private and app-external files from cloud and device transfer', () => {
    const rules = readAndroidFile('res/xml/data_extraction_rules.xml')
    for (const sectionName of ['cloud-backup', 'device-transfer']) {
      const section = rules.match(new RegExp(`<${sectionName}>([\\s\\S]*?)</${sectionName}>`))?.[1]
      expect(section).toBeTruthy()
      for (const domain of ['root', 'device_root', 'external']) {
        expect(section).toContain(`<exclude domain="${domain}" path="." />`)
      }
    }
  })

  it('keeps the same exclusions for Android 11 and earlier', () => {
    const rules = readAndroidFile('res/xml/full_backup_content.xml')
    for (const domain of ['root', 'device_root', 'external']) {
      expect(rules).toContain(`<exclude domain="${domain}" path="." />`)
    }
  })
})
