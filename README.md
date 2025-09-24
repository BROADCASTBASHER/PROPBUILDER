
# TBTC Proposal Builder (Codex)

A cleaned, modular rebuild of the single‑file Proposal Builder as a multi‑file project. 
It preserves your styling, branding, fonts (embedded if provided), and adds the fixes raised in project history.

## Highlights
- Tabs: Banner, Executive Summary, Key Benefits, Features, Pricing, Preview/Export.
- **Email export HTML** mirrors Preview, with **one Ref** field, shaded **price card** matching preview, and **Commercial terms & dependencies** (one per line).
- **Print (A4)** uses page logic suitable for two pages: page 1 visual sections, page 2 benefits & pricing (controlled by CSS page breaks).
- **Features page fix**: no overlapping controls; grid layout; icons keep aspect ratio; sliders resize live; HERO images can scale larger than standard.
- **Logo sync**: logo upload updates banner, preview and all exports.
- **Standard features** preserve aspect ratio in preview and export.
- All JS written defensively to avoid `Unexpected token` console errors (no HTML injected into scripts, sanitized text, template literals only).

## Using
Open `index.html` in a browser. 
- Upload a logo in *Banner* tab.
- Add/edit benefits, features, and pricing lines.
- Use **Export Email HTML** to download a branded standalone email file.
- Use **Print (A4)** for physical print. Adjust browser print margins to 'Default' or 'None' for best results.

## Assets
- Product images placed in `assets/images/` (Cisco 9861, MX67W, Webex included).
- If present, Telstra font files from your upload are placed in `assets/fonts/` and are used in the app and inlined into the email export.
- Pictograms and logos are extracted to `assets/pictograms/` and `assets/logos/` for future use.

## Notes
- Email clients vary in web‑font support. The exporter embeds fonts as data URLs to maximise support without external requests.
- Feature images list includes bundled product images. You can paste a direct asset path or extend `getImageOptions()` to enumerate more.
