const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const APP_JS_PATH = path.join(__dirname, '..', 'js', 'app.js');
const SOURCE = fs.readFileSync(APP_JS_PATH, 'utf8');

function loadFunction(name, dependencies = {}) {
  const search = `function ${name}`;
  const start = SOURCE.indexOf(search);
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }
  let index = SOURCE.indexOf('{', start);
  if (index === -1) {
    throw new Error(`Function ${name} has no body`);
  }
  let depth = 0;
  let end = -1;
  for (let i = index; i < SOURCE.length; i += 1) {
    const char = SOURCE[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error(`Function ${name} body not terminated`);
  }
  const fnStr = SOURCE.slice(start, end + 1);
  const factory = new Function(...Object.keys(dependencies), `return (${fnStr});`);
  return factory(...Object.values(dependencies));
}

const parseSize = loadFunction('parseSize');
const wrapTextLines = loadFunction('wrapTextLines');
const esc = loadFunction('esc');
const bulletify = loadFunction('bulletify', { esc });
const rgbToHex = loadFunction('__rgbToHex__px');

function createMockContext(charWidth = 10) {
  const calls = [];
  return {
    calls,
    measureText(text) {
      return { width: String(text).length * charWidth };
    },
    fillText(text, x, y) {
      calls.push({ text, x, y });
    }
  };
}

test('parseSize parses width and height with fallbacks', () => {
  assert.deepStrictEqual(parseSize('800x200'), [800, 200]);
  assert.deepStrictEqual(parseSize('abc'), [1000, 300]);
  assert.deepStrictEqual(parseSize(null), [1000, 300]);
});

test('wrapTextLines wraps long text across multiple lines', () => {
  const ctx = createMockContext();
  wrapTextLines(ctx, 'Alpha Beta', 0, 0, 60, 20, 3);
  assert.deepStrictEqual(ctx.calls, [
    { text: 'Alpha ', x: 0, y: 0 },
    { text: 'Beta', x: 0, y: 20 }
  ]);
});

test('wrapTextLines applies ellipsis when exceeding max lines', () => {
  const ctx = createMockContext();
  wrapTextLines(ctx, 'Alpha Beta Gamma Delta', 5, 10, 60, 18, 2);
  assert.deepStrictEqual(ctx.calls, [
    { text: 'Alpha ', x: 5, y: 10 },
    { text: 'Beta G…', x: 5, y: 28 }
  ]);
});

test('bulletify trims lines and escapes HTML characters', () => {
  const input = '  First line  \n\nSecond & <Third>\n';
  const expected = '<li>First line</li><li>Second &amp; &lt;Third&gt;</li>';
  assert.strictEqual(bulletify(input), expected);
  assert.strictEqual(bulletify(''), '');
});

test('__rgbToHex__px converts rgb strings to uppercase hex', () => {
  assert.strictEqual(rgbToHex('rgb(16, 32, 48)'), '#102030');
  assert.strictEqual(rgbToHex('rgba(255, 128, 64, 0.5)'), '#FF8040');
  assert.strictEqual(rgbToHex(''), '#E5E6EA');
  assert.strictEqual(rgbToHex('not-a-color'), 'not-a-color');
});
