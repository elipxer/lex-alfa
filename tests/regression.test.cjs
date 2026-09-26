const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('preview preserves the original template style without duplicate style attributes', () => {
  const source = fs.readFileSync('js/legendas.js', 'utf8');
  assert.equal(source.includes('preview.outerHTML = t.preview(cor).replace('), false,
    'Replacing class with a second style attribute drops template styles');
});
