const EMAIL_MAX_WIDTH = 680;
const DEFAULT_EMAIL_WIDTH = EMAIL_MAX_WIDTH;
const DEFAULT_IMAGE_WIDTH = 320;
const DEFAULT_IMAGE_HEIGHT = 180;
const FALLBACK_FONT_FAMILY = '-apple-system, Segoe UI, Roboto, Arial, sans-serif';

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
  const resp = await fetch(url, { credentials: 'include' }).catch(() => null);
  if (!resp || !resp.ok) {
    throw new Error(`Fetch failed: ${url}`);
  }
  const blob = await resp.blob();
  const mime = mimeFromExtOrBlob(url, blob);
  const dataUri = await toDataURLViaFileReader(blob, mime);
  return { dataUri, mime };
}

async function imageSrcToCanvasDataURI(src) {
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
  const mime = mimeFromExtOrBlob(src);
  const dataUri = canvas.toDataURL(mime);
  return { dataUri, mime };
}

async function imgElementToDataURI(img, warnings) {
  try {
    const src = img.currentSrc || img.src;
    if (!src) {
      return null;
    }

    if (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg')) {
      return { dataUri: src, mime: src.includes('image/png') ? 'image/png' : 'image/jpeg' };
    }

    const canUseFetch = !src.startsWith('file:');
    if (canUseFetch) {
      try {
        return await fetchAsDataURL(src);
      } catch (error) {
        // fall through to canvas fallback
      }
    }

    return await imageSrcToCanvasDataURI(src);
  } catch (error) {
    warnings.push(`IMG inline failed: ${img.alt || '[no alt]'} — ${error?.message || error}`);
    return null;
  }
}

async function canvasToDataImg(canvas, warnings) {
  try {
    const dataUri = canvas.toDataURL('image/png', 1.0);
    return { dataUri, mime: 'image/png' };
  } catch (error) {
    warnings.push(`Canvas inline failed: ${error?.message || error}`);
    return null;
  }
}

async function inlineBackgroundImage(el, warnings) {
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

  const matchUrl = (value) => {
    if (!value) {
      return [];
    }
    return [...value.matchAll(/url\((['"]?)(.*?)\1\)/g)].map((match) => match[2]).filter(Boolean);
  };

  const urls = new Set();
  for (const value of backgroundCandidates) {
    for (const found of matchUrl(value)) {
      if (!found || found.startsWith('data:')) {
        continue;
      }
      urls.add(found);
    }
  }

  if (!urls.size) {
    return;
  }

  let nextBg = inlineBg && inlineBg !== 'none' ? inlineBg : backgroundCandidates[0];

  const getBaseHref = () => {
    if (typeof document !== 'undefined' && document?.baseURI) {
      return document.baseURI;
    }
    if (typeof location !== 'undefined' && location?.href) {
      return location.href;
    }
    return 'http://localhost/';
  };

  const hasExplicitScheme = (value) => /^[a-zA-Z][\w+.-]*:/.test(value);

  const resolveUrl = (value) => {
    try {
      return new URL(value, getBaseHref());
    } catch (error) {
      return null;
    }
  };

  for (const url of urls) {
    const resolved = resolveUrl(url);
    const fallbackTarget = resolved?.href || url;
    const isOriginalRelative = !hasExplicitScheme(url) && !url.startsWith('//');
    const protocol = resolved?.protocol || '';
    const isHttp = protocol === 'http:' || protocol === 'https:';
    const canAttemptFetch = !isOriginalRelative && isHttp;

    try {
      let dataUri = null;

      if (canAttemptFetch) {
        try {
          ({ dataUri } = await fetchAsDataURL(resolved.href));
        } catch (error) {
          // fall through to canvas fallback
        }
      }

      if (!dataUri) {
        ({ dataUri } = await imageSrcToCanvasDataURI(fallbackTarget));
      }

      nextBg = nextBg.split(url).join(dataUri);
    } catch (error) {
      warnings.push(`BG image inline failed: ${url} — ${error?.message || error}`);
    }
  }
  el.style.backgroundImage = nextBg;
}

function setExplicitDimensions(el) {
  const rect = el.getBoundingClientRect();
  const width = clampWidth(rect.width || Number(el.width) || EMAIL_MAX_WIDTH);
  el.width = width;
  el.style.width = `${width}px`;
  el.style.height = 'auto';
  el.style.display = 'block';
}

async function inlineAllRasterImages(root, warnings) {
  const canvases = Array.from(root.querySelectorAll('canvas'));
  for (const canvas of canvases) {
    const res = await canvasToDataImg(canvas, warnings);
    const img = document.createElement('img');
    if (res) {
      img.src = res.dataUri;
    } else {
      img.alt = 'Canvas unavailable';
    }
    setExplicitDimensions(img);
    canvas.replaceWith(img);
  }

  const images = Array.from(root.querySelectorAll('img'));
  for (const image of images) {
    const res = await imgElementToDataURI(image, warnings);
    if (res) {
      image.src = res.dataUri;
      if (image.srcset) {
        image.removeAttribute('srcset');
      }
      setExplicitDimensions(image);
    } else {
      setExplicitDimensions(image);
    }
  }

  const elements = Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    await inlineBackgroundImage(element, warnings);
  }
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

function spacerRow(height = 16) {
  const safeHeight = Math.max(0, Math.round(height));
  return `<tr><td style="height:${safeHeight}px; line-height:${safeHeight}px; font-size:0;">&nbsp;</td></tr>`;
}

function sectionHeading(text, brand) {
  const color = brand?.colorHeading || '#222222';
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  return `<tr><td style="padding:0 40px; font-family:${esc(fontFamily)}; font-size:22px; line-height:1.4; color:${esc(color)}; font-weight:600;">${esc(text)}</td></tr>`;
}

async function renderFeatureCard(feature, brand, warnings) {
  const fontFamily = brand?.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand?.colorText || '#333333';
  const titleColor = brand?.colorHeading || '#222222';
  const rows = [];
  const image = feature?.image;
  if (image) {
    if ((image.kind === 'css-bg' || image.background === true) && (image.css || image.src)) {
      const width = clampWidth(image.width ?? DEFAULT_IMAGE_WIDTH);
      const height = Math.max(32, Math.round(image.height ?? DEFAULT_IMAGE_HEIGHT));
      const styleParts = [
        `width:${width}px`,
        `height:${height}px`,
        'background-repeat:no-repeat',
        'background-size:cover',
        'background-position:center',
        'border-radius:12px'
      ];
      if (image.src) {
        styleParts.push(`background-image:url('${esc(image.src)}')`);
      }
      if (image.css) {
        styleParts.push(image.css.trim().replace(/;+$/g, ''));
      }
      const styleAttr = `${styleParts.join('; ')};`;
      rows.push(`<tr><td style="padding-bottom:12px;"><div style="${styleAttr}"></div></td></tr>`);
    } else if (image.src) {
      const width = clampWidth(image.width ?? DEFAULT_IMAGE_WIDTH);
      const altText = image.alt || feature.title || 'Feature image';
      rows.push(`<tr><td style="padding-bottom:12px;"><img src="${esc(image.src)}" alt="${esc(altText)}" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;"></td></tr>`);
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
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid rgba(0,0,0,0.08); border-radius:16px; padding:0;">
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

function wrapInSection(content) {
  return `<tr><td style="padding:0 40px;">
    ${content}
  </td></tr>`;
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

async function buildFeatureSection(features, heading, brand, warnings) {
  if (!features.length) {
    return '';
  }
  const cards = [];
  for (const feature of features) {
    const card = await renderFeatureCard(feature, brand, warnings);
    cards.push(`<tr><td style="padding-bottom:16px;">${card}</td></tr>`);
  }
  const cardsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    ${cards.join('\n')}
  </table>`;
  const headingHtml = sectionHeading(heading, brand);
  return [headingHtml, spacerRow(12), wrapInSection(cardsTable)].join('\n');
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
      clone.width = DEFAULT_EMAIL_WIDTH;
      clone.style.width = `${DEFAULT_EMAIL_WIDTH}px`;
      clone.style.height = 'auto';
      clone.style.display = 'block';
      return `<tr><td style="padding:0;">${clone.outerHTML}</td></tr>`;
    }
    if (banner.src) {
      const width = DEFAULT_EMAIL_WIDTH;
      const altText = banner.alt || 'Proposal banner';
      return `<tr><td style="padding:0;">
    <img src="${esc(banner.src)}" alt="${esc(altText)}" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;">
  </td></tr>`;
    }
  }
  return '';
}

function buildHeaderSection(proposal, brand) {
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const mutedColor = brand.colorMuted || '#6B6F76';
  const headingColor = brand.colorHeading || '#0B1220';
  const bodyColor = brand.colorText || '#333333';

  const eyebrow = `<tr><td style="font-family:${esc(fontFamily)}; font-size:13px; line-height:1.4; color:${esc(mutedColor)}; text-transform:uppercase; letter-spacing:0.5px;">Customer</td></tr>`;
  const headlineParts = [];
  if (proposal.customer) {
    headlineParts.push(esc(proposal.customer));
  }
  if (proposal.ref) {
    headlineParts.push(`Ref ${esc(proposal.ref)}`);
  }
  const headerLine = headlineParts.length
    ? `<tr><td style="font-family:${esc(fontFamily)}; font-size:18px; line-height:1.45; font-weight:600; color:${esc(bodyColor)};">${headlineParts.join(' • ')}</td></tr>`
    : '';
  const mainHeadline = proposal.headlineMain
    ? `<tr><td style="padding-top:20px; font-family:${esc(fontFamily)}; font-size:30px; line-height:1.2; font-weight:600; color:${esc(headingColor)};">${esc(proposal.headlineMain)}</td></tr>`
    : '';
  const subheadline = proposal.headlineSub
    ? `<tr><td style="padding-top:10px; font-family:${esc(fontFamily)}; font-size:18px; line-height:1.45; color:${esc(bodyColor)};">${esc(proposal.headlineSub)}</td></tr>`
    : '';

  const eyebrowRow = proposal.customer ? eyebrow : '';

  return `<tr><td style="padding:32px 40px 28px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      ${eyebrowRow}
      ${headerLine}
      ${mainHeadline}
      ${subheadline}
    </table>
  </td></tr>`;
}

function renderExecutiveSummary(summary, brand) {
  if (!summary) {
    return '';
  }
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const bodyColor = brand.colorText || '#333333';
  const sanitized = sanitizeHTML(summary);
  return `${sectionHeading('Executive summary', brand)}\n${spacerRow(12)}\n<tr><td style="padding:0 40px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.55; color:${esc(bodyColor)};">${sanitized}</td></tr>`;
}

function renderKeyBenefitsSection(benefits, brand) {
  const content = renderKeyBenefits(benefits, brand);
  if (!content) {
    return '';
  }
  return `${sectionHeading('Key benefits', brand)}\n${spacerRow(12)}\n${wrapInSection(content)}`;
}

function renderPricingTable(html, brand) {
  if (!html) {
    return '';
  }
  const sanitized = sanitizeHTML(html);
  return `${sectionHeading('Inclusions & pricing breakdown', brand)}\n${spacerRow(12)}\n<tr><td style="padding:0 40px;">${sanitized}</td></tr>`;
}

function renderPriceCard(priceCard, brand) {
  if (!priceCard || !priceCard.show || !priceCard.html) {
    return '';
  }
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const shade = priceCard.shadedBgColor || brand.priceCardShade || '#F3F4F9';
  const sanitized = sanitizeHTML(priceCard.html);
  return `${sectionHeading('Price', brand)}\n${spacerRow(12)}\n<tr><td style="padding:0 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-radius:16px; background-color:${esc(shade)};">
      <tr>
        <td style="padding:24px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.55; color:${esc(brand.colorText || '#333333')};">
          ${sanitized}
        </td>
      </tr>
    </table>
  </td></tr>`;
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
  const rows = items
    .map((item) => `<tr>
        <td style="width:18px; font-family:${esc(fontFamily)}; font-size:16px; line-height:1.4; color:${esc(bodyColor)};">•</td>
        <td style="font-family:${esc(fontFamily)}; font-size:16px; line-height:1.55; color:${esc(bodyColor)}; padding-bottom:6px;">${esc(item)}</td>
      </tr>`)
    .join('');

  if (!rows) {
    return '';
  }

  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    ${rows}
  </table>`;

  return `${sectionHeading('Data sources', brand)}\n${spacerRow(12)}\n${wrapInSection(table)}`;
}

function renderCommercialTermsSection(terms, brand) {
  const content = buildCommercialTerms(terms, brand);
  if (!content) {
    return '';
  }
  return `${sectionHeading('Commercial Terms & Dependencies', brand)}\n${spacerRow(12)}\n${wrapInSection(content)}`;
}

function buildHeroSpacer(brand) {
  const color = brand?.colorMuted || '#E0E0E0';
  return `<tr><td style="padding:0 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-top:1px solid ${esc(color)};">
      <tr><td style="font-size:0; line-height:0; height:12px;">&nbsp;</td></tr>
    </table>
  </td></tr>`;
}

function buildOuterWrapper(content) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#FFFFFF;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${DEFAULT_EMAIL_WIDTH}" style="width:${DEFAULT_EMAIL_WIDTH}px; max-width:100%;">
            ${content}
          </table>
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

async function buildEmailExportHTML(proposal) {
  if (!proposal || typeof proposal !== 'object') {
    throw new Error('A proposal object is required');
  }
  const warnings = [];
  const brand = normalizeBrand(proposal.brand);
  const contentParts = [];

  const bannerHtml = await renderBanner(proposal.banner);
  if (bannerHtml) {
    contentParts.push(bannerHtml);
  }

  contentParts.push(buildHeaderSection(proposal, brand));

  contentParts.push(spacerRow(20));

  const executiveSummaryHtml = renderExecutiveSummary(proposal.executiveSummary, brand);
  if (executiveSummaryHtml) {
    contentParts.push(executiveSummaryHtml);
    contentParts.push(spacerRow(24));
  }

  const keyBenefitsHtml = renderKeyBenefitsSection(proposal.keyBenefits, brand);
  if (keyBenefitsHtml) {
    contentParts.push(keyBenefitsHtml);
    contentParts.push(spacerRow(24));
  }

  const { standard: standardFeatures, hero: heroFeatures } = splitFeatures(proposal.features);

  if (standardFeatures.length) {
    const featureSection = await buildFeatureSection(standardFeatures, 'Features & benefits', brand, warnings);
    if (featureSection) {
      contentParts.push(featureSection);
      contentParts.push(spacerRow(24));
    }
  }

  if (heroFeatures.length) {
    contentParts.push(buildHeroSpacer(brand));
    contentParts.push(spacerRow(16));
    const heroSection = await buildFeatureSection(heroFeatures, 'Key Features Included', brand, warnings);
    if (heroSection) {
      contentParts.push(heroSection);
      contentParts.push(spacerRow(24));
    }
  }

  const pricingTableHtml = renderPricingTable(proposal.pricingTableHTML, brand);
  if (pricingTableHtml) {
    contentParts.push(pricingTableHtml);
    contentParts.push(spacerRow(24));
  }

  const priceCardHtml = renderPriceCard(proposal.priceCard, brand);
  const dataSourcesHtml = renderDataSourcesSection(proposal.dataSources, brand);

  if (priceCardHtml) {
    contentParts.push(priceCardHtml);
    if (dataSourcesHtml) {
      contentParts.push(spacerRow(24));
    }
  }

  if (dataSourcesHtml) {
    if (!priceCardHtml && contentParts.length) {
      contentParts.push(spacerRow(24));
    }
    contentParts.push(dataSourcesHtml);
  }

  const content = contentParts.filter(Boolean).join('\n');
  const wrapperMarkup = buildOuterWrapper(content);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = wrapperMarkup;

  await inlineAllRasterImages(wrapper, warnings);

  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const emailBody = wrapper.innerHTML;
  const html = [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta http-equiv="x-ua-compatible" content="ie=edge">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '</head>',
    `<body style="margin:0; padding:0; background-color:#FFFFFF; font-family:${esc(fontFamily)};">`,
    emailBody,
    '</body></html>'
  ].join('');

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
    warnings,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildEmailExportHTML,
    // exporting helpers for potential testing
    __private: {
      sanitizeHTML,
      renderFeatureCard,
      renderKeyBenefits,
      inlineAllRasterImages,
      imgElementToDataURI,
      inlineBackgroundImage,
    },
  };
}

if (typeof window !== 'undefined') {
  window.PropBuilderEmailExport = window.PropBuilderEmailExport || {};
  window.PropBuilderEmailExport.buildEmailExportHTML = buildEmailExportHTML;
}
