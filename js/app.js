// Wire up UI and bootstrap
(async function init(){
  // Tabs
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab)));

  await State.loadDefaults();

  // Seed branding inputs
  $('#customer').value = State.s.branding.customer;
  $('#ref').value = State.s.branding.ref;
  $('#headline').value = State.s.branding.headline;
  $('#subheadline').value = State.s.branding.subheadline;

  // Seed exec + terms
  $('#exec').value = State.s.executive_summary;
  $('#terms').value = State.s.commercial_terms.join('\n');

  // Render
  renderBenefits();
  renderFeatures();
  renderPricing();
  renderPreview();

  // Branding change handlers
  ['customer','ref','headline','subheadline'].forEach(id => {
    $('#'+id).addEventListener('input', e => {
      State.s.branding[id] = e.target.value;
      if (id==='headline' || id==='subheadline') renderPreview();
    });
  });
  $('#logoInput').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const data = await blobToDataURL(f);
    State.s.branding.logo = data;
    $('#logoPreview').src = data;
    renderPreview();
  });

  // Exec + terms
  $('#exec').addEventListener('input', e => {
    State.s.executive_summary = e.target.value;
    renderPreview();
  });
  $('#terms').addEventListener('input', e => {
    State.s.commercial_terms = e.target.value.split(/\r?\n/).filter(Boolean);
    renderPreview();
  });

  // Benefits
  $('#addBenefit').addEventListener('click', () => {
    const v = $('#benefitInput').value.trim();
    if (v) { State.addBenefit(v); $('#benefitInput').value=''; renderBenefits(); renderPreview(); }
  });

  // Features
  $('#addFeature').addEventListener('click', () => {
    State.addFeature({ id:'feat-'+Date.now(), title:'New feature', description:'', image:'assets/images/Cisco 9861.png', size:70, hero:false });
    renderFeatures(); renderPreview();
  });
  $('#addSelectedToHero').addEventListener('click', () => {
    State.s.features.forEach(f => { if (f.selected) f.hero = true; });
    renderFeatures(); renderPreview();
  });

  // Pricing rows
  $('#addRow').addEventListener('click', () => {
    const d = $('#pDesc').value.trim();
    const q = $('#pQty').value.trim();
    const p = $('#pPrice').value.trim();
    if (d && q && p) {
      State.addRow(d,q,p);
      $('#pDesc').value = $('#pQty').value = $('#pPrice').value = '';
      renderPricing(); renderPreview();
    }
  });

  // Exports
  $('#downloadEmail').addEventListener('click', downloadEmailHTML);
  $('#downloadPrint').addEventListener('click', triggerPrint);

})();