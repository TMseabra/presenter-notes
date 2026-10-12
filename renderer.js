const $ = id => document.getElementById(id)
const video = $('video')
const notesEl = $('notes')

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
  else teleTimer = setInterval(() => { notesEl.scrollTop += teleSpeed }, 30)
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
  $('editor').style.fontSize = plainSize + 'px'
  settings.fontSize = fontSize
  settings.plainSize = plainSize
  saveSettings()
}

function changeFont(delta) {
  if (plainMode) plainSize = Math.min(48, Math.max(8, plainSize + delta))
  else fontSize = Math.min(96, Math.max(12, fontSize + delta * 2))
  applyFont()
}

// Ctrl + mouse wheel zooms the text.
notesEl.addEventListener('wheel', e => {
  if (!e.ctrlKey) return
  e.preventDefault()
  changeFont(e.deltaY < 0 ? 1 : -1)
}, { passive: false })

// "Paste text": type or paste your own text; it is shown as plain static text and remembered.
const editor = $('editor')
function toggleEditor() {
  if (editor.hidden) {
    editor.value = rawText
    editor.hidden = false
    notesEl.hidden = true
    $('edit').textContent = 'Done'
    editor.focus()
  } else {
    editor.hidden = true
    notesEl.hidden = false
    $('edit').textContent = 'Paste text'
    settings.pasted = editor.value
    saveSettings()
    setNotes(editor.value, false, 'pasted.txt')
  }
}
$('edit').onclick = toggleEditor
function forgetPasted() { delete settings.pasted; saveSettings() }

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
applyLayout()
$('theme').onclick = toggleTheme
if (settings.light) document.body.classList.add('light')

// Restore the window options saved last time.
for (const [id, key, apply] of [['ontop', 'ontop', window.api.setAlwaysOnTop], ['hide', 'hide', window.api.setContentProtection]]) {
  if (settings[key]) { $(id).checked = true; apply(true) }
}

$('display').onchange = e => startPreview(e.target.value)
$('open').onclick = async () => { const r = await window.api.openNotes(); if (r) { forgetPasted(); setNotes(r.content, false, r.filePath) } }
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
  if (file) { forgetPasted(); setNotes(await file.text(), false, file.name) }
})

$('refresh').onclick = loadDisplays
window.api.onDisplaysChanged(loadDisplays)
window.api.onNotesChanged(md => setNotes(md, true))
window.api.onNext(() => go(1))
window.api.onPrev(() => go(-1))
window.api.onTeleprompter(toggleTeleprompter)

document.addEventListener('keydown', e => {
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return // arrows belong to the control
  if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'Home') goTo(0)
  else if (e.key === 'End') goTo(sections.length - 1)
  else if (/^[1-9]$/.test(e.key)) goTo(Number(e.key) - 1)
  else if (e.key === 't' || e.key === 'T') toggleTheme()
  else if (e.key === 'p' || e.key === 'P') toggleFreeze()
  else if (e.key === 'n' || e.key === 'N') cycleLayout()
  else if (e.key === ']') changeTeleSpeed(1)
  else if (e.key === '[') changeTeleSpeed(-1)
  else if (e.key === 'ArrowDown') notesEl.scrollBy(0, notesEl.clientHeight / 4)
  else if (e.key === 'ArrowUp') notesEl.scrollBy(0, -notesEl.clientHeight / 4)
  else if (e.key === 'PageDown') notesEl.scrollBy(0, notesEl.clientHeight * 0.9)
  else if (e.key === 'PageUp') notesEl.scrollBy(0, -notesEl.clientHeight * 0.9)
})

applyFont()
renderTeleLabel()
loadDisplays()
if (settings.pasted) setNotes(settings.pasted, false, 'pasted.txt')
else window.api.defaultNotes().then(r => setNotes(r.content, false, r.filePath))
