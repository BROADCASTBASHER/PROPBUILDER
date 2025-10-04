const test = require('node:test');
const assert = require('node:assert');

const { JSDOM } = require('jsdom');

const {
  composeEmlMessage,
  encodeQuotedPrintable,
  chunkBase64,
  dataUriToBinary,
  inlineAllRasterImages,
} = require('../js/emailExport.js').__private;

test('encodeQuotedPrintable handles trailing spaces and equals signs', () => {
  const encoded = encodeQuotedPrintable('Line = test \nSpace ');
  assert.strictEqual(encoded.includes('=3D'), true);
  assert.strictEqual(encoded.endsWith('=20'), true);
});

test('chunkBase64 wraps lines at 76 characters', () => {
  const bytes = new Uint8Array(120);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index % 256;
  }
  const base64 = chunkBase64(bytes);
  const lines = base64.split('\r\n').filter(Boolean);
  assert(lines.every((line) => line.length <= 76));
});

test('dataUriToBinary converts base64 data URIs', () => {
  const uri = 'data:image/png;base64,AAEC';
  const result = dataUriToBinary(uri, 'image/png');
  assert(result);
  assert.strictEqual(result.mime, 'image/png');
  assert.deepStrictEqual(Array.from(result.content), [0, 1, 2]);
});

test('composeEmlMessage builds multipart related output', () => {
  const metadata = {
    from: 'From Name <from@example.com>',
    to: 'To Name <to@example.com>',
    subject: 'Subject Line',
    date: 'Wed, 01 Jan 2025 00:00:00 GMT',
    messageId: '<message@test>',
  };
  const html = '<html><body><p>Hello</p></body></html>';
  const text = 'Hello';
  const attachment = {
    mime: 'image/png',
    filename: 'image.png',
    cid: 'image1@test',
    content: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  };

  const message = composeEmlMessage(metadata, html, text, [attachment]);

  assert.match(message, /From: From Name <from@example.com>/);
  assert.match(message, /To: To Name <to@example.com>/);
  assert.match(message, /Subject: Subject Line/);
  assert.match(message, /Content-Type: multipart\/related; type="multipart\/alternative"; boundary="rel-/);
  assert.match(message, /Content-Type: multipart\/alternative; boundary="alt-/);
  assert.match(message, /Content-Type: text\/plain; charset="utf-8"/);
  assert.match(message, /Content-Type: text\/html; charset="utf-8"/);
  assert.match(message, /Content-ID: <image1@test>/);
  assert.match(message, /filename="image.png"/);
});

test('inlineAllRasterImages uses same-origin credentials and inlines images', async () => {
  const dom = new JSDOM(`<!doctype html><body><div id="root"><img id="feature" src="/feature.png" alt="Feature"></div></body>`, {
    url: 'https://example.com/app/',
  });

  const previousGlobals = {
    window: global.window,
    document: global.document,
    Image: global.Image,
    Blob: global.Blob,
    FileReader: global.FileReader,
    navigator: global.navigator,
    getComputedStyle: global.getComputedStyle,
    fetch: global.fetch,
  };

  global.window = dom.window;
  global.document = dom.window.document;
  global.Image = dom.window.Image;
  global.Blob = dom.window.Blob;
  global.FileReader = dom.window.FileReader;
  global.navigator = dom.window.navigator;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

  const fetchCalls = [];
  global.fetch = async (input, init = {}) => {
    fetchCalls.push({ input, init });
    const blob = new dom.window.Blob([Uint8Array.from([0, 1, 2, 3])], { type: 'image/png' });
    return {
      ok: true,
      blob: async () => blob,
    };
  };

  try {
    const warnings = [];
    const root = dom.window.document.getElementById('root');
    await inlineAllRasterImages(root, warnings);

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].init.credentials, 'include');

    const image = dom.window.document.getElementById('feature');
    assert.match(image.src, /^data:image\/png;base64,/);
    assert.strictEqual(warnings.length, 0);
  } finally {
    global.window = previousGlobals.window;
    global.document = previousGlobals.document;
    global.Image = previousGlobals.Image;
    global.Blob = previousGlobals.Blob;
    global.FileReader = previousGlobals.FileReader;
    global.navigator = previousGlobals.navigator;
    global.getComputedStyle = previousGlobals.getComputedStyle;
    global.fetch = previousGlobals.fetch;
  }
});

