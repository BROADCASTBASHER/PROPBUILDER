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
    icon: 'pictoCiscoHandset104.png',
    size: 72
  },
  {
    t: 'Meraki MX67 cloud security & Wi-Fi',
    c: 'Cloud-managed security appliance with integrated Wi-Fi delivers SD-WAN, threat management and easy dashboard control.',
    icon: 'pictoMerakiCloud104.png',
    size: 68
  },
  {
    t: 'Webex collaboration across devices',
    c: 'Persistent messaging, meetings and calling keep your team connected anywhere on any device.',
    icon: 'pictoWebexCollab104.png',
    size: 68
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
  if (!title && !copy && !image) {
    return null;
  }
  return { title, copy, image, width, height };
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

function buildEmailHTML() {
  if (typeof document === 'undefined') {
    return '';
  }

  const escapeHTML = (value) => {
    const raw = String(value == null ? '' : value);
    if (typeof esc === 'function') {
      return esc(raw);
    }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const parseSizeValue = (value, fallbackWidth, fallbackHeight) => {
    if (typeof parseSize === 'function') {
      const result = parseSize(value, fallbackWidth, fallbackHeight);
      if (Array.isArray(result)) {
        return result;
      }
    }
    const defaults = [fallbackWidth, fallbackHeight];
    if (value == null) {
      return defaults;
    }
    const match = String(value).trim().toLowerCase().match(/^(\d+)(?:\s*[x×]\s*(\d+))?$/);
    if (!match) {
      return defaults;
    }
    const width = Number.parseInt(match[1], 10);
    const height = match[2] ? Number.parseInt(match[2], 10) : width;
    return [Number.isFinite(width) ? width : defaults[0], Number.isFinite(height) ? height : (Number.isFinite(width) ? width : defaults[1])];
  };

  const normaliseCard = (card, defaults) => {
    if (!card || typeof card !== 'object') {
      return null;
    }
    const title = String(card.t ?? card.title ?? '').trim();
    const copy = String(card.c ?? card.copy ?? '').trim();
    const image = String(card.img ?? card.image ?? '').trim();
    const size = parseSizeValue(card.size ?? card.dimensions ?? card.imgSize ?? '', defaults[0], defaults[1]);
    if (!title && !copy && !image) {
      return null;
    }
    return { title, copy, image, width: size[0], height: size[1] };
  };

  const readJSON = (key) => {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  };

  const readHeroCards = () => {
    const stored = readJSON('heroCards');
    if (Array.isArray(stored) && stored.length) {
      return stored.map((card) => normaliseCard(card, [320, 180])).filter(Boolean);
    }
    if (typeof window !== 'undefined' && Array.isArray(window._heroCards)) {
      return window._heroCards.map((card) => normaliseCard(card, [320, 180])).filter(Boolean);
    }
    return [];
  };

  const readFeatures = () => {
    if (typeof window === 'undefined' || !Array.isArray(window._features)) {
      return [];
    }
    return window._features.map((card) => normaliseCard(card, [260, 180])).filter(Boolean);
  };

  const readPriceRows = () => {
    const table = document.getElementById('priceTableView');
    if (!table || typeof table.querySelectorAll !== 'function') {
      return [];
    }
    const rows = table.querySelectorAll('tbody tr');
    if (!rows || !rows.length) {
      return [];
    }
    const output = [];
    for (const row of rows) {
      if (!row || typeof row.querySelectorAll !== 'function') {
        continue;
      }
      const cells = row.querySelectorAll('td');
      if (!cells || !cells.length) {
        continue;
      }
      output.push(Array.from(cells).map((cell) => escapeHTML(cell && cell.textContent ? cell.textContent.trim() : '')));
    }
    return output;
  };

  const heroImageData = (() => {
    const canvas = document.getElementById('banner');
    if (canvas && typeof canvas.toDataURL === 'function') {
      try {
        const data = canvas.toDataURL('image/png');
        if (data) {
          return data;
        }
      } catch (error) {
        // ignore canvas read failures
      }
    }
    const img = document.querySelector('#tab-preview .hero img, #pageBanner, #pageBanner2, img#heroPreview');
    if (img && img.src) {
      return img.src;
    }
    return '';
  })();

  const toHex = (color) => {
    const match = String(color == null ? '' : color).match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) {
      return color ? String(color) : '#E5E6EA';
    }
    const clamp = (value) => {
      const n = Number.parseInt(value, 10);
      const safe = Number.isFinite(n) ? Math.max(0, Math.min(255, n)) : 0;
      const hex = safe.toString(16).toUpperCase();
      return hex.length === 1 ? `0${hex}` : hex;
    };
    return `#${clamp(match[1])}${clamp(match[2])}${clamp(match[3])}`;
  };

  const panelColor = (() => {
    try {
      const el = document.querySelector('#tab-preview .price-card, #tab-preview .preview-box, #pvPriceCard, .price-card');
      if (el) {
        const computed = typeof getComputedStyle === 'function' ? getComputedStyle(el).backgroundColor : null;
        if (computed) {
          return toHex(computed);
        }
      }
    } catch (error) {
      // ignore
    }
    try {
      if (typeof PRESETS !== 'undefined' && typeof state !== 'undefined') {
        const preset = PRESETS && state && PRESETS[state.preset];
        if (preset && preset.panel) {
          return preset.panel;
        }
      }
    } catch (error) {
      // ignore
    }
    return '#E5E6EA';
  })();

  const getText = (id) => {
    const el = document.getElementById(id);
    if (!el || typeof el.textContent !== 'string') {
      return '';
    }
    return el.textContent.trim();
  };

  const customer = getText('pvCustomer');
  const referenceRaw = getText('pvRef');
  const referenceLine = referenceRaw
    ? (referenceRaw.trim().toLowerCase().startsWith('ref') ? referenceRaw : `Ref: ${referenceRaw}`)
    : '';
  const heroTitle = getText('pvHero');
  const heroSubtitle = getText('pvSub');
  const summary = getText('pvSummary');
  const term = getText('pvTerm2') || getText('exportTerm');
  const benefitsNode = document.getElementById('pvBenefits');
  const benefitsList = benefitsNode && typeof benefitsNode.innerHTML === 'string' ? benefitsNode.innerHTML.trim() : '';
  const assumptions = Array.from(document.querySelectorAll('#assumptions li'))
    .map((node) => escapeHTML(node && node.textContent ? node.textContent.trim() : ''))
    .filter((text) => text.length > 0);
  const features = readFeatures();
  const heroCards = readHeroCards();
  const priceRows = readPriceRows();

  const out = [];
  out.push('<!doctype html><html lang="en"><head><meta charset="utf-8">');
  out.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  out.push('<title>Telstra Proposal Summary</title>');
  out.push('<style>');
  out.push("body{margin:0;padding:24px;background:#F6F0E8;color:#0B1220;font-family:'TelstraText',Arial,sans-serif;}");
  out.push('.wrapper{max-width:960px;margin:0 auto;}');
  out.push('.card{background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(11,18,32,0.12);margin-bottom:24px;overflow:hidden;}');
  out.push('.card-header{padding:24px;border-bottom:1px solid #E5E6EA;}');
  out.push('.card-body{padding:24px;}');
  out.push('.card h1{margin:0;font-size:28px;}');
  out.push('.card h2{margin:0;font-size:22px;}');
  out.push('.card h3{margin:0 0 12px;font-size:18px;}');
  out.push('.pill{display:inline-flex;align-items:center;padding:8px 16px;border-radius:999px;font-weight:700;background:' + panelColor + ';color:#fff;}');
  out.push('.feature-grid,.hero-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));}');
  out.push('.feature-card{border:1px solid #E5E6EA;border-radius:16px;padding:16px;background:#FAF7F3;}');
  out.push('.feature-card img{width:100%;height:auto;border-radius:12px;margin-bottom:12px;display:block;}');
  out.push('.pricing-table{width:100%;border-collapse:collapse;font-size:14px;}');
  out.push('.pricing-table th,.pricing-table td{border-top:1px solid #E5E6EA;padding:12px;text-align:left;vertical-align:top;}');
  out.push('.pricing-table thead th{background:#EEF2FF;font-weight:700;}');
  out.push('ul{margin:0;padding-left:20px;}');
  out.push('</style></head><body><div class="wrapper">');

  out.push('<section class="card intro">');
  if (heroImageData) {
    out.push(`<img src="${escapeHTML(heroImageData)}" alt="Banner" style="width:100%;display:block;">`);
  }
  out.push('<div class="card-body">');
  if (customer) {
    out.push(`<div class="pill">${escapeHTML(customer)}</div>`);
  }
  if (referenceLine) {
    out.push(`<p style="margin:12px 0 0;font-weight:600;">${escapeHTML(referenceLine)}</p>`);
  }
  if (heroTitle) {
    out.push(`<h1 style="margin:16px 0 8px;">${escapeHTML(heroTitle)}</h1>`);
  }
  if (heroSubtitle) {
    out.push(`<p style="margin:0 0 16px;font-size:18px;color:#5B6573;">${escapeHTML(heroSubtitle)}</p>`);
  }
  out.push('</div></section>');

  out.push('<section class="card summary">');
  out.push('<div class="card-header"><h2>Executive summary</h2></div>');
  out.push('<div class="card-body">');
  if (summary) {
    out.push(`<p style="margin:0;font-size:16px;line-height:1.6;">${escapeHTML(summary)}</p>`);
  }
  if (benefitsList) {
    out.push('<div style="margin-top:24px;">');
    out.push('<h3>Key benefits</h3>');
    out.push(`<ul>${benefitsList}</ul>`);
    out.push('</div>');
  }
  out.push('</div></section>');

  if (features.length) {
    out.push('<section class="card features">');
    out.push('<div class="card-header"><h2>Features &amp; benefits</h2><p style="margin:8px 0 0;color:#5B6573;">Key Features Included</p></div>');
    out.push('<div class="card-body feature-grid">');
    for (const feature of features) {
      out.push('<div class="feature-card">');
      if (feature.image) {
        out.push(`<img src="${escapeHTML(feature.image)}" alt="${escapeHTML(feature.title || 'Feature')}" style="max-height:${feature.height}px;object-fit:contain;">`);
      }
      if (feature.title) {
        out.push(`<h3>${escapeHTML(feature.title)}</h3>`);
      }
      if (feature.copy) {
        out.push(`<p style="margin:0;font-size:15px;line-height:1.5;">${escapeHTML(feature.copy)}</p>`);
      }
      out.push('</div>');
    }
    out.push('</div></section>');
  }

  if (heroCards.length) {
    out.push('<section class="card hero-cards">');
    out.push('<div class="card-header"><h2>Hero success stories</h2></div>');
    out.push('<div class="card-body hero-grid">');
    for (const card of heroCards) {
      out.push('<div class="feature-card">');
      if (card.image) {
        out.push(`<img src="${escapeHTML(card.image)}" alt="${escapeHTML(card.title || 'Hero card')}" style="max-height:${card.height}px;object-fit:contain;">`);
      }
      if (card.title) {
        out.push(`<h3>${escapeHTML(card.title)}</h3>`);
      }
      if (card.copy) {
        out.push(`<p style="margin:0;font-size:15px;line-height:1.5;">${escapeHTML(card.copy)}</p>`);
      }
      out.push('</div>');
    }
    out.push('</div></section>');
  }

  if (priceRows.length) {
    out.push('<section class="card pricing">');
    out.push('<div class="card-header"><h2>Inclusions &amp; pricing breakdown</h2></div>');
    out.push('<div class="card-body">');
    if (term) {
      out.push(`<p style="margin:0 0 12px;font-weight:600;">Term: ${escapeHTML(term)}</p>`);
    }
    out.push('<table class="pricing-table"><thead><tr><th>Inclusion</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>');
    for (const row of priceRows) {
      const [name = '', qty = '', unit = '', total = ''] = row;
      out.push(`<tr><td>${name}</td><td>${qty}</td><td>${unit}</td><td>${total}</td></tr>`);
    }
    out.push('</tbody></table>');
    out.push('</div></section>');
  }

  if (assumptions.length) {
    out.push('<section class="card assumptions">');
    out.push('<div class="card-header"><h2>Commercial terms &amp; dependencies</h2></div>');
    out.push('<div class="card-body">');
    out.push(`<ul>${assumptions.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    out.push('</div></section>');
  }

  out.push('</div></body></html>');
  return out.join('');
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
  const featurePreview = doc.getElementById('featuresView');
  const addFeatureBtn = doc.getElementById('btnAddFeat');
  const iconModal = doc.getElementById('iconModal');
  const iconGallery = doc.getElementById('iconGallery');
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
  let pvSub = doc.getElementById('pvSub');
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
    pvHero.parentElement.appendChild(pvSub);
  }

  state.preset = presetSelect ? (presetSelect.value || state.preset) : state.preset;
  state.banner.text = bannerTextInput ? (bannerTextInput.value || DEFAULT_BANNER_TEXT) : DEFAULT_BANNER_TEXT;
  state.banner.bold = bannerBoldInput ? Boolean(bannerBoldInput.checked) : state.banner.bold;
  state.banner.layout = bannerLayoutSelect ? (bannerLayoutSelect.value || state.banner.layout) : state.banner.layout;
  state.banner.size = bannerSizeSelect ? (bannerSizeSelect.value || state.banner.size) : state.banner.size;
  state.banner.logoMode = bannerLogoSelect ? (bannerLogoSelect.value || state.banner.logoMode) : state.banner.logoMode;
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
      const priceText = baseTotal > 0 ? toCurrency(displayTotal) : (priceValue > 0 ? toCurrency(displayTotal) : '');

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
      row.className = 'item-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'minmax(0, 1fr) 80px 100px 140px auto';
      row.style.gap = '8px';
      row.style.alignItems = 'center';

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

  const pushBannerToPreview = () => {
    if (!bannerCanvas || typeof bannerCanvas.toDataURL !== "function") {
      return;
    }
    try {
      const data = bannerCanvas.toDataURL('image/png');
      if (pageBanner) {
        pageBanner.src = data;
      }
      if (previewHeroImg) {
        previewHeroImg.src = data;
      }
    } catch (error) {
      // ignore canvas taint errors
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
    const textMaxWidth = isHeadlineOnly ? (width - (textPadding * 2)) : (width - panelWidth - (textPadding * 2));
    const textX = state.banner.layout === "left" && !isHeadlineOnly
      ? panelWidth + textPadding
      : textPadding;
    const textY = Math.round(height * (isHeadlineOnly ? 0.25 : 0.32));
    const maxLines = isHeadlineOnly ? 2 : 3;
    const weight = state.banner.bold ? "700" : "400";

    let fontSize = Math.max(26, Math.round(height * 0.2));
    const minFontSize = Math.max(20, Math.round(fontSize * 0.7));
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

    bannerCtx.font = `${weight} ${fontSize}px TelstraText, Arial, sans-serif`;
    bannerCtx.fillStyle = preset.headline;
    bannerCtx.textBaseline = "top";
    wrapTextLines(bannerCtx, state.banner.text || "", textX, textY, textMaxWidth, Math.round(fontSize * 1.12), maxLines);

    const logoSrc = resolveLogo();
    if (logoSrc) {
      const logoImage = new Image();
      logoImage.onload = () => {
        const padding = Math.round(height * 0.08);
        const maxLogoHeight = Math.round(height * 0.26);
        const ratio = logoImage.naturalWidth > 0 ? logoImage.naturalWidth / logoImage.naturalHeight : 1;
        const logoHeight = maxLogoHeight;
        const logoWidth = Math.round(logoHeight * ratio);
        let logoX;
        if (isHeadlineOnly || state.banner.layout === "left") {
          logoX = width - logoWidth - padding;
        } else if (state.banner.layout === "right") {
          logoX = padding;
        } else {
          logoX = width - logoWidth - padding;
        }
        const logoY = padding;
        bannerCtx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
        pushBannerToPreview();
      };
      logoImage.src = logoSrc;
    } else {
      pushBannerToPreview();
    }
  };

  const renderFeaturePreview = () => {
    if (!featurePreview) {
      return;
    }
    featurePreview.innerHTML = "";
    for (const feature of state.features) {
      const card = doc.createElement('div');
      card.className = `feature${feature.hero ? " hero" : ""}`;

      const iconWrap = doc.createElement('div');
      iconWrap.className = "icon";
      const size = Number(feature.size) || 56;
      iconWrap.style.width = `${size}px`;
      iconWrap.style.height = `${size}px`;
      const img = doc.createElement('img');
      img.src = feature.img || resolveIcon(feature.icon);
      iconWrap.appendChild(img);
      card.appendChild(iconWrap);

      const body = doc.createElement('div');
      body.style.minWidth = "0";
      if (feature.t) {
        const title = doc.createElement('div');
        title.style.fontWeight = "700";
        title.style.fontSize = "18px";
        title.style.marginBottom = "4px";
        title.textContent = feature.t;
        body.appendChild(title);
      }
      if (feature.c) {
        if (feature.c.includes('\n')) {
          const list = doc.createElement('ul');
          list.innerHTML = bulletify(feature.c);
          body.appendChild(list);
        } else {
          const copy = doc.createElement('div');
          copy.className = "note";
          copy.style.fontSize = "16px";
          copy.textContent = feature.c;
          body.appendChild(copy);
        }
      }
      card.appendChild(body);
      featurePreview.appendChild(card);
    }
  };

  let currentFeatureIndex = -1;
  let iconGalleryBuilt = false;

  const closeIconModal = () => {
    currentFeatureIndex = -1;
    if (iconModal) {
      iconModal.style.display = "none";
    }
  };

  const renderIconGallery = () => {
    if (!iconGallery || iconGalleryBuilt) {
      return;
    }
    const entries = Object.entries(iconMap);
    if (!entries.length) {
      iconGallery.innerHTML = '<div class="note">No bundled icons available. Upload your own icon instead.</div>';
      iconGalleryBuilt = true;
      return;
    }
    iconGallery.innerHTML = "";
    for (const [name, src] of entries) {
      const item = doc.createElement('div');
      item.className = "item";
      const img = doc.createElement('img');
      img.src = src;
      img.alt = name;
      item.title = name;
      item.appendChild(img);
      item.addEventListener('click', () => {
        if (currentFeatureIndex >= 0 && state.features[currentFeatureIndex]) {
          state.features[currentFeatureIndex].img = src;
          state.features[currentFeatureIndex].imgName = name;
          renderFeatureGrid();
          renderFeaturePreview();
          closeIconModal();
        }
      });
      iconGallery.appendChild(item);
    }
    iconGalleryBuilt = true;
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
      const size = Number(feature.size) || 56;
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
        if (iconModal) {
          iconModal.style.display = "flex";
          renderIconGallery();
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
      heroToggle.addEventListener('change', (event) => {
        feature.hero = Boolean(event.target.checked);
        renderFeatureGrid();
        renderFeaturePreview();
      });
      heroLabel.appendChild(heroToggle);
      heroLabel.appendChild(doc.createTextNode('Hero (span columns)'));

      const sizeWrap = doc.createElement('div');
      const sizeLabel = doc.createElement('label');
      sizeLabel.className = "note";
      sizeLabel.textContent = "Icon size";
      const sizeInput = doc.createElement('input');
      sizeInput.type = "range";
      sizeInput.min = "40";
      sizeInput.max = "120";
      sizeInput.step = "1";
      sizeInput.value = Number(feature.size) || 56;
      sizeInput.addEventListener('input', (event) => {
        feature.size = Number(event.target.value) || 56;
        renderFeatureGrid();
        renderFeaturePreview();
      });
      sizeWrap.appendChild(sizeLabel);
      sizeWrap.appendChild(sizeInput);

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
      pushBannerToPreview();
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
    emailButton.addEventListener('click', () => downloadEmailHTML());
  }
}

function downloadEmailHTML() {
  if (typeof document === 'undefined') {
    return;
  }
  const html = buildEmailHTML();
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
}

(function attachHandlers() {
  if (typeof document === 'undefined') {
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
})();

