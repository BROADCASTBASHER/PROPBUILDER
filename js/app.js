function parseSize(input, fallbackWidth = 1000, fallbackHeight = 300) {
  const result = [Number(fallbackWidth) || 1000, Number(fallbackHeight) || 300];
  if (input == null) {
    return result;
  }
  if (Array.isArray(input) && input.length >= 2) {
    const width = Number.parseInt(input[0], 10);
    const height = Number.parseInt(input[1], 10);
    return [Number.isFinite(width) ? width : result[0], Number.isFinite(height) ? height : result[1]];
  }
  const raw = String(input).trim().toLowerCase();
  if (!raw) {
    return result;
  }
  const match = raw.match(/^(\d+)(?:\s*[x×]\s*(\d+))?$/);
  if (!match) {
    return result;
  }
  const width = Number.parseInt(match[1], 10);
  const height = match[2] ? Number.parseInt(match[2], 10) : width;
  return [Number.isFinite(width) ? width : result[0], Number.isFinite(height) ? height : (Number.isFinite(width) ? width : result[1])];
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapTextLines(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  if (!ctx || typeof ctx.fillText !== 'function' || typeof ctx.measureText !== 'function') {
    return;
  }
  const safeText = String(text == null ? '' : text);
  if (!safeText) {
    return;
  }
  const limit = Number.isFinite(maxLines) && maxLines > 0 ? Math.floor(maxLines) : Number.POSITIVE_INFINITY;
  const ellipsis = '…';
  const segments = [];
  const normalised = safeText.replace(/\r\n/g, '\n');
  const parts = normalised.split('\n');
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.length === 0) {
      segments.push({ type: 'break' });
    } else {
      const tokens = part.match(/\S+\s*/g) || [];
      for (const token of tokens) {
        segments.push({ type: 'token', value: token });
      }
    }
    if (i < parts.length - 1) {
      segments.push({ type: 'break' });
    }
  }

  let current = '';
  let lineIndex = 0;

  function commit(line) {
    ctx.fillText(line, x, y + (lineIndex * lineHeight));
    lineIndex += 1;
  }

  function truncateLast(token) {
    const base = current.trimEnd();
    const rawAddition = token ? token.trim() : '';
    if (!base && !rawAddition) {
      commit(ellipsis);
      return;
    }
    if (rawAddition) {
      let keepLength = rawAddition.length;
      const prefix = base ? `${base}` : '';
      while (keepLength > 1) {
        const attempt = rawAddition.slice(0, keepLength);
        const preview = prefix ? `${prefix} ${attempt}${ellipsis}` : `${attempt}${ellipsis}`;
        if (ctx.measureText(preview).width <= maxWidth) {
          break;
        }
        keepLength -= 1;
      }
      const kept = rawAddition.slice(0, Math.max(1, keepLength));
      const finalLine = prefix ? `${prefix} ${kept}${ellipsis}` : `${kept}${ellipsis}`;
      commit(finalLine);
      return;
    }
    let reduced = base;
    while (reduced && ctx.measureText(`${reduced}${ellipsis}`).width > maxWidth) {
      reduced = reduced.slice(0, -1);
    }
    const finalLine = reduced ? `${reduced}${ellipsis}` : ellipsis;
    commit(finalLine);
  }

  for (const segment of segments) {
    if (lineIndex >= limit) {
      break;
    }
    if (segment.type === 'break') {
      if (current) {
        commit(current);
        current = '';
      } else if (lineIndex < limit) {
        commit('');
      }
      continue;
    }
    const token = segment.value;
    const candidate = current + token;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (lineIndex === limit - 1) {
      truncateLast(token);
      current = '';
      break;
    }
    commit(current);
    current = token.replace(/^\s+/, '');
  }

  if (lineIndex < limit && current) {
    commit(current);
  }
}

const TRANSPARENT_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

const PRESETS = {
  sand: { bg: '#FAF7F3', panel: '#E5E6EA', accent: '#F6F0E8', headline: '#1065FF', logo: 'Primary (Blue/Coral)' },
  sky: { bg: '#1065FF', panel: '#E5E6EA', accent: '#0A4ED1', headline: '#FFFFFF', logo: 'Primary (Mono White)' },
  coral: { bg: '#F66A51', panel: '#E5E6EA', accent: '#E95A44', headline: '#FFFFFF', logo: 'Primary (Mono White)' },
  navy: { bg: '#122B5C', panel: '#E5E6EA', accent: '#0F244E', headline: '#FFFFFF', logo: 'Primary on Blue (White T)' },
  ink: { bg: '#0B1220', panel: '#2C3440', accent: '#121A27', headline: '#FFFFFF', logo: 'Primary on Blue (White T)' }
};

const LOGO_ALIASES = {
  'Mono – White': 'Primary (Mono White)',
  'Mono – Black': 'Primary (Mono Black)',
  'Primary (Blue/Coral)': 'Primary (Blue/Coral)',
  'Primary on Blue (White T)': 'Primary on Blue (White T)',
  'Primary on Coral (White T)': 'Primary on Coral (White T)'
};

const LOGO_DISPLAY_NAMES = {
  'Primary (Blue/Coral)': 'Primary (Blue/Coral)',
  'Primary (Mono Black)': 'Mono – Black',
  'Primary (Mono White)': 'Mono – White',
  'Primary on Blue (White T)': 'Primary on Blue (White T)',
  'Primary on Coral (White T)': 'Primary on Coral (White T)'
};

const ICON_SIZE_MIN = 40;
const ICON_SIZE_MAX = 160;
const HERO_ICON_SIZE_MAX = 220;

function clampIconSizeValue(value, heroMode) {
  const numeric = Number(value);
  const fallback = heroMode ? 96 : 56;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const upper = heroMode ? HERO_ICON_SIZE_MAX : ICON_SIZE_MAX;
  return Math.max(ICON_SIZE_MIN, Math.min(upper, numeric));
}

const logoAspectCache = new Map();

const FEATURE_LIBRARY = [
  {
    t: 'Cloud-based flexibility (TIPT)',
    c: 'Eliminate on-site PBX hardware with a scalable Telstra TIPT platform managed in the cloud.',
    icon: 'pictoRecurringPayment104.png',
    hero: true,
    size: 80
  },
  {
    t: 'Cisco 9861 IP handsets',
    c: 'Colour display, HD audio and multi-line support give staff an intuitive desk experience.',
    icon: 'CISCO 9861.jpg',
    size: 96
  },
  {
    t: 'Meraki MX67 cloud security & Wi-Fi',
    c: 'Cloud-managed security appliance with integrated Wi-Fi delivers SD-WAN, threat management and easy dashboard control.',
    icon: 'MX67.jpg',
    size: 96
  },
  {
    t: 'Webex collaboration across devices',
    c: 'Persistent messaging, meetings and calling keep your team connected anywhere on any device.',
    icon: 'Webex.jpg',
    size: 96
  },
  {
    t: 'Managed install & training',
    c: 'Certified engineers configure call flows, port numbers and deliver tailored adoption sessions.',
    icon: 'pictoGetInTouch104.png',
    size: 68
  },
  {
    t: 'Simple monthly billing',
    c: 'Predictable pricing with unlimited AU calling and a contract that matches your preferred term.',
    icon: 'pictoPaymentPlan104.png',
    size: 64
  },
  {
    t: 'Adoption support & care',
    c: 'Change management resources and live support help staff embrace the new collaboration tools.',
    icon: 'pictoAdultFemale104.png',
    size: 64
  }
];

const DEFAULT_PRICING_ITEMS = [
  { label: 'TIPT Cloud Voice – Unlimited AU calls (Local/STD/Mobile)', qty: 6, unit: 'user', price: 0 },
  { label: 'Cisco 9861 IP Phone (Colour Screen)', qty: 5, unit: 'device', price: 0 },
  { label: 'Webex App (PC/Mobile) – Included with licences', qty: 6, unit: 'user', price: 0 },
  { label: 'Professional install, programming & call-flow setup', qty: 1, unit: 'project', price: 0 }
];

const MAX_FEATURES = 12;
const DEFAULT_DOC_TYPE = 'two';
const DEFAULT_GST_MODE = 'ex';
const DEFAULT_MONTHLY = 716;
const DEFAULT_TERM = 36;
const DEFAULT_BANNER_TEXT = 'Cloud voice for modern schools & businesses';

const state = {
  preset: 'navy',
  banner: {
    text: DEFAULT_BANNER_TEXT,
    bold: true,
    textSize: 1,
    layout: 'left',
    size: '1000x300',
    fit: 'contain',
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    logoMode: 'auto'
  },
  docType: DEFAULT_DOC_TYPE,
  features: [],
  pricing: {
    gst: DEFAULT_GST_MODE,
    items: [],
    monthly: DEFAULT_MONTHLY,
    term: DEFAULT_TERM
  }
};

if (typeof window !== 'undefined') {
  window.state = state;
  window._features = state.features;
}

let bannerPanelImage = null;

const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
  if (typeof FileReader !== 'function') {
    reject(new Error('FileReader is not supported'));
    return;
  }
  const reader = new FileReader();
  reader.onloadend = () => {
    resolve(typeof reader.result === 'string' ? reader.result : '');
  };
  reader.onerror = () => {
    reject(reader.error || new Error('Failed to read blob as data URL'));
  };
  reader.readAsDataURL(blob);
});

const defaultFetchImageAsDataUrl = (url) => {
  const attempts = [];
  if (typeof fetch === 'function') {
    attempts.push(() => fetch(url, { mode: 'cors', credentials: 'omit' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unexpected response status: ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => readBlobAsDataUrl(blob)));
  }
  if (typeof XMLHttpRequest === 'function') {
    attempts.push(() => new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = () => {
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            let responseBlob = null;
            if (typeof Blob === 'function') {
              responseBlob = xhr.response instanceof Blob ? xhr.response : new Blob([xhr.response]);
            }
            if (responseBlob) {
              readBlobAsDataUrl(responseBlob).then(resolve).catch(reject);
            } else {
              reject(new Error('Blob API is not supported for image conversion'));
            }
          } else {
            reject(new Error(`Unexpected XHR status: ${xhr.status}`));
          }
        };
        xhr.onerror = () => {
          reject(new Error('XHR network error while fetching image'));
        };
        xhr.send();
      } catch (error) {
        reject(error);
      }
    }));
  }
  if (!attempts.length) {
    return Promise.reject(new Error('No supported fetch mechanisms available'));
  }
  let chain = attempts[0]();
  for (let i = 1; i < attempts.length; i += 1) {
    const nextAttempt = attempts[i];
    chain = chain.catch(() => nextAttempt());
  }
  return chain;
};

let fetchImageAsDataUrlImpl = defaultFetchImageAsDataUrl;

function bulletify(input) {
  const lines = String(input == null ? '' : input)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) {
    return '';
  }
  return lines.map((line) => `<li>${esc(line)}</li>`).join('');
}

function __rgbToHex__px(color) {
  const match = String(color == null ? '' : color).match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!match) {
    return color ? String(color) : '#E5E6EA';
  }
  const toHex = (value) => {
    const clamped = Math.max(0, Math.min(255, Number.parseInt(value, 10) || 0));
    const hex = clamped.toString(16).toUpperCase();
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function readJSONFromStorage(key, fallback) {
  if (typeof localStorage === 'undefined') {
    return Array.isArray(fallback) ? fallback.slice() : fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return Array.isArray(fallback) ? fallback.slice() : fallback;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return Array.isArray(fallback) ? fallback.slice() : fallback;
  } catch (error) {
    return Array.isArray(fallback) ? fallback.slice() : fallback;
  }
}

function normaliseCard(card) {
  if (!card || typeof card !== 'object') {
    return null;
  }
  const title = String(card.t ?? card.title ?? '').trim();
  const copy = String(card.c ?? card.copy ?? '').trim();
  const image = String(card.img ?? card.image ?? '').trim();
  const size = card.size ?? card.dimensions ?? card.imgSize ?? '';
  const [width, height] = parseSize(size, 320, 180);
  const hero = Boolean(card.hero);
  if (!title && !copy && !image) {
    return null;
  }
  return { title, copy, image, width, height, hero };
}

function readHeroCards() {
  const cards = readJSONFromStorage('heroCards', []);
  if (!Array.isArray(cards) || !cards.length) {
    if (typeof window !== 'undefined' && Array.isArray(window._heroCards)) {
      return window._heroCards.map(normaliseCard).filter(Boolean);
    }
    return [];
  }
  return cards.map(normaliseCard).filter(Boolean);
}

function readFeatures() {
  const features = [];
  if (typeof window !== 'undefined' && Array.isArray(window._features)) {
    for (const feature of window._features) {
      const normalised = normaliseCard(feature);
      if (normalised) {
        features.push(normalised);
      }
    }
  }
  return features;
}

function getPanelColor() {
  try {
    const preferred = document.querySelector('#tab-preview .price-card, #tab-preview .preview-box, #pvPriceCard, .price-card');
    if (preferred) {
      const computed = typeof getComputedStyle === 'function' ? getComputedStyle(preferred).backgroundColor : null;
      if (computed) {
        return __rgbToHex__px(computed);
      }
    }
  } catch (error) {
    // ignore lookup errors
  }
  try {
    if (typeof PRESETS !== 'undefined' && typeof state !== 'undefined') {
      const preset = PRESETS && state && PRESETS[state.preset];
      if (preset && preset.panel) {
        return preset.panel;
      }
    }
  } catch (error) {
    // ignore preset lookup errors
  }
  return '#E5E6EA';
}

function getPriceRows() {
  if (typeof document === 'undefined') {
    return [];
  }
  const table = document.getElementById('priceTableView');
  if (!table || typeof table.querySelectorAll !== 'function') {
    return [];
  }
  const rows = [];
  const trList = table.querySelectorAll('tbody tr');
  if (!trList) {
    return [];
  }
  for (const row of trList) {
    if (!row || typeof row.querySelectorAll !== 'function') {
      continue;
    }
    const cells = row.querySelectorAll('td');
    if (!cells || !cells.length) {
      continue;
    }
    rows.push(Array.from(cells).map((cell) => esc(cell && cell.textContent ? cell.textContent.trim() : '')));
  }
  return rows;
}

function getHeroImageData() {
  if (typeof document === 'undefined') {
    return '';
  }
  const canvas = document.getElementById('banner');
  if (canvas && typeof canvas.toDataURL === 'function') {
    try {
      const data = canvas.toDataURL('image/png');
      if (data) {
        return data;
      }
    } catch (error) {
      // ignore canvas export issues
    }
  }
  const img = document.querySelector('#tab-preview .hero img, #pageBanner, #pageBanner2, img#heroPreview');
  if (img && img.src) {
    return img.src;
  }
  return '';
}




async function buildEmailHTML() {
  if (typeof document === 'undefined') {
    return '';
  }

  const doc = document;
  const fontData = 'd09GMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  const presetKey = state && state.preset;
  const preset = (PRESETS && presetKey && PRESETS[presetKey]) || (PRESETS && PRESETS.navy) || { bg: '#FAF7F3', panel: '#FFFFFF', headline: '#122B5C' };
  const backgroundColor = preset && preset.bg ? preset.bg : '#FAF7F3';
  const headlineColor = preset && preset.headline ? preset.headline : '#122B5C';
  const panelBorderColor = '#DDE2F3';
  const panelBackground = '#FFFFFF';
  const baseFontStack = "'TelstraText',-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
  const baseFontFamily = `font-family:${baseFontStack};`;
  const baseTextColor = '#273349';
  const mutedTextColor = '#5B6573';
  const imageCache = new Map();

  const safe = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const normalise = (value) => String(value == null ? '' : value).replace(/\r\n/g, '\n');

  const findExportNode = (name, fallbackSelector) => {
    if (!name) {
      return fallbackSelector ? doc.querySelector(fallbackSelector) : null;
    }
    return doc.querySelector(`[data-export="${name}"]`) || (fallbackSelector ? doc.querySelector(fallbackSelector) : null);
  };

  const textFrom = (name, fallbackSelector) => {
    const node = findExportNode(name, fallbackSelector);
    if (!node || typeof node.textContent !== 'string') {
      return '';
    }
    return normalise(node.textContent).trim();
  };

  const listFrom = (name, fallbackSelector) => {
    const container = findExportNode(name, fallbackSelector);
    if (!container) {
      return [];
    }
    const items = Array.from(container.querySelectorAll('li'))
      .map((item) => normalise(item.textContent).trim())
      .filter((item) => item.length > 0);
    if (items.length) {
      return items;
    }
    const fallbackText = normalise(container.textContent).trim();
    if (!fallbackText) {
      return [];
    }
    return fallbackText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  };

  const measureWidth = (element, fallback) => {
    if (!element) {
      return fallback || 0;
    }
    if (typeof element.getBoundingClientRect === 'function') {
      const rect = element.getBoundingClientRect();
      if (rect && rect.width) {
        return Math.round(rect.width);
      }
    }
    if (typeof getComputedStyle === 'function') {
      const computed = getComputedStyle(element);
      if (computed && computed.width) {
        const numeric = Number.parseFloat(computed.width);
        if (Number.isFinite(numeric) && numeric > 0) {
          return Math.round(numeric);
        }
      }
    }
    if (element.style && element.style.width) {
      const match = element.style.width.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const numeric = Number.parseFloat(match[1]);
        if (Number.isFinite(numeric)) {
          return Math.round(numeric);
        }
      }
    }
    if (element.width && Number.isFinite(Number(element.width))) {
      return Number(element.width);
    }
    return fallback || 0;
  };

  const guessMimeFromUrl = (url) => {
    const lower = String(url || '').split('?')[0].toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp';
    }
    return 'image/png';
  };

  const fetchImageAsDataUrl = (url) => fetchImageAsDataUrlImpl(url);

  const toDataUri = async (img, source) => {
    const rawSrc = source || (img ? (img.currentSrc || img.src) : '');
    if (!rawSrc) {
      return null;
    }
    if (String(rawSrc).startsWith('data:')) {
      return rawSrc;
    }

    let absolute = rawSrc;
    try {
      const base = (doc && (doc.baseURI || doc.URL)) || (typeof window !== 'undefined' && window.location ? window.location.href : undefined);
      absolute = base ? new URL(rawSrc, base).href : new URL(rawSrc).href;
    } catch (error) {
      absolute = rawSrc;
    }

    const cacheKeys = [rawSrc, absolute].filter((value, index, array) => value && array.indexOf(value) === index);
    for (const key of cacheKeys) {
      if (imageCache.has(key)) {
        return imageCache.get(key);
      }
    }

    const remember = (value) => {
      cacheKeys.forEach((key) => {
        imageCache.set(key, value);
      });
      return value;
    };

    const waitForDecode = async () => {
      if (!img) {
        return;
      }
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
          return;
        } catch (error) {
          // ignore decode errors and fall back to load events
        }
      }
      const complete = typeof img.complete === 'boolean' ? img.complete : true;
      if (complete) {
        return;
      }
      if (typeof img.addEventListener !== 'function') {
        return;
      }
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          if (typeof img.removeEventListener === 'function') {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
          }
        };
        const onLoad = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('decode-failed'));
        };
        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onError, { once: true });
      }).catch(() => {});
    };

    const fallbackToCanvas = async () => {
      if (!img || !doc || typeof doc.createElement !== 'function') {
        return null;
      }
      try {
        await waitForDecode();
      } catch (error) {
        // ignore decode errors
      }
      const width = Number(img.naturalWidth || img.width || 0);
      const height = Number(img.naturalHeight || img.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
      }
      try {
        const canvas = doc.createElement('canvas');
        if (!canvas) {
          return null;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d', { willReadFrequently: true }) : null;
        if (!ctx || typeof ctx.drawImage !== 'function') {
          return null;
        }
        ctx.drawImage(img, 0, 0, width, height);
        if (typeof canvas.toDataURL !== 'function') {
          return null;
        }
        const data = canvas.toDataURL(guessMimeFromUrl(absolute));
        if (data && typeof data === 'string' && data.startsWith('data:')) {
          return remember(data);
        }
      } catch (error) {
        // ignore canvas failures
      }
      return null;
    };

    const tryDirectFetch = async () => {
      if (typeof fetch !== 'function') {
        return null;
      }
      try {
        const response = await fetch(absolute, { cache: 'force-cache' });
        if (!response || !response.ok) {
          return null;
        }
        const mime = (response.headers && response.headers.get && response.headers.get('content-type')) || 'application/octet-stream';
        if (typeof FileReader === 'function') {
          const blob = await response.blob();
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(new Error('read-failed'));
            reader.readAsDataURL(blob);
          });
          if (data && data.startsWith('data:')) {
            return data;
          }
          return null;
        }
        if (typeof Buffer !== 'undefined') {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const data = `data:${mime};base64,${base64}`;
          if (data && data.startsWith('data:')) {
            return data;
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    };

    const tryHelperFetch = async () => {
      try {
        const result = await fetchImageAsDataUrl(absolute);
        if (result && typeof result === 'string' && result.startsWith('data:')) {
          return result;
        }
      } catch (error) {
        // ignore helper errors
      }
      return null;
    };

    let dataUri = await tryDirectFetch();
    if (!dataUri) {
      dataUri = await tryHelperFetch();
    }
    if (dataUri) {
      return remember(dataUri);
    }

    const canvasResult = await fallbackToCanvas();
    if (canvasResult) {
      return canvasResult;
    }

    return remember(null);
  };

  const imageFromElement = async (img, options = {}) => {
    if (!img) {
      return null;
    }
    const src = img.currentSrc || img.src || '';
    if (!src) {
      return null;
    }
    const dataUri = await toDataUri(img, src);
    if (!dataUri) {
      if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
        console.warn('Unable to inline image for export; omitting from output', src);
      }
      return null;
    }
    const width = options.width || measureWidth(img, options.fallbackWidth || 0) || (img.naturalWidth ? Math.min(img.naturalWidth, 320) : 0);
    const alt = img.alt ? img.alt.trim() : '';
    return { src: dataUri, width, alt };
  };

  const extractFeatureCard = async (node) => {
    if (!node) {
      return null;
    }
    const titleNode = node.querySelector('[data-export-feature-title]');
    const copyNodes = Array.from(node.querySelectorAll('[data-export-feature-copy]'));
    const listNode = node.querySelector('[data-export-feature-list]');
    const iconNode = node.querySelector('[data-export-feature-image]');
    const iconWrap = iconNode ? iconNode.parentElement : null;
    const title = titleNode ? normalise(titleNode.textContent).trim() : '';
    const copy = copyNodes.map((el) => normalise(el.textContent).trim()).filter((value) => value.length > 0);
    const bullets = listNode
      ? Array.from(listNode.querySelectorAll('li')).map((el) => normalise(el.textContent).trim()).filter((value) => value.length > 0)
      : [];
    const image = iconNode ? await imageFromElement(iconNode, { width: measureWidth(iconWrap, 72), fallbackWidth: 72 }) : null;
    if (!title && !copy.length && !bullets.length && !image) {
      return null;
    }
    return { title, copy, bullets, image };
  };

  const collectFeatureCards = async (selector) => {
    const nodes = Array.from(doc.querySelectorAll(selector));
    const results = [];
    for (const node of nodes) {
      const card = await extractFeatureCard(node);
      if (card) {
        results.push(card);
      }
    }
    return results;
  };

  const renderFeatureCard = (feature, options = {}) => {
    const { hero = false } = options;
    const parts = [];
    parts.push('<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border:1px solid #E7E7EA;border-radius:14px;background:#FFFFFF;">');
    parts.push('<tr>');
    if (feature.image && feature.image.src) {
      const width = Math.max(48, feature.image.width || (hero ? 96 : 64));
      parts.push(`<td valign="top" style="padding:14px 12px 14px 14px;width:${width}px;">`);
      parts.push(`<img src="${feature.image.src}" alt="${safe(feature.image.alt || feature.title || 'Feature image')}" width="${width}" style="width:${width}px;height:auto;display:block;border:0;">`);
      parts.push('</td>');
    } else {
      parts.push('<td valign="top" style="padding:14px 0 14px 0;width:0;"></td>');
    }
    parts.push('<td valign="top" style="padding:14px 18px 14px 12px;">');
    if (feature.title) {
      const size = hero ? 20 : 18;
      parts.push(`<div style="${baseFontFamily}font-weight:700;font-size:${size}px;color:${headlineColor};margin:0 0 6px;">${safe(feature.title)}</div>`);
    }
    feature.copy.forEach((line, index) => {
      parts.push(`<div style="${baseFontFamily}color:${baseTextColor};font-size:16px;line-height:1.6;margin:${index === 0 && !feature.title ? '0' : '8px 0 0'};">${safe(line)}</div>`);
    });
    if (feature.bullets.length) {
      parts.push(`<ul style="${baseFontFamily}color:${baseTextColor};font-size:16px;line-height:1.6;margin:${feature.copy.length ? '12px 0 0' : '0'};padding-left:20px;">${feature.bullets.map((item) => `<li style="margin:0 0 6px;">${safe(item)}</li>`).join('')}</ul>`);
    }
    parts.push('</td>');
    parts.push('</tr>');
    parts.push('</table>');
    return parts.join('');
  };

  const renderFeatureGroup = (features, options = {}) => {
    if (!features.length) {
      return '';
    }
    const rows = [];
    rows.push('<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">');
    features.forEach((feature, index) => {
      rows.push(`<tr><td style="padding:${index === 0 ? '0' : '16px'} 0 0;">${renderFeatureCard(feature, options)}</td></tr>`);
    });
    rows.push('</table>');
    return rows.join('');
  };

  const pricingTableMarkup = (() => {
    const table = findExportNode('pricing-table', '#priceTableView');
    if (!table) {
      return '';
    }
    const headerCells = Array.from(table.querySelectorAll('thead th'));
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    if (!headerCells.length || !bodyRows.length) {
      return '';
    }
    const headerHtml = headerCells.map((cell) => `<th style="${baseFontFamily}font-size:15px;font-weight:700;color:${headlineColor};background:#F6F8FB;border-bottom:1px solid #E7E7EA;padding:12px 10px;text-align:left;">${safe(normalise(cell.textContent).trim())}</th>`).join('');
    const rowsHtml = bodyRows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (!cells.length) {
        return '';
      }
      const cellHtml = cells.map((cell) => `<td style="${baseFontFamily}font-size:15px;color:${baseTextColor};line-height:1.6;border-bottom:1px solid #E7E7EA;padding:12px 10px;vertical-align:top;">${safe(normalise(cell.textContent).trim()).replace(/\n/g, '<br>')}</td>`).join('');
      return `<tr>${cellHtml}</tr>`;
    }).join('');
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #E7E7EA;border-radius:14px;overflow:hidden;">` + `<thead><tr>${headerHtml}</tr></thead>` + `<tbody>${rowsHtml}</tbody></table>`;
  })();

  const bannerCanvas = findExportNode('banner-canvas', '#banner');
  let bannerData = '';
  if (bannerCanvas && typeof bannerCanvas.toDataURL === 'function') {
    try {
      bannerData = bannerCanvas.toDataURL('image/png', 1.0);
    } catch (error) {
      bannerData = '';
    }
  }
  if (!bannerData) {
    const bannerImg = findExportNode('banner-image', '#pageBanner');
    const fallbackBanner = bannerImg ? await imageFromElement(bannerImg, { width: 640, fallbackWidth: 640 }) : null;
    bannerData = fallbackBanner && fallbackBanner.src ? fallbackBanner.src : '';
  }

  const customer = textFrom('customer', '#pvCustomer');
  const referenceRaw = textFrom('ref', '#pvRef');
  const reference = referenceRaw
    ? (referenceRaw.toLowerCase().startsWith('ref') ? referenceRaw : `Ref: ${referenceRaw}`)
    : '';
  const mainHeadline = textFrom('headline-main', '#pvHero');
  const subHeadline = textFrom('headline-sub', '#pvSub');
  const summaryText = textFrom('exec-summary', '#pvSummary');
  const keyBenefits = listFrom('key-benefits', '#pvBenefits');
  const standardFeatures = await collectFeatureCards('[data-export="features-standard"] [data-export-feature="card"][data-export-feature-type="standard"]');
  const heroFeatures = await collectFeatureCards('[data-export="features-hero"] [data-export-feature="card"]');
  const priceAmount = textFrom('price-amount', '#pvMonthly');
  const priceTerm = textFrom('price-term', '#pvTerm2');
  const terms = listFrom('terms-dependencies', '#assumptions');
  const priceCardNode = findExportNode('price-card');
  const priceLabel = priceCardNode && priceCardNode.children && priceCardNode.children[0] && priceCardNode.children[0].textContent
    ? normalise(priceCardNode.children[0].textContent).trim()
    : 'Monthly investment';
  const priceComputed = priceCardNode && typeof getComputedStyle === 'function' ? getComputedStyle(priceCardNode) : null;
  const priceBackground = __rgbToHex__px((priceComputed && priceComputed.backgroundColor) || (priceCardNode && priceCardNode.style && priceCardNode.style.backgroundColor) || '#FFFFFF');
  const priceBorderColor = __rgbToHex__px((priceComputed && priceComputed.borderColor) || (priceCardNode && priceCardNode.style && priceCardNode.style.borderColor) || '#F6F0E8');
  const priceBorderWidth = (priceComputed && priceComputed.borderTopWidth) || (priceCardNode && priceCardNode.style && priceCardNode.style.borderWidth) || '2px';
  const priceBorderRadius = (priceComputed && priceComputed.borderRadius) || (priceCardNode && priceCardNode.style && priceCardNode.style.borderRadius) || '16px';

  const summaryParagraphs = normalise(summaryText).split(/\n{2,}/).map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0);

  const contentWidth = 640;
  const modules = [];

  if (bannerData) {
    modules.push(`<tr><td style="padding:0;margin:0;"><img src="${bannerData}" alt="Proposal banner" width="${contentWidth}" style="width:100%;max-width:${contentWidth}px;height:auto;display:block;border:0;"></td></tr>`);
  }

  const headerParts = [];
  if (customer) {
    headerParts.push(`<div style="${baseFontFamily}font-size:20px;font-weight:800;color:${headlineColor};margin:0 0 10px;">${safe(customer)}</div>`);
  }
  if (reference) {
    headerParts.push(`<div style="margin:0 0 16px;">` + `<span style="${baseFontFamily}font-size:13px;font-weight:600;color:${headlineColor};background:#EEF2FF;border:1px solid #E0E7FF;border-radius:999px;padding:5px 12px;display:inline-block;">${safe(reference)}</span>` + `</div>`);
  }
  if (mainHeadline) {
    headerParts.push(`<div style="${baseFontFamily}font-size:26px;font-weight:800;color:${headlineColor};margin:0 0 8px;">${safe(mainHeadline)}</div>`);
  }
  if (subHeadline) {
    headerParts.push(`<div style="${baseFontFamily}font-size:18px;font-weight:500;color:${mutedTextColor};margin:0 0 4px;">${safe(subHeadline)}</div>`);
  }
  if (headerParts.length) {
    modules.push(`<tr><td style="padding:${modules.length ? '28px' : '32px'} 32px 0;">${headerParts.join('')}</td></tr>`);
  }

  if (summaryParagraphs.length || keyBenefits.length) {
    const overviewParts = [];
    overviewParts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">');
    overviewParts.push('<tr>');
    overviewParts.push('<td valign="top" style="padding:0 12px 0 0;width:50%;">');
    overviewParts.push(`<div style="${baseFontFamily}font-size:18px;font-weight:700;color:${headlineColor};margin:0 0 10px;">Executive summary</div>`);
    if (summaryParagraphs.length) {
      summaryParagraphs.forEach((paragraph, index) => {
        overviewParts.push(`<div style="${baseFontFamily}color:${baseTextColor};font-size:16px;line-height:1.6;margin:${index === 0 ? '0' : '12px 0 0'};">${safe(paragraph).replace(/\n/g, '<br>')}</div>`);
      });
    } else {
      overviewParts.push(`<div style="${baseFontFamily}color:${mutedTextColor};font-size:16px;line-height:1.6;margin:0;">&nbsp;</div>`);
    }
    overviewParts.push('</td>');
    overviewParts.push('<td valign="top" style="padding:0 0 0 12px;width:50%;">');
    overviewParts.push(`<div style="${baseFontFamily}font-size:18px;font-weight:700;color:${headlineColor};margin:0 0 10px;">Key benefits</div>`);
    if (keyBenefits.length) {
      overviewParts.push(`<ul style="${baseFontFamily}color:${baseTextColor};font-size:16px;line-height:1.6;margin:0;padding-left:20px;">${keyBenefits.map((item) => `<li style="margin:0 0 8px;">${safe(item)}</li>`).join('')}</ul>`);
    } else {
      overviewParts.push(`<div style="${baseFontFamily}color:${mutedTextColor};font-size:16px;line-height:1.6;">&nbsp;</div>`);
    }
    overviewParts.push('</td>');
    overviewParts.push('</tr>');
    overviewParts.push('</table>');
    modules.push(`<tr><td style="padding:${modules.length ? '28px' : '32px'} 32px 0;">${overviewParts.join('')}</td></tr>`);
  }

  if (standardFeatures.length) {
    const featureBlock = [];
    featureBlock.push(`<div style="${baseFontFamily}font-size:22px;font-weight:700;color:${headlineColor};margin:0 0 16px;">Features &amp; benefits</div>`);
    featureBlock.push(renderFeatureGroup(standardFeatures, { hero: false }));
    modules.push(`<tr><td style="padding:28px 32px 0;">${featureBlock.join('')}</td></tr>`);
  }

  if (heroFeatures.length) {
    modules.push(`<tr><td style="padding:32px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #E5E6EA;height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>`);
    const heroBlock = [];
    heroBlock.push(`<div style="${baseFontFamily}font-size:22px;font-weight:700;color:${headlineColor};margin:0 0 16px;">Key Features Included</div>`);
    heroBlock.push(renderFeatureGroup(heroFeatures, { hero: true }));
    modules.push(`<tr><td style="padding:24px 32px 0;">${heroBlock.join('')}</td></tr>`);
  }

  const pricingBlock = [];
  pricingBlock.push(`<div style="${baseFontFamily}font-size:24px;font-weight:800;color:${headlineColor};margin:0 0 18px;">Inclusions &amp; pricing breakdown</div>`);
  if (pricingTableMarkup) {
    pricingBlock.push(pricingTableMarkup);
  }
  if (pricingBlock.length > 1) {
    modules.push(`<tr><td style="padding:32px 32px 0;">${pricingBlock.join('')}</td></tr>`);
  }

  if (priceAmount) {
    const priceParts = [];
    priceParts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">');
    priceParts.push('<tr><td>');
    priceParts.push(`<div style="${baseFontFamily}background:${priceBackground};border:${priceBorderWidth} solid ${priceBorderColor};border-radius:${priceBorderRadius};padding:18px 20px;">`);
    priceParts.push(`<div style="${baseFontFamily}font-size:14px;font-weight:600;color:${mutedTextColor};margin:0 0 6px;">${safe(priceLabel)}</div>`);
    priceParts.push(`<div style="${baseFontFamily}font-size:30px;font-weight:800;color:${headlineColor};margin:0 0 6px;">${safe(priceAmount)}</div>`);
    if (priceTerm) {
      priceParts.push(`<div style="${baseFontFamily}font-size:14px;color:${mutedTextColor};margin:0;">${safe(priceTerm)}</div>`);
    }
    priceParts.push('</div>');
    priceParts.push('</td></tr>');
    priceParts.push('</table>');
    modules.push(`<tr><td style="padding:28px 32px 0;">${priceParts.join('')}</td></tr>`);
  }

  if (terms.length) {
    const termsBlock = [];
    termsBlock.push(`<div style="${baseFontFamily}font-size:18px;font-weight:700;color:${headlineColor};margin:0 0 12px;">Commercial Terms &amp; Dependencies</div>`);
    const termRows = terms.map((item) => `<tr><td style="${baseFontFamily}color:${baseTextColor};font-size:16px;line-height:1.6;padding:4px 0;">${safe(item)}</td></tr>`).join('');
    termsBlock.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${termRows}</table>`);
    modules.push(`<tr><td style="padding:28px 32px 0;">${termsBlock.join('')}</td></tr>`);
  }

  modules.push('<tr><td style="padding:32px 32px 36px;font-size:12px;line-height:1.4;text-align:center;color:#5B6573;">Prepared with the TBTC VIC EAST Proposal Studio.</td></tr>');

  const docTitle = doc && doc.title ? safe(doc.title) : 'Proposal export';

  const htmlParts = [];
  htmlParts.push('<!doctype html>');
  htmlParts.push('<html lang="en">');
  htmlParts.push('<head>');
  htmlParts.push('<meta charset="utf-8">');
  htmlParts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  htmlParts.push(`<title>${docTitle}</title>`);
  htmlParts.push(`<style type="text/css">@font-face{font-family:'TelstraText';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${fontData}) format('woff2');}</style>`);
  htmlParts.push('</head>');
  htmlParts.push(`<body style="margin:0;padding:0;background:${backgroundColor};${baseFontFamily}color:${baseTextColor};">`);
  htmlParts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${backgroundColor};">`);
  htmlParts.push('<tr><td align="center" style="padding:32px 16px;">');
  htmlParts.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:${contentWidth}px;border-collapse:separate;background:${panelBackground};border:1px solid ${panelBorderColor};border-radius:32px;overflow:hidden;">`);
  htmlParts.push('<tbody>');
  htmlParts.push(modules.join(''));
  htmlParts.push('</tbody>');
  htmlParts.push('</table>');
  htmlParts.push('</td></tr>');
  htmlParts.push('</table>');
  htmlParts.push('</body>');
  htmlParts.push('</html>');
  return htmlParts.join('');
}
function initializeApp() {
  if (typeof document === 'undefined') {
    return;
  }

  const doc = document;
  const logoMap = (typeof window !== 'undefined' && window.__LOGO_DATA__ && typeof window.__LOGO_DATA__ === 'object')
    ? window.__LOGO_DATA__
    : {};
  const iconMap = (typeof window !== 'undefined' && window.__ICON_DATA__ && typeof window.__ICON_DATA__ === 'object')
    ? window.__ICON_DATA__
    : {};
  const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

  const bannerCanvas = doc.getElementById('banner');
  const bannerCtx = bannerCanvas && typeof bannerCanvas.getContext === 'function'
    ? bannerCanvas.getContext('2d')
    : null;

  const bannerTextInput = doc.getElementById('bannerTxt');
  const bannerBoldInput = doc.getElementById('bnBold');
  const bannerTextSizeInput = doc.getElementById('bnTextSize');
  const bannerLayoutSelect = doc.getElementById('bannerLayout');
  const presetSelect = doc.getElementById('preset');
  const bannerSizeSelect = doc.getElementById('bannerSize');
  const bannerLogoSelect = doc.getElementById('bannerLogoMode');
  const bannerScale = doc.getElementById('bnScale');
  const bannerOffsetX = doc.getElementById('bnX');
  const bannerOffsetY = doc.getElementById('bnY');
  const bannerBrowse = doc.getElementById('btnBrowse');
  const bannerUpload = doc.getElementById('bannerUpload');
  const bannerUse = doc.getElementById('btnBannerUse');
  const bannerDownload = doc.getElementById('btnBannerDownload');

  const docTypeSelect = doc.getElementById('docType');
  const gstModeSelect = doc.getElementById('gstMode');
  const customerInput = doc.getElementById('customer');
  const refInput = doc.getElementById('ref');
  const heroInput = doc.getElementById('hero');
  const subHeroInput = doc.getElementById('subHero');
  const summaryInput = doc.getElementById('summaryEdit');
  const benefitsInput = doc.getElementById('benefitsEdit');
  const assumptionsInput = doc.getElementById('assumptionsEdit');
  const monthlyInput = doc.getElementById('monthly');
  const termInput = doc.getElementById('term');

  const featureGrid = doc.getElementById('featureGrid');
  const featuresPreviewLayout = doc.getElementById('featuresPreview');
  const featurePreview = doc.getElementById('featuresView');
  const addFeatureBtn = doc.getElementById('btnAddFeat');
  const iconModal = doc.getElementById('iconModal');
  const iconGallery = doc.getElementById('iconGallery');
  const iconGalleryStatus = doc.getElementById('iconGalleryStatus');
  const iconSearch = doc.getElementById('iconSearch');
  const iconUpload = doc.getElementById('iconUpload');
  const closeIconBtn = doc.getElementById('closeIcon');

  const pricingTabs = Array.from(doc.querySelectorAll('#tab-pricing .ps-tab'));
  const pricingPanels = {
    edit: doc.getElementById('ps-edit'),
    preview: doc.getElementById('ps-preview')
  };
  const itemsContainer = doc.getElementById('items');
  const addItemBtn = doc.getElementById('btnAddItem');
  const priceTableEdit = doc.querySelector('#priceTable tbody');
  const priceTablePreview = doc.querySelector('#priceTableView tbody');
  const priceTableGhost = doc.querySelector('#priceTableGhost tbody');
  const thPrice = doc.getElementById('thPrice');
  const thPriceGhost = doc.getElementById('thPriceGhost');
  const thPriceView = doc.getElementById('thPriceV');

  const pvCustomer = doc.getElementById('pvCustomer');
  const pvRef = doc.getElementById('pvRef');
  const pvSummary = doc.getElementById('pvSummary');
  const pvBenefits = doc.getElementById('pvBenefits');
  const pvHero = doc.getElementById('pvHero');
  if (pvHero) {
    pvHero.setAttribute('data-export', 'headline-main');
  }
  let pvSub = doc.getElementById('pvSub');
  if (pvSub) {
    pvSub.setAttribute('data-export', 'headline-sub');
  }
  const pvMonthly = doc.getElementById('pvMonthly');
  const pvMonthlyGhost = doc.getElementById('pvMonthlyGhost');
  const pvTerm = doc.getElementById('pvTerm2');
  const pvTermGhost = doc.getElementById('pvTerm2Ghost');
  const assumptionsList = doc.getElementById('assumptions');
  const assumptionsGhost = doc.getElementById('assumptionsGhost');
  const pageBanner = doc.getElementById('pageBanner');
  const previewHeroImg = doc.querySelector('#tab-preview .hero img');
  const pageTwo = doc.getElementById('page2');

  const modeBadge = doc.getElementById('modeBadge');
  const topTabs = doc.getElementById('topTabs');
  const emailButton = doc.getElementById('btnEmail');

  if (!pvSub && pvHero && pvHero.parentElement) {
    pvSub = doc.createElement('div');
    pvSub.id = 'pvSub';
    pvSub.style.fontSize = '18px';
    pvSub.style.color = '#5B6573';
    pvSub.style.marginTop = '6px';
    pvSub.setAttribute('data-export', 'headline-sub');
    pvHero.parentElement.appendChild(pvSub);
  }

  state.preset = presetSelect ? (presetSelect.value || state.preset) : state.preset;
  state.banner.text = bannerTextInput ? (bannerTextInput.value || DEFAULT_BANNER_TEXT) : DEFAULT_BANNER_TEXT;
  state.banner.bold = bannerBoldInput ? Boolean(bannerBoldInput.checked) : state.banner.bold;
  state.banner.textSize = bannerTextSizeInput ? (Number(bannerTextSizeInput.value) || 1) : state.banner.textSize;
  state.banner.layout = bannerLayoutSelect ? (bannerLayoutSelect.value || state.banner.layout) : state.banner.layout;
  state.banner.size = bannerSizeSelect ? (bannerSizeSelect.value || state.banner.size) : state.banner.size;
  state.banner.scale = bannerScale ? (Number(bannerScale.value) || 1) : state.banner.scale;
  state.banner.offsetX = bannerOffsetX ? (Number(bannerOffsetX.value) || 0) : state.banner.offsetX;
  state.banner.offsetY = bannerOffsetY ? (Number(bannerOffsetY.value) || 0) : state.banner.offsetY;
  const fitRadio = doc.querySelector('input[name="fit"]:checked');
  state.banner.fit = fitRadio ? fitRadio.value : state.banner.fit;

  state.docType = docTypeSelect ? (docTypeSelect.value || DEFAULT_DOC_TYPE) : DEFAULT_DOC_TYPE;
  state.pricing.gst = gstModeSelect ? (gstModeSelect.value || DEFAULT_GST_MODE) : DEFAULT_GST_MODE;
  state.pricing.monthly = monthlyInput ? (Number(monthlyInput.value) || DEFAULT_MONTHLY) : DEFAULT_MONTHLY;
  state.pricing.term = termInput ? (Number(termInput.value) || DEFAULT_TERM) : DEFAULT_TERM;

  const resolveIcon = (name) => {
    if (name && iconMap[name]) {
      return iconMap[name];
    }
    const keys = Object.keys(iconMap);
    if (keys.length) {
      return iconMap[keys[0]];
    }
    return TRANSPARENT_PNG;
  };

  const resolveLogoKey = (requested) => {
    if (!requested || requested === "auto") {
      const preset = PRESETS[state.preset] || PRESETS.navy;
      return preset.logo;
    }
    if (LOGO_ALIASES[requested]) {
      return LOGO_ALIASES[requested];
    }
    return requested;
  };

  const resolveLogo = () => {
    const key = resolveLogoKey(state.banner.logoMode);
    if (logoMap[key]) {
      return logoMap[key];
    }
    const fallback = PRESETS.navy.logo;
    if (logoMap[fallback]) {
      return logoMap[fallback];
    }
    const keys = Object.keys(logoMap);
    if (keys.length) {
      return logoMap[keys[0]];
    }
    return TRANSPARENT_PNG;
  };

  const populateBannerLogos = (desiredValue) => {
    if (!bannerLogoSelect) {
      return desiredValue || 'auto';
    }
    const previous = desiredValue != null ? desiredValue : (state.banner.logoMode || bannerLogoSelect.value || 'auto');
    const fragment = doc.createDocumentFragment();
    const autoOption = doc.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto (based on colour)';
    fragment.appendChild(autoOption);

    const keys = Object.keys(logoMap).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    keys.forEach((key) => {
      const label = LOGO_DISPLAY_NAMES[key] || key;
      const option = doc.createElement('option');
      option.value = label;
      option.textContent = label;
      fragment.appendChild(option);
    });

    bannerLogoSelect.innerHTML = '';
    bannerLogoSelect.appendChild(fragment);

    if (!keys.length) {
      bannerLogoSelect.value = 'auto';
      return 'auto';
    }

    if (previous === 'auto') {
      bannerLogoSelect.value = 'auto';
      return 'auto';
    }

    const resolvedKey = resolveLogoKey(previous);
    const aliasEntry = Object.entries(LOGO_ALIASES).find(([, canonical]) => canonical === resolvedKey);
    const fallbackAlias = aliasEntry ? aliasEntry[0] : null;
    const nextValue = fallbackAlias || (LOGO_DISPLAY_NAMES[resolvedKey] ? LOGO_DISPLAY_NAMES[resolvedKey] : resolvedKey);
    const hasOption = Array.from(bannerLogoSelect.options).some((option) => option.value === nextValue);
    bannerLogoSelect.value = hasOption ? nextValue : 'auto';
    return bannerLogoSelect.value || 'auto';
  };

  state.banner.logoMode = populateBannerLogos(state.banner.logoMode);

  state.features.length = 0;
  if (Array.isArray(window._features) && window._features.length) {
    for (const feature of window._features) {
      state.features.push({
        t: String(feature.t || feature.title || ""),
        c: String(feature.c || feature.copy || ""),
        img: feature.img || feature.image || resolveIcon(feature.icon),
        hero: Boolean(feature.hero),
        size: Number(feature.size || feature.width || 56) || 56
      });
    }
  } else {
    for (const template of FEATURE_LIBRARY) {
      state.features.push({
        t: template.t,
        c: template.c,
        img: resolveIcon(template.icon),
        hero: Boolean(template.hero),
        size: Number(template.size) || 56
      });
    }
  }
  window._features = state.features;

  state.pricing.items = (Array.isArray(state.pricing.items) && state.pricing.items.length
    ? state.pricing.items
    : DEFAULT_PRICING_ITEMS).map((item) => ({
    label: String(item.label || ""),
    qty: Number(item.qty) || 0,
    unit: String(item.unit || ""),
    price: Number(item.price) || 0
  }));

  const toCurrency = (value) => {
    const formatted = currency.format(Math.max(0, value));
    if (formatted.startsWith('$')) {
      return `A$${formatted.slice(1)}`;
    }
    return formatted;
  };

  const renderPriceTables = () => {
    const priceModeLabel = state.pricing.gst === "inc" ? "Price (inc GST)" : "Price (ex GST)";
    if (thPrice) {
      thPrice.textContent = priceModeLabel;
    }
    if (thPriceGhost) {
      thPriceGhost.textContent = priceModeLabel;
    }
    if (thPriceView) {
      thPriceView.textContent = priceModeLabel;
    }

    const rows = state.pricing.items.map((item) => {
      const label = esc(String(item.label || '').trim());
      const unit = esc(String(item.unit || '').trim());
      const qtyValue = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
      const qtyText = qtyValue ? esc(String(qtyValue)) : '';
      const priceValue = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
      const baseTotal = qtyValue > 0 ? priceValue * qtyValue : priceValue;
      const displayTotal = state.pricing.gst === "inc" ? baseTotal * 1.1 : baseTotal;
      let priceText = '';
      if (baseTotal > 0) {
        priceText = toCurrency(displayTotal);
      } else if (priceValue > 0) {
        priceText = toCurrency(displayTotal);
      } else {
        priceText = 'Included';
      }

      return `<tr><td>${label || '&nbsp;'}</td><td>${qtyText || '&nbsp;'}</td><td>${unit || '&nbsp;'}</td><td>${priceText ? esc(priceText) : '&nbsp;'}</td></tr>`;
    });

    const fallbackRow = '<tr><td colspan="4" class="note">Add line items to populate pricing.</td></tr>';
    const html = rows.length ? rows.join('') : fallbackRow;

    if (priceTableEdit) {
      priceTableEdit.innerHTML = html;
    }
    if (priceTablePreview) {
      priceTablePreview.innerHTML = html;
    }
    if (priceTableGhost) {
      priceTableGhost.innerHTML = html;
    }
  };

  const renderItems = () => {
    if (!itemsContainer) {
      return;
    }
    itemsContainer.innerHTML = '';
    state.pricing.items.forEach((item, index) => {
      const row = doc.createElement('div');
      row.className = 'item-row line-item-row';

      const labelInput = doc.createElement('input');
      labelInput.type = 'text';
      labelInput.value = item.label || '';
      labelInput.placeholder = 'Item description';
      labelInput.addEventListener('input', (event) => {
        item.label = event.target.value;
        renderPriceTables();
      });

      const qtyInput = doc.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '0';
      qtyInput.step = '1';
      qtyInput.value = Number.isFinite(Number(item.qty)) ? String(Number(item.qty)) : '';
      qtyInput.placeholder = 'Qty';
      qtyInput.addEventListener('input', (event) => {
        const next = Number(event.target.value);
        item.qty = Number.isFinite(next) ? next : 0;
        renderPriceTables();
      });

      const unitInput = doc.createElement('input');
      unitInput.type = 'text';
      unitInput.value = item.unit || '';
      unitInput.placeholder = 'Unit';
      unitInput.addEventListener('input', (event) => {
        item.unit = event.target.value;
        renderPriceTables();
      });

      const priceInput = doc.createElement('input');
      priceInput.type = 'number';
      priceInput.min = '0';
      priceInput.step = '0.01';
      priceInput.value = Number.isFinite(Number(item.price)) ? String(Number(item.price)) : '';
      priceInput.placeholder = 'Price (ex GST)';
      priceInput.addEventListener('input', (event) => {
        const next = Number(event.target.value);
        item.price = Number.isFinite(next) ? next : 0;
        renderPriceTables();
      });

      const removeBtn = doc.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        state.pricing.items.splice(index, 1);
        renderItems();
        renderPriceTables();
      });

      row.appendChild(labelInput);
      row.appendChild(qtyInput);
      row.appendChild(unitInput);
      row.appendChild(priceInput);
      row.appendChild(removeBtn);
      itemsContainer.appendChild(row);
    });
  };

  let lastBannerSnapshot = null;
  const pushBannerToPreview = () => {
    if (!bannerCanvas || typeof bannerCanvas.toDataURL !== "function") {
      if (lastBannerSnapshot) {
        if (pageBanner) {
          pageBanner.src = lastBannerSnapshot;
        }
        if (previewHeroImg) {
          previewHeroImg.src = lastBannerSnapshot;
        }
      }
      return;
    }
    let dataUrl = null;
    try {
      dataUrl = bannerCanvas.toDataURL('image/png');
    } catch (error) {
      if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
        console.warn('Unable to capture banner preview via toDataURL()', error);
      }
    }
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png')) {
      lastBannerSnapshot = dataUrl;
      if (pageBanner) {
        pageBanner.src = dataUrl;
      }
      if (previewHeroImg) {
        previewHeroImg.src = dataUrl;
      }
      return;
    }
    if (lastBannerSnapshot) {
      if (pageBanner) {
        pageBanner.src = lastBannerSnapshot;
      }
      if (previewHeroImg) {
        previewHeroImg.src = lastBannerSnapshot;
      }
    }
  };

  let bannerSyncScheduled = false;
  const scheduleBannerSync = () => {
    if (bannerSyncScheduled) {
      return;
    }
    if (!bannerCanvas || typeof bannerCanvas.toDataURL !== "function") {
      return;
    }
    bannerSyncScheduled = true;
    const sync = () => {
      bannerSyncScheduled = false;
      pushBannerToPreview();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(sync);
    } else {
      setTimeout(sync, 0);
    }
  };

  const clipRoundedRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.clip();
  };

  const safeImageSourceCache = new Map();
  const safeImageSourcePromises = new Map();

  const needsSafeImagePrefetch = (src) => {
    if (!src || typeof src !== 'string') {
      return false;
    }
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return false;
    }
    if (typeof window === 'undefined' || typeof location === 'undefined') {
      return false;
    }
    if (location.protocol === 'file:') {
      return true;
    }
    try {
      const base = doc && doc.baseURI ? doc.baseURI : location.href;
      const resolved = new URL(src, base);
      return resolved.origin !== location.origin;
    } catch (error) {
      return false;
    }
  };

  const shouldUseAnonymousCrossOrigin = (src) => {
    if (!src || typeof src !== 'string') {
      return false;
    }
    if (typeof window === 'undefined' || typeof location === 'undefined') {
      return false;
    }
    if (location.protocol === 'file:') {
      return false;
    }
    return needsSafeImagePrefetch(src);
  };

  const ensureSafeImageSource = (src) => {
    if (!src || typeof src !== 'string') {
      return src;
    }
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }
    if (!needsSafeImagePrefetch(src)) {
      safeImageSourceCache.set(src, src);
      return src;
    }
    if (safeImageSourceCache.has(src)) {
      return safeImageSourceCache.get(src);
    }
    if (safeImageSourcePromises.has(src)) {
      return safeImageSourcePromises.get(src);
    }
    if (typeof window === 'undefined') {
      return src;
    }
    const base = doc && doc.baseURI ? doc.baseURI : (typeof location !== 'undefined' ? location.href : undefined);
    let absoluteUrl = src;
    if (base) {
      try {
        absoluteUrl = new URL(src, base).href;
      } catch (error) {
        absoluteUrl = src;
      }
    }
    const promise = fetchImageAsDataUrl(absoluteUrl)
      .then((dataUrl) => {
        const finalSrc = dataUrl || src;
        safeImageSourceCache.set(src, finalSrc);
        return finalSrc;
      })
      .catch(() => {
        safeImageSourceCache.set(src, src);
        return src;
      })
      .finally(() => {
        safeImageSourcePromises.delete(src);
      });
    safeImageSourcePromises.set(src, promise);
    return promise;
  };

  const drawBanner = () => {
    if (!bannerCanvas || !bannerCtx) {
      return;
    }

    const [width, height] = parseSize(state.banner.size, 1000, 300);
    bannerCanvas.width = width;
    bannerCanvas.height = height;

    const preset = PRESETS[state.preset] || PRESETS.navy;
    bannerCtx.clearRect(0, 0, width, height);
    bannerCtx.fillStyle = preset.bg;
    bannerCtx.fillRect(0, 0, width, height);

    const isHeadlineOnly = state.banner.layout === "headline";
    const panelWidth = Math.round(width * 0.42);
    const panelX = state.banner.layout === "left" ? 0 : width - panelWidth;

    if (!isHeadlineOnly) {
      bannerCtx.save();
      bannerCtx.fillStyle = preset.panel;
      bannerCtx.fillRect(panelX, 0, panelWidth, height);
      if (bannerPanelImage && bannerPanelImage.complete && bannerPanelImage.naturalWidth > 0) {
        const baseScaleX = panelWidth / bannerPanelImage.naturalWidth;
        const baseScaleY = height / bannerPanelImage.naturalHeight;
        const fitScale = state.banner.fit === "cover" ? Math.max(baseScaleX, baseScaleY) : Math.min(baseScaleX, baseScaleY);
        const finalScale = fitScale * (state.banner.scale || 1);
        const renderWidth = bannerPanelImage.naturalWidth * finalScale;
        const renderHeight = bannerPanelImage.naturalHeight * finalScale;
        let drawX = panelX + (panelWidth - renderWidth) / 2;
        let drawY = (height - renderHeight) / 2;
        if (state.banner.fit === "cover") {
          drawX += (Number(state.banner.offsetX || 0) / 100) * (panelWidth / 2);
          drawY += (Number(state.banner.offsetY || 0) / 100) * (height / 2);
        }
        bannerCtx.save();
        clipRoundedRect(bannerCtx, panelX, 0, panelWidth, height, Math.round(height * 0.18));
        bannerCtx.drawImage(bannerPanelImage, drawX, drawY, renderWidth, renderHeight);
        bannerCtx.restore();
      }
      bannerCtx.restore();
    }

    const accentHeight = Math.max(8, Math.round(height * 0.04));
    bannerCtx.fillStyle = preset.accent;
    bannerCtx.fillRect(0, height - accentHeight, width, accentHeight);

    const textPadding = 24;
    const logoPadding = Math.round(height * 0.08);
    const maxLogoHeight = Math.round(height * 0.26);
    let textMaxWidth = isHeadlineOnly ? (width - (textPadding * 2)) : (width - panelWidth - (textPadding * 2));
    let textX = state.banner.layout === "left" && !isHeadlineOnly
      ? panelWidth + textPadding
      : textPadding;
    let leftBound = textX;
    let rightBound = textX + textMaxWidth;

    const logoSrc = resolveLogo();
    const hasRenderableLogo = Boolean(logoSrc && logoSrc !== TRANSPARENT_PNG);

    if (hasRenderableLogo) {
      const clearancePadding = Math.max(textPadding, logoPadding);
      const storedRatio = logoAspectCache.get(logoSrc) || 1;
      const estimatedLogoWidth = Math.round(maxLogoHeight * storedRatio);

      if (isHeadlineOnly || state.banner.layout === "left") {
        const maxTextEnd = width - (logoPadding + estimatedLogoWidth + clearancePadding);
        rightBound = Math.min(rightBound, maxTextEnd);
      }
      if (!isHeadlineOnly && state.banner.layout === "right") {
        const minTextStart = logoPadding + estimatedLogoWidth + clearancePadding;
        leftBound = Math.max(leftBound, minTextStart);
      }
    }

    if (rightBound < leftBound) {
      rightBound = leftBound;
    }

    textX = leftBound;
    textMaxWidth = Math.max(0, rightBound - leftBound);
    const textY = Math.round(height * (isHeadlineOnly ? 0.25 : 0.32));
    const maxLines = isHeadlineOnly ? 2 : 3;
    const weight = state.banner.bold ? "700" : "400";

    let fontSize = Math.max(26, Math.round(height * 0.2));
    const minFontSize = Math.max(20, Math.round(fontSize * 0.7));
    const textScale = Number.isFinite(state.banner.textSize) && state.banner.textSize > 0 ? state.banner.textSize : 1;
    const measureFits = (size) => {
      bannerCtx.font = `${weight} ${size}px TelstraText, Arial, sans-serif`;
      const words = String(state.banner.text || "").split(/\s+/).filter(Boolean);
      if (!words.length) {
        return true;
      }
      let line = "";
      let linesCount = 1;
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (bannerCtx.measureText(candidate).width <= textMaxWidth) {
          line = candidate;
        } else {
          linesCount += 1;
          if (linesCount > maxLines) {
            return false;
          }
          line = word;
        }
      }
      return true;
    };

    while (fontSize > minFontSize && !measureFits(fontSize)) {
      fontSize -= 1;
    }

    let scaledFontSize = Math.max(12, Math.round(fontSize * textScale));
    if (scaledFontSize > fontSize) {
      while (scaledFontSize > fontSize && !measureFits(scaledFontSize)) {
        scaledFontSize -= 1;
      }
    }
    if (!measureFits(scaledFontSize)) {
      while (scaledFontSize > minFontSize && !measureFits(scaledFontSize)) {
        scaledFontSize -= 1;
      }
    }
    fontSize = Math.max(minFontSize, scaledFontSize);

    bannerCtx.font = `${weight} ${fontSize}px TelstraText, Arial, sans-serif`;
    bannerCtx.fillStyle = preset.headline;
    bannerCtx.textBaseline = "top";
    wrapTextLines(bannerCtx, state.banner.text || "", textX, textY, textMaxWidth, Math.round(fontSize * 1.12), maxLines);

    if (hasRenderableLogo) {
      const logoImage = new Image();
      logoImage.decoding = 'async';
      logoImage.onload = () => {
        if (!logoImage.naturalWidth || !logoImage.naturalHeight) {
          scheduleBannerSync();
          return;
        }
        const ratio = logoImage.naturalWidth / logoImage.naturalHeight;
        const previousRatio = logoAspectCache.get(logoSrc);
        logoAspectCache.set(logoSrc, ratio);
        if (!previousRatio || Math.abs(previousRatio - ratio) > 0.001) {
          drawBanner();
          return;
        }
        const logoHeight = maxLogoHeight;
        const logoWidth = Math.round(logoHeight * ratio);
        let logoX;
        if (isHeadlineOnly || state.banner.layout === "left") {
          logoX = width - logoWidth - logoPadding;
        } else if (state.banner.layout === "right") {
          logoX = logoPadding;
        } else {
          logoX = width - logoWidth - logoPadding;
        }
        const logoY = logoPadding;
        bannerCtx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
        scheduleBannerSync();
      };
      logoImage.onerror = () => {
        scheduleBannerSync();
      };
      const safeSource = ensureSafeImageSource(logoSrc);
      const assignSource = (source) => {
        const finalSrc = (typeof source === 'string' && source) ? source : logoSrc;
        if (logoImage.src === finalSrc) {
          return;
        }
        if (shouldUseAnonymousCrossOrigin(finalSrc)) {
          logoImage.crossOrigin = 'anonymous';
        } else {
          logoImage.crossOrigin = null;
        }
        try {
          logoImage.src = finalSrc;
        } catch (error) {
          logoImage.src = logoSrc;
        }
      };
      if (safeSource && typeof safeSource.then === 'function') {
        safeSource.then(assignSource).catch(() => {
          assignSource(logoSrc);
        });
      } else {
        assignSource(safeSource);
      }
    } else {
      scheduleBannerSync();
    }
  };

  const keyFeaturesSection = doc.getElementById('keyFeaturesSection');
  const keyFeaturesList = doc.getElementById('keyFeaturesList');

  const buildFeatureCardElement = (feature, options = {}) => {
    if (!feature) {
      return null;
    }
    const { forceHero = false, context = 'preview' } = options;
    const titleText = feature.t ? String(feature.t).trim() : '';
    const copyText = feature.c ? String(feature.c).trim() : '';
    const iconSrc = feature.img || resolveIcon(feature.icon);
    const hasDetails = Boolean(titleText || copyText || iconSrc);
    if (!hasDetails) {
      return null;
    }

    const isHero = forceHero || Boolean(feature.hero);
    const card = doc.createElement('div');
    card.className = `feature${isHero ? ' hero' : ''}`;
    card.setAttribute('data-export-feature', 'card');
    card.setAttribute('data-export-feature-type', isHero ? 'hero' : 'standard');
    card.setAttribute('data-export-feature-context', context);
    if (context === 'key') {
      card.classList.add('key-feature-card');
    }

    if (iconSrc) {
      const iconWrap = doc.createElement('div');
      iconWrap.className = 'icon';
      const sizeValue = clampIconSizeValue(feature.size, isHero);
      iconWrap.style.width = `${sizeValue}px`;
      iconWrap.style.height = `${sizeValue}px`;
      const img = doc.createElement('img');
      img.src = iconSrc;
      img.alt = titleText || 'Feature icon';
      img.setAttribute('data-export-feature-image', 'icon');
      iconWrap.appendChild(img);
      card.appendChild(iconWrap);
    }

    const body = doc.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '4px';
    body.style.minWidth = '0';

    if (titleText) {
      const title = doc.createElement('div');
      title.style.fontWeight = '700';
      title.style.fontSize = '18px';
      title.style.marginBottom = '2px';
      title.setAttribute('data-export-feature-title', 'title');
      title.textContent = titleText;
      body.appendChild(title);
    }

    if (copyText) {
      if (copyText.includes('\n')) {
        const list = doc.createElement('ul');
        list.innerHTML = bulletify(copyText);
        list.setAttribute('data-export-feature-list', 'list');
        body.appendChild(list);
      } else {
        const copy = doc.createElement('div');
        copy.className = 'note';
        copy.style.fontSize = '16px';
        copy.setAttribute('data-export-feature-copy', 'copy');
        copy.textContent = copyText;
        body.appendChild(copy);
      }
    }

    if (!card.firstChild) {
      // Ensure layout remains consistent when there is no icon
      const spacer = doc.createElement('div');
      spacer.className = 'icon';
      const spacerSize = clampIconSizeValue(feature.size, isHero);
      spacer.style.width = `${spacerSize}px`;
      spacer.style.height = `${spacerSize}px`;
      spacer.style.display = 'none';
      card.appendChild(spacer);
    }

    card.appendChild(body);
    return card;
  };

  const renderFeaturePreview = () => {
    if (!featurePreview) {
      return;
    }

    featurePreview.innerHTML = '';
    const heroFeatures = [];
    const regularFeatures = [];

    for (const feature of state.features) {
      if (!feature) {
        continue;
      }
      const element = buildFeatureCardElement(feature);
      if (!element) {
        continue;
      }
      if (feature.hero) {
        heroFeatures.push({ feature, element });
      } else {
        regularFeatures.push({ feature, element });
      }
    }

    let hasContent = false;

    if (heroFeatures.length) {
      for (const { element } of heroFeatures) {
        featurePreview.appendChild(element);
      }
      hasContent = true;
    }

    if (regularFeatures.length) {
      for (const { element } of regularFeatures) {
        featurePreview.appendChild(element);
      }
      hasContent = true;
    }

    if (!heroFeatures.length && !regularFeatures.length) {
      hasContent = false;
    }

    if (featuresPreviewLayout) {
      if (hasContent) {
        featuresPreviewLayout.style.display = '';
        featuresPreviewLayout.classList.toggle('has-hero', heroFeatures.length > 0);
      } else {
        featuresPreviewLayout.style.display = 'none';
        featuresPreviewLayout.classList.remove('has-hero');
      }
    }

    if (keyFeaturesSection && keyFeaturesList) {
      keyFeaturesList.innerHTML = '';
      if (heroFeatures.length) {
        keyFeaturesSection.style.display = '';
        for (const { feature } of heroFeatures) {
          const card = buildFeatureCardElement(feature, { forceHero: true, context: 'key' });
          if (card) {
            keyFeaturesList.appendChild(card);
          }
        }
      } else {
        keyFeaturesSection.style.display = 'none';
      }
    }
  };

  let currentFeatureIndex = -1;
  let iconGalleryBuilt = false;
  const iconItems = [];

  const updateIconStatus = (visibleCount) => {
    if (!iconGalleryStatus) {
      return;
    }
    const total = iconItems.length;
    if (!total) {
      iconGalleryStatus.textContent = 'No bundled icons available. Upload your own icon instead.';
      return;
    }
    if (!visibleCount) {
      iconGalleryStatus.textContent = 'No pictograms match your search.';
      return;
    }
    if (visibleCount === total) {
      iconGalleryStatus.textContent = `${total} pictogram${total === 1 ? '' : 's'} available.`;
      return;
    }
    iconGalleryStatus.textContent = `Showing ${visibleCount} of ${total} pictograms.`;
  };

  const applyIconSearch = (term) => {
    const query = term ? term.trim().toLowerCase() : '';
    let visible = 0;
    for (const item of iconItems) {
      const match = !query || item.dataset.name.includes(query);
      item.style.display = match ? '' : 'none';
      if (match) {
        visible += 1;
      }
    }
    updateIconStatus(visible);
  };

  const closeIconModal = () => {
    currentFeatureIndex = -1;
    if (iconModal) {
      iconModal.style.display = "none";
    }
    if (iconSearch) {
      iconSearch.value = '';
      if (iconGalleryBuilt) {
        applyIconSearch('');
      }
    }
  };

  const renderIconGallery = () => {
    if (!iconGallery) {
      return;
    }
    if (!iconGalleryBuilt) {
      const entries = Object.entries(iconMap)
        .filter(([rawName, rawSrc]) => typeof rawName === 'string' && typeof rawSrc === 'string' && rawName.trim() && rawSrc.trim())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
      iconGallery.innerHTML = "";
      iconItems.length = 0;
      if (!entries.length) {
        updateIconStatus(0);
        iconGalleryBuilt = true;
        return;
      }
      for (const [rawName, rawSrc] of entries) {
        if (!rawSrc) {
          continue;
        }
        const name = rawName.trim();
        const src = rawSrc.trim();
        if (!name || !src) {
          continue;
        }
        const item = doc.createElement('div');
        item.className = "item";
        const baseName = name.replace(/\.[^.]+$/, '');
        const camelSeparated = baseName.replace(/([a-z])([A-Z])/g, '$1 $2');
        const variations = new Set([
          name,
          baseName,
          baseName.replace(/[_-]+/g, ' '),
          baseName.replace(/[_-]+/g, ''),
          baseName.replace(/\s+/g, ''),
          baseName.replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
          camelSeparated,
          camelSeparated.replace(/\s+/g, '')
        ]);
        const searchName = Array.from(variations).join(' ').toLowerCase();
        item.dataset.name = searchName;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Use ${name}`);
        const img = doc.createElement('img');
        img.src = src;
        img.alt = name;
        item.title = name;
        item.appendChild(img);
        const chooseIcon = () => {
          if (currentFeatureIndex >= 0 && state.features[currentFeatureIndex]) {
            state.features[currentFeatureIndex].img = src;
            state.features[currentFeatureIndex].imgName = name;
            renderFeatureGrid();
            renderFeaturePreview();
            closeIconModal();
          }
        };
        item.addEventListener('click', chooseIcon);
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            chooseIcon();
          }
        });
        iconGallery.appendChild(item);
        iconItems.push(item);
      }
      iconGalleryBuilt = true;
    }
    applyIconSearch(iconSearch ? iconSearch.value : '');
  };

  const renderFeatureGrid = () => {
    if (!featureGrid) {
      return;
    }
    featureGrid.innerHTML = "";
    state.features.forEach((feature, index) => {
      const card = doc.createElement('div');
      card.className = `feature${feature.hero ? " hero" : ""}`;

      const left = doc.createElement('div');
      left.className = "copy";
      left.style.display = "flex";
      left.style.gap = "12px";
      left.style.flex = "1 1 320px";
      left.style.minWidth = "0";

      const iconWrap = doc.createElement('div');
      iconWrap.className = "icon";
      const size = clampIconSizeValue(feature.size, feature.hero);
      feature.size = size;
      iconWrap.style.width = `${size}px`;
      iconWrap.style.height = `${size}px`;
      const img = doc.createElement('img');
      img.src = feature.img || resolveIcon(feature.icon);
      iconWrap.appendChild(img);
      left.appendChild(iconWrap);

      const textCol = doc.createElement('div');
      textCol.className = "copy";
      textCol.style.minWidth = "0";

      const titleInput = doc.createElement('input');
      titleInput.type = "text";
      titleInput.value = feature.t || "";
      titleInput.placeholder = "Feature title";
      titleInput.addEventListener('input', (event) => {
        feature.t = event.target.value;
        renderFeaturePreview();
      });

      const bodyInput = doc.createElement('textarea');
      bodyInput.value = feature.c || "";
      bodyInput.placeholder = "Details or bullet points (one per line)";
      bodyInput.addEventListener('input', (event) => {
        feature.c = event.target.value;
        renderFeaturePreview();
      });

      textCol.appendChild(titleInput);
      textCol.appendChild(bodyInput);
      left.appendChild(textCol);
      card.appendChild(left);

      const right = doc.createElement('div');
      right.className = "controls";

      const chooseBtn = doc.createElement('button');
      chooseBtn.type = "button";
      chooseBtn.className = "btn";
      chooseBtn.textContent = "Choose icon";
      chooseBtn.addEventListener('click', () => {
        currentFeatureIndex = index;
        if (iconSearch) {
          iconSearch.value = '';
        }
        if (iconModal) {
          iconModal.style.display = "flex";
          renderIconGallery();
          if (iconSearch) {
            setTimeout(() => {
              try {
                iconSearch.focus({ preventScroll: true });
              } catch (err) {
                iconSearch.focus();
              }
            }, 0);
          }
        }
      });

      const uploadInput = doc.createElement('input');
      uploadInput.type = "file";
      uploadInput.accept = "image/*";
      uploadInput.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          feature.img = reader.result || feature.img;
          renderFeatureGrid();
          renderFeaturePreview();
        };
        reader.readAsDataURL(file);
      });

      const heroLabel = doc.createElement('label');
      heroLabel.className = "chk";
      const heroToggle = doc.createElement('input');
      heroToggle.type = "checkbox";
      heroToggle.checked = Boolean(feature.hero);
      heroLabel.appendChild(heroToggle);
      heroLabel.appendChild(doc.createTextNode('Key feature (hero layout)'));

      const sizeWrap = doc.createElement('div');
      const sizeLabel = doc.createElement('label');
      sizeLabel.className = "note";
      const sizeInput = doc.createElement('input');
      sizeInput.type = "range";
      sizeInput.min = String(ICON_SIZE_MIN);
      sizeInput.step = "1";

      const updateIconSizeLabel = () => {
        const heroSuffix = heroToggle.checked ? ' – hero layout' : '';
        sizeLabel.textContent = `Icon size (${sizeInput.value}px${heroSuffix})`;
      };

      const applyHeroSizeBounds = () => {
        const max = heroToggle.checked ? HERO_ICON_SIZE_MAX : ICON_SIZE_MAX;
        sizeInput.max = String(max);
        const clamped = clampIconSizeValue(sizeInput.value, heroToggle.checked);
        sizeInput.value = String(clamped);
        feature.size = clamped;
        iconWrap.style.width = `${clamped}px`;
        iconWrap.style.height = `${clamped}px`;
        updateIconSizeLabel();
      };

      sizeInput.addEventListener('input', (event) => {
        const clamped = clampIconSizeValue(event.target.value, heroToggle.checked);
        feature.size = clamped;
        sizeInput.value = String(clamped);
        iconWrap.style.width = `${clamped}px`;
        iconWrap.style.height = `${clamped}px`;
        updateIconSizeLabel();
        renderFeaturePreview();
      });

      heroToggle.addEventListener('change', (event) => {
        feature.hero = Boolean(event.target.checked);
        card.classList.toggle('hero', feature.hero);
        applyHeroSizeBounds();
        renderFeaturePreview();
      });

      sizeWrap.appendChild(sizeLabel);
      sizeWrap.appendChild(sizeInput);
      sizeInput.value = String(feature.size != null ? feature.size : clampIconSizeValue(feature.size, heroToggle.checked));
      applyHeroSizeBounds();

      const removeBtn = doc.createElement('button');
      removeBtn.type = "button";
      removeBtn.className = "btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener('click', () => {
        state.features.splice(index, 1);
        renderFeatureGrid();
        renderFeaturePreview();
      });

      const reorderRow = doc.createElement('div');
      reorderRow.className = "reorder";
      const upBtn = doc.createElement('button');
      upBtn.type = "button";
      upBtn.className = "btn-xs";
      upBtn.textContent = "↑ Up";
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => {
        if (index > 0) {
          const swap = state.features[index - 1];
          state.features[index - 1] = state.features[index];
          state.features[index] = swap;
          renderFeatureGrid();
          renderFeaturePreview();
        }
      });
      const downBtn = doc.createElement('button');
      downBtn.type = "button";
      downBtn.className = "btn-xs";
      downBtn.textContent = "↓ Down";
      downBtn.disabled = index === state.features.length - 1;
      downBtn.addEventListener('click', () => {
        if (index < state.features.length - 1) {
          const swap = state.features[index + 1];
          state.features[index + 1] = state.features[index];
          state.features[index] = swap;
          renderFeatureGrid();
          renderFeaturePreview();
        }
      });
      reorderRow.appendChild(upBtn);
      reorderRow.appendChild(downBtn);

      right.appendChild(chooseBtn);
      right.appendChild(uploadInput);
      right.appendChild(heroLabel);
      right.appendChild(sizeWrap);
      right.appendChild(removeBtn);
      right.appendChild(reorderRow);

      card.appendChild(right);
      featureGrid.appendChild(card);
    });
  };

  const renderBenefits = () => {
    if (pvBenefits && benefitsInput) {
      pvBenefits.innerHTML = bulletify(benefitsInput.value);
    }
  };

  const renderAssumptions = () => {
    const html = assumptionsInput ? bulletify(assumptionsInput.value) : "";
    if (assumptionsList) {
      assumptionsList.innerHTML = html;
    }
    if (assumptionsGhost) {
      assumptionsGhost.innerHTML = html;
    }
  };

  const syncTotals = () => {
    const monthlyValue = Number(monthlyInput ? monthlyInput.value : state.pricing.monthly) || 0;
    state.pricing.monthly = monthlyValue;
    const termValue = Number(termInput ? termInput.value : state.pricing.term) || 0;
    state.pricing.term = termValue;
    const displayMonthly = state.pricing.gst === "inc" ? monthlyValue * 1.1 : monthlyValue;
    const monthlyLabel = state.pricing.gst === "inc" ? "inc GST" : "ex GST";
    if (pvMonthly) {
      pvMonthly.textContent = `${toCurrency(displayMonthly)} ${monthlyLabel}`;
    }
    if (pvMonthlyGhost) {
      pvMonthlyGhost.textContent = `${toCurrency(displayMonthly)} ${monthlyLabel}`;
    }
    const termLabel = termValue ? `${termValue} months` : "";
    if (pvTerm) {
      pvTerm.textContent = termLabel ? `Term: ${termLabel}` : "";
    }
    if (pvTermGhost) {
      pvTermGhost.textContent = termLabel ? `Term: ${termLabel}` : "";
    }
  };

  const syncPreview = () => {
    if (customerInput && pvCustomer) {
      const value = customerInput.value.trim();
      pvCustomer.textContent = value || "Customer";
    }
    if (refInput && pvRef) {
      const value = refInput.value.trim();
      pvRef.textContent = value ? `Ref: ${value}` : "";
    }
    if (heroInput && pvHero) {
      const value = heroInput.value.trim();
      pvHero.textContent = value || DEFAULT_BANNER_TEXT;
    }
    if (subHeroInput && pvSub) {
      pvSub.textContent = subHeroInput.value.trim();
    }
    if (summaryInput && pvSummary) {
      pvSummary.textContent = summaryInput.value;
    }
    renderBenefits();
    renderAssumptions();
    renderFeaturePreview();
    syncTotals();
    if (docTypeSelect && pageTwo) {
      const value = docTypeSelect.value || DEFAULT_DOC_TYPE;
      state.docType = value;
      pageTwo.style.display = value === "two" ? "block" : "none";
    }
  };

  const setupTabs = () => {
    if (!topTabs) {
      return;
    }
    const tabs = Array.from(topTabs.querySelectorAll('.tab'));
    if (!tabs.length) {
      return;
    }
    const sections = new Map();
    tabs.forEach((tab) => {
      const target = tab.dataset ? tab.dataset.tab : undefined;
      if (target) {
        const panel = doc.getElementById(`tab-${target}`);
        if (panel) {
          sections.set(tab, panel);
        }
      }
    });
    if (!sections.size) {
      return;
    }
    const applyBadge = (isPreview) => {
      if (doc.body) {
        doc.body.classList.toggle('editing', !isPreview);
        doc.body.classList.toggle('previewing', isPreview);
      }
      if (!modeBadge) {
        return;
      }
      if (isPreview) {
        modeBadge.textContent = "CUSTOMER VIEW";
        modeBadge.style.background = "#E7F8EE";
        modeBadge.style.border = "1px solid #C8F0DA";
        modeBadge.style.color = "#116D4C";
      } else {
        modeBadge.textContent = "EDIT MODE";
        modeBadge.style.background = "#EEF2FF";
        modeBadge.style.border = "1px solid #DDE3FF";
        modeBadge.style.color = "#122B5C";
      }
    };
    const activate = (tab) => {
      if (!sections.has(tab)) {
        return;
      }
      tabs.forEach((btn) => { btn.classList.remove('active'); });
      sections.forEach((panel) => { panel.style.display = "none"; });
      tab.classList.add('active');
      const panel = sections.get(tab);
      if (panel) {
        panel.style.display = "block";
      }
      applyBadge(tab.dataset && tab.dataset.tab === "preview");
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab));
    });
    const initial = tabs.find((tab) => tab.classList.contains('active') && sections.has(tab)) || tabs[0];
    if (initial) {
      activate(initial);
    }
  };

  const setupPricingTabs = () => {
    if (!pricingTabs.length) {
      return;
    }
    const activate = (tab) => {
      pricingTabs.forEach((btn) => btn.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset ? tab.dataset.ps : undefined;
      Object.entries(pricingPanels).forEach(([name, panel]) => {
        if (!panel) {
          return;
        }
        panel.style.display = name === target ? "block" : "none";
      });
    };
    pricingTabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab));
    });
    const initial = pricingTabs.find((tab) => tab.classList.contains('active')) || pricingTabs[0];
    if (initial) {
      activate(initial);
    }
  };

  if (iconSearch) {
    iconSearch.addEventListener('input', () => {
      if (!iconGalleryBuilt) {
        renderIconGallery();
        return;
      }
      applyIconSearch(iconSearch.value);
    });
  }

  if (closeIconBtn) {
    closeIconBtn.addEventListener('click', closeIconModal);
  }
  if (iconModal) {
    iconModal.addEventListener('click', (event) => {
      if (event.target === iconModal) {
        closeIconModal();
      }
    });
  }
  if (iconUpload) {
    iconUpload.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (currentFeatureIndex >= 0 && state.features[currentFeatureIndex]) {
          state.features[currentFeatureIndex].img = reader.result || state.features[currentFeatureIndex].img;
          renderFeatureGrid();
          renderFeaturePreview();
          closeIconModal();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (addFeatureBtn) {
    addFeatureBtn.addEventListener('click', () => {
      if (state.features.length >= MAX_FEATURES) {
        return;
      }
      state.features.push({
        t: "New feature",
        c: "Describe the benefit...",
        img: resolveIcon(),
        hero: false,
        size: 56
      });
      renderFeatureGrid();
      renderFeaturePreview();
    });
  }

  if (bannerTextInput) {
    bannerTextInput.addEventListener('input', (event) => {
      state.banner.text = event.target.value;
      drawBanner();
    });
  }
  if (bannerBoldInput) {
    bannerBoldInput.addEventListener('change', (event) => {
      state.banner.bold = Boolean(event.target.checked);
      drawBanner();
    });
  }
  if (bannerTextSizeInput) {
    bannerTextSizeInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      state.banner.textSize = Number.isFinite(value) && value > 0 ? value : 1;
      drawBanner();
    });
  }
  if (bannerLayoutSelect) {
    bannerLayoutSelect.addEventListener('change', (event) => {
      state.banner.layout = event.target.value || state.banner.layout;
      drawBanner();
    });
  }
  if (presetSelect) {
    presetSelect.addEventListener('change', (event) => {
      state.preset = event.target.value || state.preset;
      drawBanner();
    });
  }
  if (bannerSizeSelect) {
    bannerSizeSelect.addEventListener('change', (event) => {
      state.banner.size = event.target.value || state.banner.size;
      drawBanner();
    });
  }
  if (bannerLogoSelect) {
    bannerLogoSelect.addEventListener('change', (event) => {
      state.banner.logoMode = event.target.value || "auto";
      drawBanner();
    });
  }
  if (bannerScale) {
    bannerScale.addEventListener('input', (event) => {
      state.banner.scale = Number(event.target.value) || 1;
      drawBanner();
    });
  }
  if (bannerOffsetX) {
    bannerOffsetX.addEventListener('input', (event) => {
      state.banner.offsetX = Number(event.target.value) || 0;
      drawBanner();
    });
  }
  if (bannerOffsetY) {
    bannerOffsetY.addEventListener('input', (event) => {
      state.banner.offsetY = Number(event.target.value) || 0;
      drawBanner();
    });
  }
  const fitOptions = Array.from(doc.querySelectorAll('input[name="fit"]'));
  fitOptions.forEach((option) => {
    option.addEventListener('change', (event) => {
      if (event.target.checked) {
        state.banner.fit = event.target.value || state.banner.fit;
        drawBanner();
      }
    });
  });

  if (bannerBrowse && bannerUpload) {
    bannerBrowse.addEventListener('click', () => bannerUpload.click());
  }
  if (bannerUpload) {
    bannerUpload.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        bannerPanelImage = new Image();
        bannerPanelImage.onload = drawBanner;
        bannerPanelImage.src = reader.result || "";
      };
      reader.readAsDataURL(file);
    });
  }
  if (bannerUse) {
    bannerUse.addEventListener('click', () => {
      drawBanner();
    });
  }
  if (bannerDownload) {
    bannerDownload.addEventListener('click', () => {
      if (!bannerCanvas) {
        return;
      }
      const link = doc.createElement('a');
      link.href = bannerCanvas.toDataURL('image/png');
      link.download = "proposal-banner.png";
      doc.body.appendChild(link);
      link.click();
      doc.body.removeChild(link);
    });
  }

  const inputHandlers = [
    [customerInput, syncPreview],
    [refInput, syncPreview],
    [heroInput, syncPreview],
    [subHeroInput, syncPreview],
    [summaryInput, syncPreview],
    [benefitsInput, () => { renderBenefits(); renderFeaturePreview(); }],
    [assumptionsInput, renderAssumptions],
    [monthlyInput, () => { syncTotals(); renderPriceTables(); }],
    [termInput, syncTotals],
    [docTypeSelect, syncPreview],
  ];
  inputHandlers.forEach(([el, handler]) => {
    if (el && typeof el.addEventListener === "function") {
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    }
  });

  if (gstModeSelect) {
    gstModeSelect.addEventListener('change', (event) => {
      state.pricing.gst = event.target.value || DEFAULT_GST_MODE;
      renderPriceTables();
      syncTotals();
    });
  }

  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
      state.pricing.items.push({ label: "", qty: 1, unit: "", price: 0 });
      renderItems();
      renderPriceTables();
    });
  }

  setupTabs();
  setupPricingTabs();
  renderFeatureGrid();
  renderFeaturePreview();
  renderItems();
  renderPriceTables();
  renderBenefits();
  renderAssumptions();
  syncTotals();
  syncPreview();
  drawBanner();

  if (emailButton) {
    emailButton.addEventListener('click', () => {
      downloadEmailHTML();
    });
  }
}

async function downloadEmailHTML() {
  if (typeof document === 'undefined') {
    return;
  }
  try {
    const html = await buildEmailHTML();
    if (!html) {
      return;
    }
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'proposal-email.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    // Surface errors for debugging but avoid breaking the UI flow.
    if (typeof console !== 'undefined' && console.error) {
      console.error('Failed to generate email export', error);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseSize,
    esc,
    wrapTextLines,
    bulletify,
    __rgbToHex__px,
    buildEmailHTML,
    initializeApp,
    state,
    PRESETS,
    FEATURE_LIBRARY,
    DEFAULT_PRICING_ITEMS,
    __setFetchImageAsDataUrl__(fn) {
      fetchImageAsDataUrlImpl = typeof fn === 'function' ? fn : defaultFetchImageAsDataUrl;
    },
    __resetFetchImageAsDataUrl__() {
      fetchImageAsDataUrlImpl = defaultFetchImageAsDataUrl;
    },
  };
}

(function attachHandlers() {
  if (typeof document === 'undefined') {
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
})();

