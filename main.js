const { app, BrowserWindow, ipcMain, dialog, screen, desktopCapturer, globalShortcut } = require('electron')
const fs = require('fs')
const path = require('path')

let win
let watcher = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })
  win.loadFile(path.join(__dirname, 'index.html'))
}

function send(channel) {
  if (win && !win.isDestroyed()) win.webContents.send(channel)
}

function registerShortcuts() {
  // Global, so they work while VS Code has focus.
  globalShortcut.register('CommandOrControl+Alt+Right', () => send('note:next'))
  globalShortcut.register('CommandOrControl+Alt+Left', () => send('note:prev'))
  globalShortcut.register('CommandOrControl+Alt+Space', () => send('teleprompter:toggle'))
}

ipcMain.handle('displays:list', async () => {
  const displays = screen.getAllDisplays()
  const primaryId = screen.getPrimaryDisplay().id
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
  return displays
    .map((d, i) => {
      const source = sources.find(s => s.display_id === String(d.id)) || sources[i]
      return {
        sourceId: source ? source.id : null,
        label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})${d.id === primaryId ? ' - this PC screen' : ''}`,
        isPrimary: d.id === primaryId
      }
    })
    .filter(d => d.sourceId)
})

function watchNotes(filePath) {
  if (watcher) watcher.close()
  let timer
  watcher = fs.watch(filePath, () => {
    // Editors fire several events per save; debounce and re-read.
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        if (win && !win.isDestroyed()) win.webContents.send('notes:changed', fs.readFileSync(filePath, 'utf8'))
      } catch {}
    }, 150)
  })
  watcher.on('error', () => {})
}

ipcMain.handle('notes:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile']
  })
  if (res.canceled || !res.filePaths[0]) return null
  const filePath = res.filePaths[0]
  watchNotes(filePath)
  return { filePath, content: fs.readFileSync(filePath, 'utf8') }
})

ipcMain.handle('notes:default', async () => {
  const filePath = path.join(__dirname, 'notes.md')
  watchNotes(filePath)
  return { filePath, content: fs.readFileSync(filePath, 'utf8') }
})

ipcMain.on('window:always-on-top', (_e, on) => win.setAlwaysOnTop(!!on, 'floating'))
ipcMain.on('window:content-protection', (_e, on) => win.setContentProtection(!!on))

app.whenReady().then(() => {
  createWindow()
  registerShortcuts()
  const notifyDisplays = () => send('displays:changed')
  screen.on('display-added', notifyDisplays)
  screen.on('display-removed', notifyDisplays)
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
