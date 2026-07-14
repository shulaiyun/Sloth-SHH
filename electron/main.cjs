const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, safeStorage, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const crypto = require('node:crypto')
const { Client } = require('ssh2')

let window
const sshSessions = new Map()
let lastSessionId
const translationCache = new Map()

app.name = 'SlothSSH'
app.setName('SlothSSH')
app.setAppUserModelId('com.slothssh.desktop')
const brandIconPath = path.join(__dirname, 'assets', 'slothssh-icon.png')

const hostsPath = () => path.join(app.getPath('userData'), 'hosts.json')
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')
const legacyHostsPath = () => path.join(app.getPath('appData'), 'nimbus-ssh', 'hosts.json')

const defaultSettings = {
  translationProvider: 'free',
  translationFailureDelay: 15,
  baiduAppId: '',
  baiduSecretSecret: '',
  tencentSecretId: '',
  tencentSecretKeySecret: '',
  tencentRegion: 'ap-guangzhou',
  aliyunAccessKeyId: '',
  aliyunAccessKeySecretSecret: '',
  openaiPreset: 'deepseek',
  openaiBaseUrl: 'https://api.deepseek.com',
  openaiModel: 'deepseek-v4-flash',
  openaiApiKeySecret: '',
}

async function readHostRecords() {
  try {
    const data = JSON.parse(await fs.readFile(hostsPath(), 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    try {
      const legacy = JSON.parse(await fs.readFile(legacyHostsPath(), 'utf8'))
      if (Array.isArray(legacy) && legacy.length) {
        await writeHostRecords(legacy)
        return legacy
      }
    } catch { /* no legacy configuration */ }
    return []
  }
}

async function writeHostRecords(hosts) {
  await fs.mkdir(path.dirname(hostsPath()), { recursive: true })
  await fs.writeFile(hostsPath(), JSON.stringify(hosts, null, 2), { mode: 0o600 })
}

async function readSettings() {
  try {
    const settings = { ...defaultSettings, ...JSON.parse(await fs.readFile(settingsPath(), 'utf8')) }
    if (settings.translationProvider === 'free' && Number(settings.translationFailureDelay) < 15) settings.translationFailureDelay = 15
    return settings
  } catch {
    return { ...defaultSettings }
  }
}

async function writeSettings(settings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true })
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), { mode: 0o600 })
}

function publicSettings(settings) {
  const {
    baiduSecretSecret,
    tencentSecretKeySecret,
    aliyunAccessKeySecretSecret,
    openaiApiKeySecret,
    ...safe
  } = settings
  return {
    ...safe,
    hasBaiduSecret: Boolean(baiduSecretSecret),
    hasTencentSecretKey: Boolean(tencentSecretKeySecret),
    hasAliyunAccessKeySecret: Boolean(aliyunAccessKeySecretSecret),
    hasOpenaiApiKey: Boolean(openaiApiKeySecret),
  }
}

function encryptSecret(value) {
  if (!value) return ''
  if (safeStorage.isEncryptionAvailable()) {
    return `safe:${safeStorage.encryptString(value).toString('base64')}`
  }
  return `local:${Buffer.from(value, 'utf8').toString('base64')}`
}

function decryptSecret(value) {
  if (!value) return ''
  try {
    if (value.startsWith('safe:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(5), 'base64'))
    }
    if (value.startsWith('local:')) {
      return Buffer.from(value.slice(6), 'base64').toString('utf8')
    }
  } catch {
    return ''
  }
  return ''
}

function publicHost(host) {
  const { passwordSecret, passphraseSecret, ...safe } = host
  return {
    ...safe,
    hasPassword: Boolean(passwordSecret),
    hasPassphrase: Boolean(passphraseSecret),
  }
}

async function listHosts() {
  return (await readHostRecords()).map(publicHost)
}

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
}

function diagnoseSshFailure(error, context = {}) {
  const original = String(error?.message || error || '未知错误').trim()
  const raw = original.toLowerCase()
  const authType = context.authType === 'key' ? 'key' : 'password'
  let code = String(error?.code || 'CONNECTION_ERROR')
  let title = 'SSH 连接失败'
  let message = '服务器没有完成 SSH 连接。'
  let suggestions = ['检查服务器地址、SSH 端口和当前网络', '确认服务器的 SSH 服务正在运行']

  if (/authentication methods failed|authentication failed|permission denied|all configured authentication methods failed/.test(raw) || error?.level === 'client-authentication') {
    code = authType === 'key' ? 'KEY_AUTH_FAILED' : 'PASSWORD_AUTH_FAILED'
    title = authType === 'key' ? '密钥认证失败' : '用户名或密码错误'
    message = `已成功连到 ${context.host || '服务器'}:${context.port || 22}，但服务器拒绝了${authType === 'key' ? '当前私钥' : '当前用户名或密码'}。`
    suggestions = authType === 'key'
      ? ['确认选择了正确的私钥文件', '检查私钥口令和服务器 authorized_keys', '确认该用户允许使用密钥登录']
      : ['重新输入并保存服务器密码', '检查用户名是否正确', '确认服务器允许密码登录，root 用户可能被禁止']
  } else if (error?.code === 'ECONNREFUSED' || /connection refused/.test(raw)) {
    code = 'PORT_REFUSED'
    title = 'SSH 端口被拒绝'
    message = `${context.host || '服务器'}:${context.port || 22} 可以到达，但该端口没有接受 SSH 连接。`
    suggestions = ['检查 SSH 端口是否填错，常见默认端口为 22', '确认 sshd 服务正在运行并监听该端口', '检查防火墙和云安全组']
  } else if (error?.code === 'ENOTFOUND' || /getaddrinfo|not known|name or service/.test(raw)) {
    code = 'HOST_NOT_FOUND'
    title = '服务器地址无法解析'
    message = `找不到“${context.host || '当前主机'}”对应的 IP 地址。`
    suggestions = ['检查主机名或 IP 是否拼写错误', '如果使用域名，检查 DNS 和当前网络', '可直接改用服务器公网 IP 测试']
  } else if (error?.code === 'ENETUNREACH' || error?.code === 'EHOSTUNREACH' || /network is unreachable|no route to host/.test(raw)) {
    code = 'NETWORK_UNREACHABLE'
    title = '网络无法到达服务器'
    message = '当前电脑到服务器没有可用的网络路径。'
    suggestions = ['检查本机网络、VPN 或代理路由', '确认服务器公网 IP 仍然有效', '检查云平台网络和安全组']
  } else if (error?.code === 'ETIMEDOUT' || /timed? ?out|timeout/.test(raw)) {
    code = 'CONNECTION_TIMEOUT'
    title = '连接服务器超时'
    message = context.phase === 'authentication'
      ? '网络和 SSH 握手已通，但认证阶段长时间没有完成。'
      : `在限定时间内未收到 ${context.host || '服务器'}:${context.port || 22} 的 SSH 响应。`
    suggestions = ['检查 IP 和端口是否正确', '检查防火墙、安全组或运营商是否丢弃了该端口', '如果开启全局代理或 TUN，尝试让 SSH 端口直连']
  } else if (/protocol error|bad identification|identification string|invalid greeting/.test(raw)) {
    code = 'NOT_SSH_SERVICE'
    title = '目标端口不是 SSH 服务'
    message = `${context.host || '服务器'}:${context.port || 22} 有服务响应，但返回的不是标准 SSH 协议。`
    suggestions = ['检查是否把 Web、面板或其他服务端口当成了 SSH 端口', '在服务器上查看 sshd 实际监听端口', '修正连接信息后重试']
  } else if (authType === 'key' && /private\s*key|cannot parse|unsupported key/.test(raw)) {
    code = 'INVALID_PRIVATE_KEY'
    title = 'SSH 私钥格式无法识别'
    message = '已读取私钥文件，但其格式、加密方式或口令不被接受。'
    suggestions = ['确认选择的是私钥而不是 .pub 公钥', '检查私钥口令', '必要时转换为 OpenSSH 或 PEM 私钥格式']
  } else if (/no matching|handshake failed|kex|cipher|host key algorithm/.test(raw)) {
    code = 'SSH_ALGORITHM_MISMATCH'
    title = 'SSH 加密算法不兼容'
    message = '网络和端口可能正常，但客户端与服务器没有共同的 SSH 算法。'
    suggestions = ['升级服务器 OpenSSH 配置', '检查服务器是否只启用了过时算法', '复制下方原始错误便于管理员排查']
  } else if (error?.code === 'ECONNRESET' || /connection reset|socket closed|connection lost|remote host closed/.test(raw)) {
    code = 'CONNECTION_RESET'
    title = '服务器中途断开连接'
    message = '已经连到目标，但服务器或中间网络主动关闭了连接。'
    suggestions = ['检查 sshd 日志和 Fail2ban 等安全规则', '检查用户登录限制和连接数限制', '确认连接的确实是 SSH 端口']
  } else if (context.phase === 'shell') {
    code = 'SHELL_START_FAILED'
    title = '认证成功，但终端启动失败'
    message = '用户名和凭据已通过，但服务器没有允许启动交互式 Shell。'
    suggestions = ['检查用户的默认 Shell 是否有效', '检查 sshd_config 的 ForceCommand 和 PermitTTY', '检查用户账号是否被锁定']
  } else if (context.phase === 'session') {
    code = code === 'CONNECTION_ERROR' ? 'SESSION_ERROR' : code
    title = '已连接的终端会话发生异常'
    message = 'SSH 认证和终端均已启动，但会话在使用过程中发生了异常。'
    suggestions = ['重新连接服务器', '检查服务器 sshd 和系统日志', '检查网络或代理是否中途断开长连接']
  }

  return {
    state: 'error',
    code,
    title,
    message,
    suggestions,
    original,
    hostId: context.hostId,
    host: context.host,
    port: context.port,
    username: context.username,
    phase: context.phase || 'network',
    occurredAt: new Date().toISOString(),
    persistent: true,
  }
}

function disconnect(sessionId) {
  if (!sessionId) {
    for (const id of [...sshSessions.keys()]) disconnect(id)
    return
  }
  const session = sshSessions.get(sessionId)
  if (!session) return
  sshSessions.delete(sessionId)
  if (lastSessionId === sessionId) lastSessionId = [...sshSessions.keys()].at(-1)
  try { session.stream?.end() } catch { /* already closed */ }
  try { session.client?.end() } catch { /* already closed */ }
}

function getSession(sessionId) {
  const session = sshSessions.get(sessionId || lastSessionId)
  if (!session) throw new Error('请先连接服务器')
  return session
}

function getSftp(sessionId) {
  let session
  try { session = getSession(sessionId) } catch (error) { return Promise.reject(error) }
  if (session.sftp) return Promise.resolve(session.sftp)
  return new Promise((resolve, reject) => {
    session.client.sftp((error, channel) => {
      if (error) return reject(new Error(`SFTP 启动失败：${error.message}`))
      session.sftp = channel
      channel.once('close', () => { if (session.sftp === channel) session.sftp = undefined })
      resolve(channel)
    })
  })
}

function execRemote(sessionId, command) {
  let session
  try { session = getSession(sessionId) } catch (error) { return Promise.reject(error) }
  return new Promise((resolve, reject) => {
    session.client.exec(command, (error, channel) => {
      if (error) return reject(error)
      let output = ''
      let stderr = ''
      channel.setEncoding('utf8')
      channel.on('data', (chunk) => { output += chunk })
      channel.stderr.setEncoding('utf8')
      channel.stderr.on('data', (chunk) => { stderr += chunk })
      channel.on('close', (code) => code === 0 || output ? resolve(output) : reject(new Error(stderr.trim() || `远程命令退出码 ${code}`)))
      channel.on('error', reject)
    })
  })
}

const sftpCall = (channel, method, ...args) => new Promise((resolve, reject) => {
  channel[method](...args, (error, value) => error ? reject(error) : resolve(value))
})

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`

async function remotePathExists(channel, remotePath) {
  try {
    await sftpCall(channel, 'lstat', remotePath)
    return true
  } catch (error) {
    if (error?.code === 2) return false
    throw error
  }
}

async function removeRemoteTree(channel, remotePath) {
  const attrs = await sftpCall(channel, 'lstat', remotePath)
  if (!attrs.isDirectory()) {
    await sftpCall(channel, 'unlink', remotePath)
    return
  }
  const items = await sftpCall(channel, 'readdir', remotePath)
  for (const item of items) {
    if (item.filename === '.' || item.filename === '..') continue
    await removeRemoteTree(channel, path.posix.join(remotePath, item.filename))
  }
  await sftpCall(channel, 'rmdir', remotePath)
}

function createWindow() {
  window = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#080b10',
    icon: brandIconPath,
    title: 'SlothSSH',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) window.loadURL(devUrl)
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(brandIconPath)
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'SlothSSH', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]))
  } else {
    Menu.setApplicationMenu(null)
  }
  app.setAboutPanelOptions({
    applicationName: 'SlothSSH',
    applicationVersion: app.getVersion(),
    copyright: 'SlothSSH Server Manager',
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  disconnect()
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('hosts:list', listHosts)
ipcMain.handle('hosts:save', async (_event, host) => {
  const hosts = await readHostRecords()
  const index = hosts.findIndex((item) => item.id === host.id)
  const previous = index >= 0 ? hosts[index] : {}
  const authType = host.authType === 'key' ? 'key' : 'password'
  const clean = {
    ...previous,
    id: host.id || crypto.randomUUID(),
    name: String(host.name || host.hostname).trim(),
    hostname: String(host.hostname).trim(),
    port: Number(host.port) || 22,
    username: String(host.username).trim(),
    authType,
    privateKeyPath: authType === 'key' ? String(host.privateKeyPath || '') : '',
    group: String(host.group || '我的主机').trim(),
    notes: String(host.notes || '').trim(),
    color: String(host.color || '#7c8cff'),
    favorite: Boolean(host.favorite),
    updatedAt: new Date().toISOString(),
  }

  if (Object.hasOwn(host, 'password')) {
    clean.passwordSecret = host.password ? encryptSecret(String(host.password)) : ''
  }
  if (Object.hasOwn(host, 'passphrase')) {
    clean.passphraseSecret = host.passphrase ? encryptSecret(String(host.passphrase)) : ''
  }

  if (index >= 0) hosts[index] = clean
  else hosts.push(clean)
  await writeHostRecords(hosts)
  return publicHost(clean)
})

ipcMain.handle('hosts:remove', async (_event, id) => {
  for (const [sessionId, session] of sshSessions) {
    if (session.hostId === id) disconnect(sessionId)
  }
  await writeHostRecords((await readHostRecords()).filter((host) => host.id !== id))
  return true
})

ipcMain.handle('hosts:favorite', async (_event, id, favorite) => {
  const hosts = await readHostRecords()
  const host = hosts.find((item) => item.id === id)
  if (!host) return null
  host.favorite = Boolean(favorite)
  await writeHostRecords(hosts)
  return publicHost(host)
})

ipcMain.handle('credentials:reveal', async (_event, id) => {
  const host = (await readHostRecords()).find((item) => item.id === id)
  if (!host) return { password: '', passphrase: '' }
  return {
    password: decryptSecret(host.passwordSecret),
    passphrase: decryptSecret(host.passphraseSecret),
  }
})

ipcMain.handle('credentials:copy', async (_event, id) => {
  const host = (await readHostRecords()).find((item) => item.id === id)
  const password = decryptSecret(host?.passwordSecret)
  if (!password) return false
  clipboard.writeText(password)
  return true
})

ipcMain.handle('clipboard:read-text', () => clipboard.readText())
ipcMain.handle('clipboard:write-text', (_event, value) => {
  clipboard.writeText(String(value || ''))
  return true
})

ipcMain.handle('dialog:private-key', async () => {
  const result = await dialog.showOpenDialog(window, {
    title: '选择 SSH 私钥',
    properties: ['openFile', 'showHiddenFiles'],
  })
  return result.canceled ? '' : result.filePaths[0]
})

ipcMain.handle('settings:translation:get', async () => publicSettings(await readSettings()))
ipcMain.handle('settings:translation:save', async (_event, input) => {
  const settings = await readSettings()
  const provider = ['free', 'google', 'baidu', 'tencent', 'aliyun', 'openai'].includes(input.translationProvider)
    ? input.translationProvider
    : 'free'
  settings.translationProvider = provider
  const requestedDelay = Number(input.translationFailureDelay) || defaultSettings.translationFailureDelay
  settings.translationFailureDelay = Math.min(30, Math.max(provider === 'free' ? 15 : 3, requestedDelay))
  settings.baiduAppId = String(input.baiduAppId || '').trim()
  settings.tencentSecretId = String(input.tencentSecretId || '').trim()
  settings.tencentRegion = String(input.tencentRegion || '').trim() || defaultSettings.tencentRegion
  settings.aliyunAccessKeyId = String(input.aliyunAccessKeyId || '').trim()
  settings.openaiPreset = String(input.openaiPreset || '').trim() || 'custom'
  settings.openaiBaseUrl = String(input.openaiBaseUrl || '').trim() || defaultSettings.openaiBaseUrl
  settings.openaiModel = String(input.openaiModel || '').trim() || defaultSettings.openaiModel
  if (input.baiduSecret) settings.baiduSecretSecret = encryptSecret(String(input.baiduSecret))
  if (input.tencentSecretKey) settings.tencentSecretKeySecret = encryptSecret(String(input.tencentSecretKey))
  if (input.aliyunAccessKeySecret) settings.aliyunAccessKeySecretSecret = encryptSecret(String(input.aliyunAccessKeySecret))
  if (input.openaiApiKey) settings.openaiApiKeySecret = encryptSecret(String(input.openaiApiKey))
  await writeSettings(settings)
  return publicSettings(settings)
})

ipcMain.handle('system:open-external', async (_event, rawUrl) => {
  const url = new URL(String(rawUrl || ''))
  const allowedHosts = new Set([
    'api.fanyi.baidu.com',
    'cloud.tencent.com',
    'console.cloud.tencent.com',
    'help.aliyun.com',
    'bailian.console.aliyun.com',
    'api-docs.deepseek.com',
    'platform.deepseek.com',
    'platform.openai.com',
    'docs.bigmodel.cn',
    'open.bigmodel.cn',
    'docs.siliconflow.cn',
    'cloud.siliconflow.cn',
    'ram.console.aliyun.com',
  ])
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw new Error('不允许打开该外部链接')
  await shell.openExternal(url.toString())
  return true
})

ipcMain.handle('translate:text:legacy', async (_event, rawText) => {
  const text = String(rawText || '').trim()
  if (!text) return { ok: false, error: '没有需要翻译的内容' }
  if (text.length > 250000) return { ok: false, error: '终端内容超过 25 万字符，请选中需要翻译的部分' }

  const chunks = []
  let remaining = text
  while (remaining) {
    let end = Math.min(3200, remaining.length)
    if (end < remaining.length) {
      const newline = remaining.lastIndexOf('\n', end)
      const space = remaining.lastIndexOf(' ', end)
      const boundary = Math.max(newline, space)
      if (boundary > 1800) end = boundary + 1
    }
    chunks.push(remaining.slice(0, end))
    remaining = remaining.slice(end)
  }

  const settings = await readSettings()
  const provider = settings.translationProvider || 'free'

  const translateFreeSegment = async (segment) => {
    const mirrors = ['https://translate.fedilab.app/translate', 'https://translate.cutie.dating/translate']
    let lastError
    for (const endpoint of mirrors) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await net.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: segment, source: 'en', target: 'zh', format: 'text' }),
          signal: controller.signal,
        })
        const data = await response.json()
        if (response.ok && data?.translatedText) return data.translatedText.trim()
        lastError = new Error(data?.error || `公共翻译节点返回 ${response.status}`)
      } catch (error) {
        lastError = error
      } finally {
        clearTimeout(timer)
      }
    }

    const memoryUrl = new URL('https://api.mymemory.translated.net/get')
    memoryUrl.searchParams.set('q', segment)
    memoryUrl.searchParams.set('langpair', 'en|zh-CN')
    memoryUrl.searchParams.set('mt', '1')
    try {
      const response = await net.fetch(memoryUrl.toString())
      const data = await response.json()
      const translated = data?.responseData?.translatedText?.trim()
      if (response.ok && Number(data?.responseStatus) === 200 && translated) return translated
      lastError = new Error(data?.responseDetails || `MyMemory 返回 ${response.status}`)
    } catch (error) {
      lastError = error
    }
    throw lastError || new Error('免费翻译线路暂时不可用')
  }

  const translateWithFree = async (chunk) => {
    const lines = chunk.split('\n')
    const translatedLines = new Array(lines.length).fill('')
    const tasks = lines.map((line, index) => ({ line, index })).filter((item) => item.line.trim())
    for (let offset = 0; offset < tasks.length; offset += 4) {
      const batch = tasks.slice(offset, offset + 4)
      const results = await Promise.all(batch.map(async ({ line, index }) => {
        const pieces = []
        let remainingLine = line
        while (remainingLine) {
          let end = Math.min(420, remainingLine.length)
          while (Buffer.byteLength(remainingLine.slice(0, end), 'utf8') > 480 && end > 1) end -= 1
          pieces.push(remainingLine.slice(0, end))
          remainingLine = remainingLine.slice(end)
        }
        const translations = []
        for (const piece of pieces) translations.push(await translateFreeSegment(piece))
        return { index, translated: translations.join('') }
      }))
      for (const result of results) translatedLines[result.index] = result.translated
    }
    return { translated: translatedLines.join('\n'), language: 'en' }
  }

  const translateWithGoogle = async (chunk) => {
    const url = new URL('https://translate.googleapis.com/translate_a/single')
    url.searchParams.set('client', 'gtx')
    url.searchParams.set('sl', 'auto')
    url.searchParams.set('tl', 'zh-CN')
    url.searchParams.set('dt', 't')
    url.searchParams.set('q', chunk)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await net.fetch(url.toString(), { signal: controller.signal })
      if (!response.ok) throw new Error(`翻译服务返回 ${response.status}`)
      const data = await response.json()
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part) => part?.[0] || '').join('')
        : ''
      if (!translated) throw new Error('翻译服务没有返回结果')
      return { translated, language: data?.[2] || 'auto' }
    } finally {
      clearTimeout(timer)
    }
  }

  const translateWithBaidu = async (chunk) => {
    const appId = settings.baiduAppId
    const secret = decryptSecret(settings.baiduSecretSecret)
    if (!appId || !secret) throw new Error('请先在设置中填写百度翻译 APP ID 和密钥')
    const salt = `${Date.now()}${Math.floor(Math.random() * 10000)}`
    const sign = crypto.createHash('md5').update(`${appId}${chunk}${salt}${secret}`).digest('hex')
    const url = new URL('https://fanyi-api.baidu.com/api/trans/vip/translate')
    url.searchParams.set('q', chunk)
    url.searchParams.set('from', 'auto')
    url.searchParams.set('to', 'zh')
    url.searchParams.set('appid', appId)
    url.searchParams.set('salt', salt)
    url.searchParams.set('sign', sign)
    const response = await net.fetch(url.toString())
    if (!response.ok) throw new Error(`百度翻译返回 ${response.status}`)
    const data = await response.json()
    if (data.error_code) throw new Error(`百度翻译错误 ${data.error_code}：${data.error_msg || '请检查接口配置'}`)
    const translated = Array.isArray(data.trans_result)
      ? data.trans_result.map((item) => item.dst || '').join('\n')
      : ''
    if (!translated) throw new Error('百度翻译没有返回结果')
    return { translated, language: data.from || 'auto' }
  }

  const translateWithOpenAI = async (chunk) => {
    const apiKey = decryptSecret(settings.openaiApiKeySecret)
    const baseUrl = String(settings.openaiBaseUrl || '').replace(/\/+$/, '')
    const model = settings.openaiModel
    if (!baseUrl || !model || !apiKey) throw new Error('请先在设置中填写兼容接口地址、模型和 API Key')
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`
    const response = await net.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'Translate terminal output into concise Simplified Chinese. Preserve commands, shell prompts, paths, IP addresses, ports, filenames, flags, code, and line breaks exactly. Return only the translation.' },
          { role: 'user', content: chunk },
        ],
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || `兼容翻译接口返回 ${response.status}`)
    const translated = data?.choices?.[0]?.message?.content?.trim()
    if (!translated) throw new Error('兼容翻译接口没有返回结果')
    const sourceLines = chunk.split('\n')
    const nonEmptySourceLines = sourceLines.filter((line) => line.trim()).length
    const nonEmptyTranslatedLines = translated.split('\n').filter((line) => line.trim()).length
    if (sourceLines.length > 1 && nonEmptySourceLines > 2 && nonEmptyTranslatedLines < nonEmptySourceLines * 0.7) {
      const completedLines = []
      for (const line of sourceLines) {
        if (!line.trim()) completedLines.push('')
        else completedLines.push((await translateWithOpenAI(line)).translated)
      }
      return { translated: completedLines.join('\n'), language: 'auto' }
    }
    return { translated, language: 'auto' }
  }

  const translateChunk = provider === 'free'
    ? translateWithFree
    : provider === 'baidu'
      ? translateWithBaidu
      : provider === 'openai'
        ? translateWithOpenAI
        : translateWithGoogle

  try {
    const translations = []
    let detectedLanguage = 'auto'
    for (const chunk of chunks) {
      const result = await translateChunk(chunk)
      translations.push(result.translated)
      detectedLanguage = result.language || detectedLanguage
    }
    return {
      ok: true,
      translated: translations.join('').trim(),
      detectedLanguage,
      sourceLines: text.split('\n').length,
      sourceCharacters: text.length,
      translatedChunks: chunks.length,
    }
  } catch (error) {
    const message = error.name === 'AbortError' ? '翻译请求超时' : error.message
    return { ok: false, error: message }
  }
})

ipcMain.handle('translate:text', async (_event, rawText) => {
  const text = String(rawText || '').trim()
  if (!text) return { ok: false, error: '没有需要翻译的内容' }
  if (text.length > 250000) return { ok: false, error: '终端内容超过 25 万字符，请选中需要翻译的部分' }

  const settings = await readSettings()
  const provider = settings.translationProvider || 'free'
  const sourceLines = text.split('\n')
  const commandLinePatterns = [
    /^((?:(?:\[[^\]]+@[^\]]+\][#$])|(?:[\w.-]+@[\w.-]+(?::[^#$]*)?[#$]))\s*)(\S.*)$/,
    /^((?:\([^)]+\)\s*)?(?:[\w.-]+@)?[\w.-]+(?::[^#$]*)?[#$]\s+)(\S.*)$/,
    /^(\s*[#$]\s+)(\S.*)$/,
  ]
  const parseShellCommandLine = (line) => {
    const value = String(line || '')
      .replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
    if (!value || value.includes('● SlothSSH 终端已就绪')) return null
    for (const pattern of commandLinePatterns) {
      const match = value.match(pattern)
      if (match) return match
    }
    return null
  }
  const isShellCommandLine = (line) => Boolean(parseShellCommandLine(line))

  const localTerminalTranslation = (line) => {
    const value = line.trim()
    if (value.includes('● SlothSSH 终端已就绪')) return '● SlothSSH 终端已就绪'
    let match
    const scopeName = (scope) => ({ host: '本机', link: '链路', global: '全局', universe: '全局' }[scope] || scope)
    const stateName = (state) => ({ UP: '已启用', DOWN: '已关闭', UNKNOWN: '未知', DORMANT: '休眠' }[state] || state)
    const localizeDate = (date) => String(date)
      .replace(/\bSun\b/g, '周日').replace(/\bMon\b/g, '周一').replace(/\bTue\b/g, '周二')
      .replace(/\bWed\b/g, '周三').replace(/\bThu\b/g, '周四').replace(/\bFri\b/g, '周五').replace(/\bSat\b/g, '周六')
      .replace(/\bJan\b/g, '1月').replace(/\bFeb\b/g, '2月').replace(/\bMar\b/g, '3月').replace(/\bApr\b/g, '4月')
      .replace(/\bMay\b/g, '5月').replace(/\bJun\b/g, '6月').replace(/\bJul\b/g, '7月').replace(/\bAug\b/g, '8月')
      .replace(/\bSep\b/g, '9月').replace(/\bOct\b/g, '10月').replace(/\bNov\b/g, '11月').replace(/\bDec\b/g, '12月')
    const localizeServiceLabel = (label) => String(label)
      .replace(/^Timers$/i, '定时器')
      .replace(/^Shutdown$/i, '关机')
      .replace(/^Exit the Session$/i, '退出会话')
      .replace(/^Paths$/i, '路径单元')
      .replace(/^Sockets$/i, '套接字单元')
      .replace(/^Basic System$/i, '基础系统')
      .replace(/^Main User Target$/i, '用户主目标')
      .replace(/^User Application Slice$/i, '用户应用切片')
      .replace(/^User Slice of UID (\d+)$/i, 'UID $1 的用户切片')
      .replace(/^User Manager for UID (\d+)$/i, 'UID $1 的用户管理器')
      .replace(/^User Runtime Directory (.+)$/i, '用户运行目录 $1')
      .replace(/^D-Bus User Message Bus Socket$/i, 'D-Bus 用户消息总线套接字')
    const translateServiceMessage = (message) => {
      let event
      event = message.match(/^(.+?): Succeeded\.$/i)
      if (event) return `${event[1]}：运行成功`
      event = message.match(/^Stopped target (.+)\.$/i)
      if (event) return `已停止目标：${localizeServiceLabel(event[1])}`
      event = message.match(/^Reached target (.+)\.$/i)
      if (event) return `已到达目标：${localizeServiceLabel(event[1])}`
      event = message.match(/^Created slice (.+)\.$/i)
      if (event) return `已创建切片：${localizeServiceLabel(event[1])}`
      event = message.match(/^Removed slice (.+)\.$/i)
      if (event) return `已移除切片：${localizeServiceLabel(event[1])}`
      event = message.match(/^Closed (.+)\.$/i)
      if (event) return `已关闭：${localizeServiceLabel(event[1])}`
      event = message.match(/^Finished (.+)\.$/i)
      if (event) return `已完成：${localizeServiceLabel(event[1])}`
      event = message.match(/^Stopped (.+)\.$/i)
      if (event) return `已停止：${localizeServiceLabel(event[1])}`
      event = message.match(/^Stopping (.+?)\.{2,3}$/i)
      if (event) return `正在停止：${localizeServiceLabel(event[1])}`
      event = message.match(/^Started (.+)\.$/i)
      if (event) return `已启动：${localizeServiceLabel(event[1])}`
      event = message.match(/^Starting (.+?)\.{2,3}$/i)
      if (event) return `正在启动：${localizeServiceLabel(event[1])}`
      event = message.match(/^Listening on (.+)\.$/i)
      if (event) return `正在监听：${localizeServiceLabel(event[1])}`
      event = message.match(/^Queued start job for default target (.+)\.$/i)
      if (event) return `已为默认目标加入启动任务：${localizeServiceLabel(event[1])}`
      event = message.match(/^Mounted (.+)\.$/i)
      if (event) return `已挂载：${event[1]}`
      event = message.match(/^Unmounted (.+)\.$/i)
      if (event) return `已卸载：${event[1]}`
      return ''
    }
    const describeShellCommand = (command) => {
      const normalized = String(command).trim().replace(/^sudo\s+/, '')
      if (/^ip\s+-br\s+(?:a|addr|address)\b[\s\S]*&&[\s\S]*ip\s+route\b[\s\S]*\|\|\s*ifconfig\b/i.test(normalized)) {
        return '查看简要网卡地址和路由信息；ip 命令不可用时改用 ifconfig'
      }
      if (/^ip\s+-br\s+(?:a|addr|address)\b/i.test(normalized)) return '以简洁格式查看网卡和 IP 地址'
      const name = normalized.match(/^([\w./-]+)/)?.[1]?.split('/').pop()?.toLowerCase()
      if (!name) return ''
      if (name === 'ip') {
        if (/\b(?:a|addr|address)\b/.test(normalized)) return '查看网卡和 IP 地址'
        if (/\broute\b/.test(normalized)) return '查看或管理路由信息'
        return '查看或管理网络配置'
      }
      if (name === 'systemctl') {
        if (/\blist-units\b[\s\S]*--type(?:=|\s+)service[\s\S]*--state(?:=|\s+)running/i.test(normalized)) return '查看当前正在运行的 systemd 服务'
        if (/\b--failed\b/i.test(normalized)) return '查看启动失败的 systemd 服务'
        return '查看或管理 systemd 服务'
      }
      if (name === 'journalctl') return '查看 systemd 系统日志'
      if (name === 'docker') return '查看或管理 Docker 容器'
      const descriptions = {
        cat: '查看文件内容', ls: '列出目录内容', cd: '切换当前目录', pwd: '显示当前目录',
        grep: '搜索匹配文本', tail: '查看文件末尾内容', head: '查看文件开头内容', find: '查找文件或目录',
        df: '查看磁盘容量', du: '统计目录占用空间', free: '查看内存使用情况', ps: '查看进程列表',
        top: '实时查看系统资源', htop: '交互查看系统资源', uname: '查看系统和内核信息', uptime: '查看运行时间和负载',
        ss: '查看网络连接和端口', netstat: '查看网络状态', ping: '测试网络连通性', curl: '发起网络请求', wget: '下载网络文件',
        chmod: '修改文件权限', chown: '修改文件所有者', mkdir: '创建目录', cp: '复制文件或目录', mv: '移动或重命名文件',
        rm: '删除文件或目录，请谨慎操作', reboot: '重启服务器，请谨慎操作', shutdown: '关闭服务器，请谨慎操作',
        apt: '管理 Debian/Ubuntu 软件包', 'apt-get': '管理 Debian/Ubuntu 软件包', yum: '管理软件包', dnf: '管理软件包',
        vim: '使用 Vim 编辑文件', vi: '使用 Vi 编辑文件', nano: '使用 Nano 编辑文件', clear: '清空终端显示',
      }
      return descriptions[name] || ''
    }

    const describePrompt = (prompt) => {
      const cleaned = String(prompt || '').trim()
      const parsed = cleaned.match(/(?:\[)?([\w.-]+)@([\w.-]+)(?::([^#$\]]*))?(?:\])?[#$]/)
      if (!parsed) return '当前终端'
      const directory = String(parsed[3] || '').trim()
      return `${parsed[1]} 用户在 ${parsed[2]}${directory ? ` 的 ${directory} 目录` : ''}`
    }

    match = parseShellCommandLine(value)
    if (match) {
      const commandName = String(match[2]).trim().replace(/^sudo\s+/, '').match(/^([\w./-]+)/)?.[1]?.split('/').pop()
      const description = describeShellCommand(match[2]) || `运行 ${commandName || '终端'} 命令（参数保持原样）`
      return `${describePrompt(match[1])}执行：${description}`
    }

    match = value.match(/^(\S+)\s+(UNKNOWN|UP|DOWN|LOWERLAYERDOWN|DORMANT)\s+(.+)$/i)
    if (match && (/^(?:lo|eth\d*|ens\w*|enp\w*|wlan\w*|wg\w*|docker\w*|br-\w+|tun\w*|tap\w*)$/i.test(match[1]) || /(?:\d{1,3}\.){3}\d{1,3}|[a-f\d:]{3,}/i.test(match[3]))) {
      const states = { UNKNOWN: '未知', UP: '已启用', DOWN: '已关闭', LOWERLAYERDOWN: '下层链路未连接', DORMANT: '休眠' }
      return `${match[1]} 网卡｜状态：${states[match[2].toUpperCase()] || match[2]}｜地址：${match[3]}`
    }

    match = value.match(/^default\s+via\s+(\S+)\s+dev\s+(\S+)(.*)$/i)
    if (match) return `默认路由：通过 ${match[1]}；网卡：${match[2]}${/\bonlink\b/i.test(match[3]) ? '；直连链路' : ''}`
    match = value.match(/^(\S+\/\d+)\s+dev\s+(\S+)(.*)$/i)
    if (match) {
      const source = match[3].match(/\bsrc\s+(\S+)/i)?.[1]
      const protocol = match[3].match(/\bproto\s+(\S+)/i)?.[1]
      const scope = match[3].match(/\bscope\s+(\S+)/i)?.[1]
      return `网段：${match[1]}；网卡：${match[2]}${source ? `；源地址：${source}` : ''}${protocol ? `；路由协议：${protocol}` : ''}${scope ? `；作用域：${scopeName(scope)}` : ''}${/\blinkdown\b/i.test(match[3]) ? '；链路已断开' : ''}`
    }

    if (/^UNIT\s+LOAD\s+ACTIVE\s+SUB\s+DESCRIPTION$/i.test(value)) return '服务单元｜加载状态｜活动状态｜子状态｜说明'
    match = value.match(/^(\S+\.service)\s+(loaded|not-found|masked)\s+(active|inactive|failed|activating|deactivating)\s+(\S+)\s+(.+)$/i)
    if (match) {
      const loadStates = { loaded: '已加载', 'not-found': '未找到', masked: '已屏蔽' }
      const activeStates = { active: '活动', inactive: '未活动', failed: '失败', activating: '正在启动', deactivating: '正在停止' }
      const subStates = { running: '运行中', exited: '已退出', dead: '已停止', waiting: '等待中', listening: '监听中', mounted: '已挂载' }
      const descriptions = {
        'containerd container runtime': 'containerd 容器运行时',
        'regular background program processing daemon': '常规后台任务处理守护进程',
        'd-bus system message bus': 'D-Bus 系统消息总线',
        'docker application container engine': 'Docker 应用容器引擎',
        'getty on tty1': 'tty1 登录终端',
        'network time service': '网络时间服务',
        'qemu guest agent': 'QEMU 访客代理',
        'system logging service': '系统日志服务',
        'openbsd secure shell server': 'OpenBSD 安全 Shell 服务器',
        'journal service': '系统日志服务',
        'user login management': '用户登录管理',
      }
      const description = descriptions[match[5].toLowerCase()] || match[5]
      return `${match[1]}｜${loadStates[match[2].toLowerCase()] || match[2]}｜${activeStates[match[3].toLowerCase()] || match[3]}｜${subStates[match[4].toLowerCase()] || match[4]}｜${description}`
    }

    if (/^The programs included with the Debian GNU\/Linux system are free software;/i.test(value)) return 'Debian GNU/Linux 系统附带的程序是自由软件；各程序的具体发行条款记录在 /usr/share/doc/*/copyright 的对应文件中。'
    if (/^Debian GNU\/Linux comes with ABSOLUTELY NO WARRANTY/i.test(value)) return '在适用法律允许的范围内，Debian GNU/Linux 绝对不提供任何保证。'
    if (/^Linux\s+\S+\s+\d+\./.test(value)) return `系统内核信息：${value}`
    match = value.match(/^(?:Listed\s+)?(\d+)\s+loaded units?(?:\s+listed)?\.?$/i)
    if (match) return `共列出 ${match[1]} 个已加载服务单元。`

    match = value.match(/^(\d+):\s+([^:]+):\s+<([^>]*)>\s+mtu\s+(\d+)(.*)$/)
    if (match) {
      const [, number, name, rawFlags, mtu, rest] = match
      const flags = rawFlags.split(',')
      const details = []
      if (flags.includes('LOOPBACK')) details.push('回环接口')
      if (flags.includes('POINTOPOINT')) details.push('点对点接口')
      if (flags.includes('BROADCAST')) details.push('支持广播')
      if (flags.includes('MULTICAST')) details.push('支持组播')
      if (flags.includes('NO-CARRIER')) details.push('物理链路未连接')
      else if (flags.includes('LOWER_UP')) details.push('物理链路已连接')
      const state = rest.match(/\bstate\s+(\S+)/)?.[1]
      return `${number}: ${name} — ${details.join('；') || '网络接口'}；状态：${stateName(state || (flags.includes('UP') ? 'UP' : 'DOWN'))}；MTU：${mtu}`
    }
    match = value.match(/^link\/(loopback|ether|none)(?:\s+(\S+))?(?:\s+brd\s+(\S+))?/)
    if (match) {
      const type = { loopback: '回环链路', ether: '以太网链路', none: '无链路类型' }[match[1]]
      return `${type}${match[2] ? `；地址：${match[2]}` : ''}${match[3] ? `；广播地址：${match[3]}` : ''}`
    }
    match = value.match(/^inet\s+(\S+)(?:\s+brd\s+(\S+))?\s+scope\s+(\S+)(?:\s+(\S+))?/)
    if (match) return `IPv4 地址：${match[1]}${match[2] ? `；广播地址：${match[2]}` : ''}；作用域：${scopeName(match[3])}${match[4] ? `；接口：${match[4]}` : ''}`
    match = value.match(/^inet6\s+(\S+)\s+scope\s+(\S+)/)
    if (match) return `IPv6 地址：${match[1]}；作用域：${scopeName(match[2])}`
    match = value.match(/^valid_lft\s+(\S+)\s+preferred_lft\s+(\S+)/)
    if (match) return `地址有效期：${match[1] === 'forever' ? '永久' : match[1]}；首选期：${match[2] === 'forever' ? '永久' : match[2]}`
    match = value.match(/^altname\s+(.+)/)
    if (match) return `备用接口名称：${match[1]}`
    match = value.match(/^Last login:\s+(.+?)\s+from\s+(\S+)$/i)
    if (match) {
      return `上次登录：${localizeDate(match[1])}；来源：${match[2]}`
    }
    match = value.match(/^(.*?(?:systemd(?:-logind)?|dbus-daemon)\[\d+\]:\s*)(.+)$/i)
    if (match) {
      const translatedEvent = translateServiceMessage(match[2])
      if (translatedEvent) return `${localizeDate(match[1])}${translatedEvent}`
    }
    match = value.match(/^(.*?pam_unix\([^)]+\):)\s+session opened for user\s+(\S+?)(?:\(uid=(\d+)\))?\s+by \(uid=(\d+)\)$/i)
    if (match) return `${localizeDate(match[1])} 已为用户 ${match[2]} 打开会话${match[3] ? `（用户 UID：${match[3]}）` : ''}；发起 UID：${match[4]}`
    match = value.match(/^(.*?pam_unix\([^)]+\):)\s+session closed for user (\S+)$/i)
    if (match) return `${localizeDate(match[1])} 已关闭用户 ${match[2]} 的会话`
    match = value.match(/^(.*?)Accepted (password|publickey) for (\S+) from (\S+) port (\d+) ssh2$/i)
    if (match) return `${localizeDate(match[1])}已接受来自 ${match[4]}:${match[5]} 的 ${match[3]} 用户${match[2].toLowerCase() === 'password' ? '密码' : '公钥'}登录`
    match = value.match(/^(.*?)Failed password for (?:invalid user )?(\S+) from (\S+) port (\d+) ssh2$/i)
    if (match) return `${localizeDate(match[1])}${match[2]} 用户来自 ${match[3]}:${match[4]} 的密码登录失败`
    match = value.match(/^(.*?)Invalid user (\S+) from (\S+) port (\d+)$/i)
    if (match) return `${localizeDate(match[1])}检测到无效用户 ${match[2]}，来源 ${match[3]}:${match[4]}`
    match = value.match(/^(.*?)New session (\d+) of user (\S+)\.?$/i)
    if (match) return `${localizeDate(match[1])}已为用户 ${match[3]} 创建会话 ${match[2]}`
    match = value.match(/^(.*?)Removed session (\d+)\.?$/i)
    if (match) return `${localizeDate(match[1])}已移除会话 ${match[2]}`
    match = value.match(/^Mem:\s+(.+)$/)
    if (match) return `内存：${match[1]}`
    match = value.match(/^Swap:\s+(.+)$/)
    if (match) return `交换空间：${match[1]}`
    match = value.match(/^(\d+) bytes from (\S+): icmp_seq=(\d+) ttl=(\d+) time=(\S+)$/i)
    if (match) return `收到来自 ${match[2]} 的 ${match[1]} 字节响应：序号 ${match[3]}；TTL ${match[4]}；耗时 ${match[5]}`

    const exact = {
      'Permission denied.': '权限被拒绝。',
      'Connection timed out.': '连接超时。',
      'No such file or directory.': '没有该文件或目录。',
      'Command not found.': '未找到该命令。',
      'Operation not permitted.': '不允许执行此操作。',
      'Connection refused.': '连接被拒绝。',
      'Network is unreachable.': '网络不可达。',
      'Filesystem Size Used Avail Use% Mounted on': '文件系统  容量  已用  可用  使用率  挂载点',
      'NAME IMAGE COMMAND CREATED STATUS PORTS': '名称  镜像  命令  创建时间  状态  端口',
      'UNIT LOAD ACTIVE SUB DESCRIPTION': '服务单元  加载  活动  子状态  说明',
      'total used free shared buff/cache available': '总量  已用  空闲  共享  缓冲/缓存  可用',
    }
    return exact[value] || ''
  }

  const isProtectedLine = (line) => {
    const value = line.trim()
    if (!value) return false
    if (/^(?:\[[^\]]+\]\s*)?[\w.-]+@[\w.-]+(?::[^#$]*)?[#$]\s*.*$/.test(value)) return true
    if (/^[A-Z]:\\[^>]*>\s*.*$/.test(value)) return true
    if (/^(?:https?:\/\/|s?ftp:\/\/|\/)[^\s]+$/.test(value)) return true
    if (/^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(value)) return true
    if (/^(?:lines\s+\d+-\d+(?:\/\d+)?|\(END\)|--More--)$/i.test(value)) return true
    return false
  }

  const entries = sourceLines.map((source, id) => {
    const local = localTerminalTranslation(source)
    return {
      id,
      source,
      local,
      command: isShellCommandLine(source),
      kind: !source.trim() ? 'blank' : local ? 'local' : isProtectedLine(source) ? 'preserved' : 'translate',
    }
  })
  const translatable = entries.filter((entry) => entry.kind === 'translate')
  const uniqueTranslatable = []
  const firstBySource = new Map()
  const duplicateOf = new Map()
  for (const entry of translatable) {
    const key = entry.source.trim()
    if (firstBySource.has(key)) duplicateOf.set(entry.id, firstBySource.get(key))
    else {
      firstBySource.set(key, entry.id)
      uniqueTranslatable.push(entry)
    }
  }
  const cacheKey = (entry) => `${provider}\u0000${entry.source.trim()}`
  const cachedTranslations = new Map()
  const pendingTranslatable = uniqueTranslatable.filter((entry) => {
    const cached = translationCache.get(cacheKey(entry))
    if (!cached) return true
    cachedTranslations.set(entry.id, cached)
    return false
  })
  const batches = []
  let batch = []
  let batchSize = 0
  for (const entry of pendingTranslatable) {
    if (batch.length && (batch.length >= 60 || batchSize + entry.source.length > 5000)) {
      batches.push(batch)
      batch = []
      batchSize = 0
    }
    batch.push(entry)
    batchSize += entry.source.length
  }
  if (batch.length) batches.push(batch)

  const escapeHtml = (value) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  const decodeHtml = (value) => value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .trim()
  const toTaggedHtml = (items) => items
    .map((item) => `<p data-sloth-id="${item.id}">${escapeHtml(item.source)}</p>`)
    .join('')
  const parseTaggedHtml = (html) => {
    const result = new Map()
    const pattern = /<p[^>]*data-sloth-id=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/p>/gi
    let match
    while ((match = pattern.exec(html))) result.set(Number(match[1]), decodeHtml(match[2]))
    return result
  }

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await net.fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  const translateLibreBatch = async (items, timeoutMs = 9000) => {
    const html = toTaggedHtml(items)
    const mirrors = ['https://translate.fedilab.app/translate', 'https://translate.cutie.dating/translate']
    const requestMirror = async (endpoint) => {
      const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: html, source: 'en', target: 'zh', format: 'html' }),
        }, timeoutMs)
      const data = await response.json()
      if (!response.ok || !data?.translatedText) throw new Error(data?.error || `公共翻译节点返回 ${response.status}`)
      const parsed = parseTaggedHtml(data.translatedText)
      if (!parsed.size) throw new Error('公共翻译节点没有返回可对应的行')
      return parsed
    }
    try {
      return await Promise.any(mirrors.map(requestMirror))
    } catch (error) {
      throw error?.errors?.[0] || new Error('免费翻译线路暂时不可用')
    }
  }

  const translateMyMemoryLine = async (entry) => {
    const url = new URL('https://api.mymemory.translated.net/get')
    url.searchParams.set('q', entry.source.slice(0, 450))
    url.searchParams.set('langpair', 'en|zh-CN')
    url.searchParams.set('mt', '1')
    const response = await fetchWithTimeout(url.toString(), {}, 5000)
    const data = await response.json()
    const translated = data?.responseData?.translatedText?.trim()
    if (!response.ok || Number(data?.responseStatus) !== 200 || !translated) throw new Error(data?.responseDetails || 'MyMemory 没有返回结果')
    return new Map([[entry.id, translated]])
  }

  const translateGoogleBatch = async (items, timeoutMs = 12000) => {
    const url = new URL('https://translate.googleapis.com/translate_a/single')
    url.searchParams.set('client', 'gtx')
    url.searchParams.set('sl', 'auto')
    url.searchParams.set('tl', 'zh-CN')
    url.searchParams.set('dt', 't')
    url.searchParams.set('q', toTaggedHtml(items))
    const response = await fetchWithTimeout(url.toString(), {}, timeoutMs)
    if (!response.ok) throw new Error(`Google 翻译返回 ${response.status}`)
    const data = await response.json()
    const html = Array.isArray(data?.[0]) ? data[0].map((part) => part?.[0] || '').join('') : ''
    if (!html) throw new Error('Google 翻译没有返回结果')
    return parseTaggedHtml(html)
  }

  const translateFreeBatch = async (items) => {
    const results = await Promise.allSettled([
      translateGoogleBatch(items, 10000),
      translateLibreBatch(items, 10000),
    ])
    const merged = new Map()
    const score = (source, translated) => {
      const value = String(translated || '').trim()
      if (!value) return -1
      let result = (value.match(/[\u3400-\u9fff]/g) || []).length * 3
      if (value.toLowerCase() !== String(source || '').trim().toLowerCase()) result += 20
      return result
    }
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      for (const [id, value] of result.value) {
        const source = items.find((item) => item.id === id)?.source || ''
        if (!merged.has(id) || score(source, value) > score(source, merged.get(id))) merged.set(id, value)
      }
    }
    if (merged.size) return merged
    const firstFailure = results.find((result) => result.status === 'rejected')
    throw firstFailure?.reason || new Error('免费翻译线路暂时不可用')
  }

  const translateBaiduBatch = async (items) => {
    const appId = settings.baiduAppId
    const secret = decryptSecret(settings.baiduSecretSecret)
    if (!appId || !secret) throw new Error('请先在设置中填写百度翻译 APP ID 和密钥')
    const query = items.map((item) => item.source).join('\n')
    const salt = `${Date.now()}${Math.floor(Math.random() * 10000)}`
    const sign = crypto.createHash('md5').update(`${appId}${query}${salt}${secret}`).digest('hex')
    const url = new URL('https://fanyi-api.baidu.com/api/trans/vip/translate')
    for (const [key, value] of Object.entries({ q: query, from: 'auto', to: 'zh', appid: appId, salt, sign })) url.searchParams.set(key, value)
    const response = await fetchWithTimeout(url.toString())
    const data = await response.json()
    if (data.error_code) throw new Error(`百度翻译错误 ${data.error_code}：${data.error_msg || '请检查配置'}`)
    const translated = Array.isArray(data.trans_result) ? data.trans_result : []
    const result = new Map()
    translated.forEach((item, index) => {
      if (items[index] && item?.dst) result.set(items[index].id, item.dst.trim())
    })
    return result
  }

  const mapTranslatedText = (items, rawText) => {
    const translated = String(rawText || '').trim()
    if (!translated) return new Map()
    if (items.length === 1) return new Map([[items[0].id, translated]])
    const lines = translated.split('\n').map((line) => line.trim())
    if (lines.length !== items.length) return new Map()
    return new Map(items.map((item, index) => [item.id, lines[index]]))
  }

  const hmac = (algorithm, key, value, encoding) => crypto.createHmac(algorithm, key).update(value).digest(encoding)
  const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

  const translateTencentBatch = async (items) => {
    const secretId = settings.tencentSecretId
    const secretKey = decryptSecret(settings.tencentSecretKeySecret)
    const region = settings.tencentRegion || 'ap-guangzhou'
    if (!secretId || !secretKey) throw new Error('请先在设置中填写腾讯云 SecretId 和 SecretKey')

    const service = 'tmt'
    const host = 'tmt.tencentcloudapi.com'
    const action = 'TextTranslate'
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
    const body = JSON.stringify({
      SourceText: items.map((item) => item.source).join('\n'),
      Source: 'auto',
      Target: 'zh',
      ProjectId: 0,
    })
    const contentType = 'application/json; charset=utf-8'
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
    const signedHeaders = 'content-type;host;x-tc-action'
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(body)}`
    const credentialScope = `${date}/${service}/tc3_request`
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`
    const secretDate = hmac('sha256', `TC3${secretKey}`, date)
    const secretService = hmac('sha256', secretDate, service)
    const secretSigning = hmac('sha256', secretService, 'tc3_request')
    const signature = hmac('sha256', secretSigning, stringToSign, 'hex')
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    const response = await fetchWithTimeout(`https://${host}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': contentType,
        'X-TC-Action': action,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': '2018-03-21',
        'X-TC-Region': region,
      },
      body,
    }, 15000)
    const data = await response.json()
    if (!response.ok || data?.Response?.Error) {
      const error = data?.Response?.Error
      throw new Error(`腾讯翻译错误${error?.Code ? ` ${error.Code}` : ''}：${error?.Message || `HTTP ${response.status}`}`)
    }
    return mapTranslatedText(items, data?.Response?.TargetText)
  }

  const translateAliyunBatch = async (items) => {
    const accessKeyId = settings.aliyunAccessKeyId
    const accessKeySecret = decryptSecret(settings.aliyunAccessKeySecretSecret)
    if (!accessKeyId || !accessKeySecret) throw new Error('请先在设置中填写阿里云 AccessKey ID 和 AccessKey Secret')

    const resource = '/api/translate/web/general'
    const host = 'mt.cn-hangzhou.aliyuncs.com'
    const contentType = 'application/json;charset=utf-8'
    const accept = 'application/json'
    const date = new Date().toUTCString()
    const nonce = crypto.randomUUID()
    const body = JSON.stringify({
      FormatType: 'html',
      SourceLanguage: 'auto',
      TargetLanguage: 'zh',
      SourceText: toTaggedHtml(items),
      Scene: 'general',
    })
    const contentMd5 = crypto.createHash('md5').update(body).digest('base64')
    const acsHeaders = [
      'x-acs-signature-method:HMAC-SHA1',
      `x-acs-signature-nonce:${nonce}`,
      'x-acs-version:2019-01-02',
    ].join('\n')
    const stringToSign = `POST\n${accept}\n${contentMd5}\n${contentType}\n${date}\n${acsHeaders}\n${resource}`
    const signature = hmac('sha1', accessKeySecret, stringToSign, 'base64')
    const response = await fetchWithTimeout(`https://${host}${resource}`, {
      method: 'POST',
      headers: {
        Accept: accept,
        Authorization: `acs ${accessKeyId}:${signature}`,
        'Content-MD5': contentMd5,
        'Content-Type': contentType,
        Date: date,
        'x-acs-signature-method': 'HMAC-SHA1',
        'x-acs-signature-nonce': nonce,
        'x-acs-version': '2019-01-02',
      },
      body,
    }, 15000)
    const raw = await response.text()
    let data
    try { data = JSON.parse(raw) } catch { throw new Error(`阿里翻译返回了无法识别的结果（HTTP ${response.status}）`) }
    const payload = data?.TranslateGeneralResponse || data
    const responseCode = payload?.Code ?? payload?.code
    if (!response.ok || (responseCode != null && Number(responseCode) !== 200)) {
      throw new Error(`阿里翻译错误${payload?.Code ? ` ${payload.Code}` : ''}：${payload?.Message || `HTTP ${response.status}`}`)
    }
    const translated = payload?.Data?.Translated
      || payload?.data?.translated
      || payload?.Translated
      || payload?.translated
    if (!translated) throw new Error('阿里翻译没有返回译文，请确认机器翻译服务已经开通')
    const parsed = parseTaggedHtml(String(translated || ''))
    return parsed.size ? parsed : mapTranslatedText(items, translated)
  }

  const translateOpenAIBatch = async (items) => {
    const apiKey = decryptSecret(settings.openaiApiKeySecret)
    const baseUrl = String(settings.openaiBaseUrl || '').replace(/\/+$/, '')
    const model = settings.openaiModel
    if (!baseUrl || !model || !apiKey) throw new Error('请先在设置中填写兼容接口地址、模型和 API Key')
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
    const payload = Object.fromEntries(items.map((item) => [String(item.id), item.source]))
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You are a strict terminal-output translator. Translate EVERY value into natural Simplified Chinese. Do not summarize, explain, omit, merge, or leave ordinary English untranslated. Preserve only technical tokens inside sentences such as commands, paths, IPs, ports, flags, filenames, and error codes. Return one valid JSON object with exactly the same keys and no markdown.' },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    }, 45000)
    const raw = await response.text()
    let data
    try { data = JSON.parse(raw) } catch { throw new Error(`大模型接口返回了无法识别的结果（HTTP ${response.status}），请检查 Base URL`) }
    if (!response.ok) {
      const detail = data?.error?.message || data?.message || data?.code
      const hint = settings.openaiPreset === 'qwen' && response.status === 401
        ? '；请确认百炼 API Key 与中国地域 Base URL 属于同一地域'
        : ''
      throw new Error(`大模型接口错误 ${response.status}：${detail || '请检查接口配置'}${hint}`)
    }
    let content = String(data?.choices?.[0]?.message?.content || '').trim()
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const firstBrace = content.indexOf('{')
    const lastBrace = content.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) content = content.slice(firstBrace, lastBrace + 1)
    let parsed
    try { parsed = JSON.parse(content) } catch { throw new Error('大模型没有按完整行格式返回，已阻止不完整译文') }
    const result = new Map()
    for (const item of items) {
      const translated = String(parsed?.[item.id] ?? '').trim()
      if (translated) result.set(item.id, translated)
    }
    return result
  }

  const providerBatch = provider === 'free'
    ? translateFreeBatch
    : provider === 'google'
      ? translateGoogleBatch
      : provider === 'baidu'
        ? translateBaiduBatch
        : provider === 'tencent'
          ? translateTencentBatch
          : provider === 'aliyun'
            ? translateAliyunBatch
            : translateOpenAIBatch

  const translations = new Map(cachedTranslations)
  let providerError
  const parallelBatches = provider === 'free' ? 6 : 2
  for (let offset = 0; offset < batches.length; offset += parallelBatches) {
    const group = batches.slice(offset, offset + parallelBatches)
    const results = await Promise.allSettled(group.map((items) => providerBatch(items)))
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const [id, value] of result.value) translations.set(id, value)
      } else {
        providerError ||= result.reason
      }
    }
  }

  const propagateDuplicates = () => {
    for (const [duplicateId, originalId] of duplicateOf) {
      const value = translations.get(originalId)
      if (value) translations.set(duplicateId, value)
    }
  }
  propagateDuplicates()

  const technicalWords = new Set([
    'api', 'bios', 'bpf', 'brd', 'cpu', 'cron', 'dev', 'dmi', 'dns', 'docker', 'eth', 'ext4',
    'gb', 'ghz', 'gpu', 'http', 'https', 'icmp', 'inet', 'inet6', 'ip', 'ipv4', 'ipv6', 'kvm',
    'linux', 'mb', 'mhz', 'mtu', 'nginx', 'numa', 'pam', 'pam_unix', 'pid', 'port', 'qdisc',
    'ram', 'root', 'scope', 'session', 'shell', 'ssh', 'sshd', 'swap', 'systemd', 'tcp', 'tty',
    'ubuntu', 'udp', 'uid', 'unix', 'url', 'usb', 'uuid', 'vm', 'vps', 'wg', 'xfs',
  ])
  const ordinaryEnglishWords = (value) => (String(value || '').match(/[A-Za-z][A-Za-z_-]{2,}/g) || [])
    .map((word) => word.toLowerCase())
    .filter((word) => {
      if (technicalWords.has(word)) return false
      if (word.includes('_') || /\d/.test(word)) return false
      if (/^[a-f0-9-]{8,}$/i.test(word)) return false
      return true
    })
  const hasUntranslatedProse = (source, translated) => {
    const sourceWords = ordinaryEnglishWords(source)
    if (!sourceWords.length) return false
    if (!translated) return true
    if (translated.trim().toLowerCase() === source.trim().toLowerCase()) return true
    const sourceSet = new Set(sourceWords)
    const remaining = ordinaryEnglishWords(translated).filter((word) => sourceSet.has(word))
    return remaining.length >= Math.max(1, Math.ceil(sourceWords.length * 0.35))
  }

  const needsRetry = uniqueTranslatable.filter((entry) => {
    const translated = translations.get(entry.id)?.trim()
    return hasUntranslatedProse(entry.source, translated)
  })

  if (provider === 'free') {
    const limitedFallback = needsRetry.slice(0, 24)
    const retries = await Promise.allSettled(limitedFallback.map(translateMyMemoryLine))
    retries.forEach((retry) => {
      if (retry.status === 'fulfilled') {
        for (const [id, value] of retry.value) translations.set(id, value)
      } else {
        providerError ||= retry.reason
      }
    })
  } else {
    for (const entry of needsRetry) {
      try {
        const retry = await providerBatch([entry])
        const value = retry.get(entry.id)
        if (value) translations.set(entry.id, value)
      } catch (error) {
        providerError ||= error
      }
    }
  }
  propagateDuplicates()

  for (const entry of uniqueTranslatable) {
    const translated = translations.get(entry.id)?.trim()
    if (translated && !hasUntranslatedProse(entry.source, translated)) translationCache.set(cacheKey(entry), translated)
  }
  while (translationCache.size > 3000) translationCache.delete(translationCache.keys().next().value)

  const lineMeta = entries.map((entry) => {
    if (entry.kind === 'blank') return { source: entry.source, text: '', status: 'blank', command: entry.command }
    if (entry.kind === 'local') return { source: entry.source, text: entry.local, status: 'translated', local: true, command: entry.command }
    if (entry.kind === 'preserved') return { source: entry.source, text: entry.source, status: 'preserved', command: entry.command }
    const translated = translations.get(entry.id)?.trim()
    return translated
      ? { source: entry.source, text: translated, status: 'translated', partial: hasUntranslatedProse(entry.source, translated), command: entry.command }
      : { source: entry.source, text: entry.source, status: 'failed', command: entry.command }
  })
  const failedLines = lineMeta.filter((line) => line.status === 'failed').length
  const partialLines = lineMeta.filter((line) => line.partial).length
  const localLines = lineMeta.filter((line) => line.local).length
  const translatedLines = lineMeta.filter((line) => line.status === 'translated').length
  const preservedLines = lineMeta.filter((line) => line.status === 'preserved').length
  if (!translatedLines && failedLines && provider !== 'free') return { ok: false, error: providerError?.message || '翻译接口没有返回有效译文' }

  return {
    ok: true,
    translated: lineMeta.map((line) => line.text).join('\n').trim(),
    lines: lineMeta,
    sourceLines: sourceLines.length,
    translatedLines,
    preservedLines,
    failedLines,
    partialLines,
    localLines,
    provider,
    translatedChunks: batches.length,
    warning: failedLines
      ? provider === 'free'
        ? `免费联网节点在当前网络不可用；本地已翻译 ${localLines} 行，其余保留原文，可切换国内接口`
        : `有 ${failedLines} 行翻译失败，已保留原文`
      : partialLines
        ? `已自动补译，仍有 ${partialLines} 行包含可能的英文说明`
        : '',
  }
})

ipcMain.handle('ssh:connect', async (_event, input) => {
  const hostId = typeof input === 'object' ? input.hostId : input
  const sessionId = typeof input === 'object' && input.sessionId ? String(input.sessionId) : crypto.randomUUID()
  disconnect(sessionId)
  const records = await readHostRecords()
  const config = records.find((host) => host.id === hostId)
  if (!config) {
    const diagnostic = diagnoseSshFailure(new Error('找不到主机配置'), { hostId })
    Object.assign(diagnostic, { code: 'HOST_NOT_FOUND', title: '找不到主机配置', message: '该连接信息可能已被删除，请重新选择或添加服务器。', suggestions: ['返回主机列表重新选择', '必要时重新添加 SSH 主机'] })
    send('ssh:status', { ...diagnostic, sessionId })
    return { ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic: { ...diagnostic, sessionId } }
  }

  send('ssh:status', { state: 'connecting', message: `正在建立连接 ${config.hostname}:${config.port}…`, hostId, sessionId, phase: 'network' })
  const connection = new Client()
  const session = { id: sessionId, hostId, client: connection, stream: undefined, sftp: undefined }
  sshSessions.set(sessionId, session)
  lastSessionId = sessionId
  let phase = 'network'
  const diagnosticContext = { hostId, sessionId, host: config.hostname, port: Number(config.port) || 22, username: config.username, authType: config.authType }
  const reportFailure = (error, overrides = {}) => {
    const diagnostic = diagnoseSshFailure(error, { ...diagnosticContext, phase })
    Object.assign(diagnostic, overrides)
    const payload = { ...diagnostic, sessionId }
    send('ssh:status', payload)
    return payload
  }

  const options = {
    host: config.hostname,
    port: Number(config.port) || 22,
    username: config.username,
    readyTimeout: 20000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
  }

  try {
    if (config.authType === 'key') {
      options.privateKey = await fs.readFile(config.privateKeyPath)
      const passphrase = decryptSecret(config.passphraseSecret)
      if (passphrase) options.passphrase = passphrase
    } else {
      options.password = decryptSecret(config.passwordSecret)
      if (!options.password) {
        disconnect(sessionId)
        const diagnostic = reportFailure(new Error('No saved password'), {
          code: 'MISSING_PASSWORD', title: '还没有保存服务器密码',
          message: '当前连接使用密码认证，但 SlothSSH 中没有可用的密码。',
          suggestions: ['打开“编辑连接”输入密码', '保存后再重新连接'],
        })
        return { ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic }
      }
    }
  } catch (error) {
    disconnect(sessionId)
    const diagnostic = reportFailure(error, {
      code: 'KEY_ERROR', title: '无法读取 SSH 私钥',
      message: '私钥文件不存在、没有读取权限，或文件格式无法识别。',
      suggestions: ['编辑连接并重新选择私钥', '检查私钥文件权限和口令'],
    })
    return { ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic }
  }

  return new Promise((resolve) => {
    let settled = false
    const timeout = setTimeout(() => {
      const timeoutError = new Error('Connection timed out after 25 seconds')
      timeoutError.code = 'ETIMEDOUT'
      const diagnostic = reportFailure(timeoutError)
      disconnect(sessionId)
      finish({ ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic })
    }, 25000)
    const finish = (result) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        resolve(result)
      }
    }

    connection
      .on('handshake', () => {
        phase = 'authentication'
        send('ssh:status', { state: 'connecting', message: 'SSH 握手完成，正在验证用户名和密码…', hostId, sessionId, phase: 'authentication' })
      })
      .on('ready', () => {
        phase = 'shell'
        send('ssh:status', { state: 'connecting', message: '认证成功，正在启动远程终端…', hostId, sessionId, phase: 'shell' })
        connection.shell({ term: 'xterm-256color', cols: 120, rows: 36 }, async (error, shell) => {
          if (error) {
            const diagnostic = reportFailure(error)
            finish({ ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic })
            if (sshSessions.get(sessionId)?.client === connection) disconnect(sessionId)
            return
          }

          session.stream = shell
          shell.setEncoding('utf8')
          shell.on('data', (data) => send('ssh:data', { sessionId, data: String(data) }))
          shell.stderr.on('data', (data) => send('ssh:data', { sessionId, data: data.toString('utf8') }))
          shell.on('close', () => {
            if (sshSessions.get(sessionId) === session) {
              session.stream = undefined
              send('ssh:status', { state: 'disconnected', message: '连接已关闭', hostId, sessionId })
            }
          })
          shell.on('error', (streamError) => {
            reportFailure(streamError, { title: '远程终端连接异常' })
          })

          const record = records.find((host) => host.id === hostId)
          if (record) {
            record.lastConnectedAt = new Date().toISOString()
            await writeHostRecords(records)
          }
          phase = 'session'
          send('ssh:status', { state: 'connected', message: `已连接 ${config.hostname}`, hostId, sessionId })
          finish({ ok: true, sessionId })
        })
      })
      .on('error', (error) => {
        const diagnostic = reportFailure(error)
        finish({ ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic })
        if (sshSessions.get(sessionId)?.client === connection) disconnect(sessionId)
      })
      .on('close', () => {
        if (sshSessions.get(sessionId) === session && !session.stream && phase !== 'session') {
          const diagnostic = reportFailure(new Error('Connection closed before SSH session was established'), {
            code: 'REMOTE_CLOSED_EARLY', title: '服务器在连接完成前主动断开',
            message: '目标主机已接收网络连接，但在 SSH 会话建立前主动关闭。',
            suggestions: ['确认当前端口是 SSH 服务', '检查 sshd、Fail2ban 和 IP 白名单', '查看服务器认证日志'],
          })
          sshSessions.delete(sessionId)
          finish({ ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic })
          return
        }
        finish({ ok: false, sessionId, code: 'CANCELLED', error: '连接已取消或关闭' })
      })

    try {
      connection.connect(options)
    } catch (error) {
      const diagnostic = reportFailure(error)
      disconnect(sessionId)
      finish({ ok: false, sessionId, code: diagnostic.code, error: diagnostic.message, diagnostic })
    }
  })
})

ipcMain.handle('server:stats', async (_event, sessionId) => {
  const command = [
    "printf '__CPU1__ '; head -n 1 /proc/stat",
    'sleep 0.25',
    "printf '__CPU2__ '; head -n 1 /proc/stat",
    "grep -E '^(MemTotal|MemAvailable):' /proc/meminfo",
    "printf '__DISK__ '; df -Pk / | tail -n 1",
    "printf '__CORES__ '; getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || echo 1",
    "printf '__UPTIME__ '; uptime -p 2>/dev/null || uptime",
  ].join('; ')
  try {
    const output = await execRemote(sessionId, command)
    const cpuLines = [...output.matchAll(/__CPU[12]__\s+cpu\s+([^\n]+)/g)].map((match) => match[1].trim().split(/\s+/).map(Number))
    let cpuPercent = 0
    if (cpuLines.length === 2) {
      const totals = cpuLines.map((values) => values.reduce((sum, value) => sum + (Number(value) || 0), 0))
      const idle = cpuLines.map((values) => (values[3] || 0) + (values[4] || 0))
      const totalDelta = totals[1] - totals[0]
      cpuPercent = totalDelta > 0 ? Math.max(0, Math.min(100, ((totalDelta - (idle[1] - idle[0])) / totalDelta) * 100)) : 0
    }
    const memoryTotalKb = Number(output.match(/^MemTotal:\s+(\d+)/m)?.[1] || 0)
    const memoryAvailableKb = Number(output.match(/^MemAvailable:\s+(\d+)/m)?.[1] || 0)
    const disk = output.match(/__DISK__\s+\S+\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+(\S+)/)
    const cores = Number(output.match(/__CORES__\s+(\d+)/)?.[1] || 1)
    return {
      ok: true,
      cpu: { percent: Math.round(cpuPercent), cores },
      memory: {
        total: memoryTotalKb * 1024,
        used: Math.max(0, memoryTotalKb - memoryAvailableKb) * 1024,
        percent: memoryTotalKb ? Math.round(((memoryTotalKb - memoryAvailableKb) / memoryTotalKb) * 100) : 0,
      },
      disk: {
        total: Number(disk?.[1] || 0) * 1024,
        used: Number(disk?.[2] || 0) * 1024,
        available: Number(disk?.[3] || 0) * 1024,
        percent: Number(disk?.[4] || 0),
        mount: disk?.[5] || '/',
      },
      uptime: String(output.match(/__UPTIME__\s+([^\n]+)/)?.[1] || '').trim(),
      sampledAt: new Date().toISOString(),
    }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('sftp:home', async (_event, sessionId) => {
  try {
    const channel = await getSftp(sessionId)
    const remotePath = await sftpCall(channel, 'realpath', '.')
    return { ok: true, path: remotePath || '/' }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('sftp:list', async (_event, input) => {
  try {
    const channel = await getSftp(input?.sessionId)
    const rawPath = typeof input === 'object' ? input.path : input
    const remotePath = path.posix.resolve('/', String(rawPath || '/'))
    const items = await sftpCall(channel, 'readdir', remotePath)
    const files = items
      .filter((item) => item.filename !== '.' && item.filename !== '..')
      .map((item) => ({
        name: item.filename,
        path: path.posix.join(remotePath, item.filename),
        directory: item.attrs.isDirectory(),
        file: item.attrs.isFile(),
        size: Number(item.attrs.size || 0),
        modifiedAt: Number(item.attrs.mtime || 0) * 1000,
        permissions: (Number(item.attrs.mode || 0) & 0o777).toString(8).padStart(3, '0'),
      }))
      .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, 'zh-CN'))
    return { ok: true, path: remotePath, files }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('sftp:mkdir', async (_event, input, legacyName) => {
  try {
    const channel = await getSftp(input?.sessionId)
    const rawParent = typeof input === 'object' ? input.parent : input
    const rawName = typeof input === 'object' ? input.name : legacyName
    const name = path.posix.basename(String(rawName || '').trim())
    if (!name || name === '.' || name === '..') throw new Error('请输入有效的文件夹名称')
    const remotePath = path.posix.join(path.posix.resolve('/', String(rawParent || '/')), name)
    await sftpCall(channel, 'mkdir', remotePath)
    return { ok: true, path: remotePath }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('sftp:upload', async (_event, input) => {
  try {
    const channel = await getSftp(input?.sessionId)
    const localPath = String(input?.localPath || '')
    const localInfo = await fs.stat(localPath)
    if (!localInfo.isFile()) throw new Error('目前只支持上传文件，不会自动上传整个本地文件夹')
    const fileName = path.posix.basename(String(input?.fileName || path.basename(localPath)))
    const remotePath = path.posix.join(path.posix.resolve('/', String(input?.remoteDirectory || '/')), fileName)
    try {
      await sftpCall(channel, 'stat', remotePath)
      if (!input?.overwrite) return { ok: false, exists: true, path: remotePath, error: '目标文件已存在' }
    } catch (error) {
      if (error?.code !== 2) throw error
    }
    await new Promise((resolve, reject) => {
      channel.fastPut(localPath, remotePath, {
        step: (transferred, _chunk, total) => send('sftp:progress', { sessionId: input?.sessionId, fileName, transferred, total, remotePath }),
      }, (error) => error ? reject(error) : resolve())
    })
    return { ok: true, path: remotePath, size: localInfo.size }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('sftp:copy', async (_event, input) => {
  try {
    const channel = await getSftp(input?.sessionId)
    const source = path.posix.resolve('/', String(input?.source || '/'))
    const destinationDirectory = path.posix.resolve('/', String(input?.destinationDirectory || '/'))
    if (source === '/') throw new Error('不允许复制服务器根目录')
    const sourceAttrs = await sftpCall(channel, 'lstat', source)
    const originalName = path.posix.basename(source)
    let target = path.posix.join(destinationDirectory, originalName)
    if (await remotePathExists(channel, target)) {
      const extension = sourceAttrs.isDirectory() ? '' : path.posix.extname(originalName)
      const stem = extension ? originalName.slice(0, -extension.length) : originalName
      let copyIndex = 1
      do {
        const suffix = copyIndex === 1 ? ' - 副本' : ` - 副本 ${copyIndex}`
        target = path.posix.join(destinationDirectory, `${stem}${suffix}${extension}`)
        copyIndex += 1
      } while (await remotePathExists(channel, target))
    }
    await execRemote(input?.sessionId, `cp -a -- ${shellQuote(source)} ${shellQuote(target)}`)
    return { ok: true, source, path: target, name: path.posix.basename(target) }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('sftp:remove', async (_event, input) => {
  try {
    const channel = await getSftp(input?.sessionId)
    const rawPath = typeof input === 'object' ? input.path : input
    const remotePath = path.posix.resolve('/', String(rawPath || '/'))
    if (remotePath === '/') throw new Error('不允许删除服务器根目录')
    await removeRemoteTree(channel, remotePath)
    return { ok: true, path: remotePath }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('ssh:disconnect', (_event, sessionId) => {
  const session = sshSessions.get(sessionId || lastSessionId)
  const targetId = session?.id
  disconnect(targetId)
  if (targetId) send('ssh:status', { state: 'disconnected', message: '已主动断开', hostId: session.hostId, sessionId: targetId })
  return { ok: Boolean(targetId), sessionId: targetId || String(sessionId || '') }
})

ipcMain.handle('ssh:input', (_event, input, legacyData) => {
  const sessionId = typeof input === 'object' ? input.sessionId : undefined
  const data = typeof input === 'object' ? input.data : (legacyData ?? input)
  const session = sshSessions.get(sessionId || lastSessionId)
  if (!session?.stream?.writable) return false
  session.stream.write(String(data))
  return true
})

ipcMain.handle('ssh:resize', (_event, input) => {
  const session = sshSessions.get(input?.sessionId || lastSessionId)
  if (!session?.stream) return false
  session.stream.setWindow(Math.max(1, input.rows), Math.max(1, input.cols), 0, 0)
  return true
})

ipcMain.on('window:minimize', () => window?.minimize())
ipcMain.on('window:maximize', () => window?.isMaximized() ? window.unmaximize() : window?.maximize())
ipcMain.on('window:close', () => window?.close())
