// Builds a theory's data files for the page: public/data/<theory>/bundle.json (the lesson words
// and layout) and public/data/<theory>/dictionary.json (every stroke, for the letting-go preview).
//
// Usage: node scripts/build-theory.js lapwing <folder with the Plover-format JSON files>
//        node scripts/build-theory.js lyk [<folder with the 02-lyk-*.json files>]
//
// Lapwing's JSON files come from https://github.com/aerickt/plover-lapwing-aio (folder
// plover_lapwing/dictionaries). Only the .json files are used; its .modal and .py files need
// Plover's plugin runtime and are skipped, so inflected forms such as "accorded" are missing.
// Files earlier in the list win when two strokes map to the same key, like Plover's priority.
//
// Lyk's files are the output of `cargo run --release -- build` in the lyk-steno-theory repo
// (default folder: ../lyk-steno-theory/out/lyk). Lyk writes a word that does not fit one stroke
// with a join key (`+`), which this page has no key for, so those outlines are left out and the
// lessons use the words Lyk writes in a single stroke. Lessons show a word's primary outline
// (the words and short files); the other files only add strokes that count as right.
const fs = require('node:fs');
const path = require('node:path');
const steno = require('../public/lib/steno.js');

const LAPWING_FILES = [
  'lapwing-base.json',
  'lapwing-numbers.json',
  'lapwing-commands.json',
  'lapwing-semi-modal-movement.json',
  'lapwing-prefixed-proper-nouns.json',
  'lapwing-uk-additions.json',
];

// In priority order. `SHOWN` are the files whose outline a lesson displays for a word.
const LYK_FILES = [
  '02-lyk-words.json',
  '02-lyk-short.json',
  '02-lyk-alternates.json',
  '02-lyk-extras.json',
  '02-lyk-backups.json',
  '02-lyk-phrases.json',
];
const LYK_SHOWN = new Set(['02-lyk-words.json', '02-lyk-short.json']);

const [theory, argSource] = process.argv.slice(2);
const source = argSource || (theory === 'lyk' ? path.join(__dirname, '..', '..', 'lyk-steno-theory', 'out', 'lyk') : '');
if (!['lapwing', 'lyk'].includes(theory) || !source) {
  console.error('usage: node scripts/build-theory.js lapwing <folder with the JSON files>\n       node scripts/build-theory.js lyk [<folder with the 02-lyk-*.json files>]');
  process.exit(1);
}

const PUBLIC = path.join(__dirname, '..', 'public');
const plover = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'bundle.json'), 'utf8'));
const files = theory === 'lyk' ? LYK_FILES : LAPWING_FILES;

const merged = {};
const shown = [];
for (const file of files) {
  const dict = JSON.parse(fs.readFileSync(path.join(source, file), 'utf8'));
  for (const [stroke, text] of Object.entries(dict)) {
    if (stroke in merged) continue;
    merged[stroke] = text;
    if (theory !== 'lyk' || LYK_SHOWN.has(file)) shown.push([stroke, text]);
  }
}

const words = steno.buildWords(shown);
if (theory === 'lyk') {
  // Strokes from the other files count as right for a word that already has an outline to show,
  // but never become the one the lesson displays.
  const byText = new Map(words.map((word) => [word.text, word]));
  const seen = new Set(shown.map(([stroke]) => stroke));
  for (const [stroke, text] of Object.entries(merged)) {
    const word = byText.get(text);
    if (!word || seen.has(stroke) || stroke.split('/').length > 3) continue;
    const strokes = stroke.split('/').map((part) => steno.parseStroke(part));
    if (strokes.some((bits) => bits === null)) continue;
    word.variants.push(strokes);
  }
}

const bundle = {
  layout: plover.layout,
  words,
  dictionaries: files,
};

const out = path.join(PUBLIC, 'data', theory);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'bundle.json'), JSON.stringify(bundle));
// The preview reads strokes this page can press, so Lyk's join-key outlines are not written out.
const pressable = theory === 'lyk'
  ? Object.fromEntries(Object.entries(merged).filter(([stroke]) => stroke.split('/').every((part) => steno.parseStroke(part) !== null)))
  : merged;
fs.writeFileSync(path.join(out, 'dictionary.json'), JSON.stringify(pressable));
// Lyk's suffixes are continuation strokes with a join key, which this page cannot press.
const suffixes = theory === 'lyk' ? {} : steno.buildSuffixes(Object.entries(merged));
fs.writeFileSync(path.join(out, 'suffixes.json'), JSON.stringify(suffixes));
console.log(`${theory}: ${bundle.words.length} words, ${Object.keys(pressable).length} strokes -> ${out}`);
