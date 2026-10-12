function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
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
    } else if (!/^\s*([-*_])(\s*\1){2,}\s*$/.test(line) && (m = line.match(/^\s*[-*]\s+(.*)/))) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeList()
      out.push('<hr>')
    } else if ((m = line.match(/^>\s?(.*)/))) {
      closeList()
      out.push(`<blockquote>${inline(m[1])}</blockquote>`)
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

// Loaded as a plain script in the window and as a module in the tests.
if (typeof module !== 'undefined') module.exports = { escapeHtml, inline, renderMarkdown, splitSections }
