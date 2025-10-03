const test = require('node:test');
const assert = require('node:assert');

const {
  __private: { inlineAllRasterImages, inlineBackgroundImage, renderFeatureCard },
} = require('../js/emailExport.js');

const createStyle = () => ({
  backgroundImage: '',
  width: '',
  height: '',
  display: '',
  border: '',
  maxWidth: '',
});

test('inlineBackgroundImage resolves URLs to HTTPS', async () => {
  const originalDocument = global.document;
  const originalGetComputedStyle = global.getComputedStyle;

  const element = {
    style: createStyle(),
  };

  try {
    global.document = { baseURI: 'http://example.com/base/index.html' };
    global.getComputedStyle = () => ({ backgroundImage: 'url("/assets/bg.png"), linear-gradient(red, blue)' });

    element.style.backgroundImage = 'url("http://cdn.example.com/legacy.jpg")';

    const warnings = [];
    await inlineBackgroundImage(element, warnings, {});

    assert.deepStrictEqual(warnings, []);
    assert.strictEqual(
      element.style.backgroundImage,
      'url("https://cdn.example.com/legacy.jpg")'
    );
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
  }
});

test('inlineAllRasterImages keeps HTTPS and uploads canvases', async () => {
  const originalDocument = global.document;
  const originalFetch = global.fetch;
  const originalBlob = global.Blob;
  const originalGetComputedStyle = global.getComputedStyle;

  const createdImages = [];

  const documentMock = {
    baseURI: 'http://example.com/app/',
    createElement(tag) {
      assert.strictEqual(tag, 'img');
      const style = createStyle();
      const attributes = {};
      const node = {
        tagName: 'IMG',
        style,
        attributes,
        naturalWidth: 0,
        naturalHeight: 0,
        setAttribute(name, value) {
          attributes[name] = String(value);
        },
        removeAttribute(name) {
          delete attributes[name];
        },
        getBoundingClientRect() {
          return { width: this._rectWidth || 120, height: this._rectHeight || 80 };
        },
      };
      createdImages.push(node);
      return node;
    },
  };

  const canvas = {
    width: 320,
    height: 180,
    clientWidth: 320,
    clientHeight: 180,
    style: createStyle(),
    toBlob(callback) {
      const blob = new Blob(['canvasdata'], { type: 'image/png' });
      callback(blob);
    },
    replaceWith(node) {
      canvases.length = 0;
      images.push(node);
      allElements.push(node);
    },
  };

  const image = {
    src: '/media/photo.jpg',
    currentSrc: '/media/photo.jpg',
    style: createStyle(),
    naturalWidth: 640,
    naturalHeight: 320,
    attributes: { srcset: 'x' },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getBoundingClientRect() {
      return { width: 200, height: 100 };
    },
  };

  const backgroundElement = {
    style: { backgroundImage: 'url("/bg/pattern.png")' },
  };

  const canvases = [canvas];
  const images = [image];
  const allElements = [backgroundElement];

  const root = {
    querySelectorAll(selector) {
      if (selector === 'canvas') {
        return canvases;
      }
      if (selector === 'img') {
        return images;
      }
      if (selector === '*') {
        return allElements;
      }
      return [];
    },
  };

  const warnings = [];

  try {
    global.document = documentMock;
    global.fetch = undefined;
    global.getComputedStyle = (node) => node.style || createStyle();

    const uploadCalls = [];
    const options = {
      uploadCanvas: async ({ blob }) => {
        uploadCalls.push(blob);
        assert.strictEqual(blob.type, 'image/png');
        return 'https://cdn.example.com/uploaded/canvas.png';
      },
    };

    await inlineAllRasterImages(root, warnings, options);

    assert.strictEqual(uploadCalls.length, 1);
    assert.deepStrictEqual(warnings, []);

    assert.strictEqual(images[1].src, 'https://cdn.example.com/uploaded/canvas.png');
    assert.strictEqual(images[1].style.display, 'block');
    assert.strictEqual(images[1].style.border, '0');
    assert.strictEqual(images[1].attributes.width, '320');
    assert.strictEqual(images[1].attributes.height, '180');

    assert.strictEqual(image.src, 'https://example.com/media/photo.jpg');
    assert.strictEqual(image.style.display, 'block');
    assert.strictEqual(image.style.border, '0');
    assert.strictEqual(image.attributes.width, '200');
    assert.strictEqual(image.attributes.height, '100');
    assert.strictEqual(image.attributes.srcset, undefined);

    assert.strictEqual(
      backgroundElement.style.backgroundImage,
      'url("https://example.com/bg/pattern.png")'
    );
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
    if (originalBlob === undefined) {
      delete global.Blob;
    } else {
      global.Blob = originalBlob;
    }
    if (originalGetComputedStyle === undefined) {
      delete global.getComputedStyle;
    } else {
      global.getComputedStyle = originalGetComputedStyle;
    }
  }
});

test('renderFeatureCard uses <img> for background images', async () => {
  const feature = {
    title: 'Background Feature',
    image: {
      background: true,
      src: 'https://cdn.example.com/background.png',
      width: 400,
      height: 220,
      css: 'border-radius:20px; box-shadow:0 0 10px rgba(0,0,0,0.2);',
      alt: 'Background graphic',
    },
  };

  const html = await renderFeatureCard(feature, null, []);

  assert.ok(html.includes('<img'));
  assert.ok(html.includes('src="https://cdn.example.com/background.png"'));
  assert.ok(html.includes('height="220"'));
  assert.ok(html.includes('object-fit:cover'));
  assert.ok(html.includes('box-shadow:0 0 10px rgba(0,0,0,0.2)'));
  assert.ok(!html.includes('background-image'));
});
