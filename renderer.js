const $ = id => document.getElementById(id)
const video = $('video')
const notesEl = $('notes')

let sections = []
let current = 0
let fontSize = 28

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

function go(delta) {
  if (!sections.length) return
  current = Math.min(sections.length - 1, Math.max(0, current + delta))
  showNote()
}

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
function toggleTeleprompter() {
  if (teleTimer) { clearInterval(teleTimer); teleTimer = null }
  else teleTimer = setInterval(() => { notesEl.scrollTop += 1 }, 30)
  $('tele').classList.toggle('active', !!teleTimer)
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

function applyFont() { notesEl.style.fontSize = fontSize + 'px' }

$('display').onchange = e => startPreview(e.target.value)
$('open').onclick = async () => { const r = await window.api.openNotes(); if (r) setNotes(r.content) }
$('outline').onchange = e => { current = Number(e.target.value); showNote(); e.target.blur() }
$('prev').onclick = () => go(-1)
$('next').onclick = () => go(1)
$('tele').onclick = toggleTeleprompter
$('ontop').onchange = e => window.api.setAlwaysOnTop(e.target.checked)
$('hide').onchange = e => window.api.setContentProtection(e.target.checked)
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
})

applyFont()
loadDisplays()
window.api.defaultNotes().then(r => setNotes(r.content))
