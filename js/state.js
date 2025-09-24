// Centralised state with safe updates
const State = (() => {
  const s = {
    branding: { customer: "", ref: "", headline: "", subheadline: "", logo: "" },
    executive_summary: "",
    key_benefits: [],
    commercial_terms: [],
    features: [],
    pricing_rows: [],
    price_total: "0.00"
  };

  const loadDefaults = async () => {
    const res = await fetch('data/defaults.json');
    const def = await res.json();
    Object.assign(s, def);
    computeTotal();
  };

  const computeTotal = () => {
    let total = 0;
    s.pricing_rows.forEach(r => {
      const v = parseFloat((r[2]||'0').toString().replace(/[^0-9.]/g, ''));
      total += isNaN(v) ? 0 : v;
    });
    s.price_total = total.toFixed(2);
  };

  const addBenefit = (b) => {
    if (!b) return;
    s.key_benefits.push(b);
  };

  const removeBenefit = (i) => {
    s.key_benefits.splice(i,1);
  };

  const addFeature = (f) => { s.features.push(f); };
  const updateFeature = (i, patch) => { Object.assign(s.features[i], patch); };
  const removeFeature = (i) => { s.features.splice(i,1); };

  const addRow = (desc, qty, price) => { s.pricing_rows.push([desc, qty, price]); computeTotal(); };
  const removeRow = (i) => { s.pricing_rows.splice(i,1); computeTotal(); };

  return { s, loadDefaults, computeTotal, addBenefit, removeBenefit, addFeature, updateFeature, removeFeature, addRow, removeRow };
})();
