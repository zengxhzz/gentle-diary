import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

// Development-only QA helper. It can attach only to the independent Debug app.
const packageId = 'com.zhuanz1.diary.debug'
const adbPath = process.env.DIARY_ADB_PATH || join(
  process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
  'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb',
)
const expressionIndex = process.argv.indexOf('--eval')
const expression = expressionIndex < 0
  ? '({ url: location.href, title: document.title, buttons: [...document.querySelectorAll("button")].map(node => node.getAttribute("aria-label") || node.textContent.trim()) })'
  : process.argv[expressionIndex + 1]
if (!expression) throw new Error('Missing --eval expression')

function adb(args, serial = null) {
  const result = spawnSync(adbPath, serial ? ['-s', serial, ...args] : args, { encoding: 'utf8', timeout: 15000 })
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim() || 'ADB failed')
  }
  return result.stdout.trim()
}

const devices = adb(['devices']).split(/\r?\n/).slice(1)
  .map(line => line.trim().split(/\s+/))
  .filter(([, status]) => status === 'device')
const serial = process.env.DIARY_ADB_SERIAL || (devices.length === 1 ? devices[0][0] : null)
if (!serial) throw new Error('Select one authorized device with DIARY_ADB_SERIAL')
const pid = adb(['shell', 'pidof', packageId], serial)
if (!/^\d+$/.test(pid)) throw new Error('Open the diary Debug app first')
const port = adb(['forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`], serial)
if (!/^\d+$/.test(port)) throw new Error('ADB did not allocate a debugging port')

let socket
try {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(10000),
  })).json()
  const target = targets.find(item => item.type === 'page' && item.url.startsWith('https://localhost'))
  if (!target) throw new Error('The Debug WebView is not ready')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Debug WebView connection timed out')), 10000)
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve() }, { once: true })
    socket.addEventListener('error', () => {
      clearTimeout(timeout)
      reject(new Error('Cannot connect to Debug WebView'))
    }, { once: true })
  })
  const response = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Debug evaluation timed out')), 60000)
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id !== 1) return
      clearTimeout(timeout)
      resolve(message)
    })
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true },
    }))
  })
  if (response.error || response.result?.exceptionDetails) {
    throw new Error(JSON.stringify(response.error || response.result.exceptionDetails))
  }
  console.log(JSON.stringify(response.result.result.value ?? response.result.result.description))
} finally {
  socket?.close()
  adb(['forward', '--remove', `tcp:${port}`], serial)
}
