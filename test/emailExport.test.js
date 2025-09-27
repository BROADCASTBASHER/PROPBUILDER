const test = require('node:test');
const assert = require('node:assert');

const {
  __private: { imgElementToDataURI, inlineBackgroundImage },
} = require('../js/emailExport.js');

function setupCanvasEnvironment(t, { expectedType, dataUri, width = 100, height = 50 }) {
  const originalFetch = global.fetch;
  const originalDocument = global.document;
  const OriginalImage = global.Image;

  t.after(() => {
    global.fetch = originalFetch;
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (OriginalImage === undefined) {
      delete global.Image;
    } else {
      global.Image = OriginalImage;
    }
  });

  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage() {},
      };
    },
    toDataURL(type) {
      if (expectedType) {
        assert.strictEqual(type, expectedType);
      }
      return dataUri;
    },
  };

  global.document = {
    baseURI: 'https://example.com/',
    createElement(tag) {
      assert.strictEqual(tag, 'canvas');
      return canvas;
    },
  };

  class FakeImage {
    constructor() {
      this._src = '';
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.crossOrigin = '';
      this.decoding = '';
      this.referrerPolicy = '';
    }

    async decode() {
      return undefined;
    }

    set src(value) {
      this._src = value;
    }

    get src() {
      return this._src;
    }
  }

  global.Image = FakeImage;
}

test('imgElementToDataURI falls back to canvas when fetch fails', async (t) => {
  setupCanvasEnvironment(t, {
    expectedType: 'image/png',
    dataUri: 'data:image/png;base64,fallback',
  });

  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network failure');
  };

  const img = {
    currentSrc: 'https://example.com/image.png',
    src: 'https://example.com/image.png',
    alt: 'Remote image',
  };

  const warnings = [];
  const result = await imgElementToDataURI(img, warnings);

  assert.strictEqual(fetchCalls, 1);
  assert.deepStrictEqual(result, {
    dataUri: 'data:image/png;base64,fallback',
    mime: 'image/png',
  });
  assert.deepStrictEqual(warnings, []);
});


test('imgElementToDataURI skips fetch for file URLs', async (t) => {
  setupCanvasEnvironment(t, {
    expectedType: 'image/jpeg',
    dataUri: 'data:image/jpeg;base64,local',
    width: 80,
    height: 60,
  });

  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('should not fetch file URLs');
  };

  const img = {
    currentSrc: 'file:///Users/alex/Pictures/local.jpg',
    src: 'file:///Users/alex/Pictures/local.jpg',
    alt: 'Local image',
  };

  const warnings = [];
  const result = await imgElementToDataURI(img, warnings);

  assert.strictEqual(fetchCalls, 0);
  assert.deepStrictEqual(result, {
    dataUri: 'data:image/jpeg;base64,local',
    mime: 'image/jpeg',
  });
  assert.deepStrictEqual(warnings, []);
});

test('inlineBackgroundImage falls back to canvas data when fetch fails', async (t) => {
  setupCanvasEnvironment(t, {
    expectedType: 'image/png',
    dataUri: 'data:image/png;base64,canvasbg',
  });

  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network failure');
  };

  const originalGetComputedStyle = global.getComputedStyle;
  t.after(() => {
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
  });

  const styleString = 'url("https://example.com/assets/bg.png")';
  const element = {
    style: {
      backgroundImage: styleString,
    },
  };

  global.getComputedStyle = () => ({ backgroundImage: styleString });

  const warnings = [];
  await inlineBackgroundImage(element, warnings);

  assert.strictEqual(fetchCalls, 1);
  assert.deepStrictEqual(warnings, []);
  assert.ok(
    element.style.backgroundImage.includes('data:image/png;base64,canvasbg'),
    'background should be replaced with canvas data URI'
  );
});
