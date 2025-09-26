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
    const emailButton = document.getElementById('btnEmail');
    if (emailButton) {
      emailButton.addEventListener('click', () => {
        downloadEmailHTML();
      });
    }

    const tabContainer = document.getElementById('topTabs');
    if (tabContainer) {
      const tabs = Array.from(tabContainer.querySelectorAll('.tab'));
      if (tabs.length) {
        const panels = new Map();
        for (const tab of tabs) {
          const target = tab.dataset ? tab.dataset.tab : undefined;
          if (!target) {
            continue;
          }
          const panel = document.getElementById(`tab-${target}`);
          if (panel) {
            panels.set(tab, panel);
          }
        }

        if (panels.size) {
          const allPanels = Array.from(new Set(panels.values()));

          const activateTab = (tab) => {
            if (!panels.has(tab)) {
              return;
            }
            for (const candidate of tabs) {
              candidate.classList.remove('active');
            }
            for (const panel of allPanels) {
              panel.style.display = 'none';
            }
            const panel = panels.get(tab);
            tab.classList.add('active');
            if (panel) {
              panel.style.display = '';
            }
          };

          for (const tab of tabs) {
            tab.addEventListener('click', () => {
              activateTab(tab);
            });
          }

          const initialActive = tabs.find((tab) => tab.classList.contains('active') && panels.has(tab))
            || tabs.find((tab) => panels.has(tab));
          if (initialActive) {
            activateTab(initialActive);
          }
        }
      }
    }
  });
})();

