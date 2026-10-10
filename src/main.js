import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { services } from './services/container.js'
import './styles/base.css'

async function bootstrap() {
  try {
    await services.cameraRecoveryService.initialize()
  } catch {
    // 相机恢复初始化失败不应阻止本地日记主界面启动。
  }
  createApp(App).use(router).mount('#app')
}

void bootstrap()
