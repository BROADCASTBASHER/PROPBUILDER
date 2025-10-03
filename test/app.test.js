const test = require('node:test');
const assert = require('node:assert');

const {
  parseSize,
  esc,
  bulletify,
  buildEmailHTML,
  state,
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
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new Set();
    this.style = {};
    this._text = '';
    this._innerHTML = '';
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
    child.parentNode = this;
    this.children.push(child);
    if (child.id) {
      this.document.registerId(child);
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
    this.elementsById = new Map();
  }

  registerId(element) {
    if (element.id) {
      this.elementsById.set(element.id, element);
    }
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
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
