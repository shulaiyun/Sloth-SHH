const { contextBridge, ipcRenderer, webUtils } = require('electron')

const listen = (channel, callback) => {
  const handler = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('slothssh', {
  hosts: {
    list: () => ipcRenderer.invoke('hosts:list'),
    save: (host) => ipcRenderer.invoke('hosts:save', host),
    remove: (id) => ipcRenderer.invoke('hosts:remove', id),
    favorite: (id, favorite) => ipcRenderer.invoke('hosts:favorite', id, favorite),
  },
  credentials: {
    reveal: (id) => ipcRenderer.invoke('credentials:reveal', id),
    copy: (id) => ipcRenderer.invoke('credentials:copy', id),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
    writeText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  },
  translate: {
    text: (text) => ipcRenderer.invoke('translate:text', text),
    getSettings: () => ipcRenderer.invoke('settings:translation:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:translation:save', settings),
  },
  ssh: {
    connect: (hostId, sessionId) => ipcRenderer.invoke('ssh:connect', { hostId, sessionId }),
    disconnect: (sessionId) => ipcRenderer.invoke('ssh:disconnect', sessionId),
    input: (sessionId, data) => ipcRenderer.invoke('ssh:input', { sessionId, data }),
    resize: (sessionId, size) => ipcRenderer.invoke('ssh:resize', { sessionId, ...size }),
    onData: (callback) => listen('ssh:data', callback),
    onStatus: (callback) => listen('ssh:status', callback),
  },
  server: {
    stats: (sessionId) => ipcRenderer.invoke('server:stats', sessionId),
  },
  sftp: {
    home: (sessionId) => ipcRenderer.invoke('sftp:home', sessionId),
    list: (sessionId, remotePath) => ipcRenderer.invoke('sftp:list', { sessionId, path: remotePath }),
    mkdir: (sessionId, parent, name) => ipcRenderer.invoke('sftp:mkdir', { sessionId, parent, name }),
    upload: (input) => ipcRenderer.invoke('sftp:upload', input),
    copy: (input) => ipcRenderer.invoke('sftp:copy', input),
    remove: (sessionId, remotePath) => ipcRenderer.invoke('sftp:remove', { sessionId, path: remotePath }),
    pathForFile: (file) => webUtils.getPathForFile(file),
    onProgress: (callback) => listen('sftp:progress', callback),
  },
  dialog: {
    choosePrivateKey: () => ipcRenderer.invoke('dialog:private-key'),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
})
