const { contextBridge, ipcRenderer } = require('electron')

const on = (channel, cb) => ipcRenderer.on(channel, (_e, data) => cb(data))

contextBridge.exposeInMainWorld('api', {
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  openNotes: () => ipcRenderer.invoke('notes:open'),
  defaultNotes: () => ipcRenderer.invoke('notes:default'),
  setAlwaysOnTop: v => ipcRenderer.send('window:always-on-top', v),
  setContentProtection: v => ipcRenderer.send('window:content-protection', v),
  onNext: cb => on('note:next', cb),
  onPrev: cb => on('note:prev', cb),
  onNotesChanged: cb => on('notes:changed', cb),
  onDisplaysChanged: cb => on('displays:changed', cb),
  onTeleprompter: cb => on('teleprompter:toggle', cb)
})
