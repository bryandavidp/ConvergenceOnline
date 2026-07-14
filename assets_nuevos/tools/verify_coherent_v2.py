from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "listo_para_integrar_v2"
PREVIEWS = ROOT / "previews_revision"


def main() -> None:
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    checked = 0
    transparent = 0
    set_counts: dict[str, int] = {}

    for set_info in manifest["sets"]:
        folder = OUT / set_info["id"]
        files = set_info["files"]
        actual = sorted(folder.glob("*.png"))
        set_counts[set_info["id"]] = len(actual)
        if len(actual) != set_info["count"] or len(files) != set_info["count"]:
            errors.append(f"Count mismatch: {set_info['id']}")
        for record in files:
            path = folder / record["file"]
            if not path.exists():
                errors.append(f"Missing: {path.relative_to(ROOT)}")
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != record["sha256"]:
                errors.append(f"Hash mismatch: {path.relative_to(ROOT)}")
            with Image.open(path) as image:
                if image.size != (512, 512):
                    errors.append(f"Bad size {image.size}: {path.relative_to(ROOT)}")
                if image.mode != "RGBA":
                    errors.append(f"Bad mode {image.mode}: {path.relative_to(ROOT)}")
                alpha = image.getchannel("A")
                low, high = alpha.getextrema()
                if low == 0 and high > 0:
                    transparent += 1
                else:
                    errors.append(f"No transparent background: {path.relative_to(ROOT)}")
            checked += 1

    required = [
        ROOT / "PROPUESTA_COHERENCIA_V2.md",
        ROOT / "INVESTIGACION_REVISION_V2.md",
        OUT / "README.md",
        OUT / "preview_listo_para_integrar_v2.png",
        PREVIEWS / "index.html",
        PREVIEWS / "comparison_craftpix_vs_gvesster_v2.png",
    ]
    for path in required:
        if not path.exists():
            errors.append(f"Missing required deliverable: {path.relative_to(ROOT)}")

    preview_pngs = sorted(PREVIEWS.glob("*.png"))
    report = {
        "status": "ok" if not errors else "failed",
        "version": manifest["version"],
        "png_checked": checked,
        "transparent_png": transparent,
        "set_counts": set_counts,
        "revision_preview_png": len(preview_pngs),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
