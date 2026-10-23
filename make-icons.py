#!/usr/bin/env python3
"""Zeichnet das Zirkelwerk-Icon und erzeugt daraus alle benötigten Größen.

    python3 make-icons.py

Eine Quelle für alles – so können iOS, Android und die Web-App nie
auseinanderlaufen. Gezeichnet wird in vierfacher Größe und dann
verkleinert, damit die Kanten glatt werden.

Erzeugt:
  icon-1024.png, icon.png (512), icon-192.png, icon-maskable-512.png
  res/ios/icon-*.png (ohne Alphakanal) und res/ios/Default@2x~universal~anyany.png
  res/android/icon_*.png (klassisch) und res/android/icon_fg_*.png (adaptiv)

Warum die Regeln so sind:
  - iOS-Icons dürfen keinen Alphakanal haben. App Store Connect weist sie
    sonst zurück – erst nach der Verarbeitung, wenn die Build-Nummer schon
    verbraucht ist.
  - iOS rundet die Ecken selbst. Die Quelle ist ein volles Quadrat.
  - Adaptive Android-Icons: Vordergrund 108 dp, davon sind nur die inneren
    66 % garantiert sichtbar. Der Zirkel bleibt deshalb in diesem Kreis.

Voraussetzung: Pillow  (python3 -m pip install Pillow)
"""
import math
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow fehlt.  Abhilfe:  python3 -m pip install Pillow")

INK = (35, 78, 140)          # #234e8c – Hintergrund, auch colors.xml
GRID = (255, 255, 255, 46)
PAPER_ARC = (242, 183, 5)    # #f2b705 – Bleistiftgelb
METAL = (214, 222, 232)
LEAD_LEG = (255, 255, 255)
HINGE = (255, 255, 255)
S = 4                        # Überabtastung


def draw_motif(img, scale, cx, cy, with_grid):
    """Zeichnet Raster, Bogen und Zirkel in ein Bild. scale = Pixel je Einheit
    bei einem 100 Einheiten breiten Motiv."""
    d = ImageDraw.Draw(img, "RGBA")
    u = scale
    if with_grid:
        step = 10 * u
        n = int(img.width / step) + 2
        lw = max(1, int(0.6 * u))
        for i in range(-n, n + 1):
            x = cx + i * step
            d.line([(x, 0), (x, img.height)], fill=GRID, width=lw)
            y = cy + i * step
            d.line([(0, y), (img.width, y)], fill=GRID, width=lw)

    # Spitze links unten, Mine rechts unten, Gelenk oben
    nx, ny = cx - 19 * u, cy + 8 * u
    lx, ly = cx + 19 * u, cy + 8 * u
    hx, hy = cx, cy - 32 * u

    # Gezeichneter Bogen um die Spitze durch die Mine (gelb)
    # Der Bogen läuft aus der Mine nach unten – so sieht man, dass der
    # Zirkel ihn gerade zeichnet.
    r = 38 * u
    bw = int(5.5 * u)
    box = [nx - r, ny - r, nx + r, ny + r]
    d.arc(box, start=-4, end=62, fill=PAPER_ARC, width=bw)

    def leg(x1, y1, x2, y2, w1, w2, col):
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        px, py = -dy / L, dx / L
        d.polygon([
            (x1 + px * w1 / 2, y1 + py * w1 / 2), (x2 + px * w2 / 2, y2 + py * w2 / 2),
            (x2 - px * w2 / 2, y2 - py * w2 / 2), (x1 - px * w1 / 2, y1 - py * w1 / 2)
        ], fill=col)

    leg(hx, hy, nx, ny, 9 * u, 2.2 * u, METAL)
    leg(hx, hy, lx, ly, 9 * u, 4.2 * u, LEAD_LEG)
    # Mine
    d.polygon([(lx - 2.1 * u, ly - 6 * u), (lx + 2.1 * u, ly - 6 * u), (lx, ly + 1.5 * u)], fill=PAPER_ARC)
    # Griff und Gelenk
    d.rounded_rectangle([hx - 3.2 * u, hy - 15 * u, hx + 3.2 * u, hy - 2 * u], radius=3 * u, fill=PAPER_ARC)
    d.ellipse([hx - 6.5 * u, hy - 6.5 * u, hx + 6.5 * u, hy + 6.5 * u], fill=HINGE)
    d.ellipse([hx - 2.6 * u, hy - 2.6 * u, hx + 2.6 * u, hy + 2.6 * u], fill=INK)


def render(size, background, motif_fraction, with_grid=True):
    big = size * S
    img = Image.new("RGBA", (big, big), background + (255,) if background else (0, 0, 0, 0))
    scale = big * motif_fraction / 100.0
    draw_motif(img, scale, big / 2, big / 2, with_grid)
    return img.resize((size, size), Image.LANCZOS)


def save(img, path, rgb=False):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if rgb:
        flat = Image.new("RGB", img.size, INK)
        flat.paste(img, mask=img.split()[3])
        img = flat
    img.save(path, "PNG", optimize=True)
    print("  %-46s %dx%d" % (path, img.width, img.height))


def main():
    full = render(1024, INK, 0.92)
    save(full, "icon-1024.png", rgb=True)
    save(full.resize((512, 512), Image.LANCZOS), "icon.png", rgb=True)
    save(full.resize((192, 192), Image.LANCZOS), "icon-192.png", rgb=True)
    # maskable: Motiv in der sicheren Zone (80 %)
    save(render(512, INK, 0.70), "icon-maskable-512.png", rgb=True)

    for k in [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]:
        save(full.resize((k, k), Image.LANCZOS), "res/ios/icon-%d.png" % k, rgb=True)

    # Startbild: Icon mittig auf der Hintergrundfarbe, ein Quadrat für alle Lagen
    splash = Image.new("RGB", (2732, 2732), INK)
    ic = render(600, INK, 0.92)
    splash.paste(ic, ((2732 - 600) // 2, (2732 - 600) // 2), ic)
    save_rgb = "res/ios/Default@2x~universal~anyany.png"
    splash.save(save_rgb, "PNG", optimize=True)
    print("  %-46s %dx%d" % (save_rgb, 2732, 2732))

    legacy = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dens, px in legacy.items():
        save(full.resize((px, px), Image.LANCZOS), "res/android/icon_%s.png" % dens, rgb=True)
        fg = render(int(px * 108 / 48), None, 0.68, with_grid=False)
        save(fg, "res/android/icon_fg_%s.png" % dens)

    # Kontrolle: iOS ohne Alphakanal
    bad = [f for f in os.listdir("res/ios") if f.startswith("icon-") and Image.open(os.path.join("res/ios", f)).mode != "RGB"]
    if bad:
        sys.exit("Kontrolle fehlgeschlagen, Alphakanal in: " + ", ".join(bad))
    print("Fertig. iOS-Icons ohne Alphakanal geprüft.")


if __name__ == "__main__":
    main()
