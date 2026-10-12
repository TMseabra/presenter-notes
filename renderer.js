const $ = id => document.getElementById(id)
const video = $('video')
const notesEl = $('notes')

let sections = []
let current = 0

// Small persisted preferences (font size, window options).
const settings = (() => { try { return JSON.parse(localStorage.getItem('settings')) || {} } catch { return {} } })()
function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(settings)) } catch {} }

let fontSize = settings.fontSize || 28

function setNotes(md, keepPosition) {
  sections = splitSections(md)
  const outline = $('outline')
  outline.innerHTML = ''
  sections.forEach((s, i) => outline.add(new Option(`${i + 1}. ${sectionTitle(s)}`, String(i))))
  current = keepPosition ? Math.min(current, Math.max(0, sections.length - 1)) : 0
  showNote(keepPosition)
}

function showNote(keepScroll) {
  const top = notesEl.scrollTop
  notesEl.innerHTML = sections.length ? renderMarkdown(sections[current]) : '<p>No notes loaded.</p>'
  notesEl.scrollTop = keepScroll ? top : 0
  $('counter').textContent = `${sections.length ? current + 1 : 0}/${sections.length}`
  $('outline').value = String(current)
}

function goTo(index) {
  if (!sections.length) return
  current = Math.min(sections.length - 1, Math.max(0, index))
  showNote()
}

function go(delta) { goTo(current + delta) }

// ---------- Preview ----------

async function startPreview(sourceId) {
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
  $('status').textContent = ''
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
}
$('timer-toggle').onclick = () => {
  if (timerId) { clearInterval(timerId); timerId = null; $('timer-toggle').textContent = 'Start' }
  else { timerId = setInterval(() => { elapsed++; renderTimer() }, 1000); $('timer-toggle').textContent = 'Pause' }
}
$('timer-reset').onclick = () => { elapsed = 0; renderTimer() }

// ---------- Wiring ----------

function applyFont() {
  notesEl.style.fontSize = fontSize + 'px'
  settings.fontSize = fontSize
  saveSettings()
}

// Restore the window options saved last time.
for (const [id, key, apply] of [['ontop', 'ontop', window.api.setAlwaysOnTop], ['hide', 'hide', window.api.setContentProtection]]) {
  if (settings[key]) { $(id).checked = true; apply(true) }
}

$('display').onchange = e => startPreview(e.target.value)
$('open').onclick = async () => { const r = await window.api.openNotes(); if (r) setNotes(r.content) }
$('outline').onchange = e => { current = Number(e.target.value); showNote(); e.target.blur() }
$('prev').onclick = () => go(-1)
$('next').onclick = () => go(1)
$('tele').onclick = toggleTeleprompter
$('ontop').onchange = e => { window.api.setAlwaysOnTop(e.target.checked); settings.ontop = e.target.checked; saveSettings() }
$('hide').onchange = e => { window.api.setContentProtection(e.target.checked); settings.hide = e.target.checked; saveSettings() }
$('font-').onclick = () => { fontSize = Math.max(12, fontSize - 2); applyFont() }
$('font+').onclick = () => { fontSize = Math.min(96, fontSize + 2); applyFont() }

$('refresh').onclick = loadDisplays
window.api.onDisplaysChanged(loadDisplays)
window.api.onNotesChanged(md => setNotes(md, true))
window.api.onNext(() => go(1))
window.api.onPrev(() => go(-1))
window.api.onTeleprompter(toggleTeleprompter)

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return // arrows belong to the control
  if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'Home') goTo(0)
  else if (e.key === 'End') goTo(sections.length - 1)
  else if (/^[1-9]$/.test(e.key)) goTo(Number(e.key) - 1)
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
window.api.defaultNotes().then(r => setNotes(r.content))
