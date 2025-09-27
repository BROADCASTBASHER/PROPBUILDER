#!/usr/bin/env python3
import base64
import json
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS_JS = ROOT / "js" / "assets.js"

IMAGE_DIRS = [
    ROOT / "assets" / "Pictograms",
    ROOT / "assets" / "images",
]


def iter_image_paths():
    for directory in IMAGE_DIRS:
        if not directory.exists():
            continue
        for path in sorted(directory.rglob('*')):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.gif', '.svg'}:
                continue
            yield path


def to_data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        suffix = path.suffix.lower().lstrip('.')
        mime = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
        }.get(suffix, 'application/octet-stream')
    data = base64.b64encode(path.read_bytes()).decode('ascii')
    return f"data:{mime};base64,{data}"


def build_icon_map():
    items = []
    seen = set()
    found_pictogram = False
    for path in iter_image_paths():
        key = path.name
        if key in seen:
            continue
        if "Pictograms" in path.parts and path.suffix.lower() == ".png":
            found_pictogram = True
        seen.add(key)
        items.append((key, to_data_uri(path)))
    if not found_pictogram:
        raise RuntimeError(
            "No pictogram PNGs found in assets/Pictograms. Provide the source set before running."
        )
    items.sort(key=lambda item: item[0].lower())
    return items


def update_assets_js(entries):
    text = ASSETS_JS.read_text()
    pattern = re.compile(r"window.__ICON_DATA__\s*=\s*\{.*?\n\};", re.S)
    replacement_body = ",\n".join(
        f"  {json.dumps(name)}: {json.dumps(data)}" for name, data in entries
    )
    replacement = f"window.__ICON_DATA__ = {{\n{replacement_body}\n}};"
    new_text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError("Failed to replace window.__ICON_DATA__ block")
    ASSETS_JS.write_text(new_text)


def main():
    entries = build_icon_map()
    update_assets_js(entries)
    print(f"Updated {ASSETS_JS} with {len(entries)} icons")


if __name__ == "__main__":
    main()
