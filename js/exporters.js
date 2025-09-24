// Exporters: Email HTML and Print
async function buildEmailHTML() {
  // Inline CSS (copy of some preview styles + email-safe resets)
  const priceBg = getComputedStyle(document.documentElement).getPropertyValue('--price-bg') || '#eef2ff';

  // Load fonts as base64 to inline (best-effort)
  async function fontFaceBase64() {
    const styles = [];
    const fontPaths = [];
    for (const [i,p] of fontPaths.entries()) {
      try {
        const resp = await fetch(p);
        const blob = await resp.blob();
        const data = await blobToDataURL(blob);
        const family = i===0 ? 'TelstraText' : 'TelstraTextAlt'+i;
        styles.push(`@font-face{font-family:'${family}';src:url(${data}) format('woff2');font-weight:normal;font-style:normal;font-display:swap}`);
      } catch(e) {}
    }
    return styles.join('\n');
  }

  const fontsCss = await fontFaceBase64();

  const css = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;padding:16px;font-family:${fontsCss ? 'TelstraText, ' : ''}Arial,Helvetica,sans-serif;color:#1f2430}
  h1,h2{color:#0a2a6b;margin:16px 0 8px}
  .wrap{max-width:900px;margin:0 auto}
  .hdr{display:flex;gap:12px;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px}
  .logo{width:140px;height:48px;object-fit:contain}
  .price{background:${priceBg.trim()};border:1px solid #d9dcef;border-radius:12px;padding:12px;display:inline-block;font-weight:600}
  .feat{display:flex;gap:16px;align-items:center;margin:10px 0}
  .feat img{max-width:140px;height:auto;object-fit:contain}
  table{width:100%;border-collapse:collapse}
  th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
  th{background:#fafafa}
  ul{padding-left:18px}
  .muted{color:#6b7280}
  `;

  // Helper to inline images
  async function toDataURL(src) {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      return await blobToDataURL(blob);
    } catch(e) {
      return src;
    }
  }
  function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  // Build sections
  const brand = State.s.branding;
  const heroFeats = State.s.features.filter(f=>f.hero);
  const stdFeats = State.s.features.filter(f=>!f.hero);

  const logoData = brand.logo ? brand.logo : '';
  const rows = State.s.pricing_rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>$${esc(r[2])}</td></tr>`).join('');

  const terms = State.s.commercial_terms.map(t=>`<li>${esc(t)}</li>`).join('');

  let featuresHTML = '';
  for(const f of stdFeats){
    const img = await toDataURL(f.image);
    const max = f.hero ? 200 : 140;
    const w = Math.max(40, Math.min(max, parseInt(f.size||80,10)));
    featuresHTML += `<div class="feat"><img src="${img}" style="max-width:${w}px"><div><div style="font-weight:600">${esc(f.title)}</div><div class="muted">${esc(f.description)}</div></div></div>`;
  }
  let heroHTML = '';
  for(const f of heroFeats){
    const img = await toDataURL(f.image);
    const w = Math.max(40, Math.min(200, parseInt(f.size||80,10)));
    heroHTML += `<div class="feat"><img src="${img}" style="max-width:${w}px"><div><div style="font-weight:600">${esc(f.title)}</div><div class="muted">${esc(f.description)}</div></div></div>`;
  }

  const emailHTML = `<!doctype html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${fontsCss}${css}</style>
  <title>Proposal</title></head>
  <body>
    <div class="wrap">
      <div class="hdr">
        ${logoData ? `<img class="logo" src="${logoData}">` : ''}
        <div>
          <h1>${esc(brand.headline||'')}</h1>
          <div class="muted">${esc(brand.subheadline||'')}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div><strong>Customer:</strong> ${esc(brand.customer||'')}</div>
          <div><strong>Ref:</strong> ${esc(brand.ref||'')}</div>
        </div>
        <div class="price">Total: $${esc(State.s.price_total)} ex GST</div>
      </div>
      <h2>Executive summary</h2>
      <p>${esc(State.s.executive_summary||'')}</p>

      <h2>Key benefits</h2>
      <ul>${State.s.key_benefits.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>

      <h2>Features &amp; benefits</h2>
      ${featuresHTML}

      <h2>Key Features Included</h2>
      ${heroHTML}

      <h2>Inclusions &amp; pricing breakdown</h2>
      <table>
        <thead><tr><th>Inclusions &amp; pricing breakdown</th><th>Qty</th><th>Monthly (ex GST)</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td></td><td style="text-align:right;"><strong>Total</strong></td><td><strong>$${esc(State.s.price_total)}</strong></td></tr></tfoot>
      </table>

      <h2>Commercial terms &amp; dependencies</h2>
      <ul>${terms}</ul>
    </div>
  </body></html>`;
  return emailHTML;
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadEmailHTML() {
  const html = await buildEmailHTML();
  const blob = new Blob([html], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (State.s.branding.ref ? State.s.branding.ref+'_' : '') + 'proposal_email.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function triggerPrint() {
  window.print();
}
