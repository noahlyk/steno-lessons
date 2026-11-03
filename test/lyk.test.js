const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const steno = require('../public/lib/steno.js');

// Lyk's data is committed (built from the lyk-steno-theory repo with scripts/build-theory.js lyk).
const DATA = path.join(__dirname, '..', 'public', 'data');
const lyk = JSON.parse(fs.readFileSync(path.join(DATA, 'lyk', 'bundle.json'), 'utf8'));
const plover = JSON.parse(fs.readFileSync(path.join(DATA, 'bundle.json'), 'utf8'));

test('Lyk uses the same steno layout as Plover, so every key is in the same place', () => {
  assert.deepEqual(lyk.layout, plover.layout);
});

test('every Lyk lesson word is a plain word whose strokes all use keys from the layout', () => {
  assert.ok(lyk.words.length > 20000);
  for (const word of lyk.words) {
    assert.match(word.text, /^[a-z]{1,12}$/);
    assert.ok(word.shown.length > 0 && word.variants.length > 0);
    assert.ok(word.shown.every((stroke) => steno.parseStroke(stroke) !== null), word.text);
  }
});

test('Lyk lessons show a word\'s primary outline, not a shorter backup', () => {
  const shown = (text) => lyk.words.find((word) => word.text === text).shown.join('/');
  assert.equal(shown('the'), '-T');
  assert.equal(shown('they'), 'THE');
  assert.equal(shown('these'), 'THEZ');
  assert.equal(shown('those'), 'THOZ');
  assert.equal(shown('their'), 'THAER');
  assert.equal(shown('sit'), 'SEUT');
});

test('the dictionary only has strokes this page can press', () => {
  const dict = JSON.parse(fs.readFileSync(path.join(DATA, 'lyk', 'dictionary.json'), 'utf8'));
  const bad = Object.keys(dict).filter((notation) => notation.split('/').some((stroke) => steno.parseStroke(stroke) === null));
  assert.deepEqual(bad, []);
  assert.ok(Object.keys(dict).length > 50000);
});
