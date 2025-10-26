const EMAIL_MAX_WIDTH = 600;
const DEFAULT_EMAIL_WIDTH = EMAIL_MAX_WIDTH;
const DEFAULT_IMAGE_WIDTH = 320;
const DEFAULT_IMAGE_HEIGHT = 180;
const EMAIL_FEATURE_STANDARD_IMAGE_MAX_WIDTH = 76;
const EMAIL_FEATURE_STANDARD_IMAGE_MAX_HEIGHT = 76;
const EMAIL_FEATURE_HERO_IMAGE_MAX_WIDTH = 220;
const EMAIL_FEATURE_HERO_IMAGE_MAX_HEIGHT = 220;
const FALLBACK_FONT_FAMILY = '-apple-system, Segoe UI, Roboto, Arial, sans-serif';
const EMAIL_BODY_BACKGROUND = '#FAF7F3';
const EMAIL_BODY_TEXT_COLOR = '#0B1220';
const EMAIL_BODY_FONT_STACK = "'TelstraText', Arial, sans-serif";
const EMAIL_SURFACE_RADIUS = 24;
const EMAIL_SECTION_HORIZONTAL_PADDING = 28;
const EMAIL_SECTION_BOTTOM_PADDING = 28;
const EMAIL_HERO_TOP_PADDING = 28;
const EMAIL_HERO_BOTTOM_PADDING = 24;

class WarningCollector {
  constructor(initial) {
    this._warnings = Array.isArray(initial) ? initial : [];
    this._seen = new Set(this._warnings);
  }

  push(message) {
    const trimmed = String(message ?? '').trim();
    if (!trimmed || this._seen.has(trimmed)) {
      return;
    }
    this._seen.add(trimmed);
    this._warnings.push(trimmed);
  }

  toArray() {
    return [...this._warnings];
  }

  get length() {
    return this._warnings.length;
  }
}

function asWarningCollector(value) {
  if (!value) {
    return new WarningCollector();
  }
  if (value instanceof WarningCollector) {
    return value;
  }
  if (typeof value.push === 'function' && typeof value.length === 'number') {
    return new WarningCollector(value);
  }
  return new WarningCollector();
}

const INLINE_STYLE_PROPERTIES = [
  'align-content', 'align-items', 'align-self', 'background', 'background-attachment', 'background-blend-mode',
  'background-clip', 'background-color', 'background-image', 'background-origin', 'background-position',
  'background-repeat', 'background-size', 'border', 'border-block', 'border-block-color', 'border-block-style',
  'border-block-width', 'border-bottom', 'border-bottom-color', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'border-bottom-style', 'border-bottom-width', 'border-collapse', 'border-color', 'border-image', 'border-left',
  'border-left-color', 'border-left-style', 'border-left-width', 'border-radius', 'border-right', 'border-right-color',
  'border-right-style', 'border-right-width', 'border-spacing', 'border-style', 'border-top', 'border-top-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-top-style', 'border-top-width', 'border-width', 'bottom',
  'box-shadow', 'box-sizing', 'color', 'column-gap', 'display', 'filter', 'flex', 'flex-basis', 'flex-direction',
  'flex-grow', 'flex-shrink', 'flex-wrap', 'font', 'font-family', 'font-size', 'font-style', 'font-variant',
  'font-variant-numeric', 'font-weight', 'gap', 'grid-auto-flow', 'grid-template-columns', 'grid-template-rows', 'height',
  'justify-content', 'justify-items', 'justify-self', 'left', 'letter-spacing', 'line-height', 'list-style',
  'list-style-image', 'list-style-position', 'list-style-type', 'margin', 'margin-block', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width', 'object-fit', 'opacity', 'order',
  'outline', 'outline-color', 'outline-style', 'outline-width', 'overflow', 'overflow-x', 'overflow-y', 'padding',
  'padding-block', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'position', 'right', 'row-gap',
  'text-align', 'text-decoration', 'text-decoration-color', 'text-decoration-line', 'text-decoration-style', 'text-indent',
  'text-shadow', 'text-transform', 'top', 'transform', 'transition', 'vertical-align', 'white-space', 'width', 'word-break',
  'word-spacing', 'word-wrap', 'z-index',
];

const SCRIPT_TAG_REGEX = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const STYLE_TAG_REGEX = /<style[\s\S]*?>[\s\S]*?<\/style>/gi;
const EVENT_HANDLER_ATTR_REGEX = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_PROTOCOL_REGEX = /((?:href|src)\s*=\s*["'])\s*javascript:[^"']*(["'])/gi;
const DANGEROUS_TAG_REGEX = /<\/?(?:iframe|object|embed|meta|link)[^>]*>/gi;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampWidth(width) {
  if (!Number.isFinite(width) || width <= 0) {
    return Math.min(DEFAULT_IMAGE_WIDTH, EMAIL_MAX_WIDTH);
  }
  return Math.min(Math.max(24, Math.round(width)), EMAIL_MAX_WIDTH);
}

function clampFeatureImageWidth(width, { isHero } = {}) {
  const maxWidth = isHero ? EMAIL_FEATURE_HERO_IMAGE_MAX_WIDTH : EMAIL_FEATURE_STANDARD_IMAGE_MAX_WIDTH;
  return Math.min(clampWidth(width), maxWidth);
}

function clampFeatureImageHeight(height, { isHero, mirrorWidth } = {}) {
  const maxHeight = isHero ? EMAIL_FEATURE_HERO_IMAGE_MAX_HEIGHT : EMAIL_FEATURE_STANDARD_IMAGE_MAX_HEIGHT;
  const normalizedMirror = Number.isFinite(mirrorWidth) && mirrorWidth > 0 ? Math.round(mirrorWidth) : null;
  const mirrorLimit = normalizedMirror != null ? Math.min(normalizedMirror, maxHeight) : null;
  if (!Number.isFinite(height) || height <= 0) {
    return mirrorLimit != null ? mirrorLimit : maxHeight;
  }
  const clamped = Math.min(Math.max(32, Math.round(height)), maxHeight);
  if (mirrorLimit != null) {
    return mirrorLimit;
  }
  return clamped;
}

function buildSectionPadding({ top = 0, bottom = EMAIL_SECTION_BOTTOM_PADDING } = {}) {
  const horizontal = EMAIL_SECTION_HORIZONTAL_PADDING;
  return `${top}px ${horizontal}px ${bottom}px ${horizontal}px`;
}

const MIME_FALLBACK = 'image/png';

function mimeFromExtOrBlob(url, blob) {
  if (blob?.type) {
    if (blob.type.startsWith('image/')) {
      return blob.type;
    }
  }
  const lower = (url || '').split(/[?#]/)[0].toLowerCase();
  if (!lower) {
    return MIME_FALLBACK;
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.gif')) {
    return 'image/gif';
  }
  if (lower.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.avif')) {
    return 'image/avif';
  }
  return MIME_FALLBACK;
}

function assetKeyFromElement(el) {
  if (!el) {
    return '';
  }
  const datasetValue = el.dataset?.assetKey;
  if (datasetValue && datasetValue.trim()) {
    return datasetValue.trim();
  }
  if (typeof el.getAttribute === 'function') {
    const attrValue = el.getAttribute('data-asset-key');
    if (attrValue && attrValue.trim()) {
      return attrValue.trim();
    }
  }
  return '';
}

function resolveIconDataUri(assetKey) {
  if (!assetKey) {
    return null;
  }
  const scope = (typeof globalThis !== 'undefined' && globalThis)
    || (typeof window !== 'undefined' && window)
    || (typeof self !== 'undefined' && self)
    || null;
  const map = scope && typeof scope.__ICON_DATA_URIS__ === 'object' ? scope.__ICON_DATA_URIS__ : null;
  if (map && map[assetKey]) {
    return map[assetKey];
  }
  return null;
}

function mimeFromDataUri(dataUri) {
  if (!dataUri) {
    return MIME_FALLBACK;
  }
  const match = /^data:([^;,]+)[;,]/i.exec(String(dataUri));
  if (match && match[1]) {
    return match[1];
  }
  return MIME_FALLBACK;
}

function toDataURLViaFileReader(blob, mimeHint) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('readAsDataURL failed'));
    reader.onload = () => {
      let out = String(reader.result || '');
      if (out.startsWith('data:application/octet-stream')) {
        out = out.replace('data:application/octet-stream', `data:${mimeHint}`);
      }
      resolve(out);
    };
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataURL(url) {
  let requestUrl = url;
  let credentials = 'omit';

  try {
    const resolved = new URL(url, getBaseHref());
    requestUrl = resolved.href;

    const currentOrigin = (() => {
      if (typeof window !== 'undefined' && window?.location?.origin) {
        return window.location.origin;
      }
      if (typeof location !== 'undefined' && location?.origin) {
        return location.origin;
      }
      try {
        return new URL(getBaseHref()).origin;
      } catch (error) {
        return null;
      }
    })();

    if (currentOrigin && resolved.origin === currentOrigin) {
      credentials = 'include';
    }
  } catch (error) {
    requestUrl = url;
  }

  const resp = await fetch(requestUrl, { credentials, mode: 'cors' }).catch(() => null);
  if (!resp || !resp.ok) {
    throw new Error(`Fetch failed: ${url}`);
  }
  const blob = await resp.blob();
  const mime = mimeFromExtOrBlob(url, blob);

  try {
    const dataUri = await toDataURLViaFileReader(blob, mime);
    return { dataUri, mime };
  } catch (readerError) {
    try {
      const dataUri = await imageBlobToCanvasDataURI(blob, mime);
      return { dataUri, mime };
    } catch (canvasError) {
      const readerMessage = readerError?.message || String(readerError || 'readAsDataURL failed');
      const canvasMessage = canvasError?.message || String(canvasError || 'canvas fallback failed');
      throw new Error(`${readerMessage} (canvas fallback failed: ${canvasMessage})`);
    }
  }
}

async function imageSrcToCanvasDataURI(src, mimeHint) {
  const tmp = new Image();
  if (!src.startsWith('file:')) {
    tmp.crossOrigin = 'anonymous';
    tmp.referrerPolicy = 'no-referrer';
  }
  tmp.decoding = 'sync';
  tmp.src = src;
  await tmp.decode().catch(() => {
    throw new Error('decode failed');
  });

  const w = tmp.naturalWidth || 1;
  const h = tmp.naturalHeight || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('canvas ctx null');
  }
  ctx.drawImage(tmp, 0, 0);
  const mime = mimeHint || mimeFromExtOrBlob(src);
  const dataUri = canvas.toDataURL(mime);
  return { dataUri, mime };
}

async function imageBlobToCanvasDataURI(blob, mimeHint) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const { dataUri } = await imageSrcToCanvasDataURI(objectUrl, mimeHint);
    return dataUri;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function imgElementToDataURI(img, warnings) {
  const src = img.currentSrc || img.src;
  if (!src) {
    return null;
  }

  try {
    if (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg')) {
      return { dataUri: src, mime: src.includes('image/png') ? 'image/png' : 'image/jpeg' };
    }

    const canUseFetch = !src.startsWith('file:');
    let fetchError = null;
    if (canUseFetch) {
      try {
        return await fetchAsDataURL(src);
      } catch (error) {
        fetchError = error;
      }
    }

    try {
      return await imageSrcToCanvasDataURI(src);
    } catch (canvasError) {
      if (fetchError) {
        const fetchMessage = fetchError?.message || String(fetchError || 'fetch failed');
        const canvasMessage = canvasError?.message || String(canvasError || 'canvas fallback failed');
        throw new Error(`${fetchMessage}; canvas fallback failed: ${canvasMessage}`);
      }
      throw canvasError;
    }
  } catch (error) {
    warnings.push(`IMG inline failed: ${img.alt || '[no alt]'} — ${error?.message || error}`);
  }

  if (src.startsWith('file:')) {
    const assetKey = assetKeyFromElement(img);
    const dataUri = resolveIconDataUri(assetKey);
    if (dataUri) {
      return { dataUri, mime: mimeFromDataUri(dataUri) };
    }
  }
  return null;
}

function getBaseHref() {
  if (typeof document !== 'undefined' && document?.baseURI) {
    return document.baseURI;
  }
  if (typeof location !== 'undefined' && location?.href) {
    return location.href;
  }
  return 'http://localhost/';
}

function toAbsoluteHttpsUrl(value, baseHref = getBaseHref()) {
  if (!value) {
    return null;
  }

  if (/^data:/i.test(value)) {
    return value;
  }

  try {
    const resolved = new URL(value, baseHref);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      resolved.protocol = 'https:';
      return resolved.href;
    }
    if (!resolved.protocol || resolved.protocol === ':') {
      resolved.protocol = 'https:';
      return resolved.href;
    }
    return resolved.href;
  } catch (error) {
    return null;
  }
}

function cssUrl(url) {
  const safe = String(url ?? '').replace(/['"\\]/g, '\\$&');
  return `url("${safe}")`;
}

async function inlineBackgroundImage(el, warnings, options = {}) {
  const computed = getComputedStyle(el);
  const backgroundCandidates = [];
  const inlineBg = el.style?.backgroundImage;
  if (inlineBg && inlineBg !== 'none') {
    backgroundCandidates.push(inlineBg);
  }
  const computedBg = computed.backgroundImage;
  if (computedBg && computedBg !== 'none' && computedBg !== inlineBg) {
    backgroundCandidates.push(computedBg);
  }
  if (!backgroundCandidates.length) {
    return;
  }

  const baseHref = options?.baseHref || getBaseHref();

  const rewrite = (value) => {
    if (!value) {
      return value;
    }
    return value.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, rawUrl) => {
      const cleaned = (rawUrl || '').trim();
      if (!cleaned || /^data:/i.test(cleaned)) {
        return match;
      }
      const absolute = toAbsoluteHttpsUrl(cleaned, baseHref);
      if (!absolute) {
        warnings.push(`BG image inline failed: ${cleaned} — unable to resolve URL`);
        return match;
      }
      return cssUrl(absolute);
    });
  };

  const updatedInline = rewrite(inlineBg);
  if (updatedInline && updatedInline !== inlineBg) {
    el.style.backgroundImage = updatedInline;
    return;
  }

  const updatedComputed = rewrite(backgroundCandidates[0]);
  if (updatedComputed && updatedComputed !== inlineBg) {
    el.style.backgroundImage = updatedComputed;
  }
}

function toPositiveNumber(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) {
    return number;
  }
  return undefined;
}

function setExplicitDimensions(el, fallbackWidth, fallbackHeight) {
  const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { width: 0, height: 0 };
  const naturalWidth = Number(el.naturalWidth) || 0;
  const naturalHeight = Number(el.naturalHeight) || 0;
  const attrWidth = typeof el.getAttribute === 'function' ? toPositiveNumber(el.getAttribute('width')) : undefined;
  const attrHeight = typeof el.getAttribute === 'function' ? toPositiveNumber(el.getAttribute('height')) : undefined;
  const widthFallbacks = [fallbackWidth, attrWidth, rect.width, Number(el.width), naturalWidth, EMAIL_MAX_WIDTH];
  const widthCandidate = widthFallbacks.find((value) => Number.isFinite(value) && value > 0);
  const width = clampWidth(widthCandidate);

  const heightFallbacks = [fallbackHeight, attrHeight, rect.height, Number(el.height), naturalHeight];
  let heightCandidate = heightFallbacks.find((value) => Number.isFinite(value) && value > 0) || 0;
  if ((!heightCandidate || heightCandidate <= 0) && naturalWidth > 0 && naturalHeight > 0 && width > 0) {
    heightCandidate = (naturalHeight / naturalWidth) * width;
  }
  if (!Number.isFinite(heightCandidate) || heightCandidate <= 0) {
    heightCandidate = width;
  }
  const height = Math.max(1, Math.round(heightCandidate));

  el.width = width;
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('width', String(width));
  }
  el.style.width = `${width}px`;
  el.height = height;
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('height', String(height));
    el.setAttribute('border', '0');
  }
  el.style.height = 'auto';
  el.style.display = 'block';
  el.style.border = '0';
  if (!el.style.maxWidth) {
    el.style.maxWidth = '100%';
  }
}

async function canvasToPngBlob(canvas) {
  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob() returned null'));
        }
      }, 'image/png', 1.0);
    });
  }
  const dataUri = canvas.toDataURL('image/png', 1.0);
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Invalid canvas data URI');
  }
  const base64 = dataUri.slice(commaIndex + 1);
  const mime = dataUri.slice(5, commaIndex).split(';')[0] || 'image/png';
  const buffer = typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64') : Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([buffer], { type: mime });
}

function getUploadConfig(options = {}) {
  const globalScope = (typeof globalThis !== 'undefined' && globalThis) || {};
  const exportConfig = options;
  const globalExport = globalScope.PropBuilderEmailExport || {};
  const uploadCanvas = exportConfig.uploadCanvas
    || globalExport.uploadCanvas
    || globalExport.uploadCanvasImage
    || globalExport.uploadImage;
  const imageUploadEndpoint = exportConfig.imageUploadEndpoint
    || exportConfig.uploadEndpoint
    || globalExport.imageUploadEndpoint
    || globalExport.uploadEndpoint;
  const parseUploadResponse = exportConfig.parseUploadResponse || globalExport.parseUploadResponse;
  return { uploadCanvas, imageUploadEndpoint, parseUploadResponse };
}

async function uploadCanvasImage(canvas, warnings, options = {}) {
  const { uploadCanvas, imageUploadEndpoint, parseUploadResponse } = getUploadConfig(options);
  const blob = await canvasToPngBlob(canvas);

  if (typeof uploadCanvas === 'function') {
    const result = await uploadCanvas({ canvas, blob });
    const url = typeof result === 'string' ? result : result?.url || result?.href;
    const httpsUrl = toAbsoluteHttpsUrl(url);
    if (!httpsUrl) {
      throw new Error('Canvas upload function did not return a valid HTTPS URL');
    }
    return httpsUrl;
  }

  if (!imageUploadEndpoint) {
    throw new Error('No canvas upload endpoint configured');
  }

  const formData = new FormData();
  formData.append('file', blob, 'canvas.png');
  const resp = await fetch(imageUploadEndpoint, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  }).catch((error) => {
    throw new Error(`Upload failed: ${error?.message || error}`);
  });

  if (!resp || !resp.ok) {
    throw new Error(`Upload failed with status ${resp?.status || 'unknown'}`);
  }

  let payload = null;
  const contentType = resp.headers?.get?.('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = await resp.json();
  } else {
    payload = await resp.text();
  }

  let extractedUrl = null;
  if (typeof parseUploadResponse === 'function') {
    extractedUrl = await parseUploadResponse(payload, resp);
  } else if (payload && typeof payload === 'object') {
    extractedUrl = payload.secureUrl || payload.secureURL || payload.url || payload.href;
  } else if (typeof payload === 'string') {
    extractedUrl = payload.trim();
  }

  const httpsUrl = toAbsoluteHttpsUrl(extractedUrl);
  if (!httpsUrl) {
    throw new Error('Upload response did not include a valid HTTPS URL');
  }

  return httpsUrl;
}

function ensureImageAttributes(image, fallbackWidth, fallbackHeight) {
  if (typeof image.removeAttribute === 'function') {
    image.removeAttribute('srcset');
  }

  const widthAttr = typeof image.getAttribute === 'function' ? toPositiveNumber(image.getAttribute('width')) : undefined;
  const heightAttr = typeof image.getAttribute === 'function' ? toPositiveNumber(image.getAttribute('height')) : undefined;

  const widthHintArg = toPositiveNumber(fallbackWidth);
  const heightHintArg = toPositiveNumber(fallbackHeight);

  const storedWidth = toPositiveNumber(image.__pbFallbackWidth);
  const storedHeight = toPositiveNumber(image.__pbFallbackHeight);

  if (widthHintArg != null) {
    image.__pbFallbackWidth = widthHintArg;
  } else if (!storedWidth && widthAttr != null) {
    image.__pbFallbackWidth = widthAttr;
  }

  if (heightHintArg != null) {
    image.__pbFallbackHeight = heightHintArg;
  } else if (!storedHeight && heightAttr != null) {
    image.__pbFallbackHeight = heightAttr;
  }

  const widthHint = widthHintArg ?? toPositiveNumber(image.__pbFallbackWidth) ?? widthAttr;
  const heightHint = heightHintArg ?? toPositiveNumber(image.__pbFallbackHeight) ?? heightAttr;

  setExplicitDimensions(image, widthHint, heightHint);
}

async function inlineAllRasterImages(root, warnings, options = {}) {
  const baseHref = options?.baseHref || getBaseHref();
  const canvases = Array.from(root.querySelectorAll('canvas'));
  for (const canvas of canvases) {
    const img = document.createElement('img');
    try {
      const uploadedUrl = await uploadCanvasImage(canvas, warnings, options);
      img.src = uploadedUrl;
    } catch (error) {
      warnings.push(`Canvas upload failed: ${error?.message || error}`);
      img.alt = 'Canvas unavailable';
    }
    ensureImageAttributes(img, canvas.width || canvas.clientWidth, canvas.height || canvas.clientHeight);
    canvas.replaceWith(img);
  }

  const images = Array.from(root.querySelectorAll('img'));
  for (const image of images) {
    const currentSrc = image.currentSrc || image.src;
    if (currentSrc && !/^data:/i.test(currentSrc)) {
      const absolute = toAbsoluteHttpsUrl(currentSrc, baseHref);
      if (absolute && image.src !== absolute) {
        image.src = absolute;
      }
      const inlineResult = await imgElementToDataURI(image, warnings);
      if (inlineResult?.dataUri) {
        image.src = inlineResult.dataUri;
      } else if (absolute) {
        image.src = absolute;
      }
    }
    ensureImageAttributes(image);
  }

  const elements = Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    await inlineBackgroundImage(element, warnings, options);
  }
}

function buildRasterOptionsFromProposal(proposal) {
  const rasterOptions = {};
  if (proposal?.imageUploadEndpoint) {
    rasterOptions.imageUploadEndpoint = proposal.imageUploadEndpoint;
  }
  if (proposal?.uploadEndpoint && !rasterOptions.imageUploadEndpoint) {
    rasterOptions.uploadEndpoint = proposal.uploadEndpoint;
  }
  if (typeof proposal?.uploadCanvas === 'function') {
    rasterOptions.uploadCanvas = proposal.uploadCanvas;
  }
  if (proposal?.baseHref) {
    rasterOptions.baseHref = proposal.baseHref;
  }
  return rasterOptions;
}

function sanitizeHTML(input) {
  if (!input) {
    return '';
  }
  let sanitized = String(input);
  sanitized = sanitized.replace(SCRIPT_TAG_REGEX, '');
  sanitized = sanitized.replace(STYLE_TAG_REGEX, '');
  sanitized = sanitized.replace(DANGEROUS_TAG_REGEX, '');
  sanitized = sanitized.replace(EVENT_HANDLER_ATTR_REGEX, '');
  sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL_REGEX, '$1#$2');
  return sanitized;
}

function textToHTML(text) {
  if (!text) {
    return '';
  }
  return esc(text).replace(/\r\n|\n|\r/g, '<br>');
}

async function renderFeatureCard(feature, brand, warnings) {
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand?.colorText || '#333333';
  const titleColor = brand?.colorHeading || '#222222';
  const rows = [];
  const image = feature?.image;
  const isHero = Boolean(feature?.isHero);
  if (image) {
    if ((image.kind === 'css-bg' || image.background === true) && (image.css || image.src)) {
      const width = clampFeatureImageWidth(image.width ?? DEFAULT_IMAGE_WIDTH, { isHero });
      const height = clampFeatureImageHeight(image.height, { isHero, mirrorWidth: width });
      let imgSrc = image.src || '';
      if (!imgSrc && image.css) {
        const match = image.css.match(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
        if (match && match[2]) {
          imgSrc = match[2];
        }
      }
      const altText = image.alt || feature.title || 'Feature image';
      const styleParts = [
        'display:block',
        `width:${width}px`,
        'max-width:100%',
        `height:${height}px`,
        'object-fit:cover',
        'border:0',
        'outline:none',
        'text-decoration:none',
        'border-radius:12px',
      ];
      if (image.css) {
        styleParts.push(image.css.trim().replace(/;+$/g, ''));
      }
      const styleAttr = `${styleParts.join('; ')};`;
      const assetAttr = image.assetKey ? ` data-asset-key="${esc(image.assetKey)}"` : '';
      rows.push(`<tr><td style="padding-bottom:12px;"><img src="${esc(imgSrc)}" alt="${esc(altText)}" width="${width}" height="${height}" style="${styleAttr}"${assetAttr}></td></tr>`);
    } else if (image.src) {
      const width = clampFeatureImageWidth(image.width ?? DEFAULT_IMAGE_WIDTH, { isHero });
      const altText = image.alt || feature.title || 'Feature image';
      const assetAttr = image.assetKey ? ` data-asset-key="${esc(image.assetKey)}"` : '';
      rows.push(`<tr><td style="padding-bottom:12px;"><img src="${esc(image.src)}" alt="${esc(altText)}" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;"${assetAttr}></td></tr>`);
    }
  }
  if (feature.title) {
    rows.push(`<tr><td style="font-family:${esc(fontFamily)}; font-size:18px; line-height:1.4; font-weight:600; color:${esc(titleColor)}; padding-bottom:6px;">${esc(feature.title)}</td></tr>`);
  }
  if (feature.description) {
    rows.push(`<tr><td style="font-family:${esc(fontFamily)}; font-size:15px; line-height:1.55; color:${esc(bodyColor)};">${textToHTML(feature.description)}</td></tr>`);
  }
  if (Array.isArray(feature.bullets) && feature.bullets.length) {
    const items = feature.bullets
      .map((item) => esc(item))
      .map((item) => `<li style="padding-bottom:6px;">${item}</li>`)
      .join('');
    rows.push(`<tr><td style="font-family:${esc(fontFamily)}; font-size:15px; line-height:1.55; color:${esc(bodyColor)};">
      <ul style="margin:0; padding:0 0 0 18px;">${items}</ul>
    </td></tr>`);
  }
  const content = rows.join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="feature" style="width:100%; border:1px solid rgba(0,0,0,0.08); border-radius:16px; padding:0; background-color:#FFFFFF;">
  <tr>
    <td style="padding:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        ${content}
      </table>
    </td>
  </tr>
</table>`;
}

function buildCommercialTerms(terms, brand) {
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand?.colorText || '#333333';
  const lines = String(terms ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) {
    return '';
  }
  const rows = lines
    .map((line) => `<tr><td style="font-family:${esc(fontFamily)}; font-size:15px; line-height:1.55; color:${esc(bodyColor)}; padding-bottom:8px;">${esc(line)}</td></tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    ${rows}
  </table>`;
}

function renderKeyBenefits(benefits, brand) {
  if (!benefits || !benefits.length) {
    return '';
  }
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand?.colorText || '#333333';
  const rows = benefits
    .filter((item) => item != null && String(item).trim().length > 0)
    .map((item) => `<tr>
        <td style="width:18px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.4; color:${esc(bodyColor)};">•</td>
        <td style="font-family:${esc(fontFamily)}; font-size:16px; line-height:1.55; color:${esc(bodyColor)}; padding-bottom:6px;">${esc(item)}</td>
      </tr>`)
    .join('');
  if (!rows) {
    return '';
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    ${rows}
  </table>`;
}

function normalizeBrand(brand) {
  const fallback = {
    fontFamily: FALLBACK_FONT_FAMILY,
    colorText: '#333333',
    colorHeading: '#0B1220',
    colorMuted: '#6B6F76',
    priceCardShade: '#F3F4F9',
  };
  if (!brand) {
    return fallback;
  }
  return {
    fontFamily: brand.fontFamily || fallback.fontFamily,
    colorText: brand.colorText || fallback.colorText,
    colorHeading: brand.colorHeading || fallback.colorHeading,
    colorMuted: brand.colorMuted || fallback.colorMuted,
    priceCardShade: brand.priceCardShade || fallback.priceCardShade,
  };
}

async function buildFeatureSection(features, heading, brand, warnings, options = {}) {
  if (!features.length) {
    return '';
  }
  const columns = Math.max(1, Math.min(3, Number.isFinite(options.columns) ? Math.round(options.columns) : 2));
  const cards = [];
  for (const feature of features) {
    const card = await renderFeatureCard(feature, brand, warnings);
    cards.push(card);
  }
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const headingColor = brand?.colorHeading || '#0B1220';
  const sectionId = options.sectionId || 'features';
  const rows = [];
  for (let index = 0; index < cards.length; index += columns) {
    const cells = [];
    for (let column = 0; column < columns; column += 1) {
      const card = cards[index + column];
      const isLastColumn = column === columns - 1;
      const isOnlyColumn = columns === 1;
      const isLastRow = index + columns >= cards.length;
      const paddingLeft = column === 0 ? 0 : 12;
      const paddingRight = isLastColumn ? 0 : 12;
      const bottomPadding = isLastRow ? 0 : 24;
      const padding = isOnlyColumn
        ? `0 0 ${bottomPadding}px 0`
        : `0 ${paddingRight}px ${bottomPadding}px ${paddingLeft}px`;
      if (card) {
        cells.push(`<td valign="top" style="width:${Math.floor(100 / columns)}%; padding:${padding};">${card}</td>`);
      } else {
        cells.push(`<td style="width:${Math.floor(100 / columns)}%; padding:${padding};">&nbsp;</td>`);
      }
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  const cardsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-grid="${esc(sectionId)}" style="width:100%; border-spacing:0;">${rows.join('\n')}</table>`;
  const headingHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
    <tr>
      <td style="font-family:${esc(fontFamily)}; font-size:24px; font-weight:700; color:${esc(headingColor)};">${esc(heading)}</td>
    </tr>
  </table>`;
  return `<tr data-email-section="${esc(sectionId)}"><td style="padding:${buildSectionPadding()};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
      <tr><td>${headingHtml}</td></tr>
      <tr><td style="padding-top:16px;">${cardsTable}</td></tr>
    </table>
  </td></tr>`;
}

async function renderBanner(banner) {
  if (!banner) {
    return '';
  }
  if (typeof banner === 'string') {
    const width = DEFAULT_EMAIL_WIDTH;
    return `<tr><td style="padding:0;">
    <img src="${esc(banner)}" alt="Proposal banner" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;">
  </td></tr>`;
  }
  if (typeof banner === 'object') {
    if (typeof HTMLCanvasElement !== 'undefined' && banner instanceof HTMLCanvasElement) {
      const clone = banner.cloneNode(true);
      clone.removeAttribute('id');
      clone.style.display = 'block';
      clone.style.width = `${DEFAULT_EMAIL_WIDTH}px`;
      clone.style.height = 'auto';
      return `<tr><td style="padding:0;">${clone.outerHTML}</td></tr>`;
    }
    if (typeof HTMLImageElement !== 'undefined' && banner instanceof HTMLImageElement) {
      const clone = banner.cloneNode(true);
      if (banner.dataset?.assetKey && typeof clone.setAttribute === 'function') {
        clone.setAttribute('data-asset-key', banner.dataset.assetKey);
      }
      clone.width = DEFAULT_EMAIL_WIDTH;
      clone.style.width = `${DEFAULT_EMAIL_WIDTH}px`;
      clone.style.height = 'auto';
      clone.style.display = 'block';
      return `<tr><td style="padding:0;">${clone.outerHTML}</td></tr>`;
    }
    if (banner.src) {
      const width = DEFAULT_EMAIL_WIDTH;
      const altText = banner.alt || 'Proposal banner';
      const assetAttr = banner.assetKey ? ` data-asset-key="${esc(banner.assetKey)}"` : '';
      return `<tr><td style="padding:0;">
    <img src="${esc(banner.src)}" alt="${esc(altText)}" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;"${assetAttr}>
  </td></tr>`;
    }
  }
  return '';
}

function buildHeaderSection(proposal, brand) {
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const headingColor = brand.colorHeading || '#0B1220';
  const bodyColor = brand.colorText || '#333333';
  const eyebrow = brand.colorMuted || '#6B6F76';

  const headlineParts = [];
  if (proposal.customer) {
    headlineParts.push(esc(proposal.customer));
  }
  // reference displayed as badge below; omit from headlineParts to avoid duplication

  const headerLine = headlineParts.length
    ? `<tr><td style="font-family:${esc(fontFamily)}; font-size:20px; line-height:1.4; font-weight:600; color:${esc(bodyColor)};">${headlineParts.join(' • ')}</td></tr>`
    : '';

  const mainHeadline = proposal.headlineMain
    ? `<tr><td style="padding-top:${headerLine ? 20 : 0}px; font-family:${esc(fontFamily)}; font-size:28px; line-height:1.2; font-weight:600; color:${esc(headingColor)};">${esc(proposal.headlineMain)}</td></tr>`
    : '';

  const subPaddingTop = proposal.headlineMain ? 10 : (headerLine ? 20 : 0);
  const subheadline = proposal.headlineSub
    ? `<tr><td style="padding-top:${subPaddingTop}px; font-family:${esc(fontFamily)}; font-size:18px; line-height:1.45; color:${esc(bodyColor)};">${esc(proposal.headlineSub)}</td></tr>`
    : '';

  const badge = proposal.ref
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block; border-radius:999px; background-color:rgba(17, 32, 65, 0.08);"><tr><td style="padding:6px 14px; font-family:${esc(fontFamily)}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${esc(eyebrow)};">Ref: ${esc(proposal.ref)}</td></tr></table>`
    : '';

  const badgeRow = badge ? `<tr><td style="padding-top:16px;">${badge}</td></tr>` : '';

  const rows = [headerLine, mainHeadline, subheadline, badgeRow].filter(Boolean).join('\n');
  if (!rows) {
    return '';
  }

  return `<tr data-email-section="hero"><td style="padding:${buildSectionPadding({ top: EMAIL_HERO_TOP_PADDING, bottom: EMAIL_HERO_BOTTOM_PADDING })};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
      ${rows}
    </table>
  </td></tr>`;
}

function renderExecutiveSummary(summary, brand) {
  if (!summary) {
    return '';
  }
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand.colorText || '#333333';
  const eyebrow = brand.colorMuted || '#6B6F76';
  const sanitized = textToHTML(summary);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="executive-summary" style="width:100%; border:1px solid rgba(11,18,32,0.08); border-radius:16px; background-color:#FFFFFF;">
    <tr>
      <td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
          <tr>
            <td style="font-family:${esc(fontFamily)}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${esc(eyebrow)};">Executive summary</td>
          </tr>
          <tr>
            <td style="padding-top:12px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.6; color:${esc(bodyColor)};">${sanitized}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderKeyBenefitsSection(benefits, brand) {
  const content = renderKeyBenefits(benefits, brand);
  if (!content) {
    return '';
  }
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const eyebrow = brand.colorMuted || '#6B6F76';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="key-benefits" style="width:100%; border:1px solid rgba(11,18,32,0.08); border-radius:16px; background-color:#FFFFFF;">
    <tr>
      <td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
          <tr>
            <td style="font-family:${esc(fontFamily)}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${esc(eyebrow)};">Key Benefits</td>
          </tr>
          <tr>
            <td style="padding-top:12px;">${content}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderOverviewSection(proposal, brand) {
  const summaryCard = renderExecutiveSummary(proposal.executiveSummary, brand);
  const benefitsCard = renderKeyBenefitsSection(proposal.keyBenefits, brand);
  const cards = [summaryCard, benefitsCard].filter(Boolean);
  if (!cards.length) {
    return '';
  }
  if (cards.length === 1) {
    return `<tr data-email-section="overview"><td style="padding:${buildSectionPadding()};">${cards[0]}</td></tr>`;
  }
  const stacked = cards
    .map((card, index) => {
      const topPadding = index === 0 ? 0 : 16;
      return `<tr><td style="padding:${topPadding}px 0 0 0;">${card}</td></tr>`;
    })
    .join('');
  return `<tr data-email-section="overview"><td style="padding:${buildSectionPadding()};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
      ${stacked}
    </table>
  </td></tr>`;
}

function renderPricingTable(html, brand) {
  if (!html) {
    return '';
  }
  const sanitized = sanitizeHTML(html);
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const eyebrow = brand.colorMuted || '#6B6F76';
  return `<tr data-email-section="pricing"><td style="padding:${buildSectionPadding()};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="pricing-breakdown" style="width:100%; border:1px solid rgba(11,18,32,0.08); border-radius:16px; background-color:#FFFFFF;">
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
            <tr>
              <td style="font-family:${esc(fontFamily)}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${esc(eyebrow)};">Inclusions &amp; pricing breakdown</td>
            </tr>
            <tr>
              <td style="padding-top:16px;">${sanitized}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function renderPriceCard(priceCard, brand) {
  if (!priceCard || !priceCard.show || !priceCard.html) {
    return '';
  }
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const shade = priceCard.shadedBgColor || brand.priceCardShade || '#F3F4F9';
  const sanitized = sanitizeHTML(priceCard.html);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="price-card" style="width:100%; border:1px solid rgba(11,18,32,0.08); border-radius:16px; background-color:#FFFFFF;">
    <tr>
      <td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0; background-color:${esc(shade)}; border-radius:12px;">
          <tr>
            <td style="padding:24px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.55; color:${esc(brand.colorText || '#333333')};">${sanitized}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function normalizeDataSources(sources) {
  if (!sources) {
    return [];
  }

  const normalizeItem = (item) => {
    if (!item) {
      return '';
    }
    if (typeof item === 'string') {
      return item.trim();
    }
    if (typeof item === 'object') {
      const keys = ['label', 'name', 'title', 'text', 'value'];
      for (const key of keys) {
        const value = item[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      if (typeof item.textContent === 'string' && item.textContent.trim()) {
        return item.textContent.trim();
      }
    }
    return '';
  };

  if (typeof sources === 'string') {
    return sources
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const iterable = Array.isArray(sources)
    ? sources
    : (typeof sources === 'object' && typeof sources[Symbol.iterator] === 'function')
      ? Array.from(sources)
      : (typeof sources === 'object' && typeof sources.length === 'number')
        ? Array.from({ length: sources.length }, (_, index) => sources[index])
        : Array.isArray(sources?.items)
          ? sources.items
          : [];

  return iterable
    .map((item) => normalizeItem(item))
    .filter((line) => line.length > 0);
}

function renderDataSourcesSection(sources, brand) {
  const items = normalizeDataSources(sources);
  if (!items.length) {
    return '';
  }

  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand.colorText || '#333333';
  const eyebrow = brand.colorMuted || '#6B6F76';
  const rows = items
    .map((item) => `<tr>
        <td style="width:18px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.4; color:${esc(bodyColor)};">•</td>
        <td style="font-family:${esc(fontFamily)}; font-size:16px; line-height:1.55; color:${esc(bodyColor)}; padding-bottom:6px;">${esc(item)}</td>
      </tr>`)
    .join('');

  if (!rows) {
    return '';
  }

  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
    ${rows}
  </table>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="data-sources" style="width:100%; border:1px solid rgba(11,18,32,0.08); border-radius:16px; background-color:#FFFFFF;">
    <tr>
      <td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
          <tr>
            <td style="font-family:${esc(fontFamily)}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${esc(eyebrow)};">Data sources</td>
          </tr>
          <tr>
            <td style="padding-top:12px;">${table}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderCommercialTermsSection(terms, brand) {
  const content = buildCommercialTerms(terms, brand);
  if (!content) {
    return '';
  }
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const eyebrow = brand.colorMuted || '#6B6F76';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-card="commercial-terms" style="width:100%; border:1px solid rgba(11,18,32,0.08); border-radius:16px; background-color:#FFFFFF;">
    <tr>
      <td style="padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
          <tr>
            <td style="font-family:${esc(fontFamily)}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${esc(eyebrow)};">Commercial terms &amp; dependencies</td>
          </tr>
          <tr>
            <td style="padding-top:12px;">${content}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderInvestmentSection(priceCard, commercialTerms, brand) {
  const priceCardHtml = renderPriceCard(priceCard, brand);
  const termsHtml = renderCommercialTermsSection(commercialTerms, brand);
  const blocks = [priceCardHtml, termsHtml].filter(Boolean);
  if (!blocks.length) {
    return '';
  }
  if (blocks.length === 1) {
    return `<tr data-email-section="investment"><td style="padding:${buildSectionPadding()};">${blocks[0]}</td></tr>`;
  }
  const [firstBlock, secondBlock] = blocks;
  return `<tr data-email-section="investment"><td style="padding:${buildSectionPadding()};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-spacing:0;">
      <tr>
        <td valign="top" style="padding:0 12px 0 0; width:50%;">${firstBlock}</td>
        <td valign="top" style="padding:0 0 0 12px; width:50%;">${secondBlock}</td>
      </tr>
    </table>
  </td></tr>`;
}

function buildOuterWrapper(content, brand) {
  const background = EMAIL_BODY_BACKGROUND;
  const borderColor = 'rgba(11,18,32,0.08)';
  const surfaceRadius = EMAIL_SURFACE_RADIUS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${esc(background)};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <!--[if mso]><table width="${DEFAULT_EMAIL_WIDTH}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${DEFAULT_EMAIL_WIDTH}" data-email-surface="card" style="width:${DEFAULT_EMAIL_WIDTH}px; max-width:100%; background-color:#FFFFFF; border:1px solid ${borderColor}; border-radius:${surfaceRadius}px; overflow:hidden;">
            ${content}
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>`;
}

function splitFeatures(features) {
  const safe = Array.isArray(features) ? features : [];
  const standard = [];
  const hero = [];
  for (const feature of safe) {
    if (!feature || feature.visible === false) {
      continue;
    }
    if (feature.isHero) {
      hero.push(feature);
    } else {
      standard.push(feature);
    }
  }
  return { standard, hero };
}

const ENTERPRISE_SECTION_PIPELINE = [
  { id: 'banner', render: (ctx) => ctx.renderBanner() },
  { id: 'header', render: (ctx) => ctx.renderHeader() },
  { id: 'overview', render: (ctx) => ctx.renderOverview() },
  { id: 'features', render: (ctx) => ctx.renderStandardFeatures() },
  { id: 'hero-features', render: (ctx) => ctx.renderHeroFeatures() },
  { id: 'pricing-table', render: (ctx) => ctx.renderPricingTable() },
  { id: 'investment', render: (ctx) => ctx.renderInvestment() },
  { id: 'data-sources', render: (ctx) => ctx.renderDataSources() },
];

class EmailEnterpriseLayout {
  constructor(proposal, warnings) {
    this.proposal = proposal || {};
    this.brand = normalizeBrand(this.proposal.brand);
    this.warnings = asWarningCollector(warnings);
    this._featureSplit = null;
  }

  get document() {
    if (typeof document !== 'undefined') {
      return document;
    }
    return null;
  }

  get featureSplit() {
    if (!this._featureSplit) {
      this._featureSplit = splitFeatures(this.proposal.features);
    }
    return this._featureSplit;
  }

  async renderBanner() {
    return renderBanner(this.proposal.banner);
  }

  renderHeader() {
    return buildHeaderSection(this.proposal, this.brand);
  }

  renderOverview() {
    return renderOverviewSection(this.proposal, this.brand);
  }

  async renderStandardFeatures() {
    const { standard } = this.featureSplit;
    if (!standard.length) {
      return '';
    }
    return buildFeatureSection(standard, 'Features & benefits', this.brand, this.warnings, { columns: 1, sectionId: 'features' });
  }

  async renderHeroFeatures() {
    const { hero } = this.featureSplit;
    if (!hero.length) {
      return '';
    }
    return buildFeatureSection(hero, 'Key features included', this.brand, this.warnings, { columns: 1, sectionId: 'hero-features' });
  }

  renderPricingTable() {
    return renderPricingTable(this.proposal.pricingTableHTML, this.brand);
  }

  renderInvestment() {
    return renderInvestmentSection(this.proposal.priceCard, this.proposal.commercialTerms, this.brand);
  }

  renderDataSources() {
    const html = renderDataSourcesSection(this.proposal.dataSources, this.brand);
    if (!html) {
      return '';
    }
    return `<tr data-email-section="data-sources"><td style="padding:${buildSectionPadding()};">${html}</td></tr>`;
  }

  async composeSections() {
    const parts = [];
    for (const step of ENTERPRISE_SECTION_PIPELINE) {
      try {
        const result = await step.render(this);
        if (result) {
          parts.push(result);
        }
      } catch (error) {
        this.warnings.push(`Section ${step.id} failed: ${error?.message || error}`);
      }
    }
    return parts;
  }

  createWrapper(content) {
    const markup = buildOuterWrapper(content, this.brand);
    const doc = this.document;
    if (!doc || typeof doc.createElement !== 'function') {
      throw new Error('A DOM is required to serialise the enterprise layout');
    }
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = markup;
    return wrapper;
  }

  async inlineAssets(wrapper) {
    await inlineAllRasterImages(wrapper, this.warnings, buildRasterOptionsFromProposal(this.proposal));
  }

  serialise(wrapper) {
    const fontFamily = this.brand.fontFamily || FALLBACK_FONT_FAMILY;
    const emailBody = wrapper.innerHTML;
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<meta http-equiv="x-ua-compatible" content="ie=edge">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '</head>',
      `<body style="margin:0; padding:0; background-color:${esc(EMAIL_BODY_BACKGROUND)}; font-family:${esc(fontFamily)};">`,
      emailBody,
      '</body></html>'
    ].join('');
  }
}

async function buildLegacyEmailExportHTML(proposal, warnings) {
  const layout = new EmailEnterpriseLayout(proposal, warnings);
  const sections = await layout.composeSections();
  const content = sections.filter(Boolean).join('\n');
  if (!content) {
    return '';
  }
  const wrapper = layout.createWrapper(content);
  await layout.inlineAssets(wrapper);
  return layout.serialise(wrapper);
}

async function buildPreviewMirroredEmailHTML(proposal, warnings) {
  const doc = typeof document !== 'undefined' ? document : null;
  const hasDom = doc && typeof doc.getElementById === 'function' && typeof doc.createElement === 'function';
  if (!hasDom) {
    return null;
  }
  const preview = doc.getElementById('preview-export');
  if (!preview) {
    return null;
  }

  const clone = preview.cloneNode(true);
  inlineComputedStylesTree(preview, clone, doc);
  ensureCommercialTermsSpacing(clone);

  const rect = typeof preview.getBoundingClientRect === 'function'
    ? preview.getBoundingClientRect()
    : null;
  const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? Math.round(rect.width) : null;
  const styles = {
    display: 'block',
    margin: '0 auto',
  };
  if (width) {
    styles.width = `${width}px`;
    styles['max-width'] = `${width}px`;
  } else {
    styles['max-width'] = '100%';
  }
  mergeStyleDeclarations(clone, styles);

  const wrapper = doc.createElement('div');
  wrapper.appendChild(clone);

  await inlineAllRasterImages(wrapper, warnings, buildRasterOptionsFromProposal(proposal));

  return buildPreviewHtmlDocument(doc, clone, proposal);
}

async function buildEmailExportHTML(proposal) {
  if (!proposal || typeof proposal !== 'object') {
    throw new Error('A proposal object is required');
  }
  const warningCollector = new WarningCollector();

  let html = null;
  try {
    html = await buildLegacyEmailExportHTML(proposal, warningCollector);
  } catch (error) {
    warningCollector.push(`Enterprise email layout failed: ${error?.message || error}`);
  }

  if (!html) {
    try {
      html = await buildPreviewMirroredEmailHTML(proposal, warningCollector);
    } catch (error) {
      warningCollector.push(`Preview export unavailable: ${error?.message || error}`);
    }
  }

  if (!html) {
    throw new Error('Unable to generate email export HTML');
  }

  let sizeKB = 0;
  if (typeof Blob === 'function') {
    sizeKB = Math.round(new Blob([html]).size / 1024);
  } else if (typeof Buffer !== 'undefined') {
    sizeKB = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  } else {
    sizeKB = Math.round(html.length / 1024);
  }

  return {
    html,
    sizeKB,
    warnings: warningCollector.toArray(),
  };
}

function getPreviewRoot(doc) {
  if (!doc || typeof doc.querySelector !== 'function') {
    return null;
  }
  return doc.getElementById('tab-preview') || doc;
}

function selectFirst(root, selectors) {
  if (!root || typeof root.querySelector !== 'function') {
    return null;
  }
  for (const selector of selectors) {
    if (!selector) {
      continue;
    }
    const found = root.querySelector(selector);
    if (found) {
      return found;
    }
  }
  return null;
}

function normaliseInline(text) {
  if (!text) {
    return '';
  }
  return String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseMultiline(text) {
  if (!text) {
    return '';
  }
  return String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function textFromElement(el, options = {}) {
  if (!el) {
    return '';
  }
  const { preserveLineBreaks = false } = options;
  const raw = el.textContent || '';
  return preserveLineBreaks ? normaliseMultiline(raw) : normaliseInline(raw);
}

function collectListItems(listEl) {
  if (!listEl) {
    return [];
  }
  return Array.from(listEl.querySelectorAll('li'))
    .map((item) => normaliseInline(item.textContent || ''))
    .filter((value) => value.length > 0);
}

function parsePx(value) {
  if (value == null) {
    return Number.NaN;
  }
  const match = String(value).match(/(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return Number.NaN;
  }
  return Number.parseFloat(match[1]);
}

function collectDimensionCandidates(element, dimension) {
  if (!element) {
    return [];
  }
  const candidates = [];
  const attrName = dimension === 'height' ? 'height' : 'width';
  const naturalProp = dimension === 'height' ? 'naturalHeight' : 'naturalWidth';

  const styleValue = element.style ? element.style[attrName] : undefined;
  if (styleValue) {
    candidates.push(styleValue);
  }

  if (typeof element.getAttribute === 'function') {
    const attrValue = element.getAttribute(attrName);
    if (attrValue) {
      candidates.push(attrValue);
    }
  }

  const directValue = element[attrName];
  if (Number.isFinite(directValue) && directValue > 0) {
    candidates.push(directValue);
  }

  const naturalValue = element[naturalProp];
  if (Number.isFinite(naturalValue) && naturalValue > 0) {
    candidates.push(naturalValue);
  }

  const doc = element.ownerDocument;
  const view = doc && doc.defaultView ? doc.defaultView : (typeof window !== 'undefined' ? window : null);
  if (view && typeof view.getComputedStyle === 'function') {
    try {
      const computed = view.getComputedStyle(element);
      if (computed) {
        const computedValue = computed.getPropertyValue(attrName);
        if (computedValue) {
          candidates.push(computedValue);
        }
      }
    } catch (error) {
      // ignore style resolution failures
    }
  }

  if (typeof element.getBoundingClientRect === 'function') {
    try {
      const rect = element.getBoundingClientRect();
      if (rect) {
        const rectValue = dimension === 'height' ? rect.height : rect.width;
        if (Number.isFinite(rectValue) && rectValue > 0) {
          candidates.push(rectValue);
        }
      }
    } catch (error) {
      // ignore DOM measurement failures
    }
  }

  return candidates;
}

function resolveDimensionFromElements(elements, dimension) {
  const list = Array.isArray(elements) ? elements : [elements];
  for (const element of list) {
    const candidates = collectDimensionCandidates(element, dimension);
    for (const candidate of candidates) {
      const numeric = parsePx(candidate);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.round(numeric);
      }
    }
  }
  return Number.NaN;
}

function collectFeaturesFromPreview(root) {
  if (!root) {
    return [];
  }
  const cards = Array.from(root.querySelectorAll('[data-export-feature="card"]'));
  const features = [];
  for (const card of cards) {
    const context = card.getAttribute('data-export-feature-context');
    if (context && context !== 'preview') {
      continue;
    }
    const type = card.getAttribute('data-export-feature-type') || 'standard';
    const titleEl = card.querySelector('[data-export-feature-title]');
    const copyEl = card.querySelector('[data-export-feature-copy]');
    const listEl = card.querySelector('[data-export-feature-list]');
    const imageEl = card.querySelector('[data-export-feature-image]');
    const title = textFromElement(titleEl);
    const description = copyEl ? textFromElement(copyEl, { preserveLineBreaks: true }) : '';
    const bullets = listEl ? collectListItems(listEl) : [];

    let image = null;
    if (imageEl && imageEl.src) {
      const wrapper = imageEl.closest('.icon');
      const assetKey = assetKeyFromElement(imageEl);
      image = {
        src: imageEl.src,
        alt: imageEl.alt || title || 'Feature image',
      };
      if (assetKey) {
        image.assetKey = assetKey;
      }
      const width = resolveDimensionFromElements([wrapper, imageEl], 'width');
      const height = resolveDimensionFromElements([wrapper, imageEl], 'height');
      if (Number.isFinite(width) && width > 0) {
        image.width = width;
      }
      if (Number.isFinite(height) && height > 0) {
        image.height = height;
      }
    }

    if (!title && !description && !bullets.length && !image) {
      continue;
    }

    features.push({
      title,
      description: bullets.length ? '' : description,
      bullets,
      image,
      isHero: type === 'hero',
    });
  }
  return features;
}

function collectKeyBenefitsFromPreview(root) {
  const list = selectFirst(root, ['#keyBenefits', '#pvBenefits', '[data-export="key-benefits"]']);
  return collectListItems(list);
}

function collectCommercialTermsFromPreview(root) {
  const list = selectFirst(root, ['#termsDependencies', '#assumptions', '[data-export="terms-dependencies"]']);
  const items = collectListItems(list);
  return items.join('\n');
}

function collectPricingTableHTMLFromPreview(root, brand) {
  const table = selectFirst(root, ['#pricingTable', '#priceTableView', '[data-export="pricing-table"]']);
  if (!table) {
    return '';
  }
  const headerCells = Array.from(table.querySelectorAll('thead th'));
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const rows = [];
  for (const row of bodyRows) {
    const cells = Array.from(row.children || [])
      .map((cell) => normaliseInline(cell.textContent || ''));
    const hasData = cells.some((cell) => cell && cell.length > 0);
    if (!hasData) {
      continue;
    }
    rows.push(cells);
  }
  if (!rows.length) {
    return '';
  }
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const headingColor = brand?.colorHeading || '#0B1220';
  const bodyColor = brand?.colorText || '#333333';
  const headerHtml = headerCells
    .map((cell) => `<th style="font-family:${esc(fontFamily)}; font-size:15px; font-weight:600; color:${esc(headingColor)}; background-color:rgba(0, 0, 0, 0.04); padding:12px 10px; text-align:left;">${esc(normaliseInline(cell.textContent || ''))}</th>`)
    .join('');
  const rowHtml = rows
    .map((cells) => `<tr>${cells
      .map((text) => {
        const content = text ? esc(text) : '&nbsp;';
        return `<td style="font-family:${esc(fontFamily)}; font-size:15px; line-height:1.55; color:${esc(bodyColor)}; padding:12px 10px; border-bottom:1px solid rgba(0, 0, 0, 0.08);">${content}</td>`;
      })
      .join('')}</tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid rgba(0, 0, 0, 0.1); border-radius:16px; overflow:hidden;">`
    + `<thead><tr>${headerHtml}</tr></thead>`
    + `<tbody>${rowHtml}</tbody>`
    + '</table>';
}

function collectPriceCardFromPreview(root, brand) {
  const card = selectFirst(root, ['[data-export="price-card"]', '#priceCard']);
  if (!card) {
    return { show: false, html: '', shadedBgColor: brand?.priceCardShade || '#F3F4F9' };
  }
  const amountEl = selectFirst(card, ['[data-export="price-amount"]', '#pvMonthly']);
  const termEl = selectFirst(card, ['[data-export="price-term"]', '#pvTerm2']);
  const amountText = textFromElement(amountEl);
  const termText = textFromElement(termEl);
  if (!amountText && !termText) {
    return { show: false, html: '', shadedBgColor: brand?.priceCardShade || '#F3F4F9' };
  }
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const headingColor = brand?.colorHeading || '#0B1220';
  const textColor = brand?.colorText || '#333333';
  const mutedColor = brand?.colorMuted || '#6B6F76';
  const parts = [`<div style="font-family:${esc(fontFamily)}; font-size:14px; font-weight:600; color:${esc(mutedColor)};">Monthly investment</div>`];
  if (amountText) {
    parts.push(`<div style="font-family:${esc(fontFamily)}; font-size:30px; font-weight:700; color:${esc(headingColor)}; margin-top:6px;">${esc(amountText)}</div>`);
  }
  if (termText) {
    parts.push(`<div style="font-family:${esc(fontFamily)}; font-size:14px; color:${esc(textColor)}; margin-top:8px;">${esc(termText)}</div>`);
  }

  let shadedBgColor = brand?.priceCardShade || '#F3F4F9';
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const styles = window.getComputedStyle(card);
      if (styles && styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        shadedBgColor = styles.backgroundColor;
      }
    } catch (error) {
      // ignore computed style errors
    }
  }

  return {
    show: parts.length > 0,
    html: parts.join(''),
    shadedBgColor,
  };
}

function collectBrandFromPreview(root) {
  const fallback = normalizeBrand(null);
  if (!root) {
    return fallback;
  }
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return fallback;
  }
  const headlineEl = selectFirst(root, ['#mainHeadline', '#pvHero', '[data-export="headline-main"]']);
  const bodyEl = selectFirst(root, ['#executiveSummary', '#pvSummary', '[data-export="exec-summary"]']);
  const mutedEl = selectFirst(root, ['#proposalRef', '#pvRef', '[data-export="ref"]', '[data-export="price-term"]']);
  const fontEl = headlineEl || bodyEl || root;
  const styles = (element) => {
    try {
      return window.getComputedStyle(element);
    } catch (error) {
      return null;
    }
  };
  const fontStyles = styles(fontEl);
  const headingStyles = headlineEl ? styles(headlineEl) : null;
  const bodyStyles = bodyEl ? styles(bodyEl) : null;
  const mutedStyles = mutedEl ? styles(mutedEl) : null;
  return normalizeBrand({
    fontFamily: fontStyles?.fontFamily || fallback.fontFamily,
    colorHeading: headingStyles?.color || fallback.colorHeading,
    colorText: bodyStyles?.color || fallback.colorText,
    colorMuted: mutedStyles?.color || fallback.colorMuted,
    priceCardShade: fallback.priceCardShade,
  });
}

function capturePreviewBanner(doc) {
  if (!doc) {
    return null;
  }
  const canvas = typeof doc.getElementById === 'function' ? doc.getElementById('banner') : null;
  if (canvas && typeof canvas.toDataURL === 'function') {
    try {
      const dataUri = canvas.toDataURL('image/png', 1.0);
      if (dataUri && dataUri.startsWith('data:image/')) {
        return dataUri;
      }
    } catch (error) {
      // ignore canvas failures and fall back
    }
  }
  const img = selectFirst(doc, ['[data-export="banner-image"]', '#pageBanner', '#pageBanner2']);
  if (img && img.src) {
    const assetKey = assetKeyFromElement(img);
    const banner = {
      src: img.src,
      alt: img.alt || 'Proposal banner',
    };
    if (assetKey) {
      banner.assetKey = assetKey;
    }
    return banner;
  }
  return null;
}

function collectPreviewProposal(doc) {
  const root = getPreviewRoot(doc);
  const brand = collectBrandFromPreview(root);
  const customerEl = selectFirst(root, ['#customerName', '#pvCustomer', '[data-export="customer"]']);
  const refEl = selectFirst(root, ['#proposalRef', '#pvRef', '[data-export="ref"]']);
  const headlineEl = selectFirst(root, ['#mainHeadline', '#pvHero', '[data-export="headline-main"]']);
  const subHeadlineEl = selectFirst(root, ['#subHeadline', '#pvSub', '[data-export="headline-sub"]']);
  const summaryEl = selectFirst(root, ['#executiveSummary', '#pvSummary', '[data-export="exec-summary"]']);

  let customer = textFromElement(customerEl);
  if (customer && customer.replace(/\s+/g, ' ').trim().toLowerCase() === 'customer') {
    customer = '';
  }
  const refText = textFromElement(refEl);
  const normalizedRef = refText ? refText.replace(/^ref:\s*/i, '').trim() : '';

  return {
    banner: capturePreviewBanner(doc),
    brand,
    customer,
    ref: normalizedRef,
    headlineMain: textFromElement(headlineEl),
    headlineSub: textFromElement(subHeadlineEl),
    executiveSummary: textFromElement(summaryEl, { preserveLineBreaks: true }),
    keyBenefits: collectKeyBenefitsFromPreview(root),
    features: collectFeaturesFromPreview(root),
    pricingTableHTML: collectPricingTableHTMLFromPreview(root, brand),
    priceCard: collectPriceCardFromPreview(root, brand),
    commercialTerms: collectCommercialTermsFromPreview(root),
  };
}

function toStyleMap(styleText) {
  const map = new Map();
  if (!styleText) {
    return map;
  }
  String(styleText)
    .split(';')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .forEach((chunk) => {
      const parts = chunk.split(':');
      if (!parts.length) {
        return;
      }
      const prop = parts.shift();
      if (!prop) {
        return;
      }
      const value = parts.join(':').trim();
      if (!value) {
        return;
      }
      map.set(prop.trim().toLowerCase(), value);
    });
  return map;
}

function styleMapToString(map) {
  return Array.from(map.entries())
    .map(([prop, value]) => `${prop}:${value}`)
    .join('; ');
}

function mergeStyleDeclarations(element, declarations) {
  if (!element || !declarations) {
    return;
  }
  const map = toStyleMap(element.getAttribute && element.getAttribute('style'));
  Object.entries(declarations).forEach(([prop, value]) => {
    if (value == null || value === '') {
      return;
    }
    map.set(prop.trim().toLowerCase(), value);
  });
  if (map.size) {
    element.setAttribute('style', styleMapToString(map));
  }
}

function inlineComputedStylesForElement(source, target, doc) {
  if (!source || !target) {
    return;
  }
  const view = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null);
  if (!view || typeof view.getComputedStyle !== 'function') {
    return;
  }
  let computed;
  try {
    computed = view.getComputedStyle(source);
  } catch (error) {
    computed = null;
  }
  if (!computed) {
    return;
  }
  const map = toStyleMap(target.getAttribute && target.getAttribute('style'));
  INLINE_STYLE_PROPERTIES.forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (!value) {
      return;
    }
    map.set(prop.toLowerCase(), value);
  });
  if (map.has('font-family')) {
    const fontValue = map.get('font-family');
    if (fontValue && !/sans-serif/i.test(fontValue)) {
      map.set('font-family', `${fontValue}, Arial, sans-serif`);
    }
  }
  target.setAttribute('style', styleMapToString(map));
}

function inlineComputedStylesTree(sourceRoot, targetRoot, doc) {
  if (!sourceRoot || !targetRoot) {
    return;
  }
  inlineComputedStylesForElement(sourceRoot, targetRoot, doc);
  if (!sourceRoot.children || !targetRoot.children) {
    return;
  }
  const len = Math.min(sourceRoot.children.length, targetRoot.children.length);
  for (let index = 0; index < len; index += 1) {
    inlineComputedStylesTree(sourceRoot.children[index], targetRoot.children[index], doc);
  }
}

function ensureEmailImageSizing(original, clone) {
  if (!clone || clone.tagName !== 'IMG') {
    return;
  }
  const rect = original && typeof original.getBoundingClientRect === 'function'
    ? original.getBoundingClientRect()
    : null;
  const widthCandidates = [
    rect?.width,
    Number(original?.width),
    Number(original?.naturalWidth),
    DEFAULT_IMAGE_WIDTH,
  ].filter((value) => Number.isFinite(value) && value > 0);
  let width = widthCandidates.length ? widthCandidates[0] : DEFAULT_IMAGE_WIDTH;
  width = clampWidth(width);
  if (width <= 0) {
    width = DEFAULT_IMAGE_WIDTH;
  }
  clone.setAttribute('width', String(Math.round(width)));
  if (typeof clone.removeAttribute === 'function') {
    clone.removeAttribute('height');
  }
  mergeStyleDeclarations(clone, {
    width: `${Math.round(width)}px`,
    height: 'auto',
    'max-width': '100%',
    display: 'block',
    border: '0',
    outline: 'none',
    'text-decoration': 'none',
  });
}

function dataUriToBinary(dataUri, mimeFallback = MIME_FALLBACK) {
  if (!dataUri || typeof dataUri !== 'string') {
    return null;
  }
  const match = dataUri.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    return null;
  }
  const mime = match[1] || mimeFallback || MIME_FALLBACK;
  const base64 = match[2] || '';
  try {
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.from(base64, 'base64');
      return { mime, content: new Uint8Array(buffer) };
    }
    const binary = typeof atob === 'function' ? atob(base64) : null;
    if (!binary) {
      return null;
    }
    const len = binary.length;
    const array = new Uint8Array(len);
    for (let index = 0; index < len; index += 1) {
      array[index] = binary.charCodeAt(index);
    }
    return { mime, content: array };
  } catch (error) {
    return null;
  }
}

function guessAttachmentFilename(src, index, mime) {
  const fallbackExt = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  let extension = fallbackExt[mime] || 'bin';
  let baseName = '';
  if (src) {
    const cleaned = String(src).split('?')[0].split('#')[0];
    const segments = cleaned.split('/');
    const last = segments.pop() || '';
    if (last && last.includes('.')) {
      const parts = last.split('.');
      const extCandidate = parts.pop();
      if (extCandidate) {
        extension = extCandidate.toLowerCase();
      }
      baseName = parts.join('.') || '';
    } else if (last) {
      baseName = last;
    }
  }
  if (!baseName) {
    baseName = 'preview-image';
  }
  baseName = baseName.replace(/[^a-z0-9_-]+/gi, '') || 'preview-image';
  return `${baseName}-${index}.${extension}`;
}

async function collectCidImagesFromPreview(sourceRoot, cloneRoot, warnings) {
  const attachments = [];
  if (!sourceRoot || !cloneRoot) {
    return attachments;
  }
  const sourceImages = Array.from(sourceRoot.querySelectorAll('img'));
  const cloneImages = Array.from(cloneRoot.querySelectorAll('img'));
  const len = Math.min(sourceImages.length, cloneImages.length);
  for (let index = 0; index < len; index += 1) {
    const original = sourceImages[index];
    const clone = cloneImages[index];
    const src = original?.currentSrc || original?.src || '';
    if (!src) {
      continue;
    }
    const data = await imgElementToDataURI(original, warnings);
    if (!data || !data.dataUri) {
      continue;
    }
    const binary = dataUriToBinary(data.dataUri, data.mime);
    if (!binary) {
      continue;
    }
    const cid = `img${index + 1}-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}@tbtc-vic-east`;
    clone.setAttribute('src', `cid:${cid}`);
    if (typeof clone.removeAttribute === 'function') {
      clone.removeAttribute('srcset');
    }
    ensureEmailImageSizing(original, clone);
    attachments.push({
      cid,
      mime: binary.mime,
      filename: guessAttachmentFilename(src, index + 1, binary.mime),
      content: binary.content,
    });
  }
  return attachments;
}

function ensureCommercialTermsSpacing(root) {
  if (!root || typeof root.querySelector !== 'function') {
    return;
  }
  const list = root.querySelector('[data-export="terms-dependencies"]');
  if (!list) {
    return;
  }
  mergeStyleDeclarations(list, {
    'list-style-type': 'disc',
    'margin': '6px 0 0 18px',
    'padding-left': '18px',
  });
  const items = Array.from(list.querySelectorAll('li'));
  items.forEach((item) => {
    mergeStyleDeclarations(item, {
      display: 'list-item',
      'margin-bottom': '6px',
    });
  });
}

function buildPreviewHtmlDocument(doc, clone, proposal) {
  const title = esc(proposal?.headlineMain || 'TBTC VIC EAST Proposal');
  const wrapper = doc && typeof doc.createElement === 'function' ? doc.createElement('div') : null;
  if (wrapper) {
    wrapper.appendChild(clone.cloneNode(true));
  }
  const previewHtml = wrapper ? wrapper.innerHTML : clone.outerHTML;
  const htmlLines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width,initial-scale=1">',
    `  <title>${title}</title>`,
    '</head>',
    `  <body style="margin:0; padding:32px; background-color:${esc(EMAIL_BODY_BACKGROUND)}; color:${esc(EMAIL_BODY_TEXT_COLOR)}; font-family:${esc(EMAIL_BODY_FONT_STACK)};">`,
    '    <div style="width:100%; display:flex; justify-content:center;">',
    `      ${previewHtml}`,
    '    </div>',
    '  </body>',
    '</html>',
  ];
  return htmlLines.join('\n');
}

function toUtf8Bytes(input) {
  const text = input == null ? '' : String(input);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(text, 'utf8');
    return new Uint8Array(buffer);
  }
  const utf8 = unescape(encodeURIComponent(text));
  const array = new Uint8Array(utf8.length);
  for (let index = 0; index < utf8.length; index += 1) {
    array[index] = utf8.charCodeAt(index);
  }
  return array;
}

function encodeQuotedPrintable(input) {
  const bytes = toUtf8Bytes(input);
  const hex = '0123456789ABCDEF';
  let line = '';
  let output = '';
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte === 0x0D && bytes[index + 1] === 0x0A) {
      output += line + '\r\n';
      line = '';
      index += 1;
      continue;
    }
    if (byte === 0x0A) {
      output += line + '\r\n';
      line = '';
      continue;
    }
    let chunk;
    if ((byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126)) {
      chunk = String.fromCharCode(byte);
    } else if (byte === 0x09 || byte === 0x20) {
      const nextByte = bytes[index + 1];
      if (index === bytes.length - 1 || nextByte === 0x0D || nextByte === 0x0A) {
        chunk = `=${hex[(byte >> 4) & 0x0F]}${hex[byte & 0x0F]}`;
      } else {
        chunk = String.fromCharCode(byte);
      }
    } else {
      chunk = `=${hex[(byte >> 4) & 0x0F]}${hex[byte & 0x0F]}`;
    }
    if (line.length + chunk.length > 75) {
      output += `${line}=\r\n`;
      line = '';
    }
    line += chunk;
  }
  if (line.length) {
    output += line;
  }
  return output;
}

function encodeBase64(uint8) {
  if (!uint8 || !uint8.length) {
    return '';
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < uint8.length; index += chunk) {
    const slice = uint8.subarray(index, index + chunk);
    binary += String.fromCharCode.apply(null, slice);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

function chunkBase64(uint8) {
  const base64 = encodeBase64(uint8);
  if (!base64) {
    return '';
  }
  const lines = [];
  for (let index = 0; index < base64.length; index += 76) {
    lines.push(base64.slice(index, index + 76));
  }
  return lines.join('\r\n');
}

function createBoundary(prefix = 'boundary') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeHeaderValue(value) {
  return String(value ?? '')
    .replace(/\r|\n/g, ' ')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTextFallbackFromProposal(proposal) {
  const lines = [];
  lines.push('TBTC VIC EAST Proposal');
  if (proposal?.customer) {
    lines.push(`Customer: ${proposal.customer}`);
  }
  if (proposal?.ref) {
    lines.push(`Reference: ${proposal.ref}`);
  }
  if (proposal?.headlineMain) {
    lines.push(`Headline: ${proposal.headlineMain}`);
  }
  if (proposal?.headlineSub) {
    lines.push(`Subheadline: ${proposal.headlineSub}`);
  }
  if (proposal?.executiveSummary) {
    lines.push('', proposal.executiveSummary);
  }
  if (Array.isArray(proposal?.keyBenefits) && proposal.keyBenefits.length) {
    lines.push('', 'Key benefits:');
    proposal.keyBenefits.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }
  const terms = String(proposal?.commercialTerms || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (terms.length) {
    lines.push('', 'Commercial terms & dependencies:');
    terms.forEach((term) => {
      lines.push(`- ${term}`);
    });
  }
  return lines.join('\r\n');
}

function buildEmailMetadata(proposal) {
  const now = new Date();
  const baseSubject = proposal?.customer
    ? `TBTC VIC EAST Proposal - ${proposal.customer}`
    : (proposal?.headlineMain ? `TBTC VIC EAST Proposal - ${proposal.headlineMain}` : 'TBTC VIC EAST Proposal');
  const subject = sanitizeHeaderValue(baseSubject);
  const toName = proposal?.customer ? sanitizeHeaderValue(proposal.customer) : 'Customer';
  const headers = {
    subject,
    from: 'TBTC VIC East <hello@tbtc-vic-east.com.au>',
    to: `${toName} <customer@example.com>`,
    date: now.toUTCString(),
    messageId: `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@tbtc-vic-east.local>`,
  };
  return {
    subject: sanitizeHeaderValue(headers.subject),
    from: sanitizeHeaderValue(headers.from),
    to: sanitizeHeaderValue(headers.to),
    date: sanitizeHeaderValue(headers.date),
    messageId: sanitizeHeaderValue(headers.messageId),
  };
}

function composeEmlMessage(metadata, html, text, attachments) {
  const relatedBoundary = createBoundary('rel');
  const alternativeBoundary = createBoundary('alt');
  const htmlPart = encodeQuotedPrintable(html || '');
  const textPart = encodeQuotedPrintable(text || '');
  const lines = [];
  lines.push(`From: ${metadata.from}`);
  lines.push(`To: ${metadata.to}`);
  lines.push(`Subject: ${metadata.subject}`);
  lines.push(`Date: ${metadata.date}`);
  lines.push(`Message-ID: ${metadata.messageId}`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/related; type="multipart/alternative"; boundary="${relatedBoundary}"`);
  lines.push('');
  lines.push(`--${relatedBoundary}`);
  lines.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
  lines.push('');
  lines.push(`--${alternativeBoundary}`);
  lines.push('Content-Type: text/plain; charset="utf-8"');
  lines.push('Content-Transfer-Encoding: quoted-printable');
  lines.push('');
  lines.push(textPart);
  lines.push('');
  lines.push(`--${alternativeBoundary}`);
  lines.push('Content-Type: text/html; charset="utf-8"');
  lines.push('Content-Transfer-Encoding: quoted-printable');
  lines.push('');
  lines.push(htmlPart);
  lines.push('');
  lines.push(`--${alternativeBoundary}--`);
  lines.push('');
  (attachments || []).forEach((attachment) => {
    lines.push(`--${relatedBoundary}`);
    lines.push(`Content-Type: ${attachment.mime}; name="${attachment.filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-ID: <${attachment.cid}>`);
    lines.push(`Content-Disposition: inline; filename="${attachment.filename}"`);
    lines.push('');
    lines.push(chunkBase64(attachment.content));
    lines.push('');
  });
  lines.push(`--${relatedBoundary}--`);
  lines.push('');
  return lines.join('\r\n');
}

async function generatePreviewEmailPackage(doc) {
  if (!doc || typeof doc.getElementById !== 'function') {
    throw new Error('A document is required to generate the preview email package');
  }
  const preview = doc.getElementById('preview-export');
  if (!preview) {
    throw new Error('Preview export container (#preview-export) not found');
  }
  const clone = preview.cloneNode(true);
  const warnings = new WarningCollector();
  inlineComputedStylesTree(preview, clone, doc);
  ensureCommercialTermsSpacing(clone);
  const attachments = await collectCidImagesFromPreview(preview, clone, warnings);
  const proposal = collectPreviewProposal(doc);
  const html = buildPreviewHtmlDocument(doc, clone, proposal);
  const text = buildTextFallbackFromProposal(proposal);
  return { html, text, attachments, proposal, warnings: warnings.toArray() };
}

async function generatePreviewEmailEml(rootDocument) {
  const doc = rootDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    throw new Error('A document is required to generate the preview email');
  }
  const { html, text, attachments, proposal, warnings } = await generatePreviewEmailPackage(doc);
  const metadata = buildEmailMetadata(proposal);
  const eml = composeEmlMessage(metadata, html, text, attachments);
  return { eml, html, text, attachments, proposal, headers: metadata, warnings };
}

async function generateEmailExport(rootDocument) {
  const doc = rootDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    throw new Error('A document is required to generate the email export');
  }
  const proposal = collectPreviewProposal(doc);
  const result = await buildEmailExportHTML(proposal);
  return { html: result?.html || '' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateEmailExport,
    generatePreviewEmailPackage,
    generatePreviewEmailEml,
    // exporting helpers for potential testing
    __private: {
      sanitizeHTML,
      renderFeatureCard,
      renderKeyBenefits,
      inlineAllRasterImages,
      imgElementToDataURI,
      inlineBackgroundImage,
      buildEmailExportHTML,
      inlineComputedStylesTree,
      encodeQuotedPrintable,
      chunkBase64,
      composeEmlMessage,
      dataUriToBinary,
      buildPreviewHtmlDocument,
      buildTextFallbackFromProposal,
      buildEmailMetadata,
      generatePreviewEmailPackage,
      buildPreviewMirroredEmailHTML,
      buildLegacyEmailExportHTML,
      collectPreviewProposal,
    },
  };
}

if (typeof window !== 'undefined') {
  window.PropBuilderEmailExport = window.PropBuilderEmailExport || {};
  window.PropBuilderEmailExport.generateEmailExport = generateEmailExport;
  window.PropBuilderEmailExport.generatePreviewEmailEml = generatePreviewEmailEml;
}
