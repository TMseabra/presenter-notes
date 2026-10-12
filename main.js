const { app, BrowserWindow, ipcMain, dialog, screen, desktopCapturer, globalShortcut } = require('electron')
const fs = require('fs')
const path = require('path')

let win
let watcher = null

const boundsFile = () => path.join(app.getPath('userData'), 'window.json')

// Last window position/size, ignored if it would now be off every display (e.g. monitor unplugged).
function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'))
    const visible = screen.getAllDisplays().some(d => {
      const a = d.workArea
      return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y
    })
    return visible ? b : null
  } catch {
    return null
  }
}

function saveBounds() {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isMaximized()) return
  try { fs.writeFileSync(boundsFile(), JSON.stringify(win.getBounds())) } catch {}
}

function createWindow() {
  const saved = loadBounds()
  win = new BrowserWindow({
    ...(saved || { width: 1280, height: 720 }),
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })
  // The constructor can be off by a pixel or two with display scaling; setBounds restores the exact size.
  if (saved) win.setBounds(saved)
  win.on('close', saveBounds)
  win.loadFile(path.join(__dirname, 'index.html'))
}

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

function registerShortcuts() {
  // Global, so they work while VS Code has focus.
  globalShortcut.register('CommandOrControl+Alt+Right', () => send('note:next'))
  globalShortcut.register('CommandOrControl+Alt+Left', () => send('note:prev'))
  globalShortcut.register('CommandOrControl+Alt+Space', () => send('teleprompter:toggle'))
  // Scroll the notes while another app (VS Code) has focus.
  globalShortcut.register('CommandOrControl+Shift+Up', () => send('notes:scroll', -1))
  globalShortcut.register('CommandOrControl+Shift+Down', () => send('notes:scroll', 1))
  globalShortcut.register('CommandOrControl+Alt+H', () => send('view:clean-toggle'))
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

// `npm start -- my-talk.md` opens that file instead of the bundled sample.
function notesFromArgs(argv) {
  const arg = argv.slice(1).find(a => /\.(md|markdown|txt)$/i.test(a) && fs.existsSync(a))
  return arg ? path.resolve(arg) : null
}

// The bundled sample, whose first note lists the controls (the Help button).
ipcMain.handle('notes:sample', async () => {
  const filePath = path.join(__dirname, 'notes.md')
  return { filePath, content: fs.readFileSync(filePath, 'utf8') }
})

ipcMain.handle('notes:default', async () => {
  const filePath = notesFromArgs(process.argv) || path.join(__dirname, 'notes.md')
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
