#!/usr/bin/env python3
"""Prépare les ressources de la galerie à partir des fichiers sources.

Usage :
    python3 scripts/prepare_assets.py <dossier_sources>

- Œuvres : copie l'original (consultation plein écran) dans public/artworks/full
  et génère une version 1024 px de large pour la scène 3D dans public/artworks/tex.
  Aucune retouche colorimétrique, aucun recadrage : simple redimensionnement.
- Logo : conserve le fichier officiel tel quel et en dérive une version
  détourée (fond transparent) + une ombre douce pour l'accrochage mural.
- Sol : éclaircit la texture de pierre pour obtenir un calcaire ivoire.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# fichier source -> identifiant de l'œuvre (voir src/data/artworks.json)
ARTWORKS = {
    "2b09bf9b-image.jpg": "klee-late-evening",
    "43b0c6cf-image.jpg": "matisse-open-window-collioure",
    "7a913e88-image.jpg": "matisse-seated-riffian",
    "99a6824c-image.jpg": "klee-may-picture",
    "70449dd6-image.jpg": "matisse-paysage-marocain",
    "f3497354-image.jpg": "monet-effet-rose",
    "119497ad-image.jpg": "monet-giverny",
    "0abe850f-image.jpg": "van-gogh-printemps",
    "63eedf29-image.jpg": "klee-senecio",
    "f370211a-image.jpg": "klee-old-city",
    "195dcb34-image.jpg": "klee-blossoming",
    "73ff25ca-image.jpg": "klee-burggarten",
}
LOGO = "3a60486b-image.png"


def prepare_artworks(src: Path) -> None:
    for name, slug in ARTWORKS.items():
        original = src / name
        shutil.copyfile(original, PUBLIC / "artworks" / "full" / f"{slug}.jpg")
        im = Image.open(original).convert("RGB")
        w = 1024
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save(
            PUBLIC / "artworks" / "tex" / f"{slug}.jpg", quality=90, optimize=True
        )
        print("œuvre", slug, im.size, "->", (w, h))


def prepare_logo(src: Path) -> None:
    original = src / LOGO
    shutil.copyfile(original, PUBLIC / "logo" / "artin-berry-logo.png")
    im = Image.open(original).convert("L")
    ink = ImageOps.invert(im)  # encre = blanc
    bbox = ink.point(lambda v: 255 if v > 40 else 0).getbbox()
    pad = 14
    bbox = (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad)
    ink = ink.crop(bbox)
    scale = 6
    big = ink.resize((ink.width * scale, ink.height * scale), Image.LANCZOS)
    # resserre légèrement la transition pour des contours nets après agrandissement
    big = big.point(lambda v: max(0, min(255, int((v - 96) * 255 / (176 - 96)))))
    big = big.filter(ImageFilter.GaussianBlur(0.6))
    rgba = Image.new("RGBA", big.size, (17, 17, 17, 0))
    rgba.putalpha(big)
    rgba.save(PUBLIC / "logo" / "artin-berry-logo-ink.png", optimize=True)
    # masque seul (canal alpha dans une image en niveaux de gris) pour le mur
    big.save(PUBLIC / "logo" / "artin-berry-logo-mask.png", optimize=True)
    shadow = big.filter(ImageFilter.GaussianBlur(7))
    shadow.save(PUBLIC / "logo" / "artin-berry-logo-shadow.png", optimize=True)
    print("logo", im.size, "->", big.size)


def prepare_floor() -> None:
    p = PUBLIC / "textures" / "floor_diff.jpg"
    backup = PUBLIC / "textures" / "floor_diff_source.jpg"
    if not backup.exists():
        shutil.copyfile(p, backup)
    im = Image.open(backup).convert("RGB")
    im = ImageEnhance.Color(im).enhance(0.42)
    # éclaircissement doux (courbe) : calcaire ivoire
    lut = [min(255, int(255 * ((v / 255) ** 0.62) * 1.02)) for v in range(256)]
    im = im.point(lut * 3)
    warm = Image.new("RGB", im.size, (255, 250, 240))
    im = ImageChops.multiply(im, warm)
    im.save(p, quality=88, optimize=True)
    print("sol", im.resize((1, 1)).getpixel((0, 0)))
    for name in ("oak_diff.jpg", "oak_nor.jpg", "oak_rough.jpg"):
        q = PUBLIC / "textures" / name
        Image.open(q).save(q, quality=82, optimize=True)


if __name__ == "__main__":
    source = Path(sys.argv[1])
    prepare_artworks(source)
    prepare_logo(source)
    prepare_floor()
