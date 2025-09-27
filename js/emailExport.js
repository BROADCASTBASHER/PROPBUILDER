const DEFAULT_EMAIL_WIDTH = 680;
const DEFAULT_IMAGE_WIDTH = 320;
const DEFAULT_IMAGE_HEIGHT = 180;
const FALLBACK_FONT_FAMILY = '-apple-system, Segoe UI, Roboto, Arial, sans-serif';

const DATA_URI_REGEX = /^data:/i;
const BLOB_URI_REGEX = /^blob:/i;
const CSS_URL_REGEX = /url\(([^)]+)\)/gi;
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

function clampWidth(width, max = DEFAULT_EMAIL_WIDTH) {
  if (!Number.isFinite(width) || width <= 0) {
    return Math.min(DEFAULT_IMAGE_WIDTH, max);
  }
  return Math.min(Math.max(16, Math.round(width)), max);
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

async function blobToDataUri(blob, mimeType) {
  if (!blob) {
    throw new Error('No blob provided');
  }
  if (typeof FileReader === 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
  }
  if (blob.arrayBuffer) {
    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = mimeType || (blob.type || 'application/octet-stream');
    return `data:${mime};base64,${base64}`;
  }
  throw new Error('Unsupported blob type');
}

async function fetchAsDataUri(src) {
  if (!src) {
    throw new Error('Missing source');
  }
  if (DATA_URI_REGEX.test(src)) {
    return src;
  }
  if (BLOB_URI_REGEX.test(src) && typeof fetch !== 'function') {
    throw new Error('Unable to inline blob: URIs without fetch support');
  }
  if (typeof fetch !== 'function') {
    throw new Error('fetch is not available in this environment');
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load resource: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || undefined;
  return blobToDataUri(blob, contentType);
}

async function resolveCssBackground(styleString, warnings) {
  if (!styleString) {
    return { css: '', warnings };
  }
  const replacements = [];
  let match;
  CSS_URL_REGEX.lastIndex = 0;
  while ((match = CSS_URL_REGEX.exec(styleString)) !== null) {
    const raw = match[1].trim();
    const cleaned = raw.replace(/^['"]|['"]$/g, '');
    if (!cleaned) {
      continue;
    }
    try {
      const dataUri = await fetchAsDataUri(cleaned);
      replacements.push({ original: match[0], dataUri });
    } catch (error) {
      warnings.push(`Unable to inline background image ${cleaned}: ${error.message}`);
    }
  }
  let rewritten = styleString;
  for (const replacement of replacements) {
    rewritten = rewritten.replace(replacement.original, `url('${replacement.dataUri}')`);
  }
  return { css: rewritten, warnings };
}

async function resolveToDataURI(image, warnings) {
  if (!image || !image.src) {
    return null;
  }
  const kind = image.kind || 'img';
  const source = image.src;
  try {
    if (kind === 'css-bg') {
      const { css } = await resolveCssBackground(source, warnings);
      return {
        kind,
        css,
        width: image.width,
        height: image.height,
      };
    }
    if (kind === 'canvas') {
      if (typeof document !== 'undefined') {
        const canvas = document.getElementById(source) || (typeof source === 'string' ? document.querySelector(source) : null);
        if (canvas && typeof canvas.toDataURL === 'function') {
          const dataUri = canvas.toDataURL('image/png', 1.0);
          return {
            kind: 'img',
            dataUri,
            width: image.width ?? canvas.width,
            height: image.height ?? canvas.height,
          };
        }
      }
      throw new Error('Canvas element is not available in this environment');
    }
    if (kind === 'img' || kind === 'url') {
      const dataUri = await fetchAsDataUri(source);
      return {
        kind: 'img',
        dataUri,
        width: image.width,
        height: image.height,
      };
    }
    // fallback attempt
    const dataUri = await fetchAsDataUri(source);
    return {
      kind: 'img',
      dataUri,
      width: image.width,
      height: image.height,
    };
  } catch (error) {
    warnings.push(`Unable to resolve image '${source}': ${error.message}`);
    return null;
  }
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
  const resolved = feature.image ? await resolveToDataURI(feature.image, warnings) : null;
  if (resolved) {
    if (resolved.kind === 'css-bg' && resolved.css) {
      const width = clampWidth(resolved.width ?? feature.image?.width ?? DEFAULT_IMAGE_WIDTH);
      const height = Math.max(32, Math.round(resolved.height ?? feature.image?.height ?? DEFAULT_IMAGE_HEIGHT));
      const cssSnippet = resolved.css.trim();
      const backgroundCss = cssSnippet ? (cssSnippet.endsWith(';') ? cssSnippet : `${cssSnippet};`) : '';
      rows.push(`<tr><td style="padding-bottom:12px;"><div style="width:${width}px; height:${height}px; background-repeat:no-repeat; background-size:cover; background-position:center; border-radius:12px; ${backgroundCss}"></div></td></tr>`);
    } else if (resolved.dataUri) {
      const width = clampWidth(resolved.width ?? feature.image?.width ?? DEFAULT_IMAGE_WIDTH);
      rows.push(`<tr><td style="padding-bottom:12px;"><img src="${resolved.dataUri}" alt="${esc(feature.title || 'Feature image')}" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;"></td></tr>`);
    }
  }
  if (feature.title) {
    rows.push(`<tr><td style="font-family:${esc(fontFamily)}; font-size:18px; line-height:1.4; font-weight:600; color:${esc(titleColor)}; padding-bottom:6px;">${esc(feature.title)}</td></tr>`);
  }
  if (feature.description) {
    rows.push(`<tr><td style="font-family:${esc(fontFamily)}; font-size:15px; line-height:1.55; color:${esc(bodyColor)};">${textToHTML(feature.description)}</td></tr>`);
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

async function renderBanner(banner, brand, warnings) {
  if (!banner) {
    return '';
  }
  const resolved = await resolveToDataURI(banner, warnings);
  if (!resolved || !resolved.dataUri) {
    return '';
  }
  const width = DEFAULT_EMAIL_WIDTH;
  return `<tr><td style="padding:0;">
    <img src="${resolved.dataUri}" alt="Proposal banner" width="${width}" style="display:block; width:${width}px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;">
  </td></tr>`;
}

function buildHeaderSection(proposal, brand) {
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  const mutedColor = brand.colorMuted || '#6B6F76';
  const headingColor = brand.colorHeading || '#0B1220';
  const bodyColor = brand.colorText || '#333333';

  const customerLabel = `<tr><td style="font-family:${esc(fontFamily)}; font-size:13px; line-height:1.4; color:${esc(mutedColor)}; text-transform:uppercase; letter-spacing:0.5px;">Customer</td></tr>`;
  const customerValue = proposal.customer ? `<tr><td style="font-family:${esc(fontFamily)}; font-size:18px; line-height:1.45; font-weight:600; color:${esc(bodyColor)};">${esc(proposal.customer)}</td></tr>` : '';
  const refLabel = proposal.ref ? `<tr><td style="padding-top:12px; font-family:${esc(fontFamily)}; font-size:13px; line-height:1.4; color:${esc(mutedColor)}; text-transform:uppercase; letter-spacing:0.5px;">Ref</td></tr>` : '';
  const refValue = proposal.ref ? `<tr><td style="font-family:${esc(fontFamily)}; font-size:16px; line-height:1.4; color:${esc(bodyColor)};">${esc(proposal.ref)}</td></tr>` : '';
  const headline = proposal.headlineMain ? `<tr><td style="padding-top:20px; font-family:${esc(fontFamily)}; font-size:30px; line-height:1.2; font-weight:600; color:${esc(headingColor)};">${esc(proposal.headlineMain)}</td></tr>` : '';
  const subheadline = proposal.headlineSub ? `<tr><td style="padding-top:10px; font-family:${esc(fontFamily)}; font-size:18px; line-height:1.45; color:${esc(bodyColor)};">${esc(proposal.headlineSub)}</td></tr>` : '';

  return `<tr><td style="padding:32px 40px 28px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      ${customerLabel}
      ${customerValue}
      ${refLabel}
      ${refValue}
      ${headline}
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

function buildOuterWrapper(content, brand) {
  const fontFamily = brand.fontFamily || FALLBACK_FONT_FAMILY;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0; padding:0; background-color:#FFFFFF; font-family:${esc(fontFamily)};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#FFFFFF;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${DEFAULT_EMAIL_WIDTH}" style="width:${DEFAULT_EMAIL_WIDTH}px; max-width:100%;">
            ${content}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

  const bannerHtml = await renderBanner(proposal.banner, brand, warnings);
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
  if (priceCardHtml) {
    contentParts.push(priceCardHtml);
    contentParts.push(spacerRow(24));
  }

  const commercialTermsHtml = renderCommercialTermsSection(proposal.commercialTerms, brand);
  if (commercialTermsHtml) {
    contentParts.push(commercialTermsHtml);
  }

  const content = contentParts.filter(Boolean).join('\n');
  const html = buildOuterWrapper(content, brand);
  const sizeKB = Buffer.byteLength(html, 'utf8') / 1024;

  return {
    html,
    sizeKB,
    warnings,
  };
}

module.exports = {
  buildEmailExportHTML,
  // exporting helpers for potential testing
  __private: {
    resolveToDataURI,
    sanitizeHTML,
    renderFeatureCard,
    renderKeyBenefits,
  },
};
