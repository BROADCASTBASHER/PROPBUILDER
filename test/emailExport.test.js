const test = require('node:test');
const assert = require('node:assert');

const {
  composeEmlMessage,
  encodeQuotedPrintable,
  chunkBase64,
  dataUriToBinary,
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

