#!/usr/bin/env python3
"""Generate the Tech AI monkey app icon in every format the installers need.

One source of truth for the geometry: the shapes below are drawn with Pillow for
the raster formats and emitted as an SVG with the same coordinates, so the
vector and the bitmaps can never drift apart.

Outputs (cli/assets/):
    icon.svg     vector, used by the Linux .desktop entry
    icon.png     512x512 raster, thumbnail/preview
    icon.ico     multi-size, embedded in the Windows .exe
    icon.icns    macOS icon set, used by the .app bundle

Run:  python3 scripts/make-icons.py
"""

from __future__ import annotations

import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw

# --- design -----------------------------------------------------------------
S = 1024                      # design canvas; everything below is in these units
BG = "#0b0b0c"                # near-black
FG = "#34d399"                # emerald
CORNER = 224                  # background corner radius
STROKE = 64
HEAD = (512, 528, 288)        # cx, cy, r
EARS = ((218, 528, 96), (806, 528, 96))
EYES = ((400, 464, 51), (624, 464, 51))
SMILE = (512, 528, 176, 20, 160)   # cx, cy, r, start°, end° (0°=3 o'clock, clockwise)

OUT = Path(__file__).resolve().parent.parent / "cli" / "assets"


def draw(scale: int = 1) -> Image.Image:
    """Render the icon at `scale`x the design canvas, antialiased by supersampling."""
    n = S * scale

    def s(v: float) -> float:
        return v * scale

    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=s(CORNER), fill=BG)

    def ring(cx: float, cy: float, r: float) -> None:
        d.ellipse(
            [s(cx - r), s(cy - r), s(cx + r), s(cy + r)],
            outline=FG,
            width=int(s(STROKE)),
        )

    # ears first so the head outline sits on top of them
    for cx, cy, r in EARS:
        ring(cx, cy, r)
    ring(*HEAD)

    for cx, cy, r in EYES:
        d.ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)], fill=FG)

    cx, cy, r, a0, a1 = SMILE
    d.arc(
        [s(cx - r), s(cy - r), s(cx + r), s(cy + r)],
        start=a0,
        end=a1,
        fill=FG,
        width=int(s(STROKE)),
    )
    return img


def smooth(size: int) -> Image.Image:
    """Downsample a 4x supersampled render to `size`."""
    return draw(4).resize((size, size), Image.LANCZOS)


def svg() -> str:
    cx, cy, r, a0, a1 = SMILE
    x0 = cx + r * math.cos(math.radians(a0))
    y0 = cy + r * math.sin(math.radians(a0))
    x1 = cx + r * math.cos(math.radians(a1))
    y1 = cy + r * math.sin(math.radians(a1))
    ears = "\n".join(
        f'  <circle cx="{x}" cy="{y}" r="{rr}" fill="none" stroke="{FG}" stroke-width="{STROKE}"/>'
        for x, y, rr in EARS
    )
    eyes = "\n".join(
        f'  <circle cx="{x}" cy="{y}" r="{rr}" fill="{FG}"/>' for x, y, rr in EYES
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">
  <rect width="{S}" height="{S}" rx="{CORNER}" fill="{BG}"/>
{ears}
  <circle cx="{HEAD[0]}" cy="{HEAD[1]}" r="{HEAD[2]}" fill="none" stroke="{FG}" stroke-width="{STROKE}"/>
{eyes}
  <path d="M {x0:.0f} {y0:.0f} A {r} {r} 0 0 1 {x1:.0f} {y1:.0f}" fill="none" stroke="{FG}" stroke-width="{STROKE}" stroke-linecap="round"/>
</svg>
"""


def write_icns(path: Path, images: dict[str, Image.Image]) -> None:
    """Write an .icns container holding PNG data (the format macOS 10.7+ uses)."""
    chunks = b""
    for kind, img in images.items():
        import io

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        chunks += kind.encode("ascii") + struct.pack(">I", len(data) + 8) + data
    path.write_bytes(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    (OUT / "icon.svg").write_text(svg(), encoding="utf-8")

    png = smooth(512)
    png.save(OUT / "icon.png", format="PNG")

    master = smooth(1024)
    master.save(
        OUT / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    write_icns(
        OUT / "icon.icns",
        {
            "icp4": smooth(16),
            "icp5": smooth(32),
            "ic07": smooth(128),
            "ic08": smooth(256),
            "ic09": smooth(512),
            "ic10": master,
        },
    )

    for f in sorted(OUT.iterdir()):
        print(f"  {f.name:14} {f.stat().st_size:>8} bytes")


if __name__ == "__main__":
    main()
