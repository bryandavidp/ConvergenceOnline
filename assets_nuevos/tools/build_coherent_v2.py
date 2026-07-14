from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
OUT = ROOT / "listo_para_integrar_v2"
PREVIEWS = ROOT / "previews_revision"

GVESSTER = (
    ROOT
    / "_source_extract"
    / "gvesster_free_icon_pack"
    / "Free Icon Pack v3.1 (Basic)"
)
GVESSTER_EVENTS = (
    ROOT
    / "_source_extract"
    / "gvesster_events_icon_pack"
    / "Events Icon Pack v3 (Basic)"
)
AKAMI = ROOT / "_source_extract_revision" / "akami_buff_debuff_cc0"
CURRENT = ROOT / "listo_para_integrar"
REVISION = ROOT / "_source_extract_revision"

CANVAS_SIZE = 512
VISUAL_SIZE = 420


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    name = "arialbd.ttf" if bold else "arial.ttf"
    path = Path("C:/Windows/Fonts") / name
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def normalize(source: Path, destination: Path) -> dict[str, object]:
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        image = image.crop(bbox)
    image.thumbnail((VISUAL_SIZE, VISUAL_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    x = (CANVAS_SIZE - image.width) // 2
    y = (CANVAS_SIZE - image.height) // 2
    canvas.alpha_composite(image, (x, y))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    return {
        "file": destination.name,
        "source_file": str(source.relative_to(ROOT)).replace("\\", "/"),
        "sha256": digest,
        "width": CANVAS_SIZE,
        "height": CANVAS_SIZE,
    }


def copy_normalized(source: Path, destination: Path) -> dict[str, object]:
    return normalize(source, destination)


def best_gvesster(category: str, icon: str) -> Path:
    directory = GVESSTER / category / icon
    candidates = list(directory.rglob("*.png"))
    if not candidates:
        raise FileNotFoundError(f"No PNG found for {category}/{icon}")

    def score(path: Path) -> tuple[int, str]:
        value = path.name.lower()
        points = 0
        points += 140 if "outline" in value else 0
        points += 55 if "1st" in value else 0
        points += 25 if "256" in value else 0
        points -= 100 if "black" in value or "white" in value else 0
        points -= 70 if "golden" in value else 0
        points -= 35 if "2nd" in value else 0
        points -= 60 if "64" in value else 0
        return points, str(path)

    return max(candidates, key=score)


def best_event(icon: str) -> Path:
    directory = GVESSTER_EVENTS / "Halloween" / icon
    candidates = list(directory.rglob("*.png"))
    if not candidates:
        raise FileNotFoundError(f"No event PNG found for {icon}")

    def score(path: Path) -> tuple[int, str]:
        value = path.name.lower()
        points = 0
        points += 100 if "outline" in value else 0
        points += 40 if "256" in value else 0
        points -= 60 if "64" in value else 0
        return points, str(path)

    return max(candidates, key=score)


def add_set(
    set_id: str,
    label: str,
    source_name: str,
    source_url: str,
    license_name: str,
    license_note: str,
    entries: list[tuple[str, Path]],
) -> dict[str, object]:
    target = OUT / set_id
    files = []
    for destination_name, source in entries:
        files.append(copy_normalized(source, target / destination_name))
    return {
        "id": set_id,
        "label": label,
        "source": source_name,
        "source_url": source_url,
        "license": license_name,
        "license_note": license_note,
        "count": len(files),
        "files": files,
    }


def existing_entries(folder: Path, names: list[str] | None = None) -> list[tuple[str, Path]]:
    if names is None:
        files = sorted(folder.glob("*.png"))
    else:
        files = [folder / f"{name}.png" for name in names]
    missing = [path for path in files if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing existing normalized files: {missing}")
    return [(path.name, path) for path in files]


def build_sets() -> list[dict[str, object]]:
    OUT.mkdir(parents=True, exist_ok=True)
    gvesster_url = "https://gvesster.itch.io/free-icon-pack"
    gvesster_license = (
        "Commercial and client use allowed; attribution optional; no resale or "
        "redistribution as an asset pack."
    )
    sets: list[dict[str, object]] = []

    sets.append(
        add_set(
            "01_gvesster_core_ui_512",
            "UI principal",
            "Gvesster Free Icon Pack",
            gvesster_url,
            "Gvesster custom license",
            gvesster_license,
            existing_entries(CURRENT / "primary_gvesster_ui_512"),
        )
    )

    survival_specs = [
        ("axe", "Item", "Axe"),
        ("backpack", "Item", "Backpack"),
        ("balloon", "Item", "Balloon"),
        ("box", "Item", "Box"),
        ("bubble-gum", "Item", "Bubble Gum"),
        ("coil", "Item", "Coil"),
        ("cracked-egg", "Item", "Cracked Egg"),
        ("credit-card", "Item", "Credit Card"),
        ("egg", "Item", "Egg"),
        ("gum", "Item", "Gum"),
        ("hammer", "Item", "Hammer"),
        ("key", "Item", "Key"),
        ("newspaper", "Item", "Newspaper"),
        ("scroll", "Item", "Scroll"),
        ("shoe", "Item", "Shoe"),
        ("shovel", "Item", "Shovel"),
        ("sword", "Item", "Sword"),
        ("torch", "Item", "Torch"),
        ("bait", "Food", "Bait (Fishing)"),
        ("burger", "Food", "Burger"),
        ("pancake", "Food", "Pancake"),
        ("pizza", "Food", "Pizza"),
        ("broken-heart", "Main", "Broken Heart"),
        ("lightning", "Main", "Lighting"),
        ("rebirth", "Main", "Rebirth and Auto Open"),
        ("trade", "Main", "Trade"),
        ("wheel", "Main", "Wheel"),
        ("cloud", "Nature", "Cloud"),
        ("clover", "Nature", "Clover"),
        ("thunderstorm", "Nature", "Thunderstorm"),
        ("wheat", "Nature", "Wheat"),
    ]
    survival_entries = [
        (f"{name}.png", best_gvesster(category, icon))
        for name, category, icon in survival_specs
    ]
    sets.append(
        add_set(
            "02_gvesster_survival_512",
            "Supervivencia y objetos",
            "Gvesster Free Icon Pack",
            gvesster_url,
            "Gvesster custom license",
            gvesster_license,
            survival_entries,
        )
    )

    match3_specs = [
        ("apple", "Nature", "Apple"),
        ("banana", "Nature", "Banana"),
        ("strawberry", "Nature", "Strawberry"),
        ("orange", "Nature", "Orange"),
        ("avocado", "Food", "Avocado"),
        ("blueberry", "Food", "Blueberry"),
        ("lemon", "Food", "Lemon"),
        ("carrot", "Food", "Carrot"),
        ("cookie", "Food", "Cookie"),
    ]
    match3_entries = [
        (f"{name}.png", best_gvesster(category, icon))
        for name, category, icon in match3_specs
    ]
    sets.append(
        add_set(
            "03_gvesster_match3_food_512",
            "Piezas match-3 alternativas",
            "Gvesster Free Icon Pack",
            gvesster_url,
            "Gvesster custom license",
            gvesster_license,
            match3_entries,
        )
    )

    halloween_names = [
        "Bat",
        "Bone",
        "Candycorn",
        "Cauldron",
        "Coffin",
        "Ghost",
        "Pumpkin",
        "Tombstone",
        "ToT Bag Orange",
        "ToT Bag Purple",
    ]
    halloween_entries = [
        (f"{name.lower().replace(' ', '-')}.png", best_event(name))
        for name in halloween_names
    ]
    sets.append(
        add_set(
            "04_gvesster_events_halloween_512",
            "Eventos Halloween",
            "Gvesster Events Icon Pack",
            "https://gvesster.itch.io/events-icon-pack",
            "Gvesster custom license",
            gvesster_license,
            halloween_entries,
        )
    )

    progression_names = [
        "medal",
        "trophy",
        "crown",
        "star",
        "verify",
        "upgrade",
        "gift",
        "chest",
        "ticket",
        "luckyblock",
        "crystal",
        "coin",
    ]
    sets.append(
        add_set(
            "05_gvesster_progression_512",
            "Progresion, logros y recompensas",
            "Gvesster Free Icon Pack",
            gvesster_url,
            "Gvesster custom license",
            gvesster_license,
            existing_entries(CURRENT / "primary_gvesster_ui_512", progression_names),
        )
    )

    akami_candidates = []
    for path in AKAMI.rglob("*.png"):
        if "__MACOSX" in path.parts:
            continue
        try:
            with Image.open(path) as image:
                if image.size == (512, 512):
                    akami_candidates.append(path)
        except OSError:
            continue
    by_name = {path.name: path for path in akami_candidates}
    akami_entries = [(name, by_name[name]) for name in sorted(by_name)]
    sets.append(
        add_set(
            "06_akami_status_cc0_512",
            "Buffs y debuffs, uso aislado",
            "Akami Buff & Debuff Icon Pack Free Vol. 1",
            "https://akami666.itch.io/buff-debuff-icon-pack-free-vol1",
            "CC0 1.0",
            "Public domain dedication; commercial use, modification and redistribution allowed.",
            akami_entries,
        )
    )

    sets.append(
        add_set(
            "07_vektyr_buttons_512",
            "Superficies de boton",
            "Vektyr Juicy Casual Game Buttons",
            "https://realvektyr.itch.io/juicy-casual-game-buttons",
            "Vektyr custom license",
            "Personal and commercial use allowed; source asset resale is prohibited.",
            existing_entries(CURRENT / "ui_buttons_vektyr_512"),
        )
    )
    return sets


def checker(size: tuple[int, int], step: int = 16) -> Image.Image:
    image = Image.new("RGB", size, "#eef1f5")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill="#dde3ea")
    return image


def selected(paths: list[Path], limit: int) -> list[Path]:
    paths = sorted(paths, key=lambda path: str(path).lower())
    if len(paths) <= limit:
        return paths
    indexes = [round(i * (len(paths) - 1) / (limit - 1)) for i in range(limit)]
    return [paths[index] for index in indexes]


def contact_sheet(
    paths: list[Path],
    title: str,
    destination: Path,
    subtitle: str = "",
    columns: int = 6,
    limit: int = 48,
) -> None:
    paths = selected(paths, limit)
    tile_w, tile_h = 220, 250
    header_h = 108
    rows = max(1, math.ceil(len(paths) / columns))
    width = 40 + columns * tile_w
    height = header_h + 28 + rows * tile_h
    canvas = Image.new("RGB", (width, height), "#f7f8fa")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width, header_h), fill="#20252d")
    draw.text((34, 20), title, fill="white", font=font(31, True))
    if subtitle:
        draw.text((35, 66), subtitle, fill="#cbd3df", font=font(16))

    for index, path in enumerate(paths):
        row, column = divmod(index, columns)
        x = 28 + column * tile_w
        y = header_h + 18 + row * tile_h
        draw.rounded_rectangle((x, y, x + 196, y + 224), radius=8, fill="white", outline="#d7dde5")
        tile = checker((176, 176))
        try:
            with Image.open(path) as opened:
                asset = opened.convert("RGBA")
            asset.thumbnail((158, 158), Image.Resampling.LANCZOS)
            px = (tile.width - asset.width) // 2
            py = (tile.height - asset.height) // 2
            tile = tile.convert("RGBA")
            tile.alpha_composite(asset, (px, py))
            canvas.paste(tile.convert("RGB"), (x + 10, y + 10))
        except OSError:
            draw.text((x + 20, y + 80), "No preview", fill="#a33", font=font(14, True))
        label = path.stem.replace("_", " ")
        if len(label) > 25:
            label = label[:23] + ".."
        draw.text((x + 10, y + 194), label, fill="#252b33", font=font(14))

    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)


def sheet_preview(source: Path, title: str, destination: Path, subtitle: str) -> None:
    with Image.open(source) as opened:
        image = opened.convert("RGB")
    image.thumbnail((1500, 1400), Image.Resampling.LANCZOS)
    width = max(1000, image.width + 80)
    height = image.height + 150
    canvas = Image.new("RGB", (width, height), "#f7f8fa")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width, 108), fill="#20252d")
    draw.text((34, 20), title, fill="white", font=font(31, True))
    draw.text((35, 66), subtitle, fill="#cbd3df", font=font(16))
    canvas.paste(image, ((width - image.width) // 2, 126))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)


def preview_revision_candidates() -> list[dict[str, str]]:
    candidates = [
        ("akami_buff_debuff_cc0", "Akami Buff & Debuff", "CC0; encaje alto para estados; AI-assisted"),
        ("akami_cozy_witchcraft", "Akami Cozy Witchcraft", "Encaje alto, pero licencia no explicita en el archivo"),
        ("deyeshi_shiny_game_icons", "Deyeshi Shiny Game Icons", "Muy buen match-3; CC BY-SA; sprite sheet"),
        ("deyeshi_vibrant_game_icons", "Deyeshi Vibrant Game Icons", "Borde grueso, dibujo plano; CC BY-SA"),
        ("gobi_shiny_gems", "GOBI Shiny Gems", "CC BY 4.0; gema pintada mas detallada"),
        ("sudoja_game_icons_sampler", "Sudoja Free Game Icons Sampler", "Buen sampler flat; licencia local insuficiente"),
        ("assetsmithy_fantasy_loot", "AssetSmithy Fantasy Loot", "Cobertura alta; demasiado RPG/detallado; AI-assisted"),
        ("marco_consumables", "Marco Consumables", "Consumibles compactos; AI-assisted"),
    ]
    records = []
    for identifier, title, subtitle in candidates:
        folder = REVISION / identifier
        paths = [
            path
            for path in folder.rglob("*.png")
            if "__MACOSX" not in path.parts
        ]
        if identifier in {
            "akami_buff_debuff_cc0",
            "akami_cozy_witchcraft",
            "assetsmithy_fantasy_loot",
            "marco_consumables",
        }:
            unique: dict[str, Path] = {}
            for path in paths:
                key = path.name.lower()
                if identifier in {"akami_cozy_witchcraft", "marco_consumables"}:
                    key = re.sub(r"(?i)(?:^|[_ ])(?:64|128|256|512)(?=[_ ])", "_", key)
                    key = re.sub(r"(?i)(?:64|128|256|512){2}", "", key)
                previous = unique.get(key)
                if previous is None or path.stat().st_size > previous.stat().st_size:
                    unique[key] = path
            paths = list(unique.values())
        destination = PREVIEWS / f"preview_{identifier}.png"
        if len(paths) == 1:
            sheet_preview(paths[0], title, destination, subtitle)
        else:
            contact_sheet(paths, title, destination, subtitle, limit=48)
        records.append({"id": identifier, "title": title, "file": destination.name})
    return records


def section_height(count: int, columns: int = 8) -> int:
    return 86 + math.ceil(count / columns) * 190


def draw_comparison_section(
    canvas: Image.Image,
    y: int,
    label: str,
    note: str,
    paths: list[Path],
    accent: str,
    columns: int = 8,
) -> int:
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, y, canvas.width, y + 70), fill=accent)
    draw.text((34, y + 14), label, fill="white", font=font(27, True))
    draw.text((330, y + 22), note, fill="#f1f4f8", font=font(16))
    y += 82
    for index, path in enumerate(paths):
        row, column = divmod(index, columns)
        x = 30 + column * 192
        ty = y + row * 190
        tile = checker((156, 156))
        with Image.open(path) as opened:
            asset = opened.convert("RGBA")
        asset.thumbnail((140, 140), Image.Resampling.LANCZOS)
        tile = tile.convert("RGBA")
        tile.alpha_composite(asset, ((156 - asset.width) // 2, (156 - asset.height) // 2))
        canvas.paste(tile.convert("RGB"), (x, ty))
        label_text = path.stem.replace("_", " ").replace("-", " ")
        if len(label_text) > 22:
            label_text = label_text[:20] + ".."
        draw.text((x, ty + 160), label_text, fill="#222831", font=font(13))
    return y + math.ceil(len(paths) / columns) * 190


def comparison_preview() -> None:
    current_liquid = selected(
        list((CURRENT / "secondary_craftpix_liquid_loot_512").glob("*.png")), 16
    )
    proposed_survival = selected(list((OUT / "02_gvesster_survival_512").glob("*.png")), 16)
    current_halloween = selected(
        list((CURRENT / "secondary_craftpix_halloween_512").glob("*.png")), 16
    )
    proposed_halloween = list((OUT / "04_gvesster_events_halloween_512").glob("*.png"))
    sections = [
        ("ANTES: LIQUID / LOOT", "CraftPix: detalle y contorno no alineados con el HUD", current_liquid, "#8b3f45"),
        ("V2: SUPERVIVENCIA", "Gvesster: misma silueta, borde y sombreado que la UI", proposed_survival, "#28705d"),
        ("ANTES: HALLOWEEN", "CraftPix: lenguaje visual mas oscuro y RPG", current_halloween, "#8b3f45"),
        ("V2: HALLOWEEN", "Gvesster Events: continuidad directa con el set principal", proposed_halloween, "#28705d"),
    ]
    height = 110 + sum(section_height(len(paths)) for _, _, paths, _ in sections)
    canvas = Image.new("RGB", (1600, height), "#f7f8fa")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, canvas.width, 96), fill="#171b21")
    draw.text((34, 22), "Convergence Online: comparacion de coherencia V1 vs V2", fill="white", font=font(32, True))
    y = 110
    for label, note, paths, accent in sections:
        y = draw_comparison_section(canvas, y, label, note, paths, accent)
    canvas = canvas.crop((0, 0, canvas.width, y + 20))
    canvas.save(PREVIEWS / "comparison_craftpix_vs_gvesster_v2.png", optimize=True)


def final_preview(sets: list[dict[str, object]]) -> None:
    paths = []
    for set_info in sets:
        folder = OUT / str(set_info["id"])
        paths.extend(selected(list(folder.glob("*.png")), 12))
    contact_sheet(
        paths,
        "Seleccion coherente lista para integrar V2",
        OUT / "preview_listo_para_integrar_v2.png",
        "Gvesster como lenguaje principal; Akami solo para estados; Vektyr solo para superficies",
        columns=8,
        limit=len(paths),
    )


def write_index(records: list[dict[str, str]]) -> None:
    cards = [
        ("Comparacion V1 vs V2", "comparison_craftpix_vs_gvesster_v2.png"),
        *[(record["title"], record["file"]) for record in records],
    ]
    body = "\n".join(
        f'<article><h2>{title}</h2><a href="{filename}"><img src="{filename}" alt="{title}"></a></article>'
        for title, filename in cards
    )
    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revision de iconografia V2</title>
<style>
body{{margin:0;background:#eef1f4;color:#20252d;font:16px Arial,sans-serif}}main{{max-width:1500px;margin:auto;padding:28px}}h1{{font-size:30px}}article{{background:white;border:1px solid #d7dde5;border-radius:8px;margin:22px 0;padding:18px}}h2{{font-size:20px}}img{{display:block;width:100%;height:auto;border:1px solid #d7dde5}}
</style>
</head>
<body><main><h1>Revision de iconografia V2</h1>{body}</main></body>
</html>"""
    (PREVIEWS / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    sets = build_sets()
    manifest = {
        "version": 2,
        "generated_for": "Convergence Online",
        "format": "PNG RGBA 512x512, transparent background",
        "art_direction": (
            "Gvesster is the production visual language. Akami is isolated to status effects; "
            "Vektyr is isolated to button surfaces."
        ),
        "sets": sets,
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    records = preview_revision_candidates()
    comparison_preview()
    final_preview(sets)
    write_index(records)
    print(json.dumps({item["id"]: item["count"] for item in sets}, indent=2))


if __name__ == "__main__":
    main()
