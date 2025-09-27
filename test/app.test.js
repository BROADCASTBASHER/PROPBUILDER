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
const buildEmailHTML = loadFunction('buildEmailHTML');
const initializeApp = loadFunction('initializeApp');

function createElement(overrides = {}) {
  const element = { style: {}, dataset: {}, children: [], _listeners: {}, className: '' };

  let textContentValue = overrides.textContent ?? '';
  Object.defineProperty(element, 'textContent', {
    get() {
      return textContentValue;
    },
    set(value) {
      textContentValue = String(value);
      this.children = [];
      innerHTMLValue = '';
    }
  });

  let innerHTMLValue = overrides.innerHTML ?? '';
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return innerHTMLValue;
    },
    set(value) {
      innerHTMLValue = String(value);
      this.children = [];
    }
  });

  Object.defineProperty(element, 'firstChild', {
    get() {
      return this.children[0] ?? null;
    }
  });

  element.value = overrides.value ?? '';
  element.checked = overrides.checked ?? false;
  element.type = overrides.type ?? '';
  element.src = overrides.src ?? '';
  element.toDataURL = overrides.toDataURL;
  element.classList = overrides.classList || {
    add() {},
    remove() {},
    toggle() {},
    contains() { return false; }
  };

  const attrStore = new Map();
  element.setAttribute = function setAttribute(name, value) {
    attrStore.set(String(name), String(value));
  };
  element.getAttribute = function getAttribute(name) {
    return attrStore.has(String(name)) ? attrStore.get(String(name)) : null;
  };

  element.appendChild = function appendChild(child) {
    if (!child) {
      return child;
    }
    child.parentElement = this;
    this.children.push(child);
    textContentValue = '';
    innerHTMLValue = '';
    return child;
  };

  element.removeChild = function removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
    return child;
  };

  element.replaceChildren = function replaceChildren(...nodes) {
    this.children = [];
    innerHTMLValue = '';
    nodes.forEach((node) => {
      if (node) {
        this.appendChild(node);
      }
    });
  };

  element.querySelector = overrides.querySelector || (() => null);
  element.querySelectorAll = overrides.querySelectorAll || (() => []);

  element.addEventListener = function addEventListener(type, handler) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(handler);
  };

  element.removeEventListener = function removeEventListener(type, handler) {
    if (!this._listeners[type]) {
      return;
    }
    this._listeners[type] = this._listeners[type].filter((fn) => fn !== handler);
  };

  element.dispatchEvent = function dispatchEvent(event) {
    if (!event || !event.type) {
      return;
    }
    const handlers = this._listeners[event.type] || [];
    handlers.forEach((handler) => {
      handler.call(this, Object.assign({ preventDefault() {} }, event));
    });
  };

  element.click = function click() {
    this.dispatchEvent({ type: 'click', target: this });
  };

  return Object.assign(element, overrides);
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
    body: setup.body || createElement({ classList: { add() {}, remove() {}, toggle() {} } }),
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
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const previous = {
    document: global.document,
    window: global.window,
    state: global.state,
    PRESETS: global.PRESETS,
    localStorage: global.localStorage,
    getComputedStyle: global.getComputedStyle,
    DEFAULT_PRICING_ITEMS: global.DEFAULT_PRICING_ITEMS,
    DEFAULT_DOC_TYPE: global.DEFAULT_DOC_TYPE,
    DEFAULT_GST_MODE: global.DEFAULT_GST_MODE,
    DEFAULT_MONTHLY: global.DEFAULT_MONTHLY,
    DEFAULT_TERM: global.DEFAULT_TERM,
    DEFAULT_BANNER_TEXT: global.DEFAULT_BANNER_TEXT,
    FEATURE_LIBRARY: global.FEATURE_LIBRARY,
    esc: global.esc,
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
  const defaults = setup.defaults || {};
  global.DEFAULT_PRICING_ITEMS = defaults.DEFAULT_PRICING_ITEMS ?? [];
  global.DEFAULT_DOC_TYPE = defaults.DEFAULT_DOC_TYPE ?? 'two';
  global.DEFAULT_GST_MODE = defaults.DEFAULT_GST_MODE ?? 'ex';
  global.DEFAULT_MONTHLY = defaults.DEFAULT_MONTHLY ?? 0;
  global.DEFAULT_TERM = defaults.DEFAULT_TERM ?? 0;
  global.DEFAULT_BANNER_TEXT = defaults.DEFAULT_BANNER_TEXT ?? '';
  global.FEATURE_LIBRARY = setup.featureLibrary || [];
  global.esc = esc;

  try {
    return fn();
  } finally {
    global.document = previous.document;
    global.window = previous.window;
    global.state = previous.state;
    global.PRESETS = previous.PRESETS;
    global.localStorage = previous.localStorage;
    global.getComputedStyle = previous.getComputedStyle;
    global.DEFAULT_PRICING_ITEMS = previous.DEFAULT_PRICING_ITEMS;
    global.DEFAULT_DOC_TYPE = previous.DEFAULT_DOC_TYPE;
    global.DEFAULT_GST_MODE = previous.DEFAULT_GST_MODE;
    global.DEFAULT_MONTHLY = previous.DEFAULT_MONTHLY;
    global.DEFAULT_TERM = previous.DEFAULT_TERM;
    global.DEFAULT_BANNER_TEXT = previous.DEFAULT_BANNER_TEXT;
    global.FEATURE_LIBRARY = previous.FEATURE_LIBRARY;
    global.esc = previous.esc;
  }
}

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

test('initializeApp renders pricing rows and updates previews', () => {
  const itemsContainer = createElement();
  const priceTableBody = createElement();
  const priceTableGhostBody = createElement();
  const priceTableViewBody = createElement();
  const gstSelect = createElement({ value: 'ex' });
  const addItemBtn = createElement();
  const monthlyInput = createElement({ value: '0' });
  const termInput = createElement({ value: '12' });
  const docTypeSelect = createElement({ value: 'two' });
  const thPrice = createElement();
  const thPriceGhost = createElement();
  const thPriceV = createElement();

  const baseState = {
    preset: 'navy',
    banner: {
      text: 'Banner',
      bold: false,
      layout: 'left',
      size: '1000x300',
      logoMode: 'auto',
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      fit: 'contain'
    },
    docType: 'two',
    features: [],
    pricing: {
      gst: 'ex',
      items: [{ label: 'Managed <Service>', qty: 2, unit: 'seat', price: 150 }],
      monthly: 0,
      term: 12
    }
  };

  withDocumentEnvironment({
    ids: {
      items: itemsContainer,
      btnAddItem: addItemBtn,
      gstMode: gstSelect,
      monthly: monthlyInput,
      term: termInput,
      docType: docTypeSelect,
      thPrice,
      thPriceGhost,
      thPriceV
    },
    selectors: {
      '#priceTable tbody': priceTableBody,
      '#priceTableGhost tbody': priceTableGhostBody,
      '#priceTableView tbody': priceTableViewBody,
      '#tab-preview .hero img': createElement({ src: '' }),
      '#tab-preview .price-card': createElement({ style: { backgroundColor: '#223344' } })
    },
    queryAll: {
      '#tab-pricing .ps-tab': []
    },
    state: baseState,
    presets: { navy: { panel: '#223344' } },
    defaults: {
      DEFAULT_PRICING_ITEMS: baseState.pricing.items,
      DEFAULT_DOC_TYPE: 'two',
      DEFAULT_GST_MODE: 'ex',
      DEFAULT_MONTHLY: baseState.pricing.monthly,
      DEFAULT_TERM: baseState.pricing.term,
      DEFAULT_BANNER_TEXT: 'Banner'
    },
    windowOverrides: {
      __LOGO_DATA__: {},
      __ICON_DATA__: {}
    }
  }, () => {
    initializeApp();

    assert.strictEqual(itemsContainer.children.length, 1);
    const row = itemsContainer.children[0];
    assert.strictEqual(row.children.length >= 5, true);
    const priceInput = row.children[3];
    assert.strictEqual(priceTableBody.innerHTML.includes('Managed &lt;Service&gt;'), true);
    assert.strictEqual(priceTableBody.innerHTML.includes('A$300.00'), true);

    priceInput.value = '200';
    priceInput.dispatchEvent({ type: 'input', target: priceInput });

    assert.strictEqual(baseState.pricing.items[0].price, 200);
    assert.strictEqual(priceTableBody.innerHTML.includes('A$400.00'), true);

    gstSelect.value = 'inc';
    gstSelect.dispatchEvent({ type: 'change', target: gstSelect });

    assert.strictEqual(thPrice.textContent, 'Price (inc GST)');
    assert.strictEqual(priceTableBody.innerHTML.includes('A$440.00'), true);

    const removeBtn = row.children[4];
    removeBtn.click();

    assert.strictEqual(baseState.pricing.items.length, 0);
    assert.strictEqual(itemsContainer.children.length, 0);
    assert.strictEqual(priceTableBody.innerHTML.includes('Add line items'), true);
  });
});

test('initializeApp populates icon gallery with all bundled pictograms', () => {
  const iconGallery = createElement();
  const iconStatus = createElement();
  const iconSearch = createElement({ value: '' });

  const baseState = {
    preset: 'navy',
    banner: {
      text: 'Banner',
      bold: false,
      textSize: 1,
      layout: 'left',
      size: '1000x300',
      logoMode: 'auto',
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      fit: 'contain'
    },
    docType: 'two',
    features: [],
    pricing: {
      gst: 'ex',
      items: [],
      monthly: 0,
      term: 12
    }
  };

 codex/display-all-pictograms-in-modal-73ed4x
  const iconData = {};
  for (let i = 1; i <= 112; i += 1) {
    iconData[`picto-${i}.png`] = `data:image/png;base64,${i}`;
  }
  iconData['brandHero'] = 'data:image/png;base64,hero';
  iconData['photoAsset.JPG'] = 'data:image/jpeg;base64,photo';

  const expectedTitles = Object.keys(iconData).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));


 main
  withDocumentEnvironment({
    ids: {
      iconGallery,
      iconGalleryStatus: iconStatus,
      iconSearch,
      iconModal: createElement()
    },
    selectors: {},
    state: baseState,
    defaults: {
      DEFAULT_PRICING_ITEMS: [],
      DEFAULT_DOC_TYPE: 'two',
      DEFAULT_GST_MODE: 'ex',
      DEFAULT_MONTHLY: 0,
      DEFAULT_TERM: 12,
      DEFAULT_BANNER_TEXT: 'Banner'
    },
    featureLibrary: [],
    windowOverrides: {
      __LOGO_DATA__: {},
 codex/display-all-pictograms-in-modal-73ed4x
      __ICON_DATA__: iconData

      __ICON_DATA__: {
        'alpha.png': 'data:image/png;base64,AAA=',
        'beta.jpg': 'data:image/jpeg;base64,BBB='
      }
 main
    }
  }, () => {
    initializeApp();

    iconSearch.dispatchEvent({ type: 'input', target: iconSearch });

 codex/display-all-pictograms-in-modal-73ed4x
    assert.strictEqual(iconGallery.children.length, expectedTitles.length);
    const titles = iconGallery.children.map((child) => child.title).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    assert.deepStrictEqual(titles, expectedTitles);
    assert.strictEqual(iconStatus.textContent, `${expectedTitles.length} pictograms available.`);

    assert.strictEqual(iconGallery.children.length, 2);
    const titles = iconGallery.children.map((child) => child.title).sort();
    assert.deepStrictEqual(titles, ['alpha.png', 'beta.jpg']);
    assert.strictEqual(iconStatus.textContent, '2 pictograms available.');
 main
  });
});

test('__rgbToHex__px converts rgb strings to uppercase hex', () => {
  assert.strictEqual(rgbToHex('rgb(16, 32, 48)'), '#102030');
  assert.strictEqual(rgbToHex('rgba(255, 128, 64, 0.5)'), '#FF8040');
  assert.strictEqual(rgbToHex(''), '#E5E6EA');
  assert.strictEqual(rgbToHex('not-a-color'), 'not-a-color');
});

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
      pvMonthly: createElement({ textContent: '$789.00 ex GST' }),
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

  assert.ok(html.includes('TBTC VIC EAST Proposal Studio'));
  assert.match(html, /data:generated-banner/);
  assert.ok((html.match(/Ref:/g) || []).length === 1, 'ref label rendered once');
  assert.ok(html.includes('Telstra Enterprise'));
  assert.ok(html.includes('Modernise your workplace'));
  assert.ok(html.includes('Executive summary'));
  assert.ok(html.includes('Key benefits'));
  assert.ok(html.includes('<li>Rapid deployment</li><li>99.99% uptime</li>'));
  assert.ok(html.includes('Boost morale'));
  assert.ok(html.includes('Improve security'));
  assert.ok(html.includes('Features &amp; benefits'));
  assert.ok(!html.includes('HERO FEATURE'));
  assert.ok(html.indexOf('Modernise your workplace') < html.indexOf('Telstra Enterprise'));
  assert.ok(!html.includes('(STANDARD FEATURES)'));
  assert.ok(html.includes('Hero Cloud'));
  assert.ok(html.includes('Elastic scale &amp;lt;all year&amp;gt;'));
  assert.ok(html.includes('Fast rollout &lt;guaranteed&gt;'));
  assert.ok(html.includes('Commercial terms &amp; dependencies'));
  assert.ok(html.includes('Payment due &amp; accepted &lt;net30&gt;'));
  assert.ok(html.includes('$1,800.00'));
  assert.ok(html.includes('Term: 24 months'));
  assert.ok(html.includes('Monthly investment: $789.00'));
  assert.ok(html.includes('(ex GST)'));
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
  assert.ok(!html.includes('Features &amp; benefits'));
  assert.ok(!html.includes('Inclusions &amp; pricing breakdown'));
  assert.ok(!html.includes('Monthly investment:'));
  assert.ok(!html.includes('Commercial terms &amp; dependencies'));
  assert.ok(!html.includes('undefined'));
});
