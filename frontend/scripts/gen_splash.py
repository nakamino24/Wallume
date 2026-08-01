from PIL import Image, ImageDraw

size = 1024
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))  # transparent
draw = ImageDraw.Draw(img)

# Navy rounded square background
bg = Image.new("RGBA", (size, size), (22, 33, 62, 255))  # #16213E
mask = Image.new("L", (size, size), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, size, size], radius=180, fill=255)
img.paste(bg, (0, 0), mask)

# Teal "W" mark
margin = size // 3
bar_w = size // 12
bar_h = size // 3
gap = size // 8

# Left vertical
draw.rounded_rectangle(
    [margin, size - margin - bar_h, margin + bar_w, size - margin],
    radius=bar_w // 2, fill=(63, 167, 150, 255),
)
# Right vertical
draw.rounded_rectangle(
    [size - margin - bar_w, size - margin - bar_h, size - margin, size - margin],
    radius=bar_w // 2, fill=(63, 167, 150, 255),
)
# Middle V
draw.rounded_rectangle(
    [size // 2 - bar_w // 2, margin, size // 2 + bar_w // 2, margin + bar_h],
    radius=bar_w // 2, fill=(63, 167, 150, 255),
)

img.save("splash-logo.png")
print("Splash logo generated")
