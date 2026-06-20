#!/usr/bin/env python3
"""Genera favicons: emblema centrado, fondo transparente, tamaño máximo."""
from PIL import Image

SRC = "src/assets/logo-clubpilates.png"
OUT_DIR = "public"

src = Image.open(SRC).convert("RGBA")
w, h = src.size

# Solo el emblema circular (sin texto inferior)
crop = 620
left = (w - crop) // 2
top = 45
emblem = src.crop((left, top, left + crop, top + crop))

# Negro -> transparente
pixels = emblem.load()
for y in range(emblem.height):
    for x in range(emblem.width):
        r, g, b, a = pixels[x, y]
        if r < 40 and g < 40 and b < 40:
            pixels[x, y] = (0, 0, 0, 0)

bbox = emblem.getbbox()
emblem = emblem.crop(bbox)

canvas_size = 512
margin = int(canvas_size * 0.03)  # 3% margen anti-recorte en pestaña
max_inner = canvas_size - 2 * margin

scale = min(max_inner / emblem.width, max_inner / emblem.height)
new_w = max(1, int(emblem.width * scale))
new_h = max(1, int(emblem.height * scale))
emblem_fit = emblem.resize((new_w, new_h), Image.Resampling.LANCZOS)

canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
x = (canvas_size - new_w) // 2
y = (canvas_size - new_h) // 2
canvas.paste(emblem_fit, (x, y), emblem_fit)

for size in [16, 32, 48, 64, 96, 128, 192]:
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(f"{OUT_DIR}/favicon-{size}.png")

canvas.resize((192, 192), Image.Resampling.LANCZOS).save(f"{OUT_DIR}/apple-touch-icon.png")
canvas.resize((32, 32), Image.Resampling.LANCZOS).save(f"{OUT_DIR}/favicon.png")

print(f"Emblema {bbox} -> {new_w}x{new_h} en {canvas_size}px")
