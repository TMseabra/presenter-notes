const test = require('node:test')
const assert = require('node:assert')
const { renderMarkdown, splitSections, inline } = require('../markdown.js')

test('inline formatting', () => {
  assert.strictEqual(inline('a **b** `c` *d*'), 'a <strong>b</strong> <code>c</code> <em>d</em>')
})

test('html is escaped', () => {
  assert.ok(renderMarkdown('<img src=x onerror=alert(1)>').includes('&lt;img'))
})

test('headings, lists and code blocks', () => {
  const html = renderMarkdown('## T\n- a\n- b\n1. x\n```js\n<b>\n```')
  assert.ok(html.includes('<h2>T</h2>'))
  assert.strictEqual((html.match(/<li>/g) || []).length, 3)
  assert.ok(html.includes('<pre><code>&lt;b&gt;</code></pre>'))
})

test('splitSections splits on level-2 headings', () => {
  assert.strictEqual(splitSections('# Title\n## A\nx\n## B\ny').length, 3)
})

test('splitSections ignores headings inside code fences', () => {
  assert.strictEqual(splitSections('## A\n```\n## not\n```\n## B').length, 2)
})

test('splitSections drops empty parts', () => {
  assert.deepStrictEqual(splitSections(''), [])
})
