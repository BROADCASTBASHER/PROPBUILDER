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
 codex/add-full-test-suite-i8vs08
const buildEmailHTML = loadFunction('buildEmailHTML');

function createElement(overrides = {}) {
  const base = {
    textContent: '',
    innerHTML: '',
    style: {},
    src: '',
    toDataURL: undefined,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return Object.assign(base, overrides);
}

function withDocumentEnvironment(setup, fn) {
  const {
    ids = {},
    selectors = {},
    queryAll = {},
    features = [],
    heroCards = [],
    assumptions = [],
    state = { preset: 'test' },
    presets = { test: { panel: '#EFEFEF' } },
    priceCardColor = 'rgb(16, 32, 48)',
  } = setup;

  const idMap = new Map(Object.entries(ids));
  const selectorMap = new Map(Object.entries(selectors));
  const queryAllMap = new Map(Object.entries(queryAll));
  if (assumptions.length) {
    queryAllMap.set('#assumptions li', assumptions);
  }

  const documentStub = {
    documentElement: createElement({ innerHTML: '' }),
    getElementById(id) {
      return idMap.get(id) ?? null;
    },
    querySelector(selector) {
      const options = selector.split(',').map((part) => part.trim()).filter(Boolean);
      for (const option of options) {
        if (selectorMap.has(option)) {
          return selectorMap.get(option);
        }
        if (option.startsWith('#')) {
          const byId = idMap.get(option.slice(1));
          if (byId) {
            return byId;
          }
        }
      }
      return null;
    },
    querySelectorAll(selector) {
      const options = selector.split(',').map((part) => part.trim()).filter(Boolean);
      for (const option of options) {
        if (queryAllMap.has(option)) {
          return queryAllMap.get(option);
        }
      }
      return [];
    },
    createElement(tag) {
      return createElement({ tagName: tag.toUpperCase() });
    }
  };

  const previous = {
    document: global.document,
    window: global.window,
    state: global.state,
    PRESETS: global.PRESETS,
    localStorage: global.localStorage,
    getComputedStyle: global.getComputedStyle,
  };

  const storage = new Map();
  storage.set('heroCards', JSON.stringify(heroCards));

  global.document = documentStub;
  global.window = Object.assign({ _features: features }, setup.windowOverrides || {});
  global.state = state;
  global.PRESETS = presets;
  global.localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };
  global.getComputedStyle = (el) => ({ backgroundColor: (el && el.style && el.style.backgroundColor) || priceCardColor });

  try {
    return fn();
  } finally {
    global.document = previous.document;
    global.window = previous.window;
    global.state = previous.state;
    global.PRESETS = previous.PRESETS;
    global.localStorage = previous.localStorage;
    global.getComputedStyle = previous.getComputedStyle;
  }
}
=======
 main

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
 codex/add-full-test-suite-i8vs08

test('buildEmailHTML composes full export with escaped content and live data', () => {
  const assumptions = [
    createElement({ textContent: 'Payment due & accepted <net30>' }),
    createElement({ textContent: 'Requires onsite team' })
  ];

  const priceRows = [
    {
      querySelectorAll(selector) {
        if (selector === 'td') {
          return [
            createElement({ textContent: 'Managed Service & Support' }),
            createElement({ textContent: '12' }),
            createElement({ textContent: '$150.00' }),
            createElement({ textContent: '$1,800.00' })
          ];
        }
        return [];
      }
    }
  ];

  const html = withDocumentEnvironment({
    ids: {
      pageBanner: createElement({ src: 'data:initial' }),
      banner: createElement({ toDataURL: () => 'data:generated-banner' }),
      pvCustomer: createElement({ textContent: 'Telstra Enterprise' }),
      pvRef: createElement({ textContent: 'Ref: QF-77' }),
      pvHero: createElement({ textContent: 'Modernise your workplace' }),
      pvSub: createElement({ textContent: 'A tailored solution for growth' }),
      pvSummary: createElement({ textContent: 'Fast rollout <guaranteed> & scalable.' }),
      pvBenefits: createElement({ innerHTML: '<li>Rapid deployment</li><li>99.99% uptime</li>' }),
      pvTotal: createElement({ textContent: '$12,345.60 ex GST' }),
      pvMonthly: createElement({ textContent: '$789.00 per month' }),
      page2: createElement({ style: { display: 'block' } }),
      priceTableView: createElement({
        querySelectorAll(selector) {
          if (selector === 'tbody tr') {
            return priceRows;
          }
          return [];
        }
      }),
      pvTerm2: createElement({ textContent: '24 months' })
    },
    selectors: {
      '#tab-preview .hero img': createElement({ src: 'data:hero-image' }),
      '#tab-preview .price-card': createElement({ style: { backgroundColor: 'rgb(34, 51, 68)' } })
    },
    features: [
      { t: 'Network transformation', c: 'End-to-end managed service', img: 'https://cdn/img1.png', size: 64 },
      { t: 'Employee experience', c: 'Boost morale\nImprove security', img: '', size: 48 }
    ],
    heroCards: [
      { t: 'Hero Cloud', c: 'Elastic scale &lt;all year&gt;', img: 'https://cdn/hero space.png', size: 320 }
    ],
    assumptions,
    presets: {
      test: { panel: '#334455' }
    },
    state: { preset: 'test' }
  }, () => buildEmailHTML());

  assert.match(html, /data:generated-banner/);
  assert.ok((html.match(/Ref:/g) || []).length === 1, 'ref label rendered once');
  assert.ok(html.includes('Telstra Enterprise'));
  assert.ok(html.includes('Modernise your workplace'));
  assert.ok(html.includes('Key benefits'));
  assert.ok(html.includes('<li>Rapid deployment</li><li>99.99% uptime</li>'));
  assert.ok(html.includes('Features &amp; benefits') || html.includes('Features & benefits'));
  assert.ok(html.includes('Key Features Included'));
  assert.ok(html.includes('Hero Cloud'));
  assert.ok(html.includes('Elastic scale &amp;lt;all year&amp;gt;'));
  assert.ok(html.includes('Commercial terms &amp; dependencies'));
  assert.ok(html.includes('Payment due &amp; accepted &lt;net30&gt;'));
  assert.ok(html.includes('$1,800.00'));
  assert.ok(html.includes('Term: 24 months'));
  assert.ok(html.includes('background:#223344'));
  assert.ok(!html.includes('undefined'));
});

test('buildEmailHTML tolerates missing optional sections without crashing', () => {
  const html = withDocumentEnvironment({
    ids: {
      pvCustomer: createElement({ textContent: 'Minimal Co' }),
      pvRef: createElement({ textContent: '' }),
      pvHero: createElement({ textContent: '' }),
      pvSub: createElement({ textContent: '' }),
      pvSummary: createElement({ textContent: 'Summary only.' }),
      page2: createElement({ style: { display: 'none' } })
    },
    features: [],
    heroCards: [],
    assumptions: []
  }, () => buildEmailHTML());

  assert.ok(html.includes('Minimal Co'));
  assert.ok(html.includes('Executive summary'));
  assert.ok(!html.includes('Key benefits</div><ul'));
  assert.ok(!html.includes('Key Features Included'));
  assert.ok(!html.includes('Inclusions & pricing breakdown'));
  assert.ok(!html.includes('undefined'));
});
=======
 main
