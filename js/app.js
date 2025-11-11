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
    panelImage: null,
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




// codex/refactor-email-export-layout-qkps6u
const EMAIL_CURRENCY_FORMATTER = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function formatEmailCurrency(value) {
  const formatted = EMAIL_CURRENCY_FORMATTER.format(Math.max(0, Number(value) || 0));
  if (formatted.startsWith('$')) {
    return `A$${formatted.slice(1)}`;
  }
  return formatted;
}

function getEmailFieldValue(doc, id) {
  if (!doc || typeof doc.getElementById !== 'function') {
    return '';
  }
  const el = doc.getElementById(id);
  if (!el) {
    return '';
  }
  let raw = '';
  if (typeof el.value === 'string') {
    raw = el.value;
  } else if (typeof el.textContent === 'string') {
    raw = el.textContent;
  }
  return String(raw || '').replace(/\r\n/g, '\n').trim();
}

function getEmailFieldLines(doc, id) {
  const value = getEmailFieldValue(doc, id);
  if (!value) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resolveEmailBrand() {
  const presetKey = state && state.preset;
  const preset = (PRESETS && presetKey && PRESETS[presetKey]) || (PRESETS && PRESETS.navy) || {};
  return {
    fontFamily: "'TelstraText', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    colorHeading: preset.headline || '#0B1220',
    colorText: '#273349',
    colorMuted: '#5B6573',
    priceCardShade: '#F3F4F9',
  };
}

function buildFeaturesForEmail() {
  if (!Array.isArray(state.features)) {
    return [];
  }
  const iconMap = (typeof window !== 'undefined' && window.__ICON_DATA__ && typeof window.__ICON_DATA__ === 'object')
    ? window.__ICON_DATA__
    : {};
  return state.features
    .filter((feature) => feature && (feature.t || feature.c || feature.img || feature.icon || feature.assetKey))
    .map((feature) => {
      const title = feature.t ? String(feature.t).trim() : '';
      const copy = feature.c ? String(feature.c).trim() : '';
      let description = '';
      let bullets = [];
      if (copy.includes('\n')) {
        bullets = copy.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
      } else {
        description = copy;
      }
      const canonicalKey = typeof feature.icon === 'string' && feature.icon
        ? feature.icon
        : (typeof feature.assetKey === 'string' && feature.assetKey ? feature.assetKey : null);
      const iconSrc = feature.img || (canonicalKey && iconMap[canonicalKey] ? iconMap[canonicalKey] : '');
      const image = iconSrc
        ? {
            src: iconSrc,
            width: clampIconSizeValue(feature.size, feature.hero),
            alt: title || 'Feature image',
            assetKey: canonicalKey || undefined,
          }
        : null;
      return {
        title,
        description,
        bullets,
        image,
        isHero: Boolean(feature.hero),
      };
    })
    .filter((feature) => feature.title || feature.description || (feature.bullets && feature.bullets.length) || feature.image);
}

function buildPricingTableHTMLForEmail(brand) {
  const items = Array.isArray(state.pricing?.items) ? state.pricing.items : [];
  const rows = [];
  items.forEach((item) => {
    if (!item) {
      return;
    }
    const label = String(item.label || '').trim();
    const unit = String(item.unit || '').trim();
    const qtyValue = Number(item.qty);
    const priceValue = Number(item.price);
    const hasData = label || unit || Number.isFinite(qtyValue) || Number.isFinite(priceValue);
    if (!hasData) {
      return;
    }
    const qtyText = Number.isFinite(qtyValue) && qtyValue > 0 ? String(qtyValue) : '';
    const baseTotal = Number.isFinite(qtyValue) && qtyValue > 0 ? priceValue * qtyValue : priceValue;
    let priceText = '';
    if (Number.isFinite(baseTotal) && baseTotal > 0) {
      const total = state.pricing.gst === 'inc' ? baseTotal * 1.1 : baseTotal;
      priceText = formatEmailCurrency(total);
    } else if (Number.isFinite(priceValue) && priceValue > 0) {
      const total = state.pricing.gst === 'inc' ? priceValue * 1.1 : priceValue;
      priceText = formatEmailCurrency(total);
    } else if (label) {
      priceText = 'Included';
    }
    rows.push([
      label || '&nbsp;',
      qtyText || '&nbsp;',
      unit || '&nbsp;',
      priceText || '&nbsp;',
    ]);
  });
  if (!rows.length) {
    return '';
  }
  const headerLabel = state.pricing.gst === 'inc' ? 'Price (inc GST)' : 'Price (ex GST)';
  const headerCells = ['Item', 'Qty', 'Unit', headerLabel];
  const headerHtml = headerCells
    .map((text) => `<th style="font-family:${esc(brand.fontFamily)}; font-size:15px; font-weight:600; color:${esc(brand.colorHeading)}; background-color:rgba(0, 0, 0, 0.04); padding:12px 10px; text-align:left;">${esc(text)}</th>`)
    .join('');
  const rowHtml = rows
    .map((cells) => `<tr>${cells.map((text) => `<td style="font-family:${esc(brand.fontFamily)}; font-size:15px; line-height:1.55; color:${esc(brand.colorText)}; padding:12px 10px; border-bottom:1px solid rgba(0, 0, 0, 0.08);">${text === '&nbsp;' ? '&nbsp;' : esc(String(text))}</td>`).join('')}</tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid rgba(0, 0, 0, 0.1); border-radius:16px; overflow:hidden;">`
    + `<thead><tr>${headerHtml}</tr></thead>`
    + `<tbody>${rowHtml}</tbody>`
    + '</table>';
}

function buildPriceCardForEmail(brand) {
  const monthlyValue = Number(state.pricing?.monthly) || 0;
  const termValue = Number(state.pricing?.term) || 0;
  const displayMonthly = state.pricing?.gst === 'inc' ? monthlyValue * 1.1 : monthlyValue;
  const gstLabel = state.pricing?.gst === 'inc' ? 'inc GST' : 'ex GST';
  const amountText = `${formatEmailCurrency(displayMonthly)} ${gstLabel}`;
  const termText = termValue ? `Term: ${termValue} months` : '';
  const parts = [];
  parts.push(`<div style="font-family:${esc(brand.fontFamily)}; font-size:14px; font-weight:600; color:${esc(brand.colorMuted)};">Monthly investment</div>`);
  parts.push(`<div style="font-family:${esc(brand.fontFamily)}; font-size:30px; font-weight:700; color:${esc(brand.colorHeading)}; margin-top:6px;">${esc(amountText)}</div>`);
  if (termText) {
    parts.push(`<div style="font-family:${esc(brand.fontFamily)}; font-size:14px; color:${esc(brand.colorText)}; margin-top:8px;">${esc(termText)}</div>`);
  }
  return {
    show: Boolean(parts.length),
    html: parts.join(''),
    shadedBgColor: brand.priceCardShade || '#F3F4F9',
  };
}

function captureBannerForEmail(doc) {
  if (!doc || typeof doc.getElementById !== 'function') {
    return null;
  }
  const canvas = doc.getElementById('banner');
  if (canvas && typeof canvas.toDataURL === 'function') {
    try {
      const data = canvas.toDataURL('image/png', 1.0);
      if (data && data.startsWith('data:image/')) {
        return data;
      }
    } catch (error) {
      // ignore canvas read errors
    }
  }
  const fallback = doc.getElementById('pageBanner') || doc.getElementById('pageBanner2');
  if (fallback && fallback.src) {
    return {
      src: fallback.src,
      alt: fallback.alt || 'Proposal banner',
    };
  }
  return null;
}

function collectDataSourcesForEmail(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return [];
  }

  const selectorGroups = [
    '[data-export="data-sources"] [data-export-source]',
    '[data-export="data-sources"] [data-source]',
    '[data-export="data-sources"] li',
    '[data-export-source]',
    '[data-preview-source]',
    '[data-selected-source]',
    '[data-source-item]',
  ];

  const seen = new Set();
  const values = [];

  const extractText = (node) => {
    if (!node) {
      return '';
    }
    if (typeof node.getAttribute === 'function') {
      const dataValue = node.getAttribute('data-source-label') || node.getAttribute('data-label');
      if (dataValue && dataValue.trim()) {
        return dataValue.trim();
      }
    }
    if (typeof node.textContent === 'string' && node.textContent.trim()) {
      return node.textContent.trim();
    }
    if (typeof node.value === 'string' && node.value.trim()) {
      return node.value.trim();
    }
    return '';
  };

  for (const selector of selectorGroups) {
    let nodes;
    try {
      nodes = doc.querySelectorAll(selector);
    } catch (error) {
      nodes = null;
    }
    if (!nodes || !nodes.length) {
      continue;
    }
    for (const node of nodes) {
      const text = extractText(node);
      if (!text || seen.has(text)) {
        continue;
      }
      seen.add(text);
      values.push(text);
    }
    if (values.length) {
      break;
    }
  }

  return values;
}

function collectProposalForEmail(doc) {
  const brand = resolveEmailBrand();
  const banner = captureBannerForEmail(doc);
  const summary = getEmailFieldValue(doc, 'summaryEdit');
  const keyBenefits = getEmailFieldLines(doc, 'benefitsEdit');
  const terms = getEmailFieldLines(doc, 'assumptionsEdit').join('\n');
  return {
    banner,
    brand,
    customer: getEmailFieldValue(doc, 'customer'),
    ref: getEmailFieldValue(doc, 'ref'),
    headlineMain: getEmailFieldValue(doc, 'hero') || state.banner?.text || '',
    headlineSub: getEmailFieldValue(doc, 'subHero'),
    executiveSummary: summary,
    keyBenefits,
    features: buildFeaturesForEmail(),
    pricingTableHTML: buildPricingTableHTMLForEmail(brand),
    priceCard: buildPriceCardForEmail(brand),
    commercialTerms: terms,
    dataSources: collectDataSourcesForEmail(doc),
  };
}


// main
let emailBuilderOverride = null;

function resolveEmailBuilder() {
  if (emailBuilderOverride) {
    return emailBuilderOverride;
  }
  if (typeof window !== 'undefined' && window.PropBuilderEmailExport && typeof window.PropBuilderEmailExport.generateEmailExport === 'function') {
    return window.PropBuilderEmailExport.generateEmailExport;
  }
  try {
    const mod = require('./emailExport');
    if (mod && typeof mod.generateEmailExport === 'function') {
      return mod.generateEmailExport;
    }
  } catch (error) {
    // ignore module resolution errors in browser
  }
  return null;
}

async function buildEmailHTML() {
  const doc = typeof document !== 'undefined' ? document : (typeof global !== 'undefined' && global.document ? global.document : null);
  if (!doc) {
    return '';
  }
  const builder = resolveEmailBuilder();
  if (!builder) {
    throw new Error('Email export builder unavailable');
  }
  const result = await builder(doc);
  return result && result.html ? result.html : '';
}

async function exportEmailHTML() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) {
    return;
  }
  const html = await buildEmailHTML();
  if (!html) {
    throw new Error('No email HTML generated');
  }
  triggerDownloadFromText(doc, 'TBTC_VIC_EAST_Proposal.html', html, 'text/html;charset=utf-8');
}

function triggerDownloadFromText(doc, filename, text, mimeType = 'text/plain;charset=utf-8') {
  if (!doc || !filename) {
    return;
  }
  const body = doc.body || doc.documentElement;
  if (!body) {
    return;
  }
  const safeText = typeof text === 'string' ? text : '';
  let url = null;
  let link = null;
  try {
    if (typeof Blob === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([safeText], { type: mimeType });
      url = URL.createObjectURL(blob);
    } else {
      url = `data:${mimeType},${encodeURIComponent(safeText)}`;
    }
    link = doc.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    body.appendChild(link);
    link.click();
  } finally {
    if (link && link.parentNode) {
      link.parentNode.removeChild(link);
    }
    if (url && url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}

function ensureDocumentObject(doc) {
  if (doc && typeof doc.getElementById === 'function') {
    return doc;
  }
  if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
    return document;
  }
  throw new Error('A document instance is required');
}

function getInputElement(doc, id) {
  if (!doc || typeof doc.getElementById !== 'function') {
    return null;
  }
  return doc.getElementById(id);
}

function getInputValue(doc, id, fallback = '') {
  const el = getInputElement(doc, id);
  if (el && typeof el.value === 'string') {
    return el.value;
  }
  return fallback;
}

function getCheckboxValue(doc, id, fallback = false) {
  const el = getInputElement(doc, id);
  if (el && typeof el.checked === 'boolean') {
    return Boolean(el.checked);
  }
  return Boolean(fallback);
}

function getSelectValue(doc, id, fallback = '') {
  const el = getInputElement(doc, id);
  if (el && typeof el.value === 'string') {
    return el.value || fallback;
  }
  return fallback;
}

function setInputValue(doc, id, value) {
  const el = getInputElement(doc, id);
  if (el && 'value' in el) {
    el.value = value == null ? '' : String(value);
  }
}

function setCheckboxValue(doc, id, checked) {
  const el = getInputElement(doc, id);
  if (el && typeof el.checked === 'boolean') {
    el.checked = Boolean(checked);
  }
}

function setSelectValue(doc, id, value) {
  const el = getInputElement(doc, id);
  if (el && typeof el.value === 'string') {
    el.value = value == null ? '' : String(value);
  }
}

function readRadioValue(doc, name, fallback) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return fallback;
  }
  const inputs = Array.from(doc.querySelectorAll('input'));
  let first = null;
  for (const input of inputs) {
    if (!input || typeof input.getAttribute !== 'function') {
      continue;
    }
    if ((input.getAttribute('type') || '').toLowerCase() !== 'radio') {
      continue;
    }
    if ((input.getAttribute('name') || '') !== name) {
      continue;
    }
    if (first == null) {
      first = input.value || '';
    }
    if (input.checked) {
      return input.value || (first != null ? first : fallback);
    }
  }
  if (first != null && first !== '') {
    return first;
  }
  return fallback;
}

function setRadioValue(doc, name, value) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return value;
  }
  const inputs = Array.from(doc.querySelectorAll('input'));
  let firstMatch = null;
  let matched = false;
  for (const input of inputs) {
    if (!input || typeof input.getAttribute !== 'function') {
      continue;
    }
    if ((input.getAttribute('type') || '').toLowerCase() !== 'radio') {
      continue;
    }
    if ((input.getAttribute('name') || '') !== name) {
      continue;
    }
    if (firstMatch == null) {
      firstMatch = input;
    }
    const isMatch = input.value === value;
    input.checked = isMatch;
    if (isMatch) {
      matched = true;
    }
  }
  if (!matched && firstMatch) {
    firstMatch.checked = true;
    return firstMatch.value || value;
  }
  return matched ? value : (firstMatch ? firstMatch.value : value);
}

function toNumeric(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getIconMap() {
  if (typeof window !== 'undefined' && window && typeof window.__ICON_DATA__ === 'object' && window.__ICON_DATA__) {
    return window.__ICON_DATA__;
  }
  return {};
}

function resolveIconImage(assetKey) {
  if (!assetKey) {
    return '';
  }
  const map = getIconMap();
  if (map && typeof map[assetKey] === 'string' && map[assetKey]) {
    return map[assetKey];
  }
  return '';
}

function sanitizePricingItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => ({
    label: typeof item?.label === 'string' ? item.label : '',
    qty: toNumeric(item?.qty, 0),
    unit: typeof item?.unit === 'string' ? item.unit : '',
    price: toNumeric(item?.price, 0),
  }));
}

function sanitizeFeatureSnapshot(feature) {
  if (!feature || typeof feature !== 'object') {
    return null;
  }
  const title = typeof feature.t === 'string' ? feature.t : (typeof feature.title === 'string' ? feature.title : '');
  const copy = typeof feature.c === 'string' ? feature.c : (typeof feature.copy === 'string' ? feature.copy : '');
  const hero = Boolean(feature.hero);
  const rawSize = toNumeric(feature.size, hero ? 96 : 56);
  const size = clampIconSizeValue(rawSize, hero);
  const icon = typeof feature.icon === 'string' && feature.icon.trim() ? feature.icon.trim() : null;
  const assetKey = typeof feature.assetKey === 'string' && feature.assetKey.trim() ? feature.assetKey.trim() : (icon || null);
  const imgName = typeof feature.imgName === 'string' && feature.imgName.trim() ? feature.imgName.trim() : (assetKey || null);
  const img = typeof feature.img === 'string' && feature.img.trim() ? feature.img.trim() : '';
  const fallbackImg = assetKey ? resolveIconImage(assetKey) : '';
  if (!title && !copy && !img && !fallbackImg) {
    return null;
  }
  return {
    t: title,
    c: copy,
    hero,
    size,
    icon: assetKey,
    assetKey,
    img: (img || fallbackImg || TRANSPARENT_PNG),
    imgName: imgName || null,
  };
}

function collectProposalSnapshot(docParam) {
  const doc = ensureDocumentObject(docParam);
  const bannerFit = readRadioValue(doc, 'fit', state.banner.fit || 'contain');
  const snapshot = {
    version: 1,
    preset: getSelectValue(doc, 'preset', state.preset || 'navy'),
    banner: {
      text: getInputValue(doc, 'bannerTxt', state.banner.text || DEFAULT_BANNER_TEXT),
      bold: getCheckboxValue(doc, 'bnBold', state.banner.bold),
      textSize: toNumeric(getInputValue(doc, 'bnTextSize', state.banner.textSize), state.banner.textSize),
      layout: getSelectValue(doc, 'bannerLayout', state.banner.layout),
      size: getSelectValue(doc, 'bannerSize', state.banner.size),
      fit: bannerFit,
      scale: toNumeric(getInputValue(doc, 'bnScale', state.banner.scale), state.banner.scale),
      offsetX: toNumeric(getInputValue(doc, 'bnX', state.banner.offsetX), state.banner.offsetX),
      offsetY: toNumeric(getInputValue(doc, 'bnY', state.banner.offsetY), state.banner.offsetY),
      logoMode: getSelectValue(doc, 'bannerLogoMode', state.banner.logoMode || 'auto'),
      panelImage: typeof state.banner.panelImage === 'string' && state.banner.panelImage ? state.banner.panelImage : null,
    },
    docType: getSelectValue(doc, 'docType', state.docType || DEFAULT_DOC_TYPE),
    pricing: {
      gst: getSelectValue(doc, 'gstMode', state.pricing.gst || DEFAULT_GST_MODE),
      monthly: toNumeric(getInputValue(doc, 'monthly', state.pricing.monthly), state.pricing.monthly || 0),
      term: toNumeric(getInputValue(doc, 'term', state.pricing.term), state.pricing.term || 0),
      items: Array.isArray(state.pricing.items)
        ? state.pricing.items.map((item) => ({
            label: typeof item.label === 'string' ? item.label : '',
            qty: toNumeric(item.qty, 0),
            unit: typeof item.unit === 'string' ? item.unit : '',
            price: toNumeric(item.price, 0),
          }))
        : [],
    },
    customer: getInputValue(doc, 'customer', ''),
    ref: getInputValue(doc, 'ref', ''),
    hero: getInputValue(doc, 'hero', ''),
    subHero: getInputValue(doc, 'subHero', ''),
    summary: getInputValue(doc, 'summaryEdit', ''),
    benefits: getInputValue(doc, 'benefitsEdit', ''),
    assumptions: getInputValue(doc, 'assumptionsEdit', ''),
    features: Array.isArray(state.features)
      ? state.features.map((feature) => ({
          t: typeof feature.t === 'string' ? feature.t : '',
          c: typeof feature.c === 'string' ? feature.c : '',
          hero: Boolean(feature.hero),
          size: toNumeric(feature.size, feature.hero ? 96 : 56),
          icon: typeof feature.icon === 'string' && feature.icon ? feature.icon : null,
          assetKey: typeof feature.assetKey === 'string' && feature.assetKey ? feature.assetKey : (typeof feature.icon === 'string' && feature.icon ? feature.icon : null),
          img: typeof feature.img === 'string' ? feature.img : '',
          imgName: typeof feature.imgName === 'string' && feature.imgName ? feature.imgName : null,
        }))
      : [],
  };
  return snapshot;
}

function applyProposalSnapshot(snapshot, docParam) {
  const doc = ensureDocumentObject(docParam);
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Invalid proposal snapshot');
  }
  const bannerData = snapshot.banner && typeof snapshot.banner === 'object' ? snapshot.banner : {};
  const presetKey = typeof snapshot.preset === 'string' && PRESETS[snapshot.preset] ? snapshot.preset : 'navy';
  state.preset = presetKey;
  setSelectValue(doc, 'preset', presetKey);

  const bannerText = typeof bannerData.text === 'string' ? bannerData.text : DEFAULT_BANNER_TEXT;
  state.banner.text = bannerText;
  setInputValue(doc, 'bannerTxt', bannerText);

  const bannerBold = bannerData.bold != null ? Boolean(bannerData.bold) : Boolean(state.banner.bold);
  state.banner.bold = bannerBold;
  setCheckboxValue(doc, 'bnBold', bannerBold);

  const bannerTextSize = toNumeric(bannerData.textSize, state.banner.textSize);
  state.banner.textSize = bannerTextSize;
  setInputValue(doc, 'bnTextSize', bannerTextSize);

  const bannerLayout = typeof bannerData.layout === 'string' && bannerData.layout ? bannerData.layout : state.banner.layout;
  state.banner.layout = bannerLayout;
  setSelectValue(doc, 'bannerLayout', bannerLayout);

  const bannerSize = typeof bannerData.size === 'string' && bannerData.size ? bannerData.size : state.banner.size;
  state.banner.size = bannerSize;
  setSelectValue(doc, 'bannerSize', bannerSize);

  const bannerScale = toNumeric(bannerData.scale, state.banner.scale);
  state.banner.scale = bannerScale;
  setInputValue(doc, 'bnScale', bannerScale);

  const bannerOffsetX = toNumeric(bannerData.offsetX, state.banner.offsetX);
  state.banner.offsetX = bannerOffsetX;
  setInputValue(doc, 'bnX', bannerOffsetX);

  const bannerOffsetY = toNumeric(bannerData.offsetY, state.banner.offsetY);
  state.banner.offsetY = bannerOffsetY;
  setInputValue(doc, 'bnY', bannerOffsetY);

  const bannerFit = typeof bannerData.fit === 'string' && bannerData.fit ? bannerData.fit : state.banner.fit;
  state.banner.fit = setRadioValue(doc, 'fit', bannerFit) || bannerFit;

  const bannerLogoMode = typeof bannerData.logoMode === 'string' && bannerData.logoMode ? bannerData.logoMode : state.banner.logoMode;
  state.banner.logoMode = bannerLogoMode || 'auto';
  setSelectValue(doc, 'bannerLogoMode', state.banner.logoMode);

  const bannerPanelImage = typeof bannerData.panelImage === 'string' && bannerData.panelImage ? bannerData.panelImage : null;
  state.banner.panelImage = bannerPanelImage;

  const docTypeValue = typeof snapshot.docType === 'string' ? snapshot.docType : state.docType;
  state.docType = docTypeValue === 'one' || docTypeValue === 'two' ? docTypeValue : DEFAULT_DOC_TYPE;
  setSelectValue(doc, 'docType', state.docType);

  const pricingData = snapshot.pricing && typeof snapshot.pricing === 'object' ? snapshot.pricing : {};
  const gstMode = pricingData.gst === 'inc' ? 'inc' : 'ex';
  state.pricing.gst = gstMode;
  setSelectValue(doc, 'gstMode', gstMode);

  state.pricing.monthly = toNumeric(pricingData.monthly, 0);
  setInputValue(doc, 'monthly', state.pricing.monthly);

  state.pricing.term = toNumeric(pricingData.term, 0);
  setInputValue(doc, 'term', state.pricing.term);

  const sanitizedItems = sanitizePricingItems(pricingData.items).slice(0, 64);
  state.pricing.items.length = 0;
  sanitizedItems.forEach((item) => {
    state.pricing.items.push({
      label: item.label,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
    });
  });

  setInputValue(doc, 'customer', typeof snapshot.customer === 'string' ? snapshot.customer : '');
  setInputValue(doc, 'ref', typeof snapshot.ref === 'string' ? snapshot.ref : '');
  setInputValue(doc, 'hero', typeof snapshot.hero === 'string' ? snapshot.hero : '');
  setInputValue(doc, 'subHero', typeof snapshot.subHero === 'string' ? snapshot.subHero : '');
  setInputValue(doc, 'summaryEdit', typeof snapshot.summary === 'string' ? snapshot.summary : '');
  setInputValue(doc, 'benefitsEdit', typeof snapshot.benefits === 'string' ? snapshot.benefits : '');
  setInputValue(doc, 'assumptionsEdit', typeof snapshot.assumptions === 'string' ? snapshot.assumptions : '');

  const featuresSnapshot = Array.isArray(snapshot.features) ? snapshot.features : [];
  const sanitizedFeatures = featuresSnapshot.slice(0, MAX_FEATURES)
    .map(sanitizeFeatureSnapshot)
    .filter(Boolean);
  state.features.length = 0;
  sanitizedFeatures.forEach((feature) => {
    state.features.push({
      t: feature.t,
      c: feature.c,
      hero: feature.hero,
      size: feature.size,
      icon: feature.icon,
      assetKey: feature.assetKey,
      img: feature.img,
      imgName: feature.imgName,
    });
  });
  if (typeof window !== 'undefined') {
    window._features = state.features;
  }

  return collectProposalSnapshot(doc);
}
function initializeApp() {
  if (typeof document === 'undefined') {
    return;
  }

  const doc = document;
  const exportEmailBtn = doc.getElementById('btnExportEmail');
  const saveProposalBtn = doc.getElementById('btnSaveProposal');
  const loadProposalBtn = doc.getElementById('btnLoadProposal');
  const proposalUploadInput = doc.getElementById('proposalUpload');
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

  const resolveIconKey = (name, options = {}) => {
    const { allowFallback = true } = options;
    if (name && iconMap[name]) {
      return name;
    }
    if (!allowFallback) {
      return null;
    }
    const keys = Object.keys(iconMap);
    if (keys.length) {
      return keys[0];
    }
    return null;
  };

  const resolveIcon = (name) => {
    const key = resolveIconKey(name);
    if (key && iconMap[key]) {
      return iconMap[key];
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
      const requestedIcon = typeof feature.icon === 'string' && feature.icon
        ? feature.icon
        : (typeof feature.assetKey === 'string' && feature.assetKey
            ? feature.assetKey
            : (typeof feature.imgName === 'string' && feature.imgName ? feature.imgName : null));
      const hasExplicitKey = Boolean(requestedIcon);
      const hasCustomImage = typeof feature.img === 'string'
        && /^data:image\//.test(feature.img)
        && !hasExplicitKey;
      const iconKey = resolveIconKey(requestedIcon, { allowFallback: !hasCustomImage });
      state.features.push({
        t: String(feature.t || feature.title || ""),
        c: String(feature.c || feature.copy || ""),
        img: feature.img || feature.image || (iconKey ? resolveIcon(iconKey) : TRANSPARENT_PNG),
        icon: iconKey || null,
        assetKey: iconKey || null,
        imgName: typeof feature.imgName === 'string' && feature.imgName ? feature.imgName : (iconKey || null),
        hero: Boolean(feature.hero),
        size: Number(feature.size || feature.width || 56) || 56
      });
    }
  } else {
    for (const template of FEATURE_LIBRARY) {
      const templateIconKey = resolveIconKey(template.icon, { allowFallback: true });
      state.features.push({
        t: template.t,
        c: template.c,
        img: templateIconKey ? resolveIcon(templateIconKey) : TRANSPARENT_PNG,
        icon: templateIconKey || null,
        assetKey: templateIconKey || null,
        imgName: templateIconKey || null,
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

  const bannerImageTargets = (() => {
    const targets = [];
    const seen = new Set();
    const addTarget = (el) => {
      if (!el || seen.has(el)) {
        return;
      }
      seen.add(el);
      targets.push(el);
    };
    if (doc && typeof doc.querySelectorAll === 'function') {
      doc.querySelectorAll('img[data-export="banner-image"]').forEach(addTarget);
    }
    addTarget(pageBanner);
    addTarget(previewHeroImg);
    return targets;
  })();

  const updateBannerImageTargets = (src) => {
    bannerImageTargets.forEach((img) => {
      if (!img) {
        return;
      }
      if (typeof src === 'string' && src) {
        img.src = src;
        if (typeof img.removeAttribute === 'function') {
          img.removeAttribute('data-empty-banner');
        }
        if ('hidden' in img) {
          img.hidden = false;
        }
        if (img.style && typeof img.style.removeProperty === 'function') {
          img.style.removeProperty('display');
        }
      } else if (!img.src) {
        if (typeof img.setAttribute === 'function') {
          img.setAttribute('data-empty-banner', '');
        }
      }
    });
  };

  let lastBannerSnapshot = null;
  const pushBannerToPreview = () => {
    if (!bannerCanvas || typeof bannerCanvas.toDataURL !== "function") {
      if (lastBannerSnapshot) {
        updateBannerImageTargets(lastBannerSnapshot);
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
      updateBannerImageTargets(dataUrl);
      return;
    }
    if (lastBannerSnapshot) {
      updateBannerImageTargets(lastBannerSnapshot);
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

  const normalizeCornerRadii = (radii, w, h) => {
    const maxRadius = Math.min(w, h) / 2;
    if (typeof radii === "number") {
      const clamped = Math.min(Math.max(radii, 0), maxRadius);
      return { tl: clamped, tr: clamped, br: clamped, bl: clamped };
    }
    const normalized = { tl: 0, tr: 0, br: 0, bl: 0 };
    if (radii && typeof radii === "object") {
      normalized.tl = Math.min(Math.max(radii.tl || 0, 0), maxRadius);
      normalized.tr = Math.min(Math.max(radii.tr || 0, 0), maxRadius);
      normalized.br = Math.min(Math.max(radii.br || 0, 0), maxRadius);
      normalized.bl = Math.min(Math.max(radii.bl || 0, 0), maxRadius);
    }
    return normalized;
  };

  const buildRoundedRectPath = (ctx, x, y, w, h, radii) => {
    const { tl, tr, br, bl } = normalizeCornerRadii(radii, w, h);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr > 0) {
      ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    } else {
      ctx.lineTo(x + w, y);
    }
    ctx.lineTo(x + w, y + h - br);
    if (br > 0) {
      ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    } else {
      ctx.lineTo(x + w, y + h);
    }
    ctx.lineTo(x + bl, y + h);
    if (bl > 0) {
      ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    } else {
      ctx.lineTo(x, y + h);
    }
    ctx.lineTo(x, y + tl);
    if (tl > 0) {
      ctx.quadraticCurveTo(x, y, x + tl, y);
    } else {
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  const clipRoundedRect = (ctx, x, y, w, h, radii) => {
    buildRoundedRectPath(ctx, x, y, w, h, radii);
    ctx.clip();
  };

  const fillRoundedRect = (ctx, x, y, w, h, radii, fillStyle) => {
    ctx.save();
    buildRoundedRectPath(ctx, x, y, w, h, radii);
    if (fillStyle !== undefined) {
      ctx.fillStyle = fillStyle;
    }
    ctx.fill();
    ctx.restore();
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
      const panelCornerRadius = Math.round(height * 0.18);
      const panelCornerRadii = state.banner.layout === "left"
        ? { br: panelCornerRadius }
        : { bl: panelCornerRadius };

      bannerCtx.save();
      clipRoundedRect(bannerCtx, panelX, 0, panelWidth, height, panelCornerRadii);
      bannerCtx.fillStyle = preset.panel;
      bannerCtx.fillRect(panelX, 0, panelWidth, height);
      bannerCtx.restore();

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
        clipRoundedRect(bannerCtx, panelX, 0, panelWidth, height, panelCornerRadii);
        bannerCtx.drawImage(bannerPanelImage, drawX, drawY, renderWidth, renderHeight);
        bannerCtx.restore();
      }
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

    // Capture an early snapshot so the preview tab isn't left blank while
    // asynchronous logo/image loads finish rendering on the banner canvas.
    pushBannerToPreview();

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

  if (typeof state.banner.panelImage === 'string' && state.banner.panelImage) {
    bannerPanelImage = new Image();
    bannerPanelImage.onload = drawBanner;
    bannerPanelImage.src = state.banner.panelImage;
  }

  const keyFeaturesSection = doc.getElementById('keyFeaturesSection');
  const keyFeaturesList = doc.getElementById('keyFeaturesList');

  const buildFeatureCardElement = (feature, options = {}) => {
    if (!feature) {
      return null;
    }
    const { forceHero = false, context = 'preview' } = options;
    const titleText = feature.t ? String(feature.t).trim() : '';
    const copyText = feature.c ? String(feature.c).trim() : '';
    const canonicalKey = typeof feature.icon === 'string' && feature.icon
      ? feature.icon
      : (typeof feature.assetKey === 'string' && feature.assetKey ? feature.assetKey : null);
    const iconSrc = feature.img || resolveIcon(canonicalKey);
    const assetKey = canonicalKey || null;
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
      if (assetKey) {
        img.dataset.assetKey = assetKey;
      }
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
            state.features[currentFeatureIndex].icon = name;
            state.features[currentFeatureIndex].assetKey = name;
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
      const canonicalKey = typeof feature.icon === 'string' && feature.icon
        ? feature.icon
        : (typeof feature.assetKey === 'string' && feature.assetKey ? feature.assetKey : null);
      img.src = feature.img || resolveIcon(canonicalKey);
      if (canonicalKey) {
        img.dataset.assetKey = canonicalKey;
      } else {
        delete img.dataset.assetKey;
      }
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
          state.features[currentFeatureIndex].icon = null;
          state.features[currentFeatureIndex].assetKey = null;
          state.features[currentFeatureIndex].imgName = null;
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
      const defaultIconKey = resolveIconKey(null, { allowFallback: true });
      state.features.push({
        t: "New feature",
        c: "Describe the benefit...",
        img: defaultIconKey ? resolveIcon(defaultIconKey) : TRANSPARENT_PNG,
        icon: defaultIconKey || null,
        assetKey: defaultIconKey || null,
        imgName: defaultIconKey || null,
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
        const result = typeof reader.result === 'string' ? reader.result : '';
        state.banner.panelImage = result || null;
        if (result) {
          bannerPanelImage = new Image();
          bannerPanelImage.onload = drawBanner;
          bannerPanelImage.src = result;
        } else {
          bannerPanelImage = null;
          drawBanner();
        }
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

  if (exportEmailBtn && typeof exportEmailBtn.addEventListener === 'function') {
    exportEmailBtn.addEventListener('click', async () => {
      try {
        await exportEmailHTML();
      } catch (error) {
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
          console.error('Unable to export email HTML', error);
        }
      }
    });
  }

  if (saveProposalBtn && typeof saveProposalBtn.addEventListener === 'function') {
    saveProposalBtn.addEventListener('click', () => {
      try {
        const snapshot = collectProposalSnapshot(doc);
        const json = JSON.stringify(snapshot, null, 2);
        triggerDownloadFromText(doc, 'TBTC_VIC_EAST_Proposal.json', json, 'application/json');
      } catch (error) {
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
          console.error('Unable to save proposal JSON', error);
        }
      }
    });
  }

  if (loadProposalBtn && typeof loadProposalBtn.addEventListener === 'function' && proposalUploadInput) {
    loadProposalBtn.addEventListener('click', () => {
      proposalUploadInput.click();
    });
  }

  if (proposalUploadInput && typeof proposalUploadInput.addEventListener === 'function') {
    proposalUploadInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        proposalUploadInput.value = '';
        if (!text.trim()) {
          if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
            console.error('Unable to load proposal JSON: file was empty');
          }
          return;
        }
        try {
          const snapshot = JSON.parse(text);
          applyProposalSnapshot(snapshot, doc);
          state.banner.logoMode = populateBannerLogos(state.banner.logoMode);
          if (typeof state.banner.panelImage === 'string' && state.banner.panelImage) {
            bannerPanelImage = new Image();
            bannerPanelImage.onload = drawBanner;
            bannerPanelImage.src = state.banner.panelImage;
          } else {
            bannerPanelImage = null;
          }
          renderFeatureGrid();
          renderFeaturePreview();
          renderItems();
          renderPriceTables();
          renderBenefits();
          renderAssumptions();
          syncTotals();
          syncPreview();
          drawBanner();
        } catch (error) {
          if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
            console.error('Unable to load proposal JSON', error);
          }
        }
      };
      reader.onerror = () => {
        proposalUploadInput.value = '';
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
          console.error('Unable to read proposal JSON', reader.error);
        }
      };
      reader.readAsText(file);
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

}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseSize,
    esc,
    wrapTextLines,
    bulletify,
    __rgbToHex__px,
    buildEmailHTML,
    exportEmailHTML,
    collectProposalSnapshot,
    applyProposalSnapshot,
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
    __setEmailBuilder__(fn) {
      emailBuilderOverride = typeof fn === 'function' ? fn : null;
    },
    __resetEmailBuilder__() {
      emailBuilderOverride = null;
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

