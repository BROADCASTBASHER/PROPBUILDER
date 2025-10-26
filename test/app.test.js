const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const {
  parseSize,
  esc,
  bulletify,
  buildEmailHTML,
  exportEmailHTML,
  exportEmailEML,
  state,
  __setEmailBuilder__,
  __resetEmailBuilder__,
  __setEmailEmlBuilder__,
  __resetEmailEmlBuilder__,
} = require('../js/app.js');

const cloneState = () => JSON.parse(JSON.stringify(state));

function restoreState(snapshot) {
  state.preset = snapshot.preset;
  state.docType = snapshot.docType;
  Object.keys(state.banner || {}).forEach((key) => {
    delete state.banner[key];
  });
  Object.assign(state.banner, snapshot.banner);
  state.features.length = 0;
  snapshot.features.forEach((feature) => state.features.push(Object.assign({}, feature)));
  state.pricing.gst = snapshot.pricing.gst;
  state.pricing.monthly = snapshot.pricing.monthly;
  state.pricing.term = snapshot.pricing.term;
  state.pricing.items.length = 0;
  snapshot.pricing.items.forEach((item) => state.pricing.items.push(Object.assign({}, item)));
}

class MockElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.document = document;
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new Set();
    this.style = {};
    this._text = '';
    this._innerHTML = '';
    this.click = () => {};
  }

  set textContent(value) {
    this._text = value == null ? '' : String(value);
  }

  get textContent() {
    return this._text;
  }

  set innerHTML(value) {
    this._innerHTML = value == null ? '' : String(value);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    if (!child) {
      return child;
    }
    if (child.isFragment) {
      const nodes = Array.from(child.children || []);
      child.children.length = 0;
      nodes.forEach((node) => {
        this.appendChild(node);
      });
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    if (child.id) {
      this.document.registerId(child);
    }
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'id') {
      this.id = stringValue;
      this.document.registerId(this);
    }
    if (name === 'class') {
      this.classList = new Set(stringValue.split(/\s+/).filter(Boolean));
    }
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    if (name === 'id') {
      return this.id;
    }
    if (name === 'class') {
      return Array.from(this.classList).join(' ');
    }
    return this.attributes.get(name);
  }

  querySelector(selector) {
    const results = queryElements(this, selector, true);
    return results.length ? results[0] : null;
  }

  querySelectorAll(selector) {
    return queryElements(this, selector, false);
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) {
        return node;
      }
      node = node.parentNode || null;
    }
    return null;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body', this);
    this.documentElement = this.body;
    this.elementsById = new Map();
    this.downloads = [];
  }

  registerId(element) {
    if (element.id) {
      this.elementsById.set(element.id, element);
    }
  }

  createElement(tagName) {
    const element = new MockElement(tagName, this);
    if (element.tagName === 'A') {
      element.click = function click() {
        this.clicked = true;
        if (this.document && Array.isArray(this.document.downloads)) {
          this.document.downloads.push({
            download: this.download,
            href: this.href,
          });
        }
      };
    }
    return element;
  }

  createDocumentFragment() {
    const fragment = new MockElement('#fragment', this);
    fragment.isFragment = true;
    return fragment;
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  querySelector(selector) {
    const results = queryElements(this.body, selector, true);
    return results.length ? results[0] : null;
  }

  querySelectorAll(selector) {
    return queryElements(this.body, selector, false);
  }
}

function matchesSelector(element, selector) {
  if (selector.startsWith('#')) {
    return element.id === selector.slice(1);
  }
  if (selector.startsWith('.')) {
    return element.classList.has(selector.slice(1));
  }
  const attrMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, rawAttr, attrValue] = attrMatch;
    const value = element.getAttribute(rawAttr);
    if (attrValue == null) {
      return value != null;
    }
    return value === attrValue;
  }
  return element.tagName && element.tagName.toLowerCase() === selector.toLowerCase();
}

function queryElements(root, selector, firstOnly) {
  const results = [];
  const visit = (node) => {
    if (matchesSelector(node, selector)) {
      results.push(node);
      if (firstOnly) {
        return true;
      }
    }
    for (const child of node.children || []) {
      if (visit(child) && firstOnly) {
        return true;
      }
    }
    return false;
  };
  for (const child of root.children || []) {
    if (visit(child) && firstOnly) {
      break;
    }
  }
  return results;
}

test('parseSize handles various formats', () => {
  assert.deepEqual(parseSize('640x480'), [640, 480]);
  assert.deepEqual(parseSize('300'), [300, 300]);
  assert.deepEqual(parseSize('invalid', 800, 600), [800, 600]);
});

test('esc escapes HTML special characters', () => {
  assert.strictEqual(esc('<script>'), '&lt;script&gt;');
  assert.strictEqual(esc('Tom & Jerry'), 'Tom &amp; Jerry');
});

test('bulletify converts lines to list items', () => {
  const html = bulletify('First\nSecond');
  assert.strictEqual(html, '<li>First</li><li>Second</li>');
  assert.strictEqual(bulletify(''), '');
});

test('buildEmailHTML produces inline email markup', async () => {
  const snapshot = cloneState();
  const doc = new MockDocument();

  const append = (parent, child) => parent.appendChild(child);

  const bannerCanvas = doc.createElement('canvas');
  bannerCanvas.setAttribute('id', 'banner');
  bannerCanvas.toDataURL = () => 'data:image/png;base64,banner';
  append(doc.body, bannerCanvas);

  const previewRoot = doc.createElement('div');
  previewRoot.setAttribute('id', 'tab-preview');
  append(doc.body, previewRoot);

  const customerEl = doc.createElement('div');
  customerEl.setAttribute('id', 'pvCustomer');
  customerEl.setAttribute('data-export', 'customer');
  customerEl.textContent = 'Acme Pty Ltd';
  customerEl.style.color = '#273349';
  customerEl.style.fontFamily = 'MockSans';
  append(previewRoot, customerEl);

  const refEl = doc.createElement('span');
  refEl.setAttribute('id', 'pvRef');
  refEl.setAttribute('data-export', 'ref');
  refEl.textContent = 'Ref: Q-2042';
  refEl.style.color = '#5B6573';
  append(previewRoot, refEl);

  const headlineEl = doc.createElement('div');
  headlineEl.setAttribute('id', 'pvHero');
  headlineEl.setAttribute('data-export', 'headline-main');
  headlineEl.textContent = 'Unified Communications';
  headlineEl.style.color = '#0B1220';
  headlineEl.style.fontFamily = 'MockSans';
  append(previewRoot, headlineEl);

  const subHeadlineEl = doc.createElement('div');
  subHeadlineEl.setAttribute('id', 'pvSub');
  subHeadlineEl.setAttribute('data-export', 'headline-sub');
  subHeadlineEl.textContent = 'Modern cloud calling for teams';
  subHeadlineEl.style.color = '#273349';
  append(previewRoot, subHeadlineEl);

  const summaryEl = doc.createElement('div');
  summaryEl.setAttribute('id', 'pvSummary');
  summaryEl.setAttribute('data-export', 'exec-summary');
  summaryEl.textContent = 'We modernise your calling platform.\nReliable connectivity.';
  summaryEl.style.color = '#273349';
  append(previewRoot, summaryEl);

  const benefitsList = doc.createElement('ul');
  benefitsList.setAttribute('id', 'pvBenefits');
  benefitsList.setAttribute('data-export', 'key-benefits');
  const benefitOne = doc.createElement('li');
  benefitOne.textContent = 'Rapid deployment';
  append(benefitsList, benefitOne);
  const benefitTwo = doc.createElement('li');
  benefitTwo.textContent = 'Local support';
  append(benefitsList, benefitTwo);
  append(previewRoot, benefitsList);

  const featuresStandard = doc.createElement('div');
  featuresStandard.setAttribute('data-export', 'features-standard');
  append(previewRoot, featuresStandard);

  const standardCard = doc.createElement('div');
  standardCard.setAttribute('data-export-feature', 'card');
  standardCard.setAttribute('data-export-feature-type', 'standard');
  append(featuresStandard, standardCard);

  const standardIconWrap = doc.createElement('div');
  standardIconWrap.setAttribute('class', 'icon');
  standardIconWrap.style.width = '72px';
  standardIconWrap.style.height = '72px';
  append(standardCard, standardIconWrap);

  const standardIcon = doc.createElement('img');
  standardIcon.setAttribute('data-export-feature-image', 'icon');
  standardIcon.src = 'data:image/png;base64,featureA';
  standardIcon.alt = 'Feature A';
  append(standardIconWrap, standardIcon);

  const standardTitle = doc.createElement('div');
  standardTitle.setAttribute('data-export-feature-title', 'title');
  standardTitle.textContent = 'Feature A';
  append(standardCard, standardTitle);

  const standardCopy = doc.createElement('div');
  standardCopy.setAttribute('data-export-feature-copy', 'copy');
  standardCopy.textContent = 'Always-on reliability';
  append(standardCard, standardCopy);

  const featuresHero = doc.createElement('div');
  featuresHero.setAttribute('data-export', 'features-hero');
  append(previewRoot, featuresHero);

  const heroCard = doc.createElement('div');
  heroCard.setAttribute('data-export-feature', 'card');
  heroCard.setAttribute('data-export-feature-type', 'hero');
  append(featuresHero, heroCard);

  const heroTitle = doc.createElement('div');
  heroTitle.setAttribute('data-export-feature-title', 'title');
  heroTitle.textContent = 'Hero Feature';
  append(heroCard, heroTitle);

  const heroList = doc.createElement('ul');
  heroList.setAttribute('data-export-feature-list', 'list');
  const heroItemOne = doc.createElement('li');
  heroItemOne.textContent = 'Point one';
  append(heroList, heroItemOne);
  const heroItemTwo = doc.createElement('li');
  heroItemTwo.textContent = 'Point two';
  append(heroList, heroItemTwo);
  append(heroCard, heroList);

  const pricingTable = doc.createElement('table');
  pricingTable.setAttribute('data-export', 'pricing-table');
  const thead = doc.createElement('thead');
  const headerRow = doc.createElement('tr');
  ['Item', 'Qty', 'Unit', 'Price (ex GST)'].forEach((text) => {
    const th = doc.createElement('th');
    th.textContent = text;
    append(headerRow, th);
  });
  append(thead, headerRow);
  append(pricingTable, thead);

  const tbody = doc.createElement('tbody');
  const rowOne = doc.createElement('tr');
  ['TIPT Licence', '10', 'seat', 'A$350.00'].forEach((text) => {
    const td = doc.createElement('td');
    td.textContent = text;
    append(rowOne, td);
  });
  append(tbody, rowOne);
  const rowTwo = doc.createElement('tr');
  ['Professional services', '1', 'project', 'Included'].forEach((text) => {
    const td = doc.createElement('td');
    td.textContent = text;
    append(rowTwo, td);
  });
  append(tbody, rowTwo);
  append(pricingTable, tbody);
  append(previewRoot, pricingTable);

  const termsList = doc.createElement('ul');
  termsList.setAttribute('data-export', 'terms-dependencies');
  ['Term 24 months', 'Equipment delivered'].forEach((text) => {
    const li = doc.createElement('li');
    li.textContent = text;
    append(termsList, li);
  });
  append(previewRoot, termsList);

  const priceCard = doc.createElement('div');
  priceCard.setAttribute('data-export', 'price-card');
  priceCard.style.backgroundColor = '#F3F4F9';
  append(previewRoot, priceCard);

  const amountEl = doc.createElement('div');
  amountEl.setAttribute('data-export', 'price-amount');
  amountEl.textContent = 'A$720.00 ex GST';
  append(priceCard, amountEl);

  const termEl = doc.createElement('div');
  termEl.setAttribute('data-export', 'price-term');
  termEl.textContent = 'Term: 24 months';
  append(priceCard, termEl);

  global.document = doc;
  global.window = {
    getComputedStyle(element) {
      return {
        fontFamily: element.style.fontFamily || 'MockSans',
        color: element.style.color || '#273349',
        backgroundColor: element.style.backgroundColor || 'rgba(0, 0, 0, 0)',
      };
    },
  };

  try {
    state.preset = 'navy';
    state.banner.text = 'Fallback headline';
    state.features.length = 0;
    state.features.push(
      {
        t: 'Feature A',
        c: 'Always-on reliability',
        img: 'data:image/png;base64,featureA',
        hero: false,
        size: 72,
      },
      {
        t: 'Hero Feature',
        c: 'Point one\nPoint two',
        img: 'data:image/png;base64,hero',
        hero: true,
        size: 120,
      },
    );
    state.pricing.gst = 'ex';
    state.pricing.monthly = 720;
    state.pricing.term = 24;
    state.pricing.items.length = 0;
    state.pricing.items.push(
      { label: 'TIPT Licence', qty: 10, unit: 'seat', price: 35 },
      { label: 'Professional services', qty: 1, unit: 'project', price: 0 },
    );

    const html = await buildEmailHTML();
    assert.ok(html.includes('Acme Pty Ltd'));
    assert.ok(html.includes('Unified Communications'));
    assert.ok(html.includes('Key Benefits'));
    assert.ok(html.includes('Monthly investment'));
    assert.ok(html.includes('Term: 24 months'));
    assert.ok(html.includes('data:image/png;base64,banner'));
  } finally {
    restoreState(snapshot);
    delete global.document;
    delete global.window;
  }
});

class EmailExportMockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
  }

  getContext() {
    return {
      drawImage() {},
    };
  }

  toDataURL(mime = 'image/png') {
    return `data:${mime};base64,stub-inline`;
  }
}

function createStyleProxy(target) {
  const state = {};
  const sync = () => {
    const entries = Object.entries(state);
    if (!entries.length) {
      if (typeof target.__removeRawAttribute === 'function') {
        target.__removeRawAttribute('style');
      }
      return;
    }
    const value = entries.map(([key, val]) => `${key}:${val}`).join('; ');
    target.__setRawAttribute('style', value);
  };
  return new Proxy(state, {
    set(obj, prop, value) {
      if (value == null || value === '') {
        delete obj[prop];
      } else {
        obj[prop] = String(value);
      }
      sync();
      return true;
    },
    get(obj, prop) {
      return obj[prop] || '';
    },
    has(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    },
    deleteProperty(obj, prop) {
      if (prop in obj) {
        delete obj[prop];
        sync();
      }
      return true;
    },
  });
}

class EmailExportMockImageElement {
  constructor(owner, rawTag) {
    this.owner = owner;
    this.rawTag = rawTag;
    this.attributes = new Map();
    this.attributeOrder = [];
    this.dataset = {};
    this.classList = new Set();
    this._styleProxy = null;
    this.width = 0;
    this.height = 0;
    this.alt = '';
    this._src = '';
    this.currentSrc = '';
    this.style = this._createStyleProxy();
    this._parseAttributes(rawTag);
  }

  _createStyleProxy() {
    if (!this._styleProxy) {
      this._styleProxy = createStyleProxy(this);
    }
    return this._styleProxy;
  }

  _parseAttributes(rawTag) {
    const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = attrRegex.exec(rawTag))) {
      const name = match[1];
      const value = match[3] ?? match[4] ?? match[5] ?? '';
      this.__setRawAttribute(name, value);
      if (name === 'src') {
        this._src = value;
        this.currentSrc = value;
      } else if (name === 'alt') {
        this.alt = value;
      } else if (name === 'width') {
        this.width = Number(value) || 0;
      } else if (name === 'height') {
        this.height = Number(value) || 0;
      } else if (name === 'style' && value) {
        value.split(/;+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((pair) => {
            const [prop, val] = pair.split(':');
            if (prop && val != null) {
              this.style[prop.trim()] = val.trim();
            }
          });
      }
    }
  }

  __setRawAttribute(name, value) {
    if (!this.attributes.has(name)) {
      this.attributeOrder.push(name);
    }
    this.attributes.set(name, String(value));
    if (name === 'style' && !value) {
      this.attributes.delete('style');
      this.attributeOrder = this.attributeOrder.filter((attr) => attr !== 'style');
    }
  }

  __removeRawAttribute(name) {
    if (this.attributes.delete(name)) {
      this.attributeOrder = this.attributeOrder.filter((attr) => attr !== name);
    }
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    if (name === 'style') {
      this._styleProxy = createStyleProxy(this);
      this.style = this._styleProxy;
      this.__removeRawAttribute('style');
      if (!stringValue) {
        return;
      }
      const proxy = this._styleProxy;
      stringValue.split(/;+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((pair) => {
          const [prop, val] = pair.split(':');
          if (prop && val != null) {
            proxy[prop.trim()] = val.trim();
          }
        });
      return;
    }
    if (name === 'src') {
      this.src = stringValue;
      return;
    }
    if (!this.attributes.has(name)) {
      this.attributeOrder.push(name);
    }
    this.attributes.set(name, stringValue);
    if (name === 'alt') {
      this.alt = stringValue;
    }
    if (name === 'width') {
      this.width = Number(stringValue) || 0;
    }
    if (name === 'height') {
      this.height = Number(stringValue) || 0;
    }
  }

  removeAttribute(name) {
    if (name === 'style') {
      this._styleProxy = createStyleProxy(this);
      this.style = this._styleProxy;
    }
    this.attributes.delete(name);
    this.attributeOrder = this.attributeOrder.filter((attr) => attr !== name);
  }

  getAttribute(name) {
    if (name === 'src') {
      return this.src;
    }
    if (name === 'alt') {
      return this.alt;
    }
    if (name === 'width') {
      return this.width ? String(this.width) : null;
    }
    if (name === 'height') {
      return this.height ? String(this.height) : null;
    }
    return this.attributes.get(name) ?? null;
  }

  set src(value) {
    this._src = String(value);
    this.currentSrc = this._src;
    this.__setRawAttribute('src', this._src);
  }

  get src() {
    return this._src;
  }

  getBoundingClientRect() {
    return { width: this.width, height: this.height };
  }

  toHTML() {
    const attrs = this.attributeOrder
      .filter((name) => this.attributes.has(name))
      .map((name) => `${name}="${this.attributes.get(name)}"`)
      .join(' ');
    return `<img${attrs ? ` ${attrs}` : ''}>`;
  }
}

class EmailExportMockWrapper {
  constructor(doc) {
    this.doc = doc;
    this.parts = [];
    this.images = [];
  }

  set innerHTML(value) {
    this.parts = [];
    this.images = [];
    const regex = /<img\b[^>]*>/gi;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(value))) {
      if (match.index > lastIndex) {
        this.parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
      }
      const image = new EmailExportMockImageElement(this, match[0]);
      if (this.doc.baseURI && image.src && !/^https?:|^data:|^file:/i.test(image.src)) {
        try {
          image.currentSrc = new URL(image.src, this.doc.baseURI).href;
        } catch (error) {
          image.currentSrc = image.src;
        }
      }
      this.parts.push({ type: 'img', element: image });
      this.images.push(image);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < value.length) {
      this.parts.push({ type: 'text', value: value.slice(lastIndex) });
    }
  }

  get innerHTML() {
    return this.parts
      .map((part) => (part.type === 'text' ? part.value : part.element.toHTML()))
      .join('');
  }

  querySelectorAll(selector) {
    if (selector === 'canvas') {
      return [];
    }
    if (selector === 'img' || selector === '*') {
      return this.images.slice();
    }
    return [];
  }
}

class EmailExportMockDocument {
  constructor(baseHref) {
    this.baseURI = baseHref || 'file:///Users/test/proposal.html';
  }

  createElement(tagName) {
    if (tagName === 'div') {
      return new EmailExportMockWrapper(this);
    }
    if (tagName === 'canvas') {
      return new EmailExportMockCanvas();
    }
    if (tagName === 'img') {
      return new EmailExportMockImageElement(null, '<img>');
    }
    return null;
  }
}

class EmailExportMockImage {
  constructor() {
    this.decoding = 'sync';
    this.crossOrigin = null;
    this.referrerPolicy = null;
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    this._src = '';
  }

  set src(value) {
    this._src = value;
  }

  get src() {
    return this._src;
  }

  async decode() {
    return undefined;
  }
}

test('email export replaces local feature icons with data URIs', async () => {
  const { __private: emailExportPrivate } = require('../js/emailExport.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalImage = global.Image;
  const originalGetComputedStyle = global.getComputedStyle;

  const mockDocument = new EmailExportMockDocument('file:///Users/test/index.html');
  global.document = mockDocument;
  global.window = {
    getComputedStyle() {
      return {
        backgroundImage: 'none',
        backgroundColor: 'transparent',
      };
    },
  };
  global.Image = EmailExportMockImage;
  global.getComputedStyle = global.window.getComputedStyle;

  try {
    const proposal = {
      brand: {},
      features: [
        {
          title: 'Inline Icon',
          description: 'Local asset',
          image: {
            src: './icons/local.png',
            alt: 'Local icon',
            width: 120,
            height: 120,
          },
        },
      ],
      baseHref: 'file:///Users/test/index.html',
    };

    const result = await emailExportPrivate.buildEmailExportHTML(proposal);
    assert.ok(result.html.includes('data:image/png;base64,stub-inline'));
    assert.ok(!result.html.includes('file:///'));
    const featureImgMatch = result.html.match(/<img[^>]+alt="Local icon"[^>]*>/);
    assert.ok(featureImgMatch, 'feature image should be present in export');
    assert.ok(/width="76"/.test(featureImgMatch[0]), 'feature image width should remain clamped to 76px');
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    if (originalImage === undefined) {
      delete global.Image;
    } else {
      global.Image = originalImage;
    }
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
  }
});

test('email export inlines HTTPS pictogram icons as data URIs', async () => {
  const { __private: emailExportPrivate } = require('../js/emailExport.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalImage = global.Image;
  const originalGetComputedStyle = global.getComputedStyle;
  const originalFetch = global.fetch;
  const originalFileReader = global.FileReader;

  const mockDocument = new EmailExportMockDocument('https://example.com/proposal/index.html');
  global.document = mockDocument;
  global.window = {
    getComputedStyle() {
      return {
        backgroundImage: 'none',
        backgroundColor: 'transparent',
      };
    },
  };
  global.Image = EmailExportMockImage;
  global.getComputedStyle = global.window.getComputedStyle;

  const fetchedUrls = [];
  global.fetch = async (url) => {
    fetchedUrls.push(url);
    return {
      ok: true,
      async blob() {
        return { type: 'image/png' };
      },
    };
  };

  class StubFileReader {
    constructor() {
      this.result = '';
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL(blob) {
      if (!blob) {
        if (typeof this.onerror === 'function') {
          this.onerror(new Error('No blob provided'));
        }
        return;
      }
      const mime = blob.type || 'image/png';
      this.result = `data:${mime};base64,stub-fetch`;
      if (typeof this.onload === 'function') {
        this.onload();
      }
    }
  }

  global.FileReader = StubFileReader;

  try {
    const proposal = {
      brand: {},
      features: [
        {
          title: 'HTTPS Icon',
          description: 'CDN asset',
          image: {
            src: '/Pictograms/secure.png',
            alt: 'Secure icon',
            width: 48,
            height: 48,
          },
        },
      ],
      baseHref: 'https://example.com/proposal/index.html',
    };

    const result = await emailExportPrivate.buildEmailExportHTML(proposal);
    assert.ok(result.html.includes('data:image/png;base64,stub-fetch'));
    assert.ok(!result.html.includes('https://example.com/Pictograms/secure.png'));
    assert.deepEqual(fetchedUrls, ['https://example.com/Pictograms/secure.png']);
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    if (originalImage === undefined) {
      delete global.Image;
    } else {
      global.Image = originalImage;
    }
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
    if (originalFileReader === undefined) {
      delete global.FileReader;
    } else {
      global.FileReader = originalFileReader;
    }
  }
});

test('email export falls back to assetKey data URIs when file assets cannot be inlined', async () => {
  const { __private: emailExportPrivate } = require('../js/emailExport.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalImage = global.Image;
  const originalGetComputedStyle = global.getComputedStyle;
  const originalIconDataUris = global.__ICON_DATA_URIS__;

  const mockDocument = new EmailExportMockDocument('file:///Users/test/offline.html');
  global.document = mockDocument;
  global.window = {
    getComputedStyle() {
      return {
        backgroundImage: 'none',
        backgroundColor: 'transparent',
      };
    },
  };
  global.getComputedStyle = global.window.getComputedStyle;

  class FailingImage extends EmailExportMockImage {
    async decode() {
      throw new Error('decode failed');
    }
  }

  global.Image = FailingImage;
  global.__ICON_DATA_URIS__ = {
    'pictoOffline.png': 'data:image/png;base64,fallback-inline',
  };

  try {
    const proposal = {
      brand: {},
      features: [
        {
          title: 'Offline Icon',
          description: 'Bundled pictogram',
          image: {
            src: 'file:///Users/test/assets/pictoOffline.png',
            alt: 'Offline icon',
            width: 72,
            height: 72,
            assetKey: 'pictoOffline.png',
          },
        },
      ],
      baseHref: 'file:///Users/test/offline.html',
    };

    const result = await emailExportPrivate.buildEmailExportHTML(proposal);
    assert.ok(result.html.includes('data:image/png;base64,fallback-inline'));
    assert.ok(!result.html.includes('file:///Users/test/assets/pictoOffline.png'));
    assert.ok(result.html.includes('data-asset-key="pictoOffline.png"'));
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    if (originalImage === undefined) {
      delete global.Image;
    } else {
      global.Image = originalImage;
    }
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
    if (originalIconDataUris === undefined) {
      delete global.__ICON_DATA_URIS__;
    } else {
      global.__ICON_DATA_URIS__ = originalIconDataUris;
    }
  }
});

test('email export builds enterprise layout with inline images', async () => {
  const { __private: emailExportPrivate } = require('../js/emailExport.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalGetComputedStyle = global.getComputedStyle;
  const originalImage = global.Image;
  const originalFetch = global.fetch;
  const originalFileReader = global.FileReader;

  const dom = new JSDOM(`<!DOCTYPE html>
    <html>
      <body>
        <div id="tab-preview" style="padding:32px; background:#f5f6fa;">
          <div id="preview-export" style="width:760px; background:#ffffff; padding:32px; border-radius:24px; box-shadow:0 12px 32px rgba(11,18,32,0.12);">
            <img data-export="banner-image" src="https://cdn.example.com/banner.png" alt="Banner" style="width:100%; height:auto; display:block; border-radius:20px;">
            <div data-export="headline-main" style="font-size:28px; font-weight:700; margin-top:18px;">Preview Headline</div>
            <div data-export="exec-summary" style="margin-top:12px; font-size:16px; color:#5b6573;">Concise overview content.</div>
            <ul data-export="key-benefits" style="margin:18px 0 0 20px; font-size:16px; color:#0b1220;">
              <li>Reliable service</li>
            </ul>
            <div data-export="price-card" style="margin-top:24px; padding:24px; background:#f3f4f9; border-radius:16px;">
              <div data-export="price-amount" style="font-size:30px; font-weight:700;">A$100.00 ex GST</div>
            </div>
          </div>
        </div>
      </body>
    </html>`, {
    url: 'https://example.com/app/index.html',
    pretendToBeVisual: true,
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  global.Image = dom.window.Image;

  const fetchedUrls = [];
  global.fetch = async (url) => {
    fetchedUrls.push(url);
    return {
      ok: true,
      async blob() {
        return { type: 'image/png' };
      },
    };
  };

  class StubFileReader {
    constructor() {
      this.result = '';
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL(blob) {
      if (!blob) {
        if (typeof this.onerror === 'function') {
          this.onerror(new Error('Missing blob'));
        }
        return;
      }
      const mime = blob.type || 'image/png';
      this.result = `data:${mime};base64,stub-preview`;
      if (typeof this.onload === 'function') {
        this.onload();
      }
    }
  }

  global.FileReader = StubFileReader;

  try {
    const proposal = emailExportPrivate.collectPreviewProposal(dom.window.document);
    proposal.baseHref = dom.window.document.baseURI;

    const result = await emailExportPrivate.buildEmailExportHTML(proposal);

    assert.ok(result.html.includes('Preview Headline'));
    assert.ok(result.html.includes('data-email-section="hero"'));
    assert.ok(result.html.includes('data-email-card="executive-summary"'));
    assert.ok(!result.html.includes('id="preview-export"'));
    assert.ok(result.html.includes('data:image/png;base64,stub-preview'));
    assert.deepEqual(fetchedUrls, ['https://cdn.example.com/banner.png']);
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
    if (originalImage === undefined) {
      delete global.Image;
    } else {
      global.Image = originalImage;
    }
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
    if (originalFileReader === undefined) {
      delete global.FileReader;
    } else {
      global.FileReader = originalFileReader;
    }
  }
});

test('exportEmailHTML triggers download of generated markup', async () => {
  const snapshot = cloneState();
  const doc = new MockDocument();
  const originalDocument = global.document;
  const originalURL = global.URL;
  const urlCalls = [];

  global.document = doc;
  global.URL = {
    createObjectURL(blob) {
      urlCalls.push(blob);
      return `blob:mock-${urlCalls.length}`;
    },
    revokeObjectURL() {},
  };

  try {
    __setEmailBuilder__(async () => ({ html: '<html><body>Preview</body></html>' }));
    await exportEmailHTML();
    assert.strictEqual(doc.downloads.length, 1);
    const [download] = doc.downloads;
    assert.strictEqual(download.download, 'TBTC_VIC_EAST_Proposal.html');
    assert.strictEqual(download.href, 'blob:mock-1');
    assert.strictEqual(urlCalls.length, 1);
    assert.strictEqual(urlCalls[0].type, 'text/html;charset=utf-8');
    const text = await urlCalls[0].text();
    assert.strictEqual(text, '<html><body>Preview</body></html>');
    assert.strictEqual(doc.body.children.length, 0);
  } finally {
    __resetEmailBuilder__();
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalURL === undefined) {
      delete global.URL;
    } else {
      global.URL = originalURL;
    }
    restoreState(snapshot);
  }
});

test('exportEmailEML triggers download of generated message', async () => {
  const snapshot = cloneState();
  const doc = new MockDocument();
  const originalDocument = global.document;
  const originalURL = global.URL;
  const urlCalls = [];

  global.document = doc;
  global.URL = {
    createObjectURL(blob) {
      urlCalls.push(blob);
      return `blob:mock-${urlCalls.length}`;
    },
    revokeObjectURL() {},
  };

  try {
    __setEmailEmlBuilder__(async () => ({ eml: 'From: Example <example@test>\r\n', html: '<html></html>' }));
    await exportEmailEML();
    assert.strictEqual(doc.downloads.length, 1);
    const [download] = doc.downloads;
    assert.strictEqual(download.download, 'TBTC_VIC_EAST_Proposal.eml');
    assert.strictEqual(download.href, 'blob:mock-1');
    assert.strictEqual(urlCalls.length, 1);
    assert.strictEqual(urlCalls[0].type, 'message/rfc822');
    const text = await urlCalls[0].text();
    assert.strictEqual(text, 'From: Example <example@test>\r\n');
    assert.strictEqual(doc.body.children.length, 0);
  } finally {
    __resetEmailEmlBuilder__();
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalURL === undefined) {
      delete global.URL;
    } else {
      global.URL = originalURL;
    }
    restoreState(snapshot);
  }
});
