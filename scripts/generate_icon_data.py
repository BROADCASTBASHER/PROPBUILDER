#!/usr/bin/env python3
"""Build the runtime asset lookup tables used by the proposal builder UI.

The previous implementation attempted to inline every icon as a base64 string,
but that approach made the script brittle (it expected a pre-existing
`window.__ICON_DATA__` block) and the generated file was huge. More importantly
it silently failed once the pictogram set was moved into the repository root,
leaving `assets.js` in an invalid state so no icons or logos rendered.

This utility now scans the committed asset folders, emits relative URLs and
writes a small JavaScript helper that exposes `window.__ICON_DATA__` and
`window.__LOGO_DATA__` to the browser (and to Node based tests when required).
Run it whenever new pictograms, product photos or logo variants are added.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
ASSETS_JS = ROOT / "js" / "assets.js"

ICON_DIRS = [
    ROOT / "Pictograms",
    ROOT / "assets" / "images",
]

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg"}

LOGO_SOURCES = {
    "Primary (Blue/Coral)": ROOT / "assets" / "logos" / "primary-logo" / "Telstra-Primary-logo.png",
    "Primary (Mono White)": ROOT / "assets" / "logos" / "primary-logo" / "Telstra-Primary-logo-Mono-White.png",
    "Primary (Mono Black)": ROOT / "assets" / "logos" / "primary-logo" / "Telstra-Primary-logo-Mono-Black-RGB.png",
    "Primary on Blue (White T)": ROOT / "assets" / "logos" / "primary-logo" / "Telstra-Primary-logo-A.png",
    "Primary on Coral (White T)": ROOT / "assets" / "logos" / "primary-logo" / "Telstra-Primary-logo-B.png",
}


def normalise_url(path: Path) -> str:
    """Return a browser friendly relative URL for *path*."""

    relative = path.relative_to(ROOT)
    return "/".join(quote(part) for part in relative.parts)


def build_icon_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for base in ICON_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            name = path.name
            mapping.setdefault(name, normalise_url(path))
    if not mapping:
        raise RuntimeError("No icon assets found – check ICON_DIRS.")
    return dict(sorted(mapping.items(), key=lambda item: item[0].lower()))


def build_logo_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    missing = []
    for label, path in LOGO_SOURCES.items():
        if not path.exists():
            missing.append((label, path))
            continue
        mapping[label] = normalise_url(path)
    if missing:
        formatted = "\n".join(f"  - {label}: {path}" for label, path in missing)
        raise RuntimeError(f"Missing logo assets:\n{formatted}")
    return dict(sorted(mapping.items(), key=lambda item: item[0].lower()))


def render_assets_js(icon_map: dict[str, str], logo_map: dict[str, str]) -> str:
    icon_json = json.dumps(icon_map, indent=2, sort_keys=True)
    logo_json = json.dumps(logo_map, indent=2, sort_keys=True)
    return """(function initialiseAssetLookups() {{
  const ICON_DATA = {icons};
  const LOGO_DATA = {logos};

  if (typeof window !== 'undefined') {{
    window.__ICON_DATA__ = ICON_DATA;
    window.__LOGO_DATA__ = LOGO_DATA;
  }}

  if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ ICON_DATA, LOGO_DATA }};
  }}
}})();
""".format(icons=icon_json, logos=logo_json)


def main() -> int:
    icon_map = build_icon_map()
    logo_map = build_logo_map()
    ASSETS_JS.write_text(render_assets_js(icon_map, logo_map))
    print(f"Wrote {ASSETS_JS.relative_to(ROOT)} with {len(icon_map)} icons and {len(logo_map)} logos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
