const test = require('node:test');
const assert = require('node:assert');

const {
  parseSize,
  wrapTextLines,
  esc,
  bulletify,
  __rgbToHex__px: rgbToHex,
  buildEmailHTML,
  initializeApp,
  state: appState,
  PRESETS,
  FEATURE_LIBRARY,
  DEFAULT_PRICING_ITEMS,
} = require('../js/app.js');

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

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
    createTextNode(text) {
      return createElement({ textContent: String(text ?? '') });
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const previous = {
    document: global.document,
    window: global.window,
    localStorage: global.localStorage,
    getComputedStyle: global.getComputedStyle,
  };

  const stateSnapshot = clone(appState);
  const presetsSnapshot = clone(PRESETS);
  const featureLibrarySnapshot = clone(FEATURE_LIBRARY);
  const defaultPricingSnapshot = clone(DEFAULT_PRICING_ITEMS);

  const storage = new Map();
  storage.set('heroCards', JSON.stringify(heroCards));

  global.document = documentStub;
  global.window = Object.assign({ _features: features }, setup.windowOverrides || {});
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

  // reset shared state
  appState.preset = state.preset ?? stateSnapshot.preset;
  appState.banner = Object.assign({}, stateSnapshot.banner, state.banner || {});
  appState.docType = state.docType ?? stateSnapshot.docType;
  appState.features = Array.isArray(state.features) ? clone(state.features) : [];
  const pricingOverride = state.pricing || {};
  appState.pricing = Object.assign({}, stateSnapshot.pricing, pricingOverride);
  if (!Array.isArray(appState.pricing.items)) {
    appState.pricing.items = [];
  }

  if (defaults.DEFAULT_DOC_TYPE !== undefined) {
    appState.docType = defaults.DEFAULT_DOC_TYPE;
  }
  if (defaults.DEFAULT_GST_MODE !== undefined) {
    appState.pricing.gst = defaults.DEFAULT_GST_MODE;
  }
  if (defaults.DEFAULT_MONTHLY !== undefined) {
    appState.pricing.monthly = defaults.DEFAULT_MONTHLY;
  }
  if (defaults.DEFAULT_TERM !== undefined) {
    appState.pricing.term = defaults.DEFAULT_TERM;
  }
  if (defaults.DEFAULT_BANNER_TEXT !== undefined) {
    appState.banner.text = defaults.DEFAULT_BANNER_TEXT;
  }

  DEFAULT_PRICING_ITEMS.length = 0;
  const pricingDefaults = defaults.DEFAULT_PRICING_ITEMS ?? defaultPricingSnapshot;
  DEFAULT_PRICING_ITEMS.push(...clone(pricingDefaults));

  FEATURE_LIBRARY.length = 0;
  if (setup.featureLibrary) {
    FEATURE_LIBRARY.push(...clone(setup.featureLibrary));
  }

  Object.keys(PRESETS).forEach((key) => { delete PRESETS[key]; });
  Object.entries(presetsSnapshot).forEach(([key, value]) => {
    PRESETS[key] = clone(value);
  });
  Object.entries(presets || {}).forEach(([key, value]) => {
    PRESETS[key] = Object.assign({}, PRESETS[key] || {}, value);
  });

  try {
    return fn();
  } finally {
    global.document = previous.document;
    global.window = previous.window;
    global.localStorage = previous.localStorage;
    global.getComputedStyle = previous.getComputedStyle;
    appState.preset = stateSnapshot.preset;
    appState.banner = stateSnapshot.banner;
    appState.docType = stateSnapshot.docType;
    appState.features = stateSnapshot.features;
    appState.pricing = stateSnapshot.pricing;
    DEFAULT_PRICING_ITEMS.length = 0;
    DEFAULT_PRICING_ITEMS.push(...defaultPricingSnapshot);
    FEATURE_LIBRARY.length = 0;
    FEATURE_LIBRARY.push(...featureLibrarySnapshot);
    Object.keys(PRESETS).forEach((key) => { delete PRESETS[key]; });
    Object.entries(presetsSnapshot).forEach(([key, value]) => {
      PRESETS[key] = clone(value);
    });
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

    assert.strictEqual(appState.pricing.items[0].price, 200);
    assert.strictEqual(priceTableBody.innerHTML.includes('A$400.00'), true);

    gstSelect.value = 'inc';
    gstSelect.dispatchEvent({ type: 'change', target: gstSelect });

    assert.strictEqual(thPrice.textContent, 'Price (inc GST)');
    assert.strictEqual(priceTableBody.innerHTML.includes('A$440.00'), true);

    const removeBtn = row.children[4];
    removeBtn.click();

    assert.strictEqual(appState.pricing.items.length, 0);
    assert.strictEqual(itemsContainer.children.length, 0);
    assert.strictEqual(priceTableBody.innerHTML.includes('Add line items'), true);
  });
});

test('initializeApp populates icon gallery with all bundled pictograms', () => {
  const buildState = () => ({
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
  });

  const defaults = {
    DEFAULT_PRICING_ITEMS: [],
    DEFAULT_DOC_TYPE: 'two',
    DEFAULT_GST_MODE: 'ex',
    DEFAULT_MONTHLY: 0,
    DEFAULT_TERM: 12,
    DEFAULT_BANNER_TEXT: 'Banner'
  };

  const fullIconGallery = createElement();
  const fullIconStatus = createElement();
  const fullIconSearch = createElement({ value: '' });

  const iconData = {};
  for (let i = 1; i <= 112; i += 1) {
    iconData[`picto-${i}.png`] = `data:image/png;base64,${i}`;
  }
  iconData['brandHero'] = 'data:image/png;base64,hero';
  iconData['photoAsset.JPG'] = 'data:image/jpeg;base64,photo';
  const expectedTitles = Object.keys(iconData).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  withDocumentEnvironment({
    ids: {
      iconGallery: fullIconGallery,
      iconGalleryStatus: fullIconStatus,
      iconSearch: fullIconSearch,
      iconModal: createElement()
    },
    selectors: {},
    state: buildState(),
    defaults,
    featureLibrary: [],
    windowOverrides: {
      __LOGO_DATA__: {},
      __ICON_DATA__: iconData
    }
  }, () => {
    initializeApp();
    fullIconSearch.dispatchEvent({ type: 'input', target: fullIconSearch });
    assert.strictEqual(fullIconGallery.children.length, expectedTitles.length);
    const titles = fullIconGallery.children.map((child) => child.title).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    assert.deepStrictEqual(titles, expectedTitles);
    assert.strictEqual(fullIconStatus.textContent, `${expectedTitles.length} pictograms available.`);
  });

  const filteredGallery = createElement();
  const filteredStatus = createElement();
  const filteredSearch = createElement({ value: '' });

  withDocumentEnvironment({
    ids: {
      iconGallery: filteredGallery,
      iconGalleryStatus: filteredStatus,
      iconSearch: filteredSearch,
      iconModal: createElement()
    },
    selectors: {},
    state: buildState(),
    defaults,
    featureLibrary: [],
    windowOverrides: {
      __LOGO_DATA__: {},
      __ICON_DATA__: {
        'alpha.png': 'data:image/png;base64,AAA=',
        'beta.jpg': 'data:image/jpeg;base64,BBB='
      }
    }
  }, () => {
    initializeApp();
    filteredSearch.dispatchEvent({ type: 'input', target: filteredSearch });
    assert.strictEqual(filteredGallery.children.length, 2);
    const titles = filteredGallery.children.map((child) => child.title).sort();
    assert.deepStrictEqual(titles, ['alpha.png', 'beta.jpg']);
    assert.strictEqual(filteredStatus.textContent, '2 pictograms available.');
  });
});

test('feature icon sliders show px labels and hero range', () => {
  const featureGrid = createElement();
  const featuresPreview = createElement();
  const featuresView = createElement();

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

  withDocumentEnvironment({
    ids: {
      featureGrid,
      featuresPreview,
      featuresView,
      btnAddFeat: createElement(),
      iconModal: createElement(),
      iconGallery: createElement(),
      iconGalleryStatus: createElement(),
      iconSearch: createElement({ value: '' }),
      iconUpload: createElement(),
      closeIcon: createElement(),
      items: createElement(),
      btnAddItem: createElement(),
      gstMode: createElement({ value: 'ex' }),
      monthly: createElement({ value: '0' }),
      term: createElement({ value: '12' }),
      docType: createElement({ value: 'two' }),
      thPrice: createElement(),
      thPriceGhost: createElement(),
      thPriceV: createElement()
    },
    selectors: {
      '#priceTable tbody': createElement(),
      '#priceTableView tbody': createElement(),
      '#priceTableGhost tbody': createElement(),
      '#tab-preview .hero img': createElement({ src: '' }),
      '#tab-preview .price-card': createElement({ style: { backgroundColor: '#223344' } })
    },
    state: baseState,
    presets: { navy: { panel: '#223344' } },
    defaults: {
      DEFAULT_PRICING_ITEMS: [],
      DEFAULT_DOC_TYPE: 'two',
      DEFAULT_GST_MODE: 'ex',
      DEFAULT_MONTHLY: 0,
      DEFAULT_TERM: 12,
      DEFAULT_BANNER_TEXT: 'Banner'
    },
    features: [
      { t: 'Hero highlight', c: 'Important detail', img: 'icon-hero.png', hero: true, size: 210 },
      { t: 'Standard feature', c: 'Support detail', img: '', hero: false, size: 72 }
    ],
    windowOverrides: {
      __LOGO_DATA__: {},
      __ICON_DATA__: { 'icon-hero.png': 'data:image/png;base64,AAA=' }
    }
  }, () => {
    initializeApp();

    assert.ok(featureGrid.children.length >= 2, 'feature grid renders cards');
    const heroCard = featureGrid.children[0];
    const heroControls = heroCard.children[1];
    const heroSizeWrap = heroControls.children.find((child) => child.children && child.children[0] && child.children[0].textContent.includes('Icon size'));
    assert.ok(heroSizeWrap, 'hero card has size controls');
    const heroLabel = heroSizeWrap.children[0];
    const heroSlider = heroSizeWrap.children[1];
    assert.ok(heroLabel.textContent.includes('px'));
    assert.strictEqual(heroSlider.max, String(220));

    const standardCard = featureGrid.children[1];
    const standardControls = standardCard.children[1];
    const standardSizeWrap = standardControls.children.find((child) => child.children && child.children[0] && child.children[0].textContent.includes('Icon size'));
    assert.ok(standardSizeWrap, 'standard card has size controls');
    const standardLabel = standardSizeWrap.children[0];
    const standardSlider = standardSizeWrap.children[1];
    assert.ok(standardLabel.textContent.includes('px'));
    assert.strictEqual(standardSlider.max, String(160));
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
  assert.ok(html.includes('Key feature'));
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
  const pricingPos = html.indexOf('Inclusions &amp; pricing breakdown');
  const keyFeaturesPos = html.indexOf('Key features');
  assert.ok(pricingPos >= 0 && keyFeaturesPos > pricingPos, 'Key features section follows pricing breakdown');
  assert.ok(html.lastIndexOf('Hero Cloud') > keyFeaturesPos, 'Key features section contains hero content');
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
  assert.ok(!html.includes('Key features'));
  assert.ok(!html.includes('Monthly investment:'));
  assert.ok(!html.includes('Commercial terms &amp; dependencies'));
  assert.ok(!html.includes('undefined'));
});
