import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import slothLogo from './assets/slothssh-icon.png'
import {
  Activity, AlertTriangle, ChevronDown, CirclePlus, ClipboardPaste, Clock3, Command, Copy, Cpu, Eraser, ExternalLink, Eye,
  EyeOff, File, Folder, FolderKey, FolderPlus, HardDrive, Home, KeyRound, Languages, LayoutGrid, LoaderCircle,
  MoreHorizontal, Pencil, Play, RefreshCw, Search, Server, Settings,
  ShieldCheck, Square, Star, Trash2, UploadCloud, Volume2, Wifi, X, Zap,
} from 'lucide-react'

const api = window.slothssh
const palette = ['#7c8cff', '#5ad0a8', '#f3a65a', '#d078e8', '#55b8e8']
const viewMeta = {
  hosts: ['WORKSPACE', '全部主机'],
  favorites: ['PINNED', '收藏主机'],
  recent: ['HISTORY', '最近连接'],
  keys: ['AUTHENTICATION', '密钥主机'],
}
const englishUi = {
  '全部主机': 'All Hosts', '收藏主机': 'Favorites', '最近连接': 'Recent', '密钥主机': 'Key Hosts',
  '设置': 'Settings', '添加主机': 'Add Host', '搜索主机、IP、备注…': 'Search hosts, IP or notes…',
  '这里还没有主机': 'No hosts yet', '没有匹配的主机': 'No matching hosts', '添加服务器': 'Add Server',
  '密码由系统安全存储加密保存': 'Passwords are encrypted by system secure storage',
  '文件与资源': 'Files & Resources', '翻译': 'Translate', '切换': 'Switch', '快捷命令': 'Quick Commands',
  '编辑服务器': 'Edit Server', '服务器详情': 'Server Details', '连接': 'Connect', '断开': 'Disconnect', '取消连接': 'Cancel', '正在断开…': 'Disconnecting…',
  '确认断开 SSH？': 'Disconnect SSH?', '断开后将关闭当前终端连接，正在前台运行的命令可能会停止。': 'This closes the current terminal connection. Foreground commands may stop.',
  '继续使用': 'Keep Connected', '确认断开': 'Disconnect', '当前终端': 'Current terminal', '个终端会话': 'terminal sessions',
  '终端': 'Terminal', '尚未连接': 'Not connected', '欢迎使用 SlothSSH': 'Welcome to SlothSSH',
  '保存服务器信息，下次一键连接。': 'Save server details and reconnect with one click.', '新建连接': 'New connection',
  '一键连接': 'Connect', '查看信息': 'View Details', '说明命令': 'Explain', '空闲': 'Idle', '可输入操作': 'Interactive',
  '未连接': 'Disconnected', 'SSH 已加密连接': 'SSH Encrypted', '在这里输入命令，按 Enter 执行…': 'Enter a command and press Enter…',
  '服务器管理': 'Server Manager', '实时资源与 SFTP 文件': 'Live resources and SFTP files', '内存': 'Memory', '系统盘': 'System Disk',
  '服务器文件': 'Server Files', '点击选中，双击文件夹进入': 'Click to select; double-click folders to open', '复制': 'Copy', '粘贴': 'Paste', '删除': 'Delete',
  '点击文件后可操作': 'Select a file to manage it', '正在读取目录…': 'Loading directory…', '重试': 'Retry',
  '这个文件夹是空的，可直接拖入文件': 'This folder is empty. Drop files here to upload.', '拖到文件夹或终端，上传到当前目录': 'Drop onto a folder or terminal to upload here',
  '复制选中内容': 'Copy Selection', '粘贴选中内容': 'Paste Selection', '粘贴剪贴板内容': 'Paste Clipboard', '复制全部终端内容': 'Copy All Terminal Output',
  '选中全部终端内容': 'Select All Terminal Output', '清空当前窗口': 'Clear Terminal',
  '连接服务器': 'Connect Server', '切换到已连接终端': 'Switch to Connected Terminal', '新建独立终端': 'New Independent Terminal',
  '查看服务器信息': 'View Server Details', '编辑连接': 'Edit Connection', '取消收藏': 'Remove Favorite', '收藏服务器': 'Favorite Server',
  '复制 IP / 主机名': 'Copy IP / Hostname', '复制 SSH 连接命令': 'Copy SSH Command', '复制已保存密码': 'Copy Saved Password',
  '断开该主机全部终端': 'Disconnect All Host Terminals', '删除服务器': 'Delete Server',
  '清空只影响本地显示，不会终止服务器任务': 'Clearing only affects this view and will not stop remote tasks.',
  '收藏': 'Favorite', '取消收藏': 'Remove Favorite', '编辑服务器': 'Edit Server', '服务器详情': 'Server Details',
  '为当前服务器新建独立终端': 'New independent terminal for this server', '尚未连接': 'Not connected',
  '原位翻译选中内容或全部终端输出': 'Translate the selection or all terminal output in place', '切换翻译接口': 'Switch translation provider',
  '服务器名称': 'Server name', 'IP 地址或域名': 'IP address or hostname', '登录用户名': 'Login username', 'SSH 端口': 'SSH port',
  '认证方式': 'Authentication', '服务器密码': 'Server password', 'SSH 私钥': 'SSH private key', '私钥文件': 'Private key file',
  '私钥口令（可选）': 'Key passphrase (optional)', '分组': 'Group', '标记颜色': 'Label color', '管理备注': 'Management notes',
  '收藏这台服务器': 'Favorite this server', '删除': 'Delete', '取消': 'Cancel', '保存服务器': 'Save server',
  '显示或隐藏密码': 'Show or hide password', '查看': 'Show', '隐藏': 'Hide', '复制命令': 'Copy command', '用户名': 'Username',
  '未保存': 'Not saved', '使用 SSH 私钥': 'Using SSH private key', '密码认证': 'Password authentication', '编辑信息': 'Edit details',
  '凭据由系统安全存储加密': 'Credentials are encrypted by system secure storage', '快捷运维命令': 'Operations Commands',
  '搜索命令、用途…': 'Search commands or purpose…', '没有匹配的运维命令': 'No matching commands', '运行命令': 'Run command',
  '翻译中': 'Translating', '翻译模式': 'Translation mode', '查看原文': 'View Original', '显示译文': 'Show Translation',
  '退出翻译': 'Exit Translation', '重新翻译': 'Translate Again', '复制中文': 'Copy Chinese', '翻译完成': 'Translation complete',
  '例如：香港生产服务器': 'e.g. Hong Kong production server', '已加密保存，点击眼睛查看': 'Encrypted; click the eye to reveal',
  '输入服务器登录密码': 'Enter the server login password', '密码会使用系统安全存储加密，可随时查看和复制': 'The password is encrypted by system secure storage and can be revealed or copied anytime',
  '选择 ~/.ssh 下的私钥': 'Choose a private key from ~/.ssh', '已加密保存': 'Encrypted and saved', '没有口令可留空': 'Leave blank if there is no passphrase',
  '我的主机': 'My Hosts', '机房、用途、续费时间等信息…': 'Data center, purpose, renewal date…',
  '服务器': 'Server', '条只读命令': 'read-only commands', '编辑后运行': 'Edit before running',
  '可以修改参数、路径或筛选条件，确认前不会执行。': 'Adjust parameters, paths, or filters. Nothing runs until you confirm.',
  '关闭编辑': 'Close editor', '将在当前 SSH 会话中执行 · ⌘/Ctrl + Enter': 'Runs in the current SSH session · ⌘/Ctrl + Enter',
  '连接服务器后才能运行': 'Connect to a server before running',
  '全部': 'All', '系统': 'System', '资源': 'Resources', '网络': 'Network', '服务日志': 'Services & Logs', '容器': 'Containers', '安全': 'Security',
  '点击命令会先进入编辑区，确认后才执行': 'Commands open in the editor and run only after confirmation',
  '可先查看和编辑，连接服务器后运行': 'Review and edit now; run after connecting to a server',
  'SSH 连接诊断': 'SSH Connection Diagnostics', '建议按以下顺序检查': 'Check in this order', '查看英文原始错误': 'View original error',
  '复制诊断': 'Copy Diagnostics', '重新连接': 'Reconnect', '主题与外观': 'Theme & Appearance', '界面语言': 'Interface Language',
  '云雾浅蓝': 'Mist Blue', '深夜蓝': 'Midnight Blue', '黑曜灰': 'Obsidian', '极光紫': 'Aurora', '日间浅色': 'Daylight', '中文': 'Chinese', '英文': 'English',
}
const tx = (language, value) => language === 'en' ? englishUi[value] || value : value
const englishDiagnosticTitles = {
  AUTH_FAILED: 'Incorrect username or password', PASSWORD_AUTH_FAILED: 'Incorrect username or password',
  CONNECTION_REFUSED: 'SSH port refused the connection', PORT_REFUSED: 'SSH port refused the connection',
  CONNECTION_TIMEOUT: 'Server connection timed out', HOST_UNREACHABLE: 'Server is unreachable',
  HOST_KEY_FAILED: 'Host key verification failed', KEY_AUTH_FAILED: 'SSH key authentication failed',
  SHELL_FAILED: 'Could not start the remote terminal', UNKNOWN: 'SSH connection failed',
}
const englishDiagnosticMessages = {
  AUTH_FAILED: 'The server rejected the supplied credentials. Check the username, password, and authentication policy.',
  PASSWORD_AUTH_FAILED: 'The server rejected the supplied password. Check the username and password, then try again.',
  CONNECTION_REFUSED: 'The host responded, but no SSH service accepted the connection on this port.',
  PORT_REFUSED: 'The host responded, but no SSH service accepted the connection on this port.',
  CONNECTION_TIMEOUT: 'SlothSSH could not reach the SSH service before the connection timed out.',
  HOST_UNREACHABLE: 'The host cannot be reached from the current network.',
  HOST_KEY_FAILED: 'The server identity could not be verified safely.',
  KEY_AUTH_FAILED: 'The server rejected the selected private key or its passphrase.',
  SHELL_FAILED: 'Authentication succeeded, but the server did not provide an interactive shell.',
}
const terminalThemes = {
  codex: { background: '#c8dde6', foreground: '#202a30', cursor: '#1478c8', selectionBackground: '#5c9ec75c', black: '#263238', red: '#a94950', green: '#17705f', yellow: '#875f22', blue: '#245f98', magenta: '#745083', cyan: '#1d7080', white: '#eaf3f6', brightBlack: '#667780', brightWhite: '#f7fbfc' },
  midnight: { background: '#090c12', foreground: '#d7dce8', cursor: '#8c98ff', selectionBackground: '#7c8cff44', black: '#11151d', red: '#f07178', green: '#72d7b1', yellow: '#f2c17a', blue: '#7c9cf5', magenta: '#c792ea', cyan: '#60c9d4', white: '#e8ebf2', brightBlack: '#5a6272' },
  graphite: { background: '#111315', foreground: '#e0dfdb', cursor: '#d9a963', selectionBackground: '#d9a9633d', black: '#17191b', red: '#e17373', green: '#8cc990', yellow: '#d9b66f', blue: '#83a9d8', magenta: '#bb91c7', cyan: '#78b9b5', white: '#f1efe9', brightBlack: '#666965' },
  aurora: { background: '#090c18', foreground: '#dce5f3', cursor: '#61e7d2', selectionBackground: '#725cff4d', black: '#11162a', red: '#ff7588', green: '#62e6b6', yellow: '#f5c879', blue: '#6ba8ff', magenta: '#c38cff', cyan: '#55e0e8', white: '#edf4ff', brightBlack: '#64708e' },
  daylight: { background: '#111827', foreground: '#e5e7eb', cursor: '#7c8cff', selectionBackground: '#7c8cff55', black: '#111827', red: '#fb7185', green: '#6ee7b7', yellow: '#fbbf24', blue: '#93c5fd', magenta: '#d8b4fe', cyan: '#67e8f9', white: '#f8fafc', brightBlack: '#64748b' },
}
const commandCategories = [
  ['all', '全部'], ['system', '系统'], ['resource', '资源'], ['network', '网络'],
  ['service', '服务日志'], ['container', '容器'], ['security', '安全'],
]
const quickCommands = [
  { category: 'system', label: '系统概览', description: '内核、架构和运行时间', command: 'uname -a && printf "\\n" && uptime' },
  { category: 'system', label: '系统版本', description: '查看 Linux 发行版信息', command: 'cat /etc/os-release 2>/dev/null || sw_vers' },
  { category: 'system', label: '启动时间', description: '最近启动与当前时间', command: 'date && who -b 2>/dev/null && uptime -s 2>/dev/null' },
  { category: 'resource', label: 'CPU 进程', description: 'CPU 占用最高的进程', command: 'ps aux --sort=-%cpu 2>/dev/null | head -20 || ps aux | head -20' },
  { category: 'resource', label: '内存使用', description: '内存与交换空间', command: 'free -h 2>/dev/null || vm_stat' },
  { category: 'resource', label: '磁盘容量', description: '文件系统容量与使用率', command: 'df -hT 2>/dev/null || df -h' },
  { category: 'resource', label: 'inode 使用', description: '排查磁盘有空间但无法写入', command: 'df -ih' },
  { category: 'network', label: '地址与路由', description: '网卡地址和默认路由', command: 'ip -br address 2>/dev/null && printf "\\n" && ip route 2>/dev/null || ifconfig' },
  { category: 'network', label: '监听端口', description: '查看正在监听的 TCP/UDP 端口', command: 'ss -lntup 2>/dev/null || netstat -lntup 2>/dev/null' },
  { category: 'network', label: '连接统计', description: '当前网络连接汇总', command: 'ss -s 2>/dev/null || netstat -s | head -60' },
  { category: 'service', label: '失败服务', description: 'systemd 启动失败的服务', command: 'systemctl --failed --no-pager 2>/dev/null || true' },
  { category: 'service', label: '运行中服务', description: '当前正在运行的服务', command: 'systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -80' },
  { category: 'service', label: '严重系统日志', description: '本次启动的错误级日志', command: 'journalctl -b -p err -n 100 --no-pager 2>/dev/null' },
  { category: 'service', label: '最近系统日志', description: '最近 100 条系统事件', command: 'journalctl -n 100 --no-pager 2>/dev/null || dmesg | tail -100' },
  { category: 'container', label: 'Docker 容器', description: '容器状态和端口', command: 'docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"' },
  { category: 'container', label: 'Docker 资源', description: '容器 CPU 与内存占用', command: 'docker stats --no-stream' },
  { category: 'container', label: 'Docker 空间', description: '镜像、容器和卷占用', command: 'docker system df' },
  { category: 'security', label: '最近登录', description: '用户登录历史和来源', command: 'last -n 30' },
  { category: 'security', label: 'SSH 失败记录', description: '最近 24 小时失败登录', command: 'journalctl -u ssh -u sshd --since "-24 hours" --no-pager 2>/dev/null | grep -Ei "failed|invalid|error" | tail -100' },
  { category: 'security', label: '防火墙状态', description: '自动识别常见防火墙', command: 'ufw status verbose 2>/dev/null || firewall-cmd --state 2>/dev/null || nft list ruleset 2>/dev/null | head -100 || iptables -S 2>/dev/null' },
]
const providerLabels = {
  free: '免费基础', google: 'Google', baidu: '百度', tencent: '腾讯云', aliyun: '阿里云', openai: '大模型',
}
const providerLabelsEn = {
  free: 'Free Basic', google: 'Google', baidu: 'Baidu', tencent: 'Tencent', aliyun: 'Alibaba', openai: 'LLM API',
}
const shellCommandLinePatterns = [
  /^(?:(?:\[[^\]]+@[^\]]+\][#$])|(?:[\w.-]+@[\w.-]+(?::[^#$]*)?[#$]))\s*\S.*$/,
  /^(?:\([^)]+\)\s*)?(?:[\w.-]+@)?[\w.-]+(?::[^#$]*)?[#$]\s+\S.*$/,
  /^\s*[#$]\s+\S.*$/,
]
const isShellCommandLine = (line) => {
  const value = String(line || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  return !value.includes('● SlothSSH 终端已就绪') && shellCommandLinePatterns.some((pattern) => pattern.test(value))
}
const llmPresets = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', guide: 'https://api-docs.deepseek.com/', key: 'https://platform.deepseek.com/api_keys' },
  qwen: { label: '阿里百炼 · 通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', guide: 'https://help.aliyun.com/zh/model-studio/first-api-call-to-qwen', key: 'https://help.aliyun.com/zh/model-studio/get-api-key/' },
  zhipu: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.1', guide: 'https://docs.bigmodel.cn/cn/guide/develop/openai/introduction', key: 'https://open.bigmodel.cn/usercenter/apikeys' },
  siliconflow: { label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3-8B', guide: 'https://docs.siliconflow.cn/cn/userguide/capabilities/text-generation', key: 'https://cloud.siliconflow.cn/account/ak' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', guide: 'https://platform.openai.com/docs/api-reference/chat', key: 'https://platform.openai.com/api-keys' },
  custom: { label: '自定义兼容接口', baseUrl: '', model: '', guide: '', key: '' },
}

function App() {
  const [hosts, setHosts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [activeView, setActiveView] = useState('hosts')
  const [status, setStatus] = useState({ state: 'disconnected', message: '尚未连接' })
  const [terminalSessions, setTerminalSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [terminalReadyVersion, setTerminalReadyVersion] = useState(0)
  const [hostMenu, setHostMenu] = useState(null)
  const [toast, setToast] = useState('')
  const [commandDraft, setCommandDraft] = useState('')
  const [inlineTranslation, setInlineTranslation] = useState(null)
  const [translationProvider, setTranslationProvider] = useState('free')
  const [translationFailureDelay, setTranslationFailureDelay] = useState(15)
  const [terminalMenu, setTerminalMenu] = useState(null)
  const [disconnectPrompt, setDisconnectPrompt] = useState(null)
  const [serverToolsOpen, setServerToolsOpen] = useState(false)
  const [serverStats, setServerStats] = useState(null)
  const [remotePath, setRemotePath] = useState('')
  const [remoteFiles, setRemoteFiles] = useState([])
  const [selectedRemoteFile, setSelectedRemoteFile] = useState(null)
  const [remoteClipboard, setRemoteClipboard] = useState(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [terminalDropActive, setTerminalDropActive] = useState(false)
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('slothssh:fontSize')) || 13)
  const [theme, setTheme] = useState(() => {
    const designVersion = localStorage.getItem('slothssh:designVersion')
    let initialTheme
    if (designVersion !== '2') {
      localStorage.setItem('slothssh:designVersion', '2')
      initialTheme = 'codex'
    } else {
      initialTheme = localStorage.getItem('slothssh:theme') || 'codex'
    }
    document.documentElement.dataset.theme = initialTheme
    return initialTheme
  })
  const [language, setLanguage] = useState(() => localStorage.getItem('slothssh:language') || 'zh')
  const terminalApi = useRef(null)
  const sessionTerminalsRef = useRef(new Map())
  const pendingTerminalDataRef = useRef(new Map())
  const activeSessionIdRef = useRef(null)
  const searchRef = useRef(null)
  const commandDecorationsRef = useRef(new Map())
  const t = (value) => tx(language, value)

  const clearCommandDecorations = () => {
    for (const item of commandDecorationsRef.current.values()) {
      try { item.decoration?.dispose() } catch { /* decoration already removed */ }
      try { item.marker?.dispose() } catch { /* marker already removed */ }
    }
    commandDecorationsRef.current.clear()
  }

  const highlightTerminalCommands = (terminal = terminalApi.current?.terminal) => {
    if (!terminal?.registerDecoration || !terminal?.registerMarker) return
    const buffer = terminal.buffer.active
    const cursorLine = buffer.baseY + buffer.cursorY
    const start = Math.max(0, buffer.length - 240)
    for (let index = start; index < buffer.length; index += 1) {
      const line = buffer.getLine(index)
      const text = line?.translateToString(true).trimEnd() || ''
      if (!isShellCommandLine(text)) continue
      let row = index
      do {
        const wrappedLine = buffer.getLine(row)
        if (!wrappedLine) break
        const key = `${terminal.__slothSessionId || 'terminal'}:${row}:${wrappedLine.translateToString(true)}`
        if (!commandDecorationsRef.current.has(key)) {
          let marker
          try {
            marker = terminal.registerMarker(row - cursorLine)
            const decoration = marker && terminal.registerDecoration({
              marker,
              x: 0,
              width: terminal.cols,
              backgroundColor: '#2b2313',
              foregroundColor: '#ffd27a',
            })
            if (marker && decoration) {
              commandDecorationsRef.current.set(key, { marker, decoration })
              marker.onDispose(() => commandDecorationsRef.current.delete(key))
            } else {
              marker?.dispose()
            }
          } catch {
            marker?.dispose()
          }
        }
        row += 1
      } while (row < buffer.length && buffer.getLine(row)?.isWrapped)
    }
  }

  const reloadHosts = async (keepSelection = true) => {
    const items = await api.hosts.list()
    setHosts(items)
    if (!keepSelection || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id || null)
    }
    return items
  }

  const refreshTranslationProvider = async () => {
    const settings = await api.translate.getSettings()
    setTranslationProvider(settings.translationProvider || 'free')
    setTranslationFailureDelay(Number(settings.translationFailureDelay) || 15)
    return settings
  }

  useEffect(() => { reloadHosts(false); refreshTranslationProvider() }, [])
  useEffect(() => {
    localStorage.setItem('slothssh:theme', theme)
    document.documentElement.dataset.theme = theme
    for (const instance of sessionTerminalsRef.current.values()) {
      if (instance?.terminal) instance.terminal.options.theme = terminalThemes[theme] || terminalThemes.midnight
    }
  }, [theme])
  useEffect(() => {
    localStorage.setItem('slothssh:language', language)
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
  }, [language])
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
    const session = terminalSessions.find((item) => item.id === activeSessionId)
    setStatus(session?.status || { state: 'disconnected', message: '尚未连接' })
    terminalApi.current = sessionTerminalsRef.current.get(activeSessionId) || null
  }, [activeSessionId, terminalSessions])

  useEffect(() => api.ssh.onStatus((nextStatus) => {
    if (!nextStatus?.sessionId) return
    setTerminalSessions((current) => current.map((item) => item.id === nextStatus.sessionId ? { ...item, status: nextStatus } : item))
    if (activeSessionIdRef.current === nextStatus.sessionId) setStatus(nextStatus)
  }), [])

  useEffect(() => api.ssh.onData((payload) => {
    const sessionId = payload?.sessionId
    const data = typeof payload === 'object' ? payload.data : payload
    const instance = sessionTerminalsRef.current.get(sessionId)
    if (!instance) {
      pendingTerminalDataRef.current.set(sessionId, `${pendingTerminalDataRef.current.get(sessionId) || ''}${data || ''}`)
      return
    }
    instance.terminal.write(String(data || ''), () => {
      instance.terminal.scrollToBottom()
      highlightTerminalCommands(instance.terminal)
    })
  }), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const listener = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setModal('new')
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setModal('commands')
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  useEffect(() => {
    if (!inlineTranslation) return
    const exitTranslation = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setInlineTranslation(null)
        setTimeout(() => terminalApi.current?.terminal.focus(), 0)
      }
    }
    window.addEventListener('keydown', exitTranslation, true)
    return () => window.removeEventListener('keydown', exitTranslation, true)
  }, [inlineTranslation])

  useEffect(() => {
    if (!terminalMenu) return
    const close = (event) => {
      if (event.key === 'Escape' || event.type !== 'keydown') setTerminalMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('blur', close)
    }
  }, [terminalMenu])

  useEffect(() => {
    if (!hostMenu) return
    const close = (event) => {
      if (event.key === 'Escape' || event.type !== 'keydown') setHostMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('blur', close)
    }
  }, [hostMenu])

  useEffect(() => {
    localStorage.setItem('slothssh:fontSize', String(fontSize))
    for (const instance of sessionTerminalsRef.current.values()) {
      instance.terminal.options.fontSize = fontSize
      requestAnimationFrame(() => instance.fit.fit())
    }
  }, [fontSize])

  useEffect(() => {
    for (const session of terminalSessions) {
      const instance = sessionTerminalsRef.current.get(session.id)
      if (!instance || session.status?.state !== 'connected' || instance.readyWritten) continue
      instance.readyWritten = true
      requestAnimationFrame(() => {
        try { instance.fit.fit() } catch { /* terminal may be hidden */ }
        instance.terminal.write('\x1b[38;2;124;140;255m● SlothSSH 终端已就绪\x1b[0m\r\n', () => {
          instance.terminal.refresh(0, Math.max(0, instance.terminal.rows - 1))
          instance.terminal.scrollToBottom()
          highlightTerminalCommands(instance.terminal)
        })
        api.ssh.resize(session.id, { cols: instance.terminal.cols, rows: instance.terminal.rows })
        api.ssh.input(session.id, '\r')
      })
    }
  }, [terminalSessions, terminalReadyVersion])

  useEffect(() => {
    const instance = sessionTerminalsRef.current.get(activeSessionId)
    if (!instance) return
    terminalApi.current = instance
    requestAnimationFrame(() => {
      try { instance.fit.fit() } catch { /* session panel is switching */ }
      instance.terminal.refresh(0, Math.max(0, instance.terminal.rows - 1))
      instance.terminal.focus()
    })
  }, [activeSessionId, terminalReadyVersion])

  const selected = hosts.find((host) => host.id === selectedId)
  const activeSession = terminalSessions.find((session) => session.id === activeSessionId)
  const isConnected = status.state === 'connected'
  const isConnecting = status.state === 'connecting'
  const isDisconnecting = status.state === 'disconnecting'

  const loadServerStats = async () => {
    if (!isConnected) return
    const result = await api.server.stats(activeSessionId)
    if (result.ok) setServerStats(result)
  }

  const loadRemoteDirectory = async (targetPath) => {
    if (!isConnected) return false
    setRemoteLoading(true)
    setRemoteError('')
    const result = await api.sftp.list(activeSessionId, targetPath)
    setRemoteLoading(false)
    if (!result.ok) {
      setRemoteError(result.error || '无法读取远程目录')
      return false
    }
    setRemotePath(result.path)
    setRemoteFiles(result.files)
    setSelectedRemoteFile(null)
    return true
  }

  const initializeServerTools = async () => {
    if (!isConnected) return
    loadServerStats()
    if (remotePath) {
      await loadRemoteDirectory(remotePath)
      return
    }
    const home = await api.sftp.home(activeSessionId)
    if (home.ok) await loadRemoteDirectory(home.path)
    else setRemoteError(home.error || '无法读取服务器主目录')
  }

  const toggleServerTools = () => {
    if (!isConnected) {
      setToast('连接服务器后才能查看资源和文件')
      return
    }
    const opening = !serverToolsOpen
    setServerToolsOpen(opening)
    if (opening) initializeServerTools()
  }

  const uploadFiles = async (fileList, targetDirectory = remotePath) => {
    const files = Array.from(fileList || [])
    if (!isConnected || !files.length) return
    let destination = targetDirectory
    if (!destination) {
      const home = await api.sftp.home(activeSessionId)
      if (!home.ok) {
        setToast(home.error || '无法确定上传目录')
        return
      }
      destination = home.path
      setRemotePath(destination)
    }
    for (const file of files) {
      const localPath = api.sftp.pathForFile(file)
      if (!localPath) {
        setToast(`无法读取本地文件：${file.name}`)
        continue
      }
      setUploadProgress({ fileName: file.name, transferred: 0, total: file.size || 0, destination })
      let result = await api.sftp.upload({ sessionId: activeSessionId, localPath, fileName: file.name, remoteDirectory: destination, overwrite: false })
      if (result.exists) {
        const overwrite = window.confirm(`${result.path} 已存在，是否覆盖？\n\n取消将保留服务器上的原文件。`)
        if (overwrite) result = await api.sftp.upload({ sessionId: activeSessionId, localPath, fileName: file.name, remoteDirectory: destination, overwrite: true })
        else continue
      }
      if (!result.ok) setToast(`${file.name} 上传失败：${result.error}`)
      else setToast(`${file.name} 已上传到 ${destination}`)
    }
    setUploadProgress(null)
    if (serverToolsOpen && destination === remotePath) await loadRemoteDirectory(destination)
  }

  const createRemoteFolder = async () => {
    const name = window.prompt('新文件夹名称')?.trim()
    if (!name) return
    const result = await api.sftp.mkdir(activeSessionId, remotePath, name)
    if (!result.ok) setToast(`创建失败：${result.error}`)
    else {
      setToast(`已创建文件夹 ${name}`)
      loadRemoteDirectory(remotePath)
    }
  }

  const copyRemoteFile = () => {
    if (!selectedRemoteFile) return
    setRemoteClipboard(selectedRemoteFile)
    setToast(`已复制 ${selectedRemoteFile.name}，进入目标文件夹后点“粘贴”`)
  }

  const pasteRemoteFile = async () => {
    if (!remoteClipboard || !remotePath) return
    const result = await api.sftp.copy({ sessionId: activeSessionId, source: remoteClipboard.path, destinationDirectory: remotePath })
    if (!result.ok) setToast(`粘贴失败：${result.error}`)
    else {
      setToast(`已创建 ${result.name}`)
      await loadRemoteDirectory(remotePath)
    }
  }

  const deleteRemoteFile = async () => {
    if (!selectedRemoteFile) return
    const type = selectedRemoteFile.directory ? '文件夹及其全部内容' : '文件'
    const confirmed = window.confirm(`确定要删除${type}“${selectedRemoteFile.name}”吗？\n\n该操作会立即修改服务器，无法撤销。`)
    if (!confirmed) return
    const result = await api.sftp.remove(activeSessionId, selectedRemoteFile.path)
    if (!result.ok) setToast(`删除失败：${result.error}`)
    else {
      setToast(`已删除 ${selectedRemoteFile.name}`)
      await loadRemoteDirectory(remotePath)
    }
  }

  useEffect(() => api.sftp.onProgress((progress) => {
    if (!progress?.sessionId || progress.sessionId === activeSessionIdRef.current) setUploadProgress((current) => ({ ...current, ...progress }))
  }), [])

  useEffect(() => {
    if (!isConnected) {
      setServerToolsOpen(false)
      setServerStats(null)
      setRemotePath('')
      setRemoteFiles([])
      setSelectedRemoteFile(null)
      setRemoteClipboard(null)
      setUploadProgress(null)
      return
    }
    if (!serverToolsOpen) return
    const timer = setInterval(loadServerStats, 10000)
    return () => clearInterval(timer)
  }, [isConnected, serverToolsOpen])

  useEffect(() => {
    requestAnimationFrame(() => {
      try { terminalApi.current?.fit.fit() } catch { /* panel transition */ }
    })
  }, [serverToolsOpen])

  const visibleHosts = useMemo(() => {
    let items = [...hosts]
    if (activeView === 'favorites') items = items.filter((host) => host.favorite)
    if (activeView === 'recent') items = items.filter((host) => host.lastConnectedAt).sort((a, b) => b.lastConnectedAt.localeCompare(a.lastConnectedAt))
    if (activeView === 'keys') items = items.filter((host) => host.authType === 'key')
    const needle = query.trim().toLowerCase()
    if (needle) items = items.filter((host) =>
      [host.name, host.hostname, host.username, host.group, host.notes].some((value) => String(value || '').toLowerCase().includes(needle)),
    )
    return items
  }, [hosts, activeView, query])

  const saveHost = async (host) => {
    const saved = await api.hosts.save(host)
    await reloadHosts()
    setSelectedId(saved.id)
    setModal(null)
    setToast('服务器信息已安全保存')
  }

  const deleteHost = async (host) => {
    await api.hosts.remove(host.id)
    setTerminalSessions((current) => current.filter((session) => session.hostId !== host.id))
    if (activeSession?.hostId === host.id) setActiveSessionId(null)
    await reloadHosts(false)
    setModal(null)
    setToast('主机已删除')
  }

  const toggleFavorite = async (host) => {
    await api.hosts.favorite(host.id, !host.favorite)
    await reloadHosts()
  }

  const selectHost = async (host) => {
    setSelectedId(host.id)
    const hostSessions = [...terminalSessions].reverse().filter((session) => session.hostId === host.id)
    const existing = hostSessions.find((session) => ['connected', 'connecting'].includes(session.status?.state)) || hostSessions[0]
    setActiveSessionId(existing?.id || null)
    setStatus(existing?.status || { state: 'disconnected', message: '尚未连接' })
    setInlineTranslation(null)
    setServerToolsOpen(false)
  }

  const startConnection = async (host = selected, forceNew = false) => {
    if (!host) return
    const reusable = !forceNew && activeSession?.hostId === host.id && !['connected', 'connecting'].includes(activeSession.status?.state)
      ? activeSession
      : null
    const existing = !forceNew && terminalSessions.find((session) => session.hostId === host.id && ['connected', 'connecting'].includes(session.status?.state))
    if (existing) {
      setSelectedId(host.id)
      setActiveSessionId(existing.id)
      setStatus(existing.status)
      return
    }
    const sessionId = reusable?.id || crypto.randomUUID()
    const terminalNumber = terminalSessions.filter((session) => session.hostId === host.id && session.id !== sessionId).length + 1
    const connectingStatus = { state: 'connecting', message: `正在建立连接 ${host.hostname}:${host.port}…`, hostId: host.id, sessionId, phase: 'network' }
    setTerminalSessions((current) => reusable
      ? current.map((item) => item.id === sessionId ? { ...item, status: connectingStatus } : item)
      : [...current, { id: sessionId, hostId: host.id, number: terminalNumber, status: connectingStatus }])
    setSelectedId(host.id)
    setActiveSessionId(sessionId)
    setStatus(connectingStatus)
    setInlineTranslation(null)
    setServerToolsOpen(false)
    setServerStats(null)
    setRemotePath('')
    setRemoteFiles([])
    if (reusable) {
      const instance = sessionTerminalsRef.current.get(sessionId)
      if (instance) { instance.readyWritten = false; instance.terminal.clear(); instance.terminal.reset() }
    }
    setModal(null)
    try {
      const result = await api.ssh.connect(host.id, sessionId)
      if (!result.ok) {
        if (result.diagnostic) {
          setTerminalSessions((current) => current.map((item) => item.id === sessionId ? { ...item, status: result.diagnostic } : item))
          setStatus(result.diagnostic)
        }
        return
      }
      await reloadHosts()
      setTimeout(() => terminalApi.current?.terminal.focus(), 100)
    } catch (error) {
      const failure = {
        state: 'error', code: 'APP_CONNECTION_ERROR', title: '连接进程异常',
        message: 'SlothSSH 在发起连接时遇到内部异常。', original: error.message,
        suggestions: ['重新尝试连接', '如果持续出现，复制诊断信息进行排查'], persistent: true, hostId: host.id, sessionId,
      }
      setTerminalSessions((current) => current.map((item) => item.id === sessionId ? { ...item, status: failure } : item))
      setStatus(failure)
    }
  }

  const connect = () => startConnection(selected, false)
  const newTerminal = (host = selected) => startConnection(host, true)

  const copyConnectionDiagnostic = async () => {
    if (status.state !== 'error') return
    const diagnostic = [
      `SlothSSH 连接诊断：${status.title || '连接失败'}`,
      `目标：${selected?.username || status.username || ''}@${selected?.hostname || status.host || ''}:${selected?.port || status.port || 22}`,
      `错误代码：${status.code || 'UNKNOWN'}`,
      `阶段：${status.phase || 'network'}`,
      `说明：${status.message || ''}`,
      `建议：${(status.suggestions || []).join('；')}`,
      `原始错误：${status.original || '无'}`,
      `时间：${status.occurredAt || new Date().toISOString()}`,
    ].join('\n')
    await api.clipboard.writeText(diagnostic)
    setToast('已复制中文连接诊断')
  }

  const disconnect = async (requestedSessionId) => {
    const sessionId = typeof requestedSessionId === 'string' ? requestedSessionId : activeSessionId
    if (!sessionId) return
    const disconnectingStatus = { state: 'disconnecting', message: '正在断开…', hostId: selected?.id, sessionId }
    setTerminalSessions((current) => current.map((item) => item.id === sessionId ? { ...item, status: disconnectingStatus } : item))
    if (activeSessionId === sessionId) setStatus(disconnectingStatus)
    try {
      const result = await api.ssh.disconnect(sessionId)
      if (result?.ok === false) {
        const nextStatus = { state: 'disconnected', message: '会话已经断开', hostId: selected?.id, sessionId }
        setTerminalSessions((current) => current.map((item) => item.id === sessionId ? { ...item, status: nextStatus } : item))
        if (activeSessionId === sessionId) setStatus(nextStatus)
      }
      terminalApi.current?.terminal.blur()
      setToast('SSH 会话已断开')
    } catch (error) {
      setToast(`断开失败：${error.message}`)
    }
  }

  const closeTerminalSession = async (sessionId) => {
    await api.ssh.disconnect(sessionId)
    const remaining = terminalSessions.filter((session) => session.id !== sessionId)
    setTerminalSessions(remaining)
    pendingTerminalDataRef.current.delete(sessionId)
    if (activeSessionId === sessionId) {
      const next = remaining.at(-1)
      setActiveSessionId(next?.id || null)
      if (next) setSelectedId(next.hostId)
      else setStatus({ state: 'disconnected', message: '尚未连接' })
    }
  }

  const switchTerminalSession = (session) => {
    setActiveSessionId(session.id)
    setSelectedId(session.hostId)
    setStatus(session.status || { state: 'disconnected', message: '尚未连接' })
    setInlineTranslation(null)
    setServerToolsOpen(false)
    setCommandDraft('')
  }

  const runCommand = (command) => {
    if (!isConnected) {
      setToast('请先连接服务器')
      return
    }
    api.ssh.input(activeSessionId, `${command}\r`)
    setTimeout(() => highlightTerminalCommands(), 100)
    setModal(null)
    terminalApi.current?.terminal.focus()
  }

  const submitCommand = (event) => {
    event.preventDefault()
    const command = commandDraft.trim()
    if (!command || !isConnected) return
    api.ssh.input(activeSessionId, `${command}\r`)
    setTimeout(() => highlightTerminalCommands(), 100)
    setCommandDraft('')
    terminalApi.current?.terminal.focus()
  }

  const translateCommandDraft = () => {
    const command = commandDraft.trim()
    if (!command || !selected) {
      setToast('请先输入需要说明的命令')
      return
    }
    const host = terminalApi.current?.element
    requestTranslation({
      mode: 'selection',
      source: '当前输入命令',
      original: `${selected.username}@${selected.hostname}$ ${command}`,
      anchor: { top: Math.max(12, (host?.clientHeight || 500) - 385), left: 14 },
    })
  }

  const requestTranslation = async (base) => {
    const startedAt = performance.now()
    setInlineTranslation({ ...base, provider: translationProvider, loading: true, error: '', translated: '', showOriginal: false })
    const result = await api.translate.text(base.original)
    const hasFailure = !result.ok || Number(result.failedLines) > 0
    const remainingDelay = (translationFailureDelay * 1000) - (performance.now() - startedAt)
    if (hasFailure && remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay))
    }
    setInlineTranslation((current) => {
      if (!current || current.original !== base.original) return current
      return result.ok
        ? { ...current, loading: false, translated: result.translated, lines: result.lines, sourceLines: result.sourceLines, translatedLines: result.translatedLines, preservedLines: result.preservedLines, failedLines: result.failedLines, partialLines: result.partialLines, localLines: result.localLines, provider: result.provider, translatedChunks: result.translatedChunks, warning: result.warning }
        : { ...current, loading: false, error: result.error || '翻译失败' }
    })
  }

  const openTranslation = () => {
    const terminal = terminalApi.current?.terminal
    if (!terminal) {
      setToast('终端还没有可翻译的内容')
      return
    }

    const selection = terminal.getSelection().trim()
    if (selection) {
      const position = terminal.getSelectionPosition()
      const host = terminalApi.current?.element
      const row = host?.querySelector('.xterm-rows > div')
      const screen = host?.querySelector('.xterm-screen')
      const rowHeight = row?.getBoundingClientRect().height || fontSize * 1.5
      const charWidth = screen ? screen.getBoundingClientRect().width / Math.max(1, terminal.cols) : 8
      const viewportY = terminal.buffer.active.viewportY
      const rawTop = ((position?.start.y || viewportY) - viewportY + 1) * rowHeight + 12
      const rawLeft = (position?.start.x || 0) * charWidth + 14
      const anchor = {
        top: Math.max(10, Math.min(rawTop, (host?.clientHeight || 500) - 380)),
        left: Math.max(10, Math.min(rawLeft, (host?.clientWidth || 700) - 510)),
      }
      requestTranslation({ mode: 'selection', source: '选中内容', original: selection, anchor })
      return
    }

    const buffer = terminal.buffer.active
    const lines = []
    const physicalToLogical = []
    for (let index = 0; index < buffer.length; index += 1) {
      const bufferLine = buffer.getLine(index)
      const line = bufferLine?.translateToString(true).trimEnd() || ''
      if (bufferLine?.isWrapped && lines.length) lines[lines.length - 1] += line
      else lines.push(line)
      physicalToLogical[index] = Math.max(0, lines.length - 1)
    }
    const firstContentLine = lines.findIndex((line) => line.trim())
    let lastContentLine = lines.length - 1
    while (lastContentLine >= 0 && !lines[lastContentLine].trim()) lastContentLine -= 1
    const contentLines = firstContentLine >= 0 ? lines.slice(firstContentLine, lastContentLine + 1) : []
    const draftLine = commandDraft.trim() && selected
      ? `${selected.username}@${selected.hostname}$ ${commandDraft.trim()}`
      : ''
    const outputLines = draftLine ? [...contentLines, draftLine] : contentLines
    const allOutput = outputLines.join('\n')
    if (!allOutput) {
      setToast('请先选中英文，或等待终端产生输出')
      return
    }
    const viewportLogicalLine = physicalToLogical[Math.min(buffer.viewportY, physicalToLogical.length - 1)] || 0
    const viewportLine = Math.max(0, viewportLogicalLine - Math.max(0, firstContentLine))
    const scrollRatio = Math.min(1, viewportLine / Math.max(1, outputLines.length - terminal.rows))
    requestTranslation({ mode: 'all', source: draftLine ? '终端输出与当前命令' : '全部终端输出', original: allOutput, initialLine: viewportLine, scrollRatio })
  }

  const retryInlineTranslation = () => {
    if (inlineTranslation) requestTranslation(inlineTranslation)
  }

  const copyInlineTranslation = async () => {
    if (!inlineTranslation?.translated) return
    await navigator.clipboard.writeText(inlineTranslation.translated)
    setToast('中文翻译已复制')
  }

  const getTerminalText = () => {
    const terminal = terminalApi.current?.terminal
    if (!terminal) return ''
    const buffer = terminal.buffer.active
    let output = ''
    for (let index = 0; index < buffer.length; index += 1) {
      const line = buffer.getLine(index)
      if (!line) continue
      output += line.translateToString(true)
      if (!line.isWrapped) output += '\n'
    }
    return output.trimEnd()
  }

  const copyTerminalSelection = async () => {
    const text = terminalApi.current?.terminal.getSelection() || ''
    if (!text) return
    await api.clipboard.writeText(text)
    setTerminalMenu(null)
    setToast('已复制选中的终端内容')
  }

  const copyTerminalAll = async () => {
    const text = getTerminalText()
    if (!text) return
    await api.clipboard.writeText(text)
    setTerminalMenu(null)
    setToast(`已复制全部终端内容（${text.split('\n').length} 行）`)
  }

  const pasteIntoTerminal = async () => {
    if (!isConnected) {
      setToast('连接服务器后才能粘贴到终端')
      setTerminalMenu(null)
      return
    }
    const selectedText = terminalApi.current?.terminal.getSelection() || ''
    const text = selectedText || await api.clipboard.readText()
    if (text) await api.ssh.input(activeSessionId, text)
    setTerminalMenu(null)
    if (text) setToast(selectedText ? '已将终端选中内容粘贴到命令行' : '已粘贴剪贴板内容')
    terminalApi.current?.terminal.focus()
  }

  const selectTerminalAll = () => {
    terminalApi.current?.terminal.selectAll()
    setTerminalMenu(null)
    setToast('已选中全部终端内容，可按 ⌘C 复制')
  }

  const clearTerminalWindow = () => {
    clearCommandDecorations()
    terminalApi.current?.terminal.clear()
    setInlineTranslation(null)
    setTerminalMenu(null)
    setToast('已清空本地终端窗口，不影响服务器进程')
    setTimeout(() => terminalApi.current?.terminal.focus(), 0)
  }

  const openTerminalMenu = (event) => {
    event.preventDefault()
    const terminal = terminalApi.current?.terminal
    if (!terminal) return
    const wrap = event.currentTarget.closest('.terminal-wrap')
    const bounds = wrap?.getBoundingClientRect()
    const x = Math.max(8, Math.min(event.clientX - (bounds?.left || 0), (bounds?.width || 700) - 224))
    const y = Math.max(8, Math.min(event.clientY - (bounds?.top || 0), (bounds?.height || 500) - 240))
    setTerminalMenu({ x, y, hasSelection: terminal.hasSelection() })
    terminal.focus()
  }

  const openHostMenu = (event, host) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(host.id)
    setHostMenu({ x: Math.min(event.clientX, window.innerWidth - 245), y: Math.min(event.clientY, window.innerHeight - 390), host })
  }

  const disconnectHostSessions = async (host) => {
    const targets = terminalSessions.filter((session) => session.hostId === host.id)
    await Promise.all(targets.map((session) => api.ssh.disconnect(session.id)))
    setTerminalSessions((current) => current.map((session) => session.hostId === host.id ? { ...session, status: { state: 'disconnected', message: '已主动断开', hostId: host.id, sessionId: session.id } } : session))
    if (targets.some((session) => session.id === activeSessionId)) setStatus({ state: 'disconnected', message: '已主动断开' })
    setHostMenu(null)
  }

  const deleteHostFromMenu = async (host) => {
    if (!window.confirm(`确定要删除服务器“${host.name}”吗？\n\n已保存的连接信息和密码将被删除。`)) return
    await disconnectHostSessions(host)
    setTerminalSessions((current) => current.filter((session) => session.hostId !== host.id))
    await deleteHost(host)
  }

  return (
    <main className={`app-shell ${serverToolsOpen ? 'tools-left' : ''}`}>
      <aside className="rail">
        <div className="brand"><img src={slothLogo} alt="SlothSSH" /></div>
        <nav className="rail-nav">
          <RailButton icon={LayoutGrid} active={activeView === 'hosts'} label={t('全部主机')} onClick={() => setActiveView('hosts')} />
          <RailButton icon={Star} active={activeView === 'favorites'} label={t('收藏主机')} onClick={() => setActiveView('favorites')} />
          <RailButton icon={Clock3} active={activeView === 'recent'} label={t('最近连接')} onClick={() => setActiveView('recent')} />
          <RailButton icon={FolderKey} active={activeView === 'keys'} label={t('密钥主机')} onClick={() => setActiveView('keys')} />
        </nav>
        <RailButton icon={Settings} active={modal === 'settings'} label={t('设置')} onClick={() => setModal('settings')} />
      </aside>

      <section className={`host-panel ${serverToolsOpen ? 'tools-view' : ''}`}>
        <header className="drag-region panel-heading">
          <div><p className="eyebrow">{viewMeta[activeView][0]}</p><h1>{t(viewMeta[activeView][1])}</h1></div>
          <button className="icon-button no-drag" title={t('添加主机')} onClick={() => setModal('new')}><CirclePlus size={19} /></button>
        </header>
        <div className="search-box">
          <Search size={15} />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('搜索主机、IP、备注…')} />
          <kbd>⌘ K</kbd>
        </div>
        <div className="group-label"><span>{t(viewMeta[activeView][1])}</span><span>{visibleHosts.length}</span></div>
        <div className="host-list">
          {visibleHosts.map((host) => (
            <div key={host.id} className={`host-card ${selectedId === host.id ? 'selected' : ''}`} onClick={() => selectHost(host)} onContextMenu={(event) => openHostMenu(event, host)}>
              <span className="server-avatar" style={{ '--accent': host.color }}><Server size={17} /></span>
              <span className="host-copy"><strong>{host.name}</strong><small>{host.username}@{host.hostname}</small></span>
              <button className={`card-star ${host.favorite ? 'active' : ''}`} title={t(host.favorite ? '取消收藏' : '收藏')} onClick={(event) => { event.stopPropagation(); toggleFavorite(host) }}><Star size={13} fill={host.favorite ? 'currentColor' : 'none'} /></button>
              {terminalSessions.some((session) => session.hostId === host.id && session.status?.state === 'connected') && <span className="host-session-count">{terminalSessions.filter((session) => session.hostId === host.id && session.status?.state === 'connected').length}</span>}
            </div>
          ))}
          {!visibleHosts.length && <div className="host-empty"><Server size={24} /><p>{t(query ? '没有匹配的主机' : '这里还没有主机')}</p><button onClick={() => setModal('new')}>{t('添加服务器')}</button></div>}
        </div>
        <div className="security-note"><ShieldCheck size={14} /><span>{t('密码由系统安全存储加密保存')}</span></div>
        {serverToolsOpen && <ServerToolsPanel
          stats={serverStats}
          remotePath={remotePath}
          files={remoteFiles}
          selectedFile={selectedRemoteFile}
          clipboardFile={remoteClipboard}
          loading={remoteLoading}
          error={remoteError}
          upload={uploadProgress}
          onClose={() => setServerToolsOpen(false)}
          onRefresh={() => { loadServerStats(); loadRemoteDirectory(remotePath) }}
          onHome={async () => { const home = await api.sftp.home(activeSessionId); if (home.ok) loadRemoteDirectory(home.path) }}
          onParent={() => loadRemoteDirectory(remotePath === '/' ? '/' : remotePath.split('/').slice(0, -1).join('/') || '/')}
          onOpen={loadRemoteDirectory}
          onSelect={setSelectedRemoteFile}
          onCopy={copyRemoteFile}
          onPaste={pasteRemoteFile}
          onDelete={deleteRemoteFile}
          onCreateFolder={createRemoteFolder}
          onUpload={(files, destination) => uploadFiles(files, destination)}
          t={t}
          language={language}
        />}
      </section>

      <section className="workspace">
        <header className="topbar drag-region">
          <div className="window-space" />
          <button className="session-title no-drag" onClick={() => selected && setModal('details')}>
            <span className="session-icon" style={{ '--accent': selected?.color || '#7c8cff' }}><Server size={18} /></span>
            <span className="session-copy"><strong>{selected?.name || 'SlothSSH'}</strong><small>{selected ? `${selected.username}@${selected.hostname}:${selected.port}` : language === 'en' ? 'Simple, efficient server management' : '简单、高效地管理你的服务器'}</small></span>
            {selected && <ChevronDown size={14} className="muted" />}
          </button>
          <div className="top-actions no-drag">
            <button className="locale-toggle" title={language === 'zh' ? 'Switch to English' : '切换到中文'} onClick={() => setLanguage((value) => value === 'zh' ? 'en' : 'zh')}><span>{language === 'zh' ? '🇨🇳' : '🇺🇸'}</span><em>{language === 'zh' ? '中文' : 'EN'}</em></button>
            {selected && <button className={`quick-button ${serverToolsOpen ? 'active' : ''}`} title={t('文件与资源')} onClick={toggleServerTools}><Folder size={15} /><span>{t('文件与资源')}</span></button>}
            {selected && <div className={`translate-control ${inlineTranslation ? 'active' : ''}`}>
              <button className="translate-main" title={t('原位翻译选中内容或全部终端输出')} onClick={openTranslation}><Languages size={15} /><span>{t('翻译')}</span><em>{(language === 'en' ? providerLabelsEn : providerLabels)[translationProvider] || (language === 'en' ? 'Custom' : '自定义')}</em></button>
              <button className="translate-switch" title={t('切换翻译接口')} onClick={() => setModal('settings')}><ChevronDown size={13} /><span>{t('切换')}</span></button>
            </div>}
            {selected && <button className="quick-button" title={`${t('快捷命令')} (⌘⇧P)`} onClick={() => setModal('commands')}><Zap size={15} /><span>{t('快捷命令')}</span></button>}
            {selected && <button className="icon-button" title={t('编辑服务器')} onClick={() => setModal('edit')}><Pencil size={16} /></button>}
            {selected && <button className="icon-button" title={t('服务器详情')} onClick={() => setModal('details')}><MoreHorizontal size={18} /></button>}
            {isDisconnecting ? <button className="connect-button danger" disabled><LoaderCircle size={13} className="spin" />{t('正在断开…')}</button> : isConnected ? <button className="connect-button danger" onClick={() => setDisconnectPrompt({ sessionId: activeSessionId, hostName: selected?.name, count: 1 })}><Square size={12} fill="currentColor" />{t('断开')}</button> : isConnecting ? <button className="connect-button danger" onClick={() => disconnect()}><X size={13} />{t('取消连接')}</button> : <button className="connect-button" disabled={!selected} onClick={connect}><Play size={13} fill="currentColor" />{t('连接')}</button>}
          </div>
        </header>

        <div className="tabbar">
          {!terminalSessions.length && <button className="terminal-tab active"><TerminalIcon /><span>{selected ? `${selected.name} · ${t('终端')}` : t('终端')}</span></button>}
          {terminalSessions.map((session) => {
            const host = hosts.find((item) => item.id === session.hostId)
            return <button key={session.id} className={`terminal-tab ${activeSessionId === session.id ? 'active' : ''}`} onClick={() => switchTerminalSession(session)}><TerminalIcon /><span>{host?.name || '服务器'}{session.number > 1 ? ` · ${session.number}` : ''}</span><i className={`tab-status ${session.status?.state || 'disconnected'}`} /><X size={13} onClick={(event) => { event.stopPropagation(); closeTerminalSession(session.id) }} /></button>
          })}
          <button className="new-tab" title={t('为当前服务器新建独立终端')} disabled={!selected} onClick={() => newTerminal(selected)}>+</button>
          <div className="connection-state" title={status.message}><span className={`status-dot ${status.state}`} /><span>{status.state === 'error' ? status.title || (language === 'en' ? 'Connection failed' : '连接失败') : t(status.message)}</span></div>
        </div>

        <section className="terminal-wrap">
          {!selected && <div className="welcome"><div className="welcome-mark"><img src={slothLogo} alt="" /></div><h2>{t('欢迎使用 SlothSSH')}</h2><p>{t('保存服务器信息，下次一键连接。')}</p><button onClick={() => setModal('new')}><CirclePlus size={16} />{t('添加主机')}</button><div className="shortcut"><kbd>⌘</kbd><kbd>N</kbd><span>{t('新建连接')}</span></div></div>}
          {selected && status.state === 'error' && (!status.hostId || status.hostId === selected.id) && <ConnectionErrorCard diagnostic={status} host={selected} t={t} language={language} onRetry={connect} onEdit={() => setModal('edit')} onCopy={copyConnectionDiagnostic} onDismiss={() => {
            const nextStatus = { state: 'disconnected', message: '尚未连接', hostId: selected.id, sessionId: activeSessionId }
            setTerminalSessions((current) => current.map((item) => item.id === activeSessionId ? { ...item, status: nextStatus } : item))
            setStatus(nextStatus)
          }} />}
          {selected && !isConnected && !isConnecting && status.state !== 'error' && <div className="terminal-idle"><span className="server-orbit" style={{ '--accent': selected.color }}><Cpu size={28} /></span><h2>{selected.name}</h2><p>{selected.username}@{selected.hostname}:{selected.port}</p><div className="idle-actions"><button onClick={connect}><Play size={14} fill="currentColor" />{t('一键连接')}</button><button className="ghost-action" onClick={() => setModal('details')}><Eye size={14} />{t('查看信息')}</button></div></div>}
          {terminalSessions.map((session) => <SessionTerminal
            key={session.id}
            session={session}
            active={activeSessionId === session.id}
            fontSize={fontSize}
            theme={theme}
            onReady={(instance) => {
              sessionTerminalsRef.current.set(session.id, instance)
              const pending = pendingTerminalDataRef.current.get(session.id)
              if (pending) { instance.terminal.write(pending); pendingTerminalDataRef.current.delete(session.id) }
              if (activeSessionIdRef.current === session.id) terminalApi.current = instance
              setTerminalReadyVersion((value) => value + 1)
            }}
            onDispose={() => {
              sessionTerminalsRef.current.delete(session.id)
              if (activeSessionIdRef.current === session.id) terminalApi.current = null
            }}
            onToast={setToast}
            onHighlight={highlightTerminalCommands}
            onContextMenu={openTerminalMenu}
            onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setTerminalDropActive(true) } }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTerminalDropActive(false) }}
            onDrop={(event) => { event.preventDefault(); setTerminalDropActive(false); uploadFiles(event.dataTransfer.files) }}
          />)}
          {terminalDropActive && <div className="terminal-drop-hint"><UploadCloud size={22} /><strong>上传到当前远程目录</strong><span>{remotePath || '服务器主目录'}</span></div>}
          {terminalMenu && <TerminalContextMenu menu={terminalMenu} connected={isConnected} t={t} onCopy={copyTerminalSelection} onPaste={pasteIntoTerminal} onCopyAll={copyTerminalAll} onSelectAll={selectTerminalAll} onClear={clearTerminalWindow} />}
          {inlineTranslation && <InlineTranslation translation={inlineTranslation} failureDelay={translationFailureDelay} t={t} language={language} onClose={() => setInlineTranslation(null)} onRetry={retryInlineTranslation} onCopy={copyInlineTranslation} onOpenSettings={() => setModal('settings')} onToggleOriginal={() => setInlineTranslation((current) => current ? { ...current, showOriginal: !current.showOriginal } : current)} />}
          {isConnected && <form className="terminal-command-bar" onSubmit={submitCommand}><span><strong>{selected?.username || 'root'}@{selected?.hostname}</strong><em>$</em></span><input value={commandDraft} onChange={(event) => setCommandDraft(event.target.value)} placeholder={t('在这里输入命令，按 Enter 执行…')} spellCheck="false" autoComplete="off" /><button type="button" className="command-translate" disabled={!commandDraft.trim()} title="用中文说明当前命令" onClick={translateCommandDraft}><Languages size={13} />{t('说明命令')}</button><kbd>Enter</kbd></form>}
        </section>

        <footer className="statusbar"><span><Wifi size={13} />{t(isConnected ? 'SSH 已加密连接' : '未连接')}</span><span className="status-spacer" /><span>UTF-8</span><span>xterm-256color</span><span><Activity size={13} />{t(isConnected ? '可输入操作' : '空闲')}</span></footer>
      </section>

      {hostMenu && <HostContextMenu
        menu={hostMenu}
        sessionCount={terminalSessions.filter((session) => session.hostId === hostMenu.host.id).length}
        connectedCount={terminalSessions.filter((session) => session.hostId === hostMenu.host.id && session.status?.state === 'connected').length}
        onConnect={() => { setHostMenu(null); startConnection(hostMenu.host, false) }}
        onNewTerminal={() => { setHostMenu(null); newTerminal(hostMenu.host) }}
        onDetails={() => { setSelectedId(hostMenu.host.id); setHostMenu(null); setModal('details') }}
        onEdit={() => { setSelectedId(hostMenu.host.id); setHostMenu(null); setModal('edit') }}
        onFavorite={() => { toggleFavorite(hostMenu.host); setHostMenu(null) }}
        onCopyAddress={async () => { await api.clipboard.writeText(hostMenu.host.hostname); setHostMenu(null); setToast('已复制服务器地址') }}
        onCopyCommand={async () => { await api.clipboard.writeText(`ssh -p ${hostMenu.host.port} ${hostMenu.host.username}@${hostMenu.host.hostname}`); setHostMenu(null); setToast('已复制 SSH 连接命令') }}
        onCopyPassword={async () => { const copied = await api.credentials.copy(hostMenu.host.id); setHostMenu(null); setToast(copied ? '已复制服务器密码' : '该连接没有保存密码') }}
        onDisconnect={() => { const host = hostMenu.host; setHostMenu(null); setDisconnectPrompt({ host, hostName: host.name, count: terminalSessions.filter((session) => session.hostId === host.id && session.status?.state === 'connected').length }) }}
        onDelete={() => deleteHostFromMenu(hostMenu.host)}
        t={t}
      />}

      {(modal === 'new' || modal === 'edit') && <HostModal host={modal === 'edit' ? selected : null} t={t} onClose={() => setModal(null)} onSave={saveHost} onDelete={deleteHost} />}
      {modal === 'details' && selected && <DetailsModal host={selected} t={t} onClose={() => setModal(null)} onEdit={() => setModal('edit')} onToast={setToast} />}
      {modal === 'commands' && <CommandModal connected={isConnected} t={t} onClose={() => setModal(null)} onRun={runCommand} />}
      {modal === 'settings' && <SettingsModal fontSize={fontSize} setFontSize={setFontSize} theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} t={t} onSaved={(settings) => { setTranslationProvider(settings.translationProvider || 'free'); setTranslationFailureDelay(Number(settings.translationFailureDelay) || 15) }} onClose={() => { setModal(null); refreshTranslationProvider() }} />}
      {disconnectPrompt && <DisconnectConfirm prompt={disconnectPrompt} t={t} onClose={() => setDisconnectPrompt(null)} onConfirm={async () => { const prompt = disconnectPrompt; setDisconnectPrompt(null); if (prompt.host) await disconnectHostSessions(prompt.host); else await disconnect(prompt.sessionId) }} />}
      {toast && <div className="toast"><ShieldCheck size={15} />{toast}</div>}
    </main>
  )
}

function DisconnectConfirm({ prompt, t, onClose, onConfirm }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal confirm-disconnect-modal" role="alertdialog" aria-modal="true" aria-labelledby="disconnect-title">
      <header><div><p className="eyebrow">SSH SESSION</p><h2 id="disconnect-title">{t('确认断开 SSH？')}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
      <div className="confirm-disconnect-body"><span><Square size={17} fill="currentColor" /></span><div><strong>{prompt.hostName || t('当前终端')}</strong><p>{t('断开后将关闭当前终端连接，正在前台运行的命令可能会停止。')}</p>{prompt.count > 1 && <small>{prompt.count} {t('个终端会话')}</small>}</div></div>
      <footer><span /><div><button className="secondary-button" onClick={onClose}>{t('继续使用')}</button><button className="primary-button confirm-danger" onClick={onConfirm}><Square size={12} fill="currentColor" />{t('确认断开')}</button></div></footer>
    </div>
  </div>
}

function RailButton({ icon: Icon, active, label, onClick }) {
  return <button className={`rail-button ${active ? 'active' : ''}`} title={label} onClick={onClick}><Icon size={18} /></button>
}

function TerminalIcon() { return <span className="terminal-glyph">›_</span> }

const formatBytes = (bytes) => {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

function SessionTerminal({ session, active, fontSize, theme, onReady, onDispose, onToast, onHighlight, onContextMenu, onDragOver, onDragLeave, onDrop }) {
  const hostRef = useRef(null)
  useEffect(() => {
    const element = hostRef.current
    if (!element) return
    const terminal = new Terminal({
      cursorBlink: true, cursorStyle: 'bar', fontFamily: '"SFMono-Regular", "JetBrains Mono", Menlo, monospace',
      fontSize, lineHeight: 1.5, letterSpacing: 0.2, scrollback: 10000, allowProposedApi: true,
      allowTransparency: true, convertEol: false,
      theme: terminalThemes[theme] || terminalThemes.midnight,
    })
    terminal.__slothSessionId = session.id
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(element)
    const instance = { terminal, fit, element, readyWritten: false }
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      const key = event.key.toLowerCase()
      if (((event.metaKey && key === 'c') || (event.ctrlKey && event.shiftKey && key === 'c')) && terminal.hasSelection()) {
        api.clipboard.writeText(terminal.getSelection())
        onToast('已复制选中的终端内容')
        return false
      }
      return true
    })
    const input = terminal.onData((data) => {
      api.ssh.input(session.id, data)
      if (data.includes('\r') || data.includes('\n')) setTimeout(() => onHighlight(terminal), 80)
    })
    const observer = new ResizeObserver(() => {
      if (!element.offsetWidth) return
      requestAnimationFrame(() => {
        try {
          fit.fit()
          api.ssh.resize(session.id, { cols: terminal.cols, rows: terminal.rows })
        } catch { /* terminal is switching */ }
      })
    })
    observer.observe(element)
    onReady(instance)
    return () => {
      observer.disconnect()
      input.dispose()
      onDispose(instance)
      terminal.dispose()
    }
  }, [session.id])

  const visible = active && ['connected', 'connecting'].includes(session.status?.state)
  return <div ref={hostRef} className={`terminal-host ${visible ? 'visible' : ''}`} onMouseDown={() => active && hostRef.current?.querySelector('textarea')?.focus()} onContextMenu={active ? onContextMenu : undefined} onDragOver={active ? onDragOver : undefined} onDragLeave={active ? onDragLeave : undefined} onDrop={active ? onDrop : undefined} />
}

function ConnectionErrorCard({ diagnostic, host, t, language, onRetry, onEdit, onCopy, onDismiss }) {
  const phaseNames = { network: '网络连接', authentication: '用户认证', shell: '终端启动', session: '已连接会话' }
  return <article className="connection-error-card">
    <header><span><AlertTriangle size={20} /></span><div><small>{t('SSH 连接诊断')}</small><h2>{language === 'en' ? englishDiagnosticTitles[diagnostic.code] || 'SSH connection failed' : diagnostic.title || '连接失败'}</h2></div><em>{diagnostic.code || 'UNKNOWN'}</em><button title="关闭诊断" onClick={onDismiss}><X size={15} /></button></header>
    <div className="connection-error-body">
      <p>{language === 'en' ? englishDiagnosticMessages[diagnostic.code] || 'The server did not complete the SSH connection.' : diagnostic.message || '服务器没有完成 SSH 连接。'}</p>
      <div className="connection-target"><Server size={14} /><span><strong>{host.username}@{host.hostname}</strong><small>端口 {host.port} · 失败阶段：{phaseNames[diagnostic.phase] || diagnostic.phase || '连接'}</small></span></div>
      {!!diagnostic.suggestions?.length && <section><strong>{t('建议按以下顺序检查')}</strong><ol>{diagnostic.suggestions.map((suggestion, index) => <li key={`${index}-${suggestion}`}>{suggestion}</li>)}</ol></section>}
      <details><summary>{t('查看英文原始错误')}</summary><code>{diagnostic.original || '没有原始错误信息'}</code></details>
    </div>
    <footer><button className="secondary" onClick={onCopy}><Copy size={13} />{t('复制诊断')}</button><span /><button className="secondary" onClick={onEdit}><Pencil size={13} />{t('编辑连接')}</button><button className="retry" onClick={onRetry}><RefreshCw size={13} />{t('重新连接')}</button></footer>
  </article>
}

function ServerToolsPanel({ stats, remotePath, files, selectedFile, clipboardFile, loading, error, upload, onClose, onRefresh, onHome, onParent, onOpen, onSelect, onCopy, onPaste, onDelete, onCreateFolder, onUpload, t, language }) {
  const pickerRef = useRef(null)
  const [dropFolder, setDropFolder] = useState('')
  const progress = upload?.total ? Math.min(100, Math.round((upload.transferred / upload.total) * 100)) : 0
  const resources = [
    { label: 'CPU', value: `${stats?.cpu?.percent ?? '—'}%`, detail: stats ? `${stats.cpu.cores} 核心` : '正在读取', icon: Cpu, percent: stats?.cpu?.percent || 0, color: '#7c8cff' },
    { label: t('内存'), value: `${stats?.memory?.percent ?? '—'}%`, detail: stats ? `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}` : '正在读取', icon: Activity, percent: stats?.memory?.percent || 0, color: '#5ad0a8' },
    { label: t('系统盘'), value: `${stats?.disk?.percent ?? '—'}%`, detail: stats ? `${formatBytes(stats.disk.used)} / ${formatBytes(stats.disk.total)}` : '正在读取', icon: HardDrive, percent: stats?.disk?.percent || 0, color: '#f3a65a' },
  ]
  const acceptDrop = (event, destination) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setDropFolder(destination)
  }
  const handleDrop = (event, destination) => {
    event.preventDefault()
    event.stopPropagation()
    setDropFolder('')
    onUpload(event.dataTransfer.files, destination)
  }
  return <aside className="server-tools-panel">
    <header><div><span>{t('服务器管理')}</span><small>{stats?.uptime || t('实时资源与 SFTP 文件')}</small></div><button title="刷新" onClick={onRefresh}><RefreshCw size={14} /></button><button title="关闭" onClick={onClose}><X size={15} /></button></header>
    <section className="resource-grid">
      {resources.map((item) => <article key={item.label} style={{ '--meter-color': item.color }}><div><item.icon size={13} /><span>{item.label}</span><strong>{item.value}</strong></div><div className="resource-meter"><i style={{ width: `${item.percent}%` }} /></div><small>{item.detail}</small></article>)}
    </section>
    <section className="file-browser">
      <header><div><strong>{t('服务器文件')}</strong><small>{t('点击选中，双击文件夹进入')}</small></div><button title="新建文件夹" onClick={onCreateFolder}><FolderPlus size={14} /></button><button title="选择本地文件上传" onClick={() => pickerRef.current?.click()}><UploadCloud size={14} /></button><input ref={pickerRef} type="file" multiple hidden onChange={(event) => { onUpload(event.target.files, remotePath); event.target.value = '' }} /></header>
      <div className="path-bar"><button title="主目录" onClick={onHome}><Home size={13} /></button><button title="上级目录" onClick={onParent} disabled={remotePath === '/'}><span>↑</span></button><code title={remotePath}>{remotePath || '正在读取…'}</code></div>
      <div className="file-actionbar"><button disabled={!selectedFile} onClick={onCopy}><Copy size={12} />{t('复制')}</button><button disabled={!clipboardFile} onClick={onPaste}><ClipboardPaste size={12} />{t('粘贴')}</button><button className="danger" disabled={!selectedFile} onClick={onDelete}><Trash2 size={12} />{t('删除')}</button><span>{selectedFile ? `${language === 'en' ? 'Selected' : '已选'}：${selectedFile.name}` : t('点击文件后可操作')}</span></div>
      {upload && <div className="upload-progress"><span><UploadCloud size={12} />{upload.fileName}</span><strong>{progress}%</strong><i><b style={{ width: `${progress}%` }} /></i></div>}
      {clipboardFile && <div className="remote-clipboard"><Copy size={11} /><span>已复制：<strong>{clipboardFile.name}</strong></span><small>进入目标文件夹后点粘贴</small></div>}
      <div className={`remote-file-list ${dropFolder === remotePath ? 'drop-target' : ''}`} onDragOver={(event) => acceptDrop(event, remotePath)} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropFolder('') }} onDrop={(event) => handleDrop(event, remotePath)}>
        {loading && <div className="remote-state"><LoaderCircle className="spin" size={17} />正在读取目录…</div>}
        {!loading && error && <div className="remote-state error"><AlertTriangle size={16} />{error}<button onClick={onRefresh}>重试</button></div>}
        {!loading && !error && files.map((item) => <button
          key={item.path}
          className={`remote-file ${item.directory ? 'directory' : ''} ${selectedFile?.path === item.path ? 'selected' : ''} ${dropFolder === item.path ? 'drop-target' : ''}`}
          title={item.directory ? '双击进入，或把本地文件拖到这里上传' : item.path}
          onClick={() => onSelect(item)}
          onDoubleClick={() => item.directory && onOpen(item.path)}
          onDragOver={(event) => item.directory && acceptDrop(event, item.path)}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropFolder('') }}
          onDrop={(event) => item.directory && handleDrop(event, item.path)}
        ><span className="file-icon">{item.directory ? <Folder size={15} fill="currentColor" /> : <File size={15} />}</span><span className="file-name"><strong>{item.name}</strong><small>{item.directory ? `文件夹 · ${item.permissions}` : `${formatBytes(item.size)} · ${item.permissions}`}</small></span><time>{item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : ''}</time></button>)}
        {!loading && !error && !files.length && <div className="remote-state"><Folder size={18} />这个文件夹是空的，可直接拖入文件</div>}
      </div>
    </section>
    <footer><UploadCloud size={12} /><span>拖到文件夹或终端，上传到当前目录</span></footer>
  </aside>
}

function HostModal({ host, t, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(host ? { ...host } : {
    name: '', hostname: '', port: 22, username: 'root', authType: 'password',
    password: '', privateKeyPath: '', passphrase: '', group: '我的主机', notes: '',
    favorite: false, color: palette[0],
  })
  const [showSecret, setShowSecret] = useState(false)
  const [secretLoaded, setSecretLoaded] = useState(!host)
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const hasAuth = form.authType === 'password' ? (form.password || host?.hasPassword) : form.privateKeyPath
  const valid = form.hostname.trim() && form.username.trim() && hasAuth

  const revealSecret = async () => {
    if (host && !secretLoaded) {
      const secret = await api.credentials.reveal(host.id)
      setForm((current) => ({ ...current, password: secret.password, passphrase: secret.passphrase }))
      setSecretLoaded(true)
    }
    setShowSecret((current) => !current)
  }

  const chooseKey = async () => {
    const file = await api.dialog.choosePrivateKey()
    if (file) change('privateKeyPath', file)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal host-modal" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(form) }}>
        <header><div><p className="eyebrow">SERVER PROFILE</p><h2>{t(host ? '编辑服务器' : '添加服务器')}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></header>
        <div className="form-grid modal-scroll">
          <label className="field span-2"><span>{t('服务器名称')}</span><input autoFocus value={form.name} onChange={(e) => change('name', e.target.value)} placeholder={t('例如：香港生产服务器')} /></label>
          <label className="field span-2"><span>{t('IP 地址或域名')}</span><input value={form.hostname} onChange={(e) => change('hostname', e.target.value)} placeholder="192.168.1.10 / server.example.com" required /></label>
          <label className="field"><span>{t('登录用户名')}</span><input value={form.username} onChange={(e) => change('username', e.target.value)} placeholder="root" required /></label>
          <label className="field"><span>{t('SSH 端口')}</span><input type="number" min="1" max="65535" value={form.port} onChange={(e) => change('port', e.target.value)} /></label>
          <div className="field span-2"><span>{t('认证方式')}</span><div className="segmented"><button type="button" className={form.authType === 'password' ? 'active' : ''} onClick={() => change('authType', 'password')}>{t('服务器密码')}</button><button type="button" className={form.authType === 'key' ? 'active' : ''} onClick={() => change('authType', 'key')}>{t('SSH 私钥')}</button></div></div>
          {form.authType === 'password' ? <label className="field span-2"><span>{t('服务器密码')}</span><div className="password-input"><input type={showSecret ? 'text' : 'password'} value={form.password || ''} onChange={(e) => { change('password', e.target.value); setSecretLoaded(true) }} placeholder={host?.hasPassword && !secretLoaded ? t('已加密保存，点击眼睛查看') : t('输入服务器登录密码')} /><button type="button" title={t('显示或隐藏密码')} onClick={revealSecret}>{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><small className="field-help"><ShieldCheck size={12} />{t('密码会使用系统安全存储加密，可随时查看和复制')}</small></label> : <><label className="field span-2"><span>{t('私钥文件')}</span><button type="button" className="file-picker" onClick={chooseKey}><KeyRound size={15} /><em>{form.privateKeyPath || t('选择 ~/.ssh 下的私钥')}</em></button></label><label className="field span-2"><span>{t('私钥口令（可选）')}</span><div className="password-input"><input type={showSecret ? 'text' : 'password'} value={form.passphrase || ''} onChange={(e) => { change('passphrase', e.target.value); setSecretLoaded(true) }} placeholder={host?.hasPassphrase && !secretLoaded ? t('已加密保存') : t('没有口令可留空')} /><button type="button" onClick={revealSecret}>{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label></>}
          <label className="field"><span>{t('分组')}</span><input value={form.group || ''} onChange={(e) => change('group', e.target.value)} placeholder={t('我的主机')} /></label>
          <div className="field"><span>{t('标记颜色')}</span><div className="color-picker">{palette.map((color) => <button type="button" key={color} className={form.color === color ? 'active' : ''} style={{ '--swatch': color }} onClick={() => change('color', color)} />)}</div></div>
          <label className="field span-2"><span>{t('管理备注')}</span><textarea value={form.notes || ''} onChange={(e) => change('notes', e.target.value)} placeholder={t('机房、用途、续费时间等信息…')} /></label>
          <label className="favorite-check span-2"><input type="checkbox" checked={Boolean(form.favorite)} onChange={(e) => change('favorite', e.target.checked)} /><Star size={14} fill={form.favorite ? 'currentColor' : 'none'} />{t('收藏这台服务器')}</label>
        </div>
        <footer>{host ? <button type="button" className="delete-button" onClick={() => onDelete(host)}><Trash2 size={15} />{t('删除')}</button> : <span />}<div><button type="button" className="secondary-button" onClick={onClose}>{t('取消')}</button><button className="primary-button" disabled={!valid}>{t('保存服务器')}</button></div></footer>
      </form>
    </div>
  )
}

function DetailsModal({ host, t, onClose, onEdit, onToast }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const reveal = async () => {
    if (!password) setPassword((await api.credentials.reveal(host.id)).password)
    setShow((current) => !current)
  }
  const copyPassword = async () => {
    if (await api.credentials.copy(host.id)) onToast('密码已复制到剪贴板')
    else onToast('这台服务器没有保存密码')
  }
  const copyCommand = async () => {
    await navigator.clipboard.writeText(`ssh -p ${host.port} ${host.username}@${host.hostname}`)
    onToast('SSH 连接命令已复制')
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal details-modal"><header><div><p className="eyebrow">SERVER DETAILS</p><h2>{host.name}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="details-body"><div className="detail-row"><span>{t('服务器')}</span><strong>{host.hostname}:{host.port}</strong><button onClick={copyCommand}><Copy size={14} />{t('复制命令')}</button></div><div className="detail-row"><span>{t('用户名')}</span><strong>{host.username}</strong></div><div className="detail-row password-row"><span>{t('服务器密码')}</span><strong>{host.authType === 'key' ? t('使用 SSH 私钥') : (show ? (password || t('未保存')) : (host.hasPassword ? '••••••••••••' : t('未保存')))}</strong>{host.authType === 'password' && <div><button onClick={reveal}>{show ? <EyeOff size={14} /> : <Eye size={14} />}{t(show ? '隐藏' : '查看')}</button><button onClick={copyPassword}><Copy size={14} />{t('复制')}</button></div>}</div><div className="detail-row"><span>{t('认证方式')}</span><strong>{host.authType === 'key' ? `${t('SSH 私钥')} · ${host.privateKeyPath}` : t('密码认证')}</strong></div><div className="detail-row"><span>{t('分组')}</span><strong>{host.group || t('我的主机')}</strong></div>{host.notes && <div className="detail-notes"><span>{t('管理备注')}</span><p>{host.notes}</p></div>}</div><footer><span className="secure-label"><ShieldCheck size={13} />{t('凭据由系统安全存储加密')}</span><div><button className="primary-button" onClick={onEdit}><Pencil size={13} />{t('编辑信息')}</button></div></footer></div></div>
}

function TerminalContextMenu({ menu, connected, onCopy, onPaste, onCopyAll, onSelectAll, onClear, t }) {
  return <div className="terminal-context-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(event) => event.stopPropagation()}>
    <button disabled={!menu.hasSelection} onClick={onCopy}><Copy size={14} /><span>{t('复制选中内容')}</span><kbd>⌘C</kbd></button>
      <button disabled={!connected} onClick={onPaste}><ClipboardPaste size={14} /><span>{t(menu.hasSelection ? '粘贴选中内容' : '粘贴剪贴板内容')}</span><kbd>{menu.hasSelection ? 'SEL' : '⌘V'}</kbd></button>
    <div className="context-separator" />
    <button onClick={onCopyAll}><Copy size={14} /><span>{t('复制全部终端内容')}</span></button>
    <button onClick={onSelectAll}><Command size={14} /><span>{t('选中全部终端内容')}</span></button>
    <div className="context-separator" />
    <button className="context-danger" onClick={onClear}><Eraser size={14} /><span>{t('清空当前窗口')}</span></button>
    <p>{t('清空只影响本地显示，不会终止服务器任务')}</p>
  </div>
}

function HostContextMenu({ menu, sessionCount, connectedCount, onConnect, onNewTerminal, onDetails, onEdit, onFavorite, onCopyAddress, onCopyCommand, onCopyPassword, onDisconnect, onDelete, t }) {
  const host = menu.host
  return <div className="host-context-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(event) => event.stopPropagation()}>
    <header><span className="server-avatar" style={{ '--accent': host.color }}><Server size={15} /></span><div><strong>{host.name}</strong><small>{host.username}@{host.hostname}:{host.port}</small></div>{connectedCount > 0 && <em>{connectedCount} 个已连接</em>}</header>
    <button onClick={onConnect}><Play size={13} /><span>{t(connectedCount ? '切换到已连接终端' : '连接服务器')}</span></button>
    <button onClick={onNewTerminal}><TerminalIcon /><span>{t('新建独立终端')}</span><kbd>{sessionCount ? `#${sessionCount + 1}` : '+'}</kbd></button>
    <div className="context-separator" />
    <button onClick={onDetails}><Eye size={13} /><span>{t('查看服务器信息')}</span></button>
    <button onClick={onEdit}><Pencil size={13} /><span>{t('编辑连接')}</span></button>
    <button onClick={onFavorite}><Star size={13} /><span>{t(host.favorite ? '取消收藏' : '收藏服务器')}</span></button>
    <div className="context-separator" />
    <button onClick={onCopyAddress}><Copy size={13} /><span>{t('复制 IP / 主机名')}</span></button>
    <button onClick={onCopyCommand}><Command size={13} /><span>{t('复制 SSH 连接命令')}</span></button>
    {host.authType === 'password' && <button onClick={onCopyPassword}><KeyRound size={13} /><span>{t('复制已保存密码')}</span></button>}
    <div className="context-separator" />
    <button disabled={!sessionCount} onClick={onDisconnect}><Square size={12} /><span>{t('断开该主机全部终端')}</span></button>
    <button className="context-danger" onClick={onDelete}><Trash2 size={13} /><span>{t('删除服务器')}</span></button>
  </div>
}

function CommandModal({ connected, t, onClose, onRun }) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState(null)
  const [draft, setDraft] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return quickCommands.filter((item) => (category === 'all' || item.category === category)
      && (!needle || `${item.label} ${item.description} ${item.command}`.toLowerCase().includes(needle)))
  }, [category, query])
  const editCommand = (item) => {
    setSelectedCommand(item)
    setDraft(item.command)
  }
  const runEditedCommand = () => {
    const command = draft.trim()
    if (connected && command) onRun(command)
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal command-modal">
      <header><div><p className="eyebrow">OPERATIONS TOOLBOX</p><h2>{t('快捷运维命令')}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
      <div className={`command-browser ${selectedCommand ? 'editing' : ''}`}>
        <div className="command-tools"><label><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('搜索命令、用途…')} /></label><span>{filtered.length} {t('条只读命令')}</span></div>
        <nav className="command-categories">{commandCategories.map(([id, label]) => <button key={id} className={category === id ? 'active' : ''} onClick={() => setCategory(id)}>{t(label)}</button>)}</nav>
        <div className="command-list">{filtered.map((item) => <button key={`${item.category}-${item.label}`} onClick={() => editCommand(item)}><span><Zap size={15} />{item.label}</span><small>{item.description}</small><code>{item.command}</code><Pencil size={13} /></button>)}{!filtered.length && <div className="command-empty">{t('没有匹配的运维命令')}</div>}</div>
        {selectedCommand && <section className="command-editor"><header><div><strong>{t('编辑后运行')} · {selectedCommand.label}</strong><small>{t('可以修改参数、路径或筛选条件，确认前不会执行。')}</small></div><button title={t('关闭编辑')} onClick={() => setSelectedCommand(null)}><X size={15} /></button></header><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runEditedCommand() } }} spellCheck="false" /><footer><span>{t(connected ? '将在当前 SSH 会话中执行 · ⌘/Ctrl + Enter' : '连接服务器后才能运行')}</span><div><button className="secondary-button" onClick={() => setSelectedCommand(null)}>{t('取消')}</button><button className="primary-button" disabled={!connected || !draft.trim()} onClick={runEditedCommand}><Play size={12} fill="currentColor" />{t('运行命令')}</button></div></footer></section>}
      </div>
      <footer><small>{t(connected ? '点击命令会先进入编辑区，确认后才执行' : '可先查看和编辑，连接服务器后运行')}</small><kbd>⌘ ⇧ P</kbd></footer>
    </div>
  </div>
}

function InlineTranslation({ translation, failureDelay, t, language, onClose, onRetry, onCopy, onToggleOriginal, onOpenSettings }) {
  const isSelection = translation.mode === 'selection'
  const bodyRef = useRef(null)
  const [speaking, setSpeaking] = useState('')
  const style = isSelection ? { top: translation.anchor?.top, left: translation.anchor?.left } : undefined
  const content = translation.showOriginal ? translation.original : translation.translated

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const speak = async (text, language, key) => {
    if (!text || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    let voices = window.speechSynthesis.getVoices()
    if (!voices.length) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 600)
        window.speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(timer); resolve() }, { once: true })
      })
      voices = window.speechSynthesis.getVoices()
    }
    const technicalAcronyms = new Set(['API', 'BIOS', 'CPU', 'DNS', 'GPU', 'HTTP', 'HTTPS', 'IP', 'KVM', 'RAM', 'SSH', 'TCP', 'UDP', 'URL', 'UUID'])
    const speechText = language.startsWith('en')
      ? String(text).replace(/\b[A-Z]{4,}\b/g, (word) => technicalAcronyms.has(word) ? word : word.toLowerCase())
      : String(text)
    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.lang = language
    utterance.rate = language.startsWith('en') ? 0.92 : 0.96
    utterance.pitch = 1
    utterance.volume = 1
    const preferredNames = language.startsWith('en')
      ? ['Samantha', 'Alex', 'Ava', 'Daniel', 'Karen', 'Google US English']
      : ['Tingting', 'Ting-Ting', 'Meijia', 'Sin-ji', 'Google 普通话']
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()))
    utterance.voice = preferredNames.map((name) => matchingVoices.find((voice) => voice.name.includes(name))).find(Boolean)
      || matchingVoices.find((voice) => voice.localService)
      || matchingVoices[0]
      || null
    utterance.onstart = () => setSpeaking(key)
    utterance.onend = () => setSpeaking('')
    utterance.onerror = () => setSpeaking('')
    window.speechSynthesis.speak(utterance)
  }
  const closeTranslation = () => {
    window.speechSynthesis?.cancel()
    onClose()
  }

  useEffect(() => {
    if (isSelection || translation.loading || translation.error || !bodyRef.current) return
    const frame = requestAnimationFrame(() => {
      const body = bodyRef.current
      if (!body) return
      const target = !translation.showOriginal
        ? body.querySelector(`[data-line-index="${Math.max(0, translation.initialLine || 0)}"]`)
        : null
      if (target) {
        body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 15
      } else {
        body.scrollTop = (translation.scrollRatio || 0) * Math.max(0, body.scrollHeight - body.clientHeight)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [isSelection, translation.loading, translation.error, translation.showOriginal, translation.lines, translation.initialLine, translation.scrollRatio])

  const translatedView = isSelection && !translation.showOriginal
    ? <div className="selection-bilingual"><section className="bilingual-card english"><header><span>{language === 'en' ? 'English source' : '英文原文'}</span><button className={speaking === 'english' ? 'speaking' : ''} onClick={() => speak(translation.original, 'en-US', 'english')}><Volume2 size={13} />{speaking === 'english' ? (language === 'en' ? 'Speaking' : '正在朗读') : (language === 'en' ? 'Pronounce' : '英文读音')}</button></header><p>{translation.original}</p></section><section className="bilingual-card chinese"><header><span>{language === 'en' ? 'Chinese meaning' : '中文释义'}</span><button className={speaking === 'chinese' ? 'speaking' : ''} onClick={() => speak(translation.translated, 'zh-CN', 'chinese')}><Volume2 size={13} />{speaking === 'chinese' ? (language === 'en' ? 'Speaking' : '正在朗读') : (language === 'en' ? 'Read Chinese' : '朗读中文')}</button></header><p>{translation.translated}</p></section><small className="speech-note">{language === 'en' ? 'Uses a local system voice; ordinary uppercase words are pronounced as words.' : '使用电脑本地英语音色；全大写普通单词会自动按单词朗读'}</small></div>
    : !translation.showOriginal && Array.isArray(translation.lines)
      ? <div className="translation-lines">{translation.lines.map((line, index) => {
          const commandLine = Boolean(line.command || isShellCommandLine(line.source))
          return <div key={`${index}-${line.status}`} data-line-index={index} className={`translation-line ${line.status} ${commandLine ? 'command' : ''}`} title={line.status === 'failed' ? '该行未获得译文，红色内容为保留的英文原文' : commandLine ? '这是终端执行命令，已用独立颜色标记' : ''}><code>{line.text || ' '}</code></div>
        })}</div>
      : <pre>{content}</pre>

  const freeMode = translation.provider === 'free'
  const progressLabel = translation.loading
    ? t('翻译中')
    : translation.sourceLines
      ? `${language === 'en' ? 'Processed' : '已处理'} ${translation.sourceLines} ${language === 'en' ? 'lines' : '行'}${freeMode ? ` · ${language === 'en' ? 'Free Basic' : '免费基础'}` : ''}`
      : t('翻译模式')

  return <section className={`inline-translation ${isSelection ? 'selection' : 'all'}`} style={style}><header><span><Languages size={13} />{translation.source}<em>{progressLabel}</em></span><div>{!isSelection && <button className={translation.showOriginal ? '' : 'active'} onClick={onToggleOriginal}>{t(translation.showOriginal ? '显示译文' : '查看原文')}</button>}<button title={t('重新翻译')} onClick={onRetry} disabled={translation.loading}><RefreshCw size={13} /></button><button title={t('复制中文')} onClick={onCopy} disabled={!translation.translated}><Copy size={13} /></button><button className="exit-translation" title={language === 'en' ? 'Exit translation and return to the terminal, or press Esc' : '退出翻译并返回终端，或按 Esc'} onClick={closeTranslation}><X size={14} /><span>{t('退出翻译')}</span><kbd>Esc</kbd></button></div></header><div ref={bodyRef} className="inline-translation-body">{translation.loading ? <div className="translation-loading"><LoaderCircle size={18} className="spin" />{language === 'en' ? `Waiting for the complete translation. Failed lines will appear after ${failureDelay || 15} seconds…` : `正在等待完整译文，失败提示将在 ${failureDelay || 15} 秒阈值后显示…`}</div> : translation.error ? <div className="translation-error">{translation.error}</div> : translatedView}</div>{!isSelection && <footer><ShieldCheck size={12} /><strong className={translation.failedLines ? 'translation-failed-summary' : ''}>{translation.failedLines ? (language === 'en' ? `${translation.failedLines} red lines = no valid result from the free endpoint within 15 seconds` : `红色 ${translation.failedLines} 行＝免费线路在 15 秒内未返回有效译文`) : freeMode ? (language === 'en' ? 'Free Basic translation' : '免费基础翻译') : t('翻译完成')}</strong><span>{translation.warning || (language === 'en' ? (freeMode ? 'Good for common prompts; use a cloud or LLM provider for complex logs.' : 'Common terminal states are localized while technical identifiers retain their format.') : (freeMode ? '适合常见提示；复杂日志可切换国内云翻译或大模型' : '常见终端状态已在本地中文化，技术标识保持原格式'))}</span>{freeMode && <button className="quality-switch" onClick={onOpenSettings}>{language === 'en' ? 'Switch provider' : '切换更强接口'}</button>}<button className="footer-exit" onClick={closeTranslation}>{t('退出翻译')} <kbd>Esc</kbd></button></footer>}</section>
}

function SettingsModal({ fontSize, setFontSize, theme, setTheme, language, setLanguage, t, onClose, onSaved }) {
  const [translation, setTranslation] = useState({
    translationProvider: 'free', translationFailureDelay: 15, baiduAppId: '', baiduSecret: '',
    tencentSecretId: '', tencentSecretKey: '', tencentRegion: 'ap-guangzhou',
    aliyunAccessKeyId: '', aliyunAccessKeySecret: '', openaiPreset: 'deepseek',
    openaiBaseUrl: 'https://api.deepseek.com', openaiModel: 'deepseek-v4-flash', openaiApiKey: '',
    hasBaiduSecret: false, hasTencentSecretKey: false, hasAliyunAccessKeySecret: false, hasOpenaiApiKey: false,
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.translate.getSettings().then((settings) => setTranslation((current) => ({ ...current, ...settings })))
  }, [])

  const change = (key, value) => setTranslation((current) => ({ ...current, [key]: value }))
  const chooseLlmPreset = (presetId) => {
    const preset = llmPresets[presetId]
    setTranslation((current) => ({
      ...current,
      openaiPreset: presetId,
      ...(presetId === 'custom' ? {} : { openaiBaseUrl: preset.baseUrl, openaiModel: preset.model }),
    }))
  }
  const openLink = async (url) => {
    try { await api.system.openExternal(url) } catch (error) { setMessage(`无法打开链接：${error.message}`) }
  }
  const save = async (test = false) => {
    setSaving(true)
    setMessage('')
    try {
      const saved = await api.translate.saveSettings(translation)
      setTranslation((current) => ({
        ...current,
        ...saved,
        baiduSecret: '',
        tencentSecretKey: '',
        aliyunAccessKeySecret: '',
        openaiApiKey: '',
      }))
      onSaved?.(saved)
      if (test) {
        const result = await api.translate.text('Connection successful. Terminal translation is ready.')
        setMessage(result.ok ? `测试成功：${result.translated}` : `测试失败：${result.error}`)
      } else {
        setMessage('翻译接口设置已保存')
      }
    } catch (error) {
      setMessage(`保存失败：${error.message}`)
    }
    setSaving(false)
  }

  const preset = llmPresets[translation.openaiPreset] || llmPresets.custom
  const tr = (zh, en) => language === 'en' ? en : zh

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal settings-modal">
      <header><div><p className="eyebrow">PREFERENCES</p><h2>{language === 'en' ? 'SlothSSH Settings' : 'SlothSSH 设置'}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
      <div className="settings-scroll">
        <section className="appearance-settings">
          <div className="settings-title"><div><span>{t('主题与外观')}</span><small>{language === 'en' ? 'Choose a comfortable look for day or night.' : '可随时切换，日间与夜间使用都更舒服'}</small></div></div>
          <div className="theme-options">
            {[
              ['codex', '云雾浅蓝', '#c8dde6', '#1478c8'],
              ['midnight', '深夜蓝', '#111827', '#7c8cff'],
              ['graphite', '黑曜灰', '#191b1d', '#d9a963'],
              ['aurora', '极光紫', '#10152a', '#55e0e8'],
              ['daylight', '日间浅色', '#f5f7fb', '#5d6fe8'],
            ].map(([id, label, bg, accent]) => <button key={id} className={`theme-card ${theme === id ? 'active' : ''}`} onClick={() => setTheme(id)}><i style={{ '--preview-bg': bg, '--preview-accent': accent }}><b /><b /><b /></i><span>{t(label)}</span>{theme === id && <em>✓</em>}</button>)}
          </div>
          <div className="language-settings"><div><span>{t('界面语言')}</span><small>{language === 'en' ? 'The main interface changes instantly.' : '主要界面文字会立即切换'}</small></div><div className="language-options"><button className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')}><span>🇨🇳</span>中文</button><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}><span>🇺🇸</span>English</button></div></div>
        </section>
        <section className="settings-row">
          <div><span>{language === 'en' ? 'Terminal font size' : '终端字体大小'}</span><small>{language === 'en' ? 'Applies to current and future terminals immediately.' : '立即应用到当前和后续终端'}</small></div>
          <div className="stepper"><button onClick={() => setFontSize(Math.max(10, fontSize - 1))}>−</button><strong>{fontSize}px</strong><button onClick={() => setFontSize(Math.min(20, fontSize + 1))}>+</button></div>
        </section>
        <section className="translation-settings">
          <div className="settings-title">
            <div><span>{tr('翻译接口', 'Translation provider')}</span><small>{tr('只显示当前接口需要填写的内容', 'Only settings required by the selected provider are shown.')}</small></div>
            <select value={translation.translationProvider} onChange={(event) => change('translationProvider', event.target.value)}>
              <optgroup label={tr('免配置', 'No setup required')}><option value="free">{tr('本地优先 + 免费基础', 'Local first + Free Basic')}</option><option value="google">{tr('Google 翻译', 'Google Translate')}</option></optgroup>
              <optgroup label={tr('国内云翻译', 'China cloud translation')}><option value="baidu">{tr('百度翻译', 'Baidu Translate')}</option><option value="tencent">{tr('腾讯云机器翻译', 'Tencent Cloud TMT')}</option><option value="aliyun">{tr('阿里云机器翻译', 'Alibaba Cloud MT')}</option></optgroup>
              <optgroup label={tr('大模型', 'Large language model')}><option value="openai">{tr('大模型 API', 'LLM API')}</option></optgroup>
            </select>
          </div>
          <div className="translation-policy"><div><strong>{tr('失败提示等待', 'Failure display delay')}</strong><small>{tr('完整译文会立即显示；存在失败行时，至少等待此时长后才显示红色原文。免费基础最低为 15 秒。', 'Complete results appear immediately. Failed lines are shown in red only after this delay; Free Basic uses at least 15 seconds.')}</small></div><select value={translation.translationFailureDelay || 15} onChange={(event) => change('translationFailureDelay', Number(event.target.value))}><option value="15">15 {tr('秒', 'sec')}</option><option value="20">20 {tr('秒', 'sec')}</option><option value="30">30 {tr('秒', 'sec')}</option></select></div>

          {translation.translationProvider === 'free' && <div className="provider-note caution"><AlertTriangle size={15} /><div><strong>{tr('免费基础质量 · 免配置', 'Free Basic quality · No setup')}</strong><small>{tr('常见命令由本地解析；复杂日志依赖海外免费节点，速度和完整度低于国内云翻译及大模型。', 'Common commands are handled locally. Complex logs use a free overseas endpoint and may be slower or less complete than cloud translation or an LLM.')}</small></div></div>}
          {translation.translationProvider === 'google' && <div className="provider-note"><Languages size={15} /><div><strong>{tr('Google 翻译', 'Google Translate')}</strong><small>{tr('质量较稳定且无需密钥，但部分中国网络需要代理。', 'Stable quality with no API key; some networks in China may require a proxy.')}</small></div></div>}

          {translation.translationProvider === 'baidu' && <div className="provider-fields">
            <label><span>APP ID</span><input value={translation.baiduAppId || ''} onChange={(event) => change('baiduAppId', event.target.value)} placeholder="百度翻译开放平台 APP ID" /></label>
            <label><span>{tr('密钥', 'Secret key')}</span><input type="password" value={translation.baiduSecret || ''} onChange={(event) => change('baiduSecret', event.target.value)} placeholder={translation.hasBaiduSecret ? tr('已加密保存，留空保持不变', 'Encrypted; leave blank to keep unchanged') : tr('输入百度翻译密钥', 'Enter the Baidu Translate secret')} /></label>
            <div className="provider-actions span-2"><span>{tr('需先开通通用文本翻译', 'General Text Translation must be enabled first.')}</span><button onClick={() => openLink('https://api.fanyi.baidu.com/api/trans/product/apidoc/')}><ExternalLink size={12} />{tr('配置教程', 'Setup guide')}</button></div>
          </div>}

          {translation.translationProvider === 'tencent' && <div className="provider-fields">
            <label><span>SecretId</span><input value={translation.tencentSecretId || ''} onChange={(event) => change('tencentSecretId', event.target.value)} placeholder="腾讯云 API SecretId" /></label>
            <label><span>SecretKey</span><input type="password" value={translation.tencentSecretKey || ''} onChange={(event) => change('tencentSecretKey', event.target.value)} placeholder={translation.hasTencentSecretKey ? tr('已加密保存，留空保持不变', 'Encrypted; leave blank to keep unchanged') : 'Enter SecretKey'} /></label>
            <label className="span-2"><span>{tr('接入地域', 'Region')}</span><select value={translation.tencentRegion || 'ap-guangzhou'} onChange={(event) => change('tencentRegion', event.target.value)}><option value="ap-guangzhou">{tr('广州', 'Guangzhou')}</option><option value="ap-shanghai">{tr('上海', 'Shanghai')}</option><option value="ap-beijing">{tr('北京', 'Beijing')}</option></select></label>
            <div className="provider-actions span-2"><span>{tr('需开通腾讯机器翻译 TMT', 'Tencent Cloud TMT must be enabled first.')}</span><button onClick={() => openLink('https://cloud.tencent.com/document/product/551/104415')}><ExternalLink size={12} />{tr('开通教程', 'Setup guide')}</button><button onClick={() => openLink('https://console.cloud.tencent.com/cam/capi')}><ExternalLink size={12} />{tr('获取密钥', 'Get keys')}</button></div>
          </div>}

          {translation.translationProvider === 'aliyun' && <div className="provider-fields">
            <label><span>AccessKey ID</span><input value={translation.aliyunAccessKeyId || ''} onChange={(event) => change('aliyunAccessKeyId', event.target.value)} placeholder="阿里云 RAM AccessKey ID" /></label>
            <label><span>AccessKey Secret</span><input type="password" value={translation.aliyunAccessKeySecret || ''} onChange={(event) => change('aliyunAccessKeySecret', event.target.value)} placeholder={translation.hasAliyunAccessKeySecret ? tr('已加密保存，留空保持不变', 'Encrypted; leave blank to keep unchanged') : 'Enter AccessKey Secret'} /></label>
            <div className="provider-actions span-2"><span>{tr('这是机器翻译，不是百炼 API Key', 'This is Machine Translation, not a Model Studio API key.')}</span><button onClick={() => openLink('https://help.aliyun.com/zh/machine-translation/developer-reference/api-reference-machine-translation-universal-version-call-guide')}><ExternalLink size={12} />{tr('接入教程', 'Setup guide')}</button><button onClick={() => openLink('https://ram.console.aliyun.com/manage/ak')}><ExternalLink size={12} />{tr('获取密钥', 'Get keys')}</button></div>
          </div>}

          {translation.translationProvider === 'openai' && <div className="provider-fields">
            <label className="span-2"><span>{tr('平台预设', 'Provider preset')}</span><select value={translation.openaiPreset || 'custom'} onChange={(event) => chooseLlmPreset(event.target.value)}>{Object.entries(llmPresets).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
            <label className="span-2"><span>Base URL</span><input value={translation.openaiBaseUrl || ''} onChange={(event) => { change('openaiBaseUrl', event.target.value); change('openaiPreset', 'custom') }} placeholder="必须是兼容 Chat Completions 的地址" /></label>
            <label><span>{tr('模型名称', 'Model name')}</span><input value={translation.openaiModel || ''} onChange={(event) => change('openaiModel', event.target.value)} placeholder="e.g. qwen-plus" /></label>
            <label><span>API Key</span><input type="password" value={translation.openaiApiKey || ''} onChange={(event) => change('openaiApiKey', event.target.value)} placeholder={translation.hasOpenaiApiKey ? tr('已加密保存，留空保持不变', 'Encrypted; leave blank to keep unchanged') : 'Enter API Key'} /></label>
            <div className="provider-actions span-2"><span>{translation.openaiPreset === 'qwen' ? tr('百炼中国区必须使用带 /compatible-mode/v1 的地址', 'Alibaba Model Studio in China requires a URL ending in /compatible-mode/v1.') : tr('选择预设会自动填写正确地址和推荐模型', 'A preset fills in the correct endpoint and recommended model automatically.')}</span>{preset.guide && <button onClick={() => openLink(preset.guide)}><ExternalLink size={12} />{tr('配置教程', 'Setup guide')}</button>}{preset.key && <button onClick={() => openLink(preset.key)}><ExternalLink size={12} />{tr('获取密钥', 'Get keys')}</button>}</div>
          </div>}

          {message && <div className={`settings-message ${message.startsWith('测试失败') || message.startsWith('保存失败') || message.startsWith('无法') ? 'error' : ''}`}>{message}</div>}
        </section>
      </div>
      <footer><span className="secure-label"><ShieldCheck size={13} />{tr('接口密钥由系统安全存储加密', 'API credentials are encrypted by system secure storage')}</span><div><button className="secondary-button" disabled={saving} onClick={() => save(true)}>{tr('测试接口', 'Test provider')}</button><button className="primary-button" disabled={saving} onClick={() => save(false)}>{saving ? tr('保存中…', 'Saving…') : tr('保存设置', 'Save settings')}</button></div></footer>
    </div>
  </div>
}

export default App
