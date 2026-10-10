<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ThemeSwatch from '@/components/themes/ThemeSwatch.vue'
import { useBackupControls } from '@/composables/useBackupControls.js'
import { services } from '@/services/container.js'
import { toDateKey } from '@/utils/date.js'

const router = useRouter()
const catalog = ref([])
const settings = ref(null)
const currentTheme = ref(null)
const saving = ref(false)
const savedNotice = ref('')
const errorMessage = ref('')
const {
  backupBusy,
  backupNotice,
  backupError,
  importInput,
  importConfirmOpen,
  canShareBackup,
  exportBackup,
  loadExportRecoveryStatus,
  chooseImportFile,
  handleImportFile,
  cancelImport,
  confirmImport,
} = useBackupControls({
  backupService: services.backupService,
  onRestored: async () => {
    settings.value = await services.themeService.getSettings()
    currentTheme.value = await services.themeService.getActiveTheme({ dateKey: toDateKey() })
  },
})

onMounted(async () => {
  void loadExportRecoveryStatus()
  catalog.value = services.themeService.getCatalog()
  settings.value = await services.themeService.getSettings()
  currentTheme.value = await services.themeService.getActiveTheme({ dateKey: toDateKey() })
})

function goBack() {
  void router.push({ name: 'today' })
}

async function savePatch(patch) {
  if (!settings.value || saving.value) return
  saving.value = true
  savedNotice.value = ''
  errorMessage.value = ''

  try {
    settings.value = await services.themeService.saveSettings(patch)
    currentTheme.value = await services.themeService.getActiveTheme({
      dateKey: toDateKey(),
      forceNewLaunch: settings.value.mode === 'random' && settings.value.rotation === 'each_launch',
    })
    savedNotice.value = '已保存'
  } catch (error) {
    errorMessage.value = error?.message ?? '主题设置保存失败'
  } finally {
    saving.value = false
  }
}

function setMode(mode) {
  void savePatch({ mode })
}

function setRotation(rotation) {
  void savePatch({ rotation })
}

function selectFixedTheme(themeId) {
  void savePatch({ mode: 'fixed', fixedThemeId: themeId })
}

function toggleEnabledTheme(themeId) {
  if (!settings.value) return
  if (settings.value.mode === 'fixed') {
    selectFixedTheme(themeId)
    return
  }

  const enabled = new Set(settings.value.enabledThemes)
  if (enabled.has(themeId)) enabled.delete(themeId)
  else enabled.add(themeId)
  if (!enabled.size) return

  void savePatch({ enabledThemes: [...enabled] })
}

</script>

<template>
  <div class="screen">
    <AppHeader title="设置" show-back @back="goBack" />

    <main v-if="settings" class="page-content settings-content">
      <div class="page-intro">
        <p class="page-eyebrow">偏好与数据</p>
        <h2 class="page-title">让日记，更像你。</h2>
        <p class="page-description">调整书写氛围，妥善保管你的记录。</p>
      </div>

      <section class="setting-row" aria-labelledby="appearance-title">
        <div class="setting-heading">
          <div>
            <h2 id="appearance-title">外观</h2>
            <p>首页主题 · 当前使用「{{ currentTheme?.name || '云朵' }}」</p>
          </div>
          <span v-if="savedNotice" class="save-notice" aria-live="polite">{{ savedNotice }}</span>
        </div>

        <div class="segmented-control" role="group" aria-label="主题模式">
          <button type="button" :class="{ active: settings.mode === 'fixed' }" :aria-pressed="settings.mode === 'fixed'" :disabled="saving" @click="setMode('fixed')">固定主题</button>
          <button type="button" :class="{ active: settings.mode === 'random' }" :aria-pressed="settings.mode === 'random'" :disabled="saving" @click="setMode('random')">自动轮换</button>
        </div>

        <div v-if="settings.mode === 'random'" class="rotation-block">
          <p class="sub-label">轮换频率</p>
          <div class="segmented-control segmented-control--small" role="group" aria-label="轮换频率">
            <button type="button" :class="{ active: settings.rotation === 'each_launch' }" :aria-pressed="settings.rotation === 'each_launch'" :disabled="saving" @click="setRotation('each_launch')">每次打开</button>
            <button type="button" :class="{ active: settings.rotation === 'daily' }" :aria-pressed="settings.rotation === 'daily'" :disabled="saving" @click="setRotation('daily')">每天一次</button>
          </div>
        </div>

        <p id="theme-help" class="setting-help">{{ settings.mode === 'fixed' ? '选择一个长期使用的主题。' : '勾选可以参与轮换的主题。' }}</p>

        <div class="theme-grid" role="group" aria-label="首页主题" aria-describedby="theme-help">
          <button
            v-for="theme in catalog"
            :key="theme.id"
            class="theme-option"
            type="button"
            :aria-label="`${theme.name}主题`"
            :aria-pressed="settings.mode === 'fixed' ? settings.fixedThemeId === theme.id : settings.enabledThemes.includes(theme.id)"
            :disabled="saving"
            @click="toggleEnabledTheme(theme.id)"
          >
            <ThemeSwatch :theme="theme" :selected="settings.mode === 'fixed' && settings.fixedThemeId === theme.id" :checked="settings.mode === 'random' && settings.enabledThemes.includes(theme.id)" :check-mode="settings.mode === 'random'" />
          </button>
        </div>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </section>

      <section class="setting-row backup-section" aria-labelledby="backup-title">
        <div class="setting-heading">
          <div>
            <h2 id="backup-title">备份与恢复</h2>
            <p>导出一个包含日记、草稿、设置和图片原文件的 JSON 备份。请妥善保管，备份内容尚未加密。</p>
          </div>
        </div>

        <div class="backup-actions">
          <button class="backup-button backup-button--primary" type="button" :disabled="backupBusy" @click="exportBackup()">
            {{ backupBusy ? '处理中…' : '保存备份文件' }}
          </button>
          <button v-if="canShareBackup" class="backup-button" type="button" :disabled="backupBusy" @click="exportBackup({ method: 'share' })">
            通过其他应用分享
          </button>
          <button class="backup-button backup-button--danger" type="button" :disabled="backupBusy" @click="chooseImportFile">
            导入并恢复
          </button>
          <input
            ref="importInput"
            hidden
            type="file"
            accept="application/json,.json"
            :disabled="backupBusy"
            @change="handleImportFile"
          />
        </div>

        <p class="backup-warning"><strong>导入须知</strong>导入仅支持“替换现有数据”。选择文件后还会再次确认；校验或写入失败时不会改动当前数据库。</p>
        <p v-if="backupNotice" class="backup-notice" role="status" aria-live="polite">{{ backupNotice }}</p>
        <p v-if="backupError" class="error-message" role="alert">{{ backupError }}</p>
      </section>

      <section class="setting-row storage-section" aria-labelledby="storage-title">
        <div class="setting-heading">
          <h2 id="storage-title">数据存储</h2>
          <span class="storage-label">本地优先</span>
        </div>
        <p>日记保存在本机数据库中，离线也能继续书写和查看。</p>
      </section>

      <footer class="settings-footer">
        <span>版本 0.1.0</span>
        <span>让记录留在身边</span>
      </footer>
    </main>

    <ConfirmDialog
      :open="importConfirmOpen"
      title="替换全部本地数据？"
      message="导入会用所选备份替换当前日记、草稿、设置和附件。系统会先完整校验，失败时保留原数据；成功后无法在应用内撤销。"
      confirm-label="确认替换"
      cancel-label="取消"
      danger
      @cancel="cancelImport"
      @confirm="confirmImport"
    />
  </div>
</template>

<style scoped>
.settings-content {
  padding-bottom: calc(var(--safe-bottom) + 3rem);
}

.setting-row {
  padding: var(--space-xl) 0;
  border-top: 1px solid var(--color-border);
}

.setting-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.setting-heading > div {
  min-width: 0;
}

.setting-row h2,
.setting-row p {
  margin: 0;
}

.setting-row h2 {
  color: var(--color-text-primary);
  font-family: var(--font-reading);
  font-size: var(--text-lg);
  font-weight: 500;
  line-height: 1.6;
}

.setting-row p {
  margin-top: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.save-notice,
.storage-label {
  flex-shrink: 0;
  margin-top: 0.3rem;
  color: var(--color-accent-strong);
  font-size: var(--text-xs);
  line-height: 1.8;
}

.segmented-control {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xs);
  margin-top: var(--space-lg);
  padding: var(--space-xs);
  background: var(--color-surface-muted);
  border-radius: var(--radius-sm);
}

.segmented-control button {
  min-width: 0;
  min-height: 2.75rem;
  padding: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
  border-radius: calc(var(--radius-sm) - 3px);
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease;
}

.segmented-control button.active {
  color: var(--color-accent-strong);
  font-weight: 500;
  background: var(--color-surface);
  box-shadow: 0 1px 4px rgba(52, 69, 63, 0.07);
}

.segmented-control--small {
  max-width: 20rem;
  margin-top: var(--space-sm);
}

.rotation-block {
  margin-top: var(--space-lg);
}

.setting-row .sub-label {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.setting-row .setting-help {
  margin-top: var(--space-lg);
  font-size: var(--text-xs);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
  margin-top: var(--space-md);
}

.theme-option {
  min-width: 0;
  min-height: 2.75rem;
  padding: 0;
  text-align: left;
  border-radius: var(--radius-sm);
}

.theme-option:focus-visible,
.segmented-control button:focus-visible,
.backup-button:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--color-accent-strong);
  outline-offset: 3px;
}

.segmented-control button:disabled,
.theme-option:disabled,
.backup-button:disabled {
  cursor: default;
  opacity: 0.6;
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.backup-button {
  min-width: 0;
  min-height: 2.75rem;
  max-width: 100%;
  padding: 0.65rem var(--space-lg);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
  transition:
    background-color var(--duration-fast) ease,
    border-color var(--duration-fast) ease;
}

.backup-button--primary {
  color: var(--color-surface);
  font-weight: 500;
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.backup-button--danger {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 28%, var(--color-surface));
}

.backup-button:not(:disabled):active {
  background: var(--color-surface-muted);
}

.backup-button--primary:not(:disabled):active {
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
}

.setting-row .backup-warning {
  margin-top: var(--space-lg);
  padding: var(--space-md);
  font-size: var(--text-xs);
  background: color-mix(in srgb, var(--color-danger) 4%, var(--color-surface));
  border-left: 2px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-surface));
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.backup-warning strong {
  display: block;
  margin-bottom: var(--space-xs);
  color: var(--color-danger);
  font-weight: 500;
}

.setting-row .backup-notice,
.setting-row .error-message {
  margin-top: var(--space-md);
  font-size: var(--text-xs);
}

.setting-row .backup-notice {
  color: var(--color-accent-strong);
}

.setting-row .error-message {
  color: var(--color-danger);
}

.settings-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm) var(--space-lg);
  padding-top: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.8;
  border-top: 1px solid var(--color-border);
}

@media (hover: hover) {
  .segmented-control button:not(.active):not(:disabled):hover {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-surface) 50%, transparent);
  }

  .theme-option:not(:disabled):hover :deep(.theme-swatch) {
    border-color: var(--color-accent-strong);
  }

  .backup-button:not(.backup-button--primary):not(:disabled):hover {
    background: var(--color-surface-muted);
  }

  .backup-button--primary:not(:disabled):hover {
    background: var(--color-text-primary);
    border-color: var(--color-text-primary);
  }
}

@media (min-width: 34rem) {
  .theme-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 24rem) {
  .backup-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .backup-button {
    width: 100%;
  }
}
</style>
