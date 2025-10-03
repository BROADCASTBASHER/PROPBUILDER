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
  const elements = {};

  const createTextElement = (value) => ({
    value,
    textContent: value,
  });

  elements.banner = {
    toDataURL: () => 'data:image/png;base64,banner',
  };
  elements.customer = createTextElement('Acme Pty Ltd');
  elements.ref = createTextElement('Q-2042');
  elements.hero = createTextElement('Unified Communications');
  elements.subHero = createTextElement('Modern cloud calling for teams');
  elements.summaryEdit = createTextElement('We modernise your calling platform.\nReliable connectivity.');
  elements.benefitsEdit = createTextElement('Rapid deployment\nLocal support');
  elements.assumptionsEdit = createTextElement('Term 24 months\nEquipment delivered');

  const documentMock = {
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return {
        innerHTML: '',
        querySelectorAll() {
          return [];
        },
      };
    },
  };

  global.document = documentMock;

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
  }
});
