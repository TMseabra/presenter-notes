const $ = id => document.getElementById(id)
const video = $('video')
const notesEl = $('notes')
const pad = $('padtext')

let mode = 'pad' // 'pad' | 'notes'
let sections = []
let current = 0

// Small persisted preferences (font size, window options).
const settings = (() => { try { return JSON.parse(localStorage.getItem('settings')) || {} } catch { return {} } })()
function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(settings)) } catch {} }

let fontSize = settings.fontSize || 28

// A .txt file is shown whole and static (one "note", original formatting); .md files are split per "## ".
let plainMode = false
let rawText = '' // the text currently shown, so the editor can start from it
let plainSize = settings.plainSize || 14 // plain text has its own, smaller, size
let padSize = settings.padSize || 16

function setNotes(md, keepPosition, fileName) {
  rawText = md
  if (fileName !== undefined) { plainMode = isPlainFile(fileName); applyFont() }
  sections = plainMode ? (md.trim() ? [md] : []) : splitSections(md)
  const outline = $('outline')
  outline.innerHTML = ''
  sections.forEach((s, i) => outline.add(new Option(`${i + 1}. ${plainMode ? 'Full text' : sectionTitle(s)}`, String(i))))
  current = keepPosition ? Math.min(current, Math.max(0, sections.length - 1)) : 0
  showNote(keepPosition)
}

function showNote(keepScroll) {
  const top = notesEl.scrollTop
  const render = plainMode ? renderPlain : renderMarkdown
  notesEl.innerHTML = sections.length ? render(sections[current]) : '<p>No notes loaded.</p>'
  notesEl.scrollTop = keepScroll ? top : 0
  $('counter').textContent = `${sections.length ? current + 1 : 0}/${sections.length}`
  $('outline').value = String(current)
}

function goTo(index) {
  if (!sections.length) return
  const target = Math.min(sections.length - 1, Math.max(0, index))
  if (target === current) return // already there: keep the reading position
  current = target
  showNote()
}

function go(delta) { goTo(current + delta) }

// ---------- Preview ----------

async function startPreview(sourceId) {
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
  $('status').textContent = ''
  video.classList.remove('frozen')
  $('freeze').classList.remove('active')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxFrameRate: 30 } }
    })
    video.srcObject = stream
    // The capture ends when the display is unplugged; say so instead of freezing on the last frame.
    stream.getVideoTracks()[0].onended = () => { $('status').textContent = 'Display disconnected. Reconnect it and press Refresh.' }
  } catch (err) {
    $('status').textContent = `Could not capture the display: ${err.message}`
  }
}

async function loadDisplays() {
  const displays = await window.api.listDisplays()
  const select = $('display')
  const previous = select.value
  select.innerHTML = ''
  displays.forEach(d => select.add(new Option(d.label, d.sourceId)))
  // Prefer a display that is not the PC screen.
  const other = displays.find(d => !d.isPrimary) || displays[0]
  const keep = displays.find(d => d.sourceId === previous) && displays.length > 1 ? previous : other && other.sourceId
  if (keep) { select.value = keep; startPreview(keep) }
  if (displays.length < 2) $('status').textContent = 'Only one display found. Use Win + P and pick Extend.'
}

// ---------- Teleprompter ----------

let teleTimer = null
let teleSpeed = settings.teleSpeed || 1 // pixels per 30 ms tick

function renderTeleLabel() { $('tele').textContent = `Teleprompter x${teleSpeed}` }

function toggleTeleprompter() {
  if (teleTimer) { clearInterval(teleTimer); teleTimer = null }
  else teleTimer = setInterval(() => { scroller().scrollTop += teleSpeed }, 30)
  $('tele').classList.toggle('active', !!teleTimer)
}

function changeTeleSpeed(delta) {
  teleSpeed = Math.min(10, Math.max(1, teleSpeed + delta))
  settings.teleSpeed = teleSpeed
  saveSettings()
  renderTeleLabel()
}

// ---------- Timer ----------

let elapsed = 0
let timerId = null
function renderTimer() {
  const p = n => String(n).padStart(2, '0')
  $('timer').textContent = `${p(Math.floor(elapsed / 3600))}:${p(Math.floor(elapsed / 60) % 60)}:${p(elapsed % 60)}`
  const target = Number($('target').value)
  $('timer').classList.toggle('over', target > 0 && elapsed > target * 60)
}
$('target').oninput = () => { settings.target = $('target').value; saveSettings(); renderTimer() }
if (settings.target) $('target').value = settings.target
$('timer-toggle').onclick = () => {
  if (timerId) { clearInterval(timerId); timerId = null; $('timer-toggle').textContent = 'Start' }
  else { timerId = setInterval(() => { elapsed++; renderTimer() }, 1000); $('timer-toggle').textContent = 'Pause' }
}
$('timer-reset').onclick = () => { elapsed = 0; renderTimer() }

// ---------- Wiring ----------

function applyFont() {
  notesEl.style.fontSize = (plainMode ? plainSize : fontSize) + 'px'
  pad.style.fontSize = padSize + 'px'
  $('padsize').textContent = padSize
  settings.fontSize = fontSize
  settings.plainSize = plainSize
  settings.padSize = padSize
  saveSettings()
}

// The A-/A+ buttons, Ctrl+wheel and the pad toolbar all resize whatever is on screen.
function changeFont(delta) {
  if (mode === 'pad') padSize = Math.min(48, Math.max(8, padSize + delta))
  else if (plainMode) plainSize = Math.min(48, Math.max(8, plainSize + delta))
  else fontSize = Math.min(96, Math.max(12, fontSize + delta * 2))
  applyFont()
}

// Ctrl + mouse wheel zooms the text.
for (const el of [notesEl, pad]) {
  el.addEventListener('wheel', e => {
    if (!e.ctrlKey) return
    e.preventDefault()
    changeFont(e.deltaY < 0 ? 1 : -1)
  }, { passive: false })
}

// ---------- Notepad (the editable panel) ----------

// Pasting always inserts plain text, so text copied from a web page or Word never brings its own giant font.
pad.addEventListener('paste', e => {
  e.preventDefault()
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
})

let padSaveTimer = null
function savePad() {
  clearTimeout(padSaveTimer)
  padSaveTimer = setTimeout(() => { try { localStorage.setItem('padHtml', pad.innerHTML) } catch {} }, 300)
}
pad.addEventListener('input', savePad)

// Clicking a toolbar control must not lose the selection inside the pad.
let savedRange = null
document.addEventListener('selectionchange', () => {
  const sel = getSelection()
  if (sel.rangeCount && pad.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange()
})

function format(cmd, value) {
  pad.focus()
  if (savedRange) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(savedRange) }
  document.execCommand('styleWithCSS', false, true)
  document.execCommand(cmd, false, value)
  savePad()
}

$('padbar').addEventListener('mousedown', e => { if (e.target.tagName === 'BUTTON') e.preventDefault() })
for (const b of document.querySelectorAll('#padbar [data-cmd]')) b.onclick = () => format(b.dataset.cmd)
for (const b of document.querySelectorAll('#padbar [data-fg]')) {
  b.style.background = b.dataset.fg
  b.onclick = () => format('foreColor', b.dataset.fg)
}
$('fg').oninput = e => format('foreColor', e.target.value)
$('bg').oninput = e => format('hiliteColor', e.target.value)
$('nohl').onclick = () => format('hiliteColor', 'transparent')
$('padreset').onclick = () => format('removeFormat')
$('padsize-').onclick = () => { if (mode === 'pad') changeFont(-1) }
$('padsize+').onclick = () => { if (mode === 'pad') changeFont(1) }

// Restore what was typed last time (or the text pasted with the old "Paste text" box).
try {
  const saved = localStorage.getItem('padHtml')
  if (saved) pad.innerHTML = saved
  else if (settings.pasted) pad.textContent = settings.pasted
} catch {}

// Two modes share the right-hand side: the notepad (default) and notes loaded from a file.
function setMode(next) {
  mode = next
  pad.parentElement.hidden = mode !== 'pad'
  notesEl.hidden = mode !== 'notes'
  $('mode').textContent = mode === 'pad' ? 'Open a notes file' : 'Back to notepad'
  settings.mode = mode
  saveSettings()
}
const scroller = () => (mode === 'pad' ? pad : notesEl)
$('mode').onclick = () => setMode(mode === 'pad' ? 'notes' : 'pad')

function toggleTheme() {
  document.body.classList.toggle('light')
  settings.light = document.body.classList.contains('light')
  saveSettings()
}
// Freezing pauses the <video> on the current frame; handy to inspect something on the big screen.
function toggleFreeze() {
  const frozen = !video.paused
  if (frozen) video.pause(); else video.play()
  video.classList.toggle('frozen', frozen)
  $('freeze').classList.toggle('active', frozen)
}
$('freeze').onclick = toggleFreeze

// Layout cycles: both -> notes only -> preview only -> both.
const layouts = ['both', 'only-notes', 'only-preview']
let layout = layouts.includes(settings.layout) ? settings.layout : 'both'
function applyLayout() {
  document.body.classList.remove('only-notes', 'only-preview')
  if (layout !== 'both') document.body.classList.add(layout)
  settings.layout = layout
  saveSettings()
}
function cycleLayout() { layout = layouts[(layouts.indexOf(layout) + 1) % layouts.length]; applyLayout() }
$('layout').onclick = cycleLayout

// Clean view hides the toolbar and the side panels, leaving only the live preview.
function toggleClean() { document.body.classList.toggle('clean') }
$('clean').onclick = toggleClean
// The shortcut bar under the toolbar, so nobody has to memorise the keys. Dismissible; Help brings it back.
function setHints(visible) {
  $('hints').classList.toggle('off', !visible)
  settings.hintsHidden = !visible
  saveSettings()
}
$('hints-close').onclick = () => setHints(false)
setHints(!settings.hintsHidden)
$('help').onclick = async () => {
  setHints(true)
  const r = await window.api.sampleNotes(); setNotes(r.content, false, r.filePath); setMode('notes') }
$('preview').ondblclick = toggleClean // quick way back out
window.api.onCleanToggle(toggleClean)

// Which side the notes are on (persisted). Layout is mirrored with CSS, so the code below only needs to know the side.
const notesOnLeft = () => document.body.classList.contains('notes-left')
function applySide() {
  document.body.classList.toggle('notes-left', settings.side === 'left')
}
function toggleSide() {
  settings.side = notesOnLeft() ? 'right' : 'left'
  saveSettings()
  applySide()
}
$('side').onclick = toggleSide
applySide()

// Draggable divider between the preview and the notes; double-click resets it.
const DEFAULT_SPLIT = 60
function setSplit(percent, save) {
  const value = Math.min(85, Math.max(15, percent))
  document.documentElement.style.setProperty('--split', String(value))
  if (save) { settings.split = value; saveSettings() }
}
setSplit(settings.split || DEFAULT_SPLIT)
$('divider').addEventListener('pointerdown', e => {
  e.preventDefault()
  const divider = $('divider')
  const main = divider.parentElement
  divider.classList.add('dragging')
  const move = ev => {
    const rect = main.getBoundingClientRect()
    // The preview's share, measured from whichever edge it sits on.
    const fromEdge = notesOnLeft() ? rect.right - ev.clientX : ev.clientX - rect.left
    setSplit((fromEdge / rect.width) * 100, true)
  }
  const up = () => {
    divider.classList.remove('dragging')
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', up)
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', up)
})
$('divider').ondblclick = () => setSplit(DEFAULT_SPLIT, true)

// Ctrl+Shift+Up/Down (global) scrolls the notes a little while you keep typing in another app.
window.api.onScroll(dir => scroller().scrollBy(0, dir * 90))
applyLayout()
$('theme').onclick = toggleTheme
if (settings.light) document.body.classList.add('light')

// Restore the window options saved last time.
for (const [id, key, apply] of [['ontop', 'ontop', window.api.setAlwaysOnTop], ['hide', 'hide', window.api.setContentProtection]]) {
  if (settings[key]) { $(id).checked = true; apply(true) }
}

$('display').onchange = e => startPreview(e.target.value)
$('open').onclick = async () => { const r = await window.api.openNotes(); if (r) { setNotes(r.content, false, r.filePath); setMode('notes') } }
$('outline').onchange = e => { current = Number(e.target.value); showNote(); e.target.blur() }
$('prev').onclick = () => go(-1)
$('next').onclick = () => go(1)
$('tele').onclick = toggleTeleprompter
$('ontop').onchange = e => { window.api.setAlwaysOnTop(e.target.checked); settings.ontop = e.target.checked; saveSettings() }
$('hide').onchange = e => { window.api.setContentProtection(e.target.checked); settings.hide = e.target.checked; saveSettings() }
$('font-').onclick = () => changeFont(-1)
$('font+').onclick = () => changeFont(1)

// Drop a .md/.txt file anywhere on the window to load it as the notes.
document.addEventListener('dragover', e => e.preventDefault())
document.addEventListener('drop', async e => {
  e.preventDefault()
  const file = [...e.dataTransfer.files].find(f => /\.(md|markdown|txt)$/i.test(f.name))
  if (file) { setNotes(await file.text(), false, file.name); setMode('notes') }
})

$('refresh').onclick = loadDisplays
window.api.onDisplaysChanged(loadDisplays)
window.api.onNotesChanged(md => setNotes(md, true))
window.api.onNext(() => go(1))
window.api.onPrev(() => go(-1))
window.api.onTeleprompter(toggleTeleprompter)

document.addEventListener('keydown', e => {
  // Keys belong to the control being used, and to the notepad while you type in it.
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return
  if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'Home') goTo(0)
  else if (e.key === 'End') goTo(sections.length - 1)
  else if (/^[1-9]$/.test(e.key)) goTo(Number(e.key) - 1)
  else if (e.key === 't' || e.key === 'T') toggleTheme()
  else if (e.key === 'p' || e.key === 'P') toggleFreeze()
  else if (e.key === 'n' || e.key === 'N') cycleLayout()
  else if (e.key === 's' || e.key === 'S') toggleSide()
  else if (e.key === 'h' || e.key === 'H' || e.key === 'Escape') { if (e.key !== 'Escape' || document.body.classList.contains('clean')) toggleClean() }
  else if (e.key === ']') changeTeleSpeed(1)
  else if (e.key === '[') changeTeleSpeed(-1)
  else if (e.key === 'ArrowDown') scroller().scrollBy(0, scroller().clientHeight / 4)
  else if (e.key === 'ArrowUp') scroller().scrollBy(0, -scroller().clientHeight / 4)
  else if (e.key === 'PageDown') scroller().scrollBy(0, scroller().clientHeight * 0.9)
  else if (e.key === 'PageUp') scroller().scrollBy(0, -scroller().clientHeight * 0.9)
})

applyFont()
renderTeleLabel()
loadDisplays()
setMode(settings.mode === 'notes' ? 'notes' : 'pad')
window.api.defaultNotes().then(r => setNotes(r.content, false, r.filePath))
