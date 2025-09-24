// DOM helpers and renderers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function setActiveTab(id) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-'+id));
}

function renderBenefits() {
  const list = $('#benefitList');
  list.innerHTML = '';
  State.s.key_benefits.forEach((b, i) => {
    const div = document.createElement('div');
    div.className = 'kf-item';
    div.innerHTML = `<div class="flex" style="justify-content:space-between;">
      <span>${escapeHtml(b)}</span>
      <button class="btn ghost" data-idx="${i}">Remove</button>
    </div>`;
    div.querySelector('button').addEventListener('click', () => {
      State.removeBenefit(i);
      renderBenefits(); renderPreview();
    });
    list.appendChild(div);
  });
}

function featureRowTemplate(f, idx) {
  return `<div class="card">
    <div class="feature-row">
      <div class="icon-wrap">
        <img src="${escapeAttr(f.image)}" style="max-width:${f.hero? '180px':'140px'}">
      </div>
      <div class="copy">
        <label class="label">Title</label>
        <input class="input" value="${escapeAttr(f.title)}" data-k="title" data-i="${idx}">
        <label class="label" style="margin-top:6px;">Description</label>
        <textarea class="textarea" data-k="description" data-i="${idx}">${escapeHtml(f.description)}</textarea>
      </div>
      <div class="controls">
        <div class="full">
          <label class="label">Image</label>
          <select class="select" data-k="image" data-i="${idx}"></select>
        </div>
        <div>
          <label class="label">Size</label>
          <input type="range" min="40" max="${f.hero? '200':'140'}" step="1" value="${f.size}" class="input" data-k="size" data-i="${idx}">
        </div>
        <div class="full">
          <label><input type="checkbox" ${f.hero? 'checked':''} data-k="hero" data-i="${idx}"> Mark as Key Feature Included (HERO)</label>
        </div>
        <div class="full">
          <label><input type="checkbox" data-k="select" data-i="${idx}"> Select for bulk add to HERO</label>
        </div>
        <button class="btn warn full" data-action="remove" data-i="${idx}">Remove</button>
      </div>
    </div>
  </div>`;
}

function renderFeatures() {
  const wrap = $('#featuresWrap');
  wrap.innerHTML = State.s.features.map(featureRowTemplate).join('');
  // populate image selects with available pictograms + product images
  const imageOptions = getImageOptions();
  $$('#featuresWrap select.select').forEach(sel => {
    sel.innerHTML = imageOptions.map(o => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    const idx = parseInt(sel.dataset.i,10);
    sel.value = State.s.features[idx].image;
    sel.addEventListener('change', e => {
      State.updateFeature(idx, { image: e.target.value });
      renderFeatures(); renderPreview();
    });
  });
  // bind inputs
  $$('#featuresWrap input.input, #featuresWrap textarea').forEach(el => {
    const idx = parseInt(el.dataset.i,10);
    const key = el.dataset.k;
    el.addEventListener('input', e => {
      let val = e.target.value;
      if (key === 'size') val = parseInt(val,10);
      State.updateFeature(idx, { [key]: val });
      renderPreview(); // live update
    });
  });
  // checkboxes
  $$('#featuresWrap input[type="checkbox"]').forEach(el => {
    const idx = parseInt(el.dataset.i,10);
    const key = el.dataset.k;
    el.addEventListener('change', e => {
      if (key === 'hero') {
        State.updateFeature(idx, { hero: !!e.target.checked });
        renderFeatures(); // re-render to update max range for hero vs standard
      } else {
        State.updateFeature(idx, { selected: !!e.target.checked });
      }
      renderPreview();
    });
  });
  // remove buttons
  $$('#featuresWrap [data-action="remove"]').forEach(btn => {
    const idx = parseInt(btn.dataset.i,10);
    btn.addEventListener('click', () => {
      State.removeFeature(idx);
      renderFeatures(); renderPreview();
    });
  });
}

function renderPricing() {
  const tb = $('#pricingTable tbody');
  tb.innerHTML = '';
  State.s.pricing_rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>$${escapeHtml(r[2])}</td>`;
    tr.addEventListener('click', () => {
      State.removeRow(i);
      renderPricing(); renderPreview();
    });
    tb.appendChild(tr);
  });
  $('#totalPrice').textContent = State.s.price_total;
}

function renderPreview() {
  // banner
  $('#headlinePreview').textContent = State.s.branding.headline || 'Cloud Voice for your business';
  $('#subheadlinePreview').textContent = State.s.branding.subheadline || 'Powered by Telstra TIPT and Cisco Webex';
  if (State.s.branding.logo) $('#logoPreview').src = State.s.branding.logo;

  const p = $('#previewArea');
  p.innerHTML = `
  <div>
    <div class="flex" style="justify-content:space-between; align-items:flex-start">
      <div>
        <div><strong>Customer:</strong> ${escapeHtml(State.s.branding.customer||'')}</div>
        <div><strong>Ref:</strong> ${escapeHtml(State.s.branding.ref||'')}</div>
      </div>
      <div class="price-card">Total: $${escapeHtml(State.s.price_total)} ex GST</div>
    </div>
    <div class="print-page print-p1"></div>
    <section>
      <h2>Executive summary</h2>
      <p>${escapeHtml(State.s.executive_summary)}</p>
    </section>
    <section>
      <h2>Key benefits</h2>
      <ul>${State.s.key_benefits.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    </section>
    <section>
      <h2>Features & benefits</h2>
      ${State.s.features.filter(f=>!f.hero).map(f => featurePreviewHTML(f)).join('')}
    </section>
    <section>
      <h2>Key Features Included</h2>
      ${State.s.features.filter(f=>f.hero).map(f => featurePreviewHTML(f)).join('')}
    </section>
    <section>
      <h2>Inclusions & pricing breakdown</h2>
      ${pricingTableHTML()}
    </section>
    <section>
      <h2>Commercial terms & dependencies</h2>
      <ul>${State.s.commercial_terms.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>
    </section>
  </div>`;
}

function featurePreviewHTML(f) {
  const max = f.hero ? 200 : 140;
  const w = Math.max(40, Math.min(max, parseInt(f.size||80,10)));
  return `<div class="feat">
    <img src="${escapeAttr(f.image)}" style="max-width:${w}px">
    <div>
      <div style="font-weight:600">${escapeHtml(f.title)}</div>
      <div style="color:#4b5563">${escapeHtml(f.description)}</div>
    </div>
  </div>`;
}

function pricingTableHTML() {
  const rows = State.s.pricing_rows.map(r => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>$${escapeHtml(r[2])}</td></tr>`).join('');
  return `<table class="pricing-table">
    <thead><tr><th>Inclusions & pricing breakdown</th><th>Qty</th><th>Monthly (ex GST)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td></td><td style="text-align:right;"><strong>Total</strong></td><td><strong>$${escapeHtml(State.s.price_total)}</strong></td></tr></tfoot>
  </table>`;
}

// util
function escapeHtml(s='') {
  return s.toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s='') {
  return escapeHtml(s).replace(/"/g,'&quot;');
}

// get available images for selects
function getImageOptions() {
  const opts = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach(()=>{}); // noop to avoid unused
  // Gather images from known folders listed in the project
  const known = [
    'assets/images/Cisco 9861.png',
    'assets/images/mx67w.png',
    'assets/images/Webex.png'
  ];
  known.forEach(k => { opts.push({label: k.split('/').pop(), value: k}); });

  // We cannot read directory contents from the filesystem at runtime in browser for pictograms/logos,
  // so we include a few conventional names users might drag into the page later.
  return opts;
}
