#!/usr/bin/env python3
"""Crée les aperçus de démarrage depuis les textures, sans toucher aux originaux.

Usage : python3 scripts/prepare_previews.py (Python + Pillow).
Les textures détaillées et les fichiers full/ restent inchangés.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"


def main() -> None:
    artworks = json.loads((ROOT / "src/data/artworks.json").read_text())
    total = 0
    for artwork in artworks:
        if not artwork.get("imagePreview"):
            continue
        destination = PUBLIC / artwork["imagePreview"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(PUBLIC / artwork["image"]) as source:
            preview = source.convert("RGB")
            preview.thumbnail((512, 768), Image.Resampling.LANCZOS)
            preview.save(destination, quality=82, optimize=True)
        total += destination.stat().st_size
    print(f"Aperçus : {total:,} octets")


if __name__ == "__main__":
    main()
