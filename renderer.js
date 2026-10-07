const $ = id => document.getElementById(id)
const video = $('video')
const notesEl = $('notes')

let sections = []
let current = 0
let fontSize = 28

// ---------- Markdown ----------

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function renderMarkdown(md) {
  const out = []
  let list = null
  let code = null
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }

  for (const line of md.split(/\r?\n/)) {
    if (line.startsWith('```')) {
      if (code === null) { closeList(); code = [] }
      else { out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null }
      continue
    }
    if (code !== null) { code.push(line); continue }

    let m
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      closeList()
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`)
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if (line.trim()) {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    } else {
      closeList()
    }
  }
  if (code !== null) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  closeList()
  return out.join('\n')
}

// A note is a "## " section. Text before the first one (e.g. the "# " title) is its own note.
function splitSections(md) {
  const parts = []
  let buf = []
  let inFence = false
  for (const line of md.split(/\r?\n/)) {
    if (line.startsWith('```')) inFence = !inFence
    if (!inFence && /^##\s/.test(line) && buf.length) { parts.push(buf.join('\n')); buf = [] }
    buf.push(line)
  }
  if (buf.length) parts.push(buf.join('\n'))
  return parts.filter(p => p.trim())
}

function setNotes(md) {
  sections = splitSections(md)
  current = 0
  showNote()
}

function showNote() {
  notesEl.innerHTML = sections.length ? renderMarkdown(sections[current]) : '<p>No notes loaded.</p>'
  notesEl.scrollTop = 0
  $('counter').textContent = `${sections.length ? current + 1 : 0}/${sections.length}`
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
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxFrameRate: 30 } }
    })
  } catch (err) {
    $('status').textContent = `Could not capture the display: ${err.message}`
  }
}

async function loadDisplays() {
  const displays = await window.api.listDisplays()
  const select = $('display')
  select.innerHTML = ''
  displays.forEach(d => select.add(new Option(d.label, d.sourceId)))
  // Prefer a display that is not the PC screen.
  const other = displays.find(d => !d.isPrimary) || displays[0]
  if (other) { select.value = other.sourceId; startPreview(other.sourceId) }
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
$('prev').onclick = () => go(-1)
$('next').onclick = () => go(1)
$('tele').onclick = toggleTeleprompter
$('ontop').onchange = e => window.api.setAlwaysOnTop(e.target.checked)
$('hide').onchange = e => window.api.setContentProtection(e.target.checked)
$('font-').onclick = () => { fontSize = Math.max(12, fontSize - 2); applyFont() }
$('font+').onclick = () => { fontSize = Math.min(96, fontSize + 2); applyFont() }

window.api.onNext(() => go(1))
window.api.onPrev(() => go(-1))
window.api.onTeleprompter(toggleTeleprompter)

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
})

applyFont()
loadDisplays()
window.api.defaultNotes().then(r => setNotes(r.content))
