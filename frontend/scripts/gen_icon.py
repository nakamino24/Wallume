from PIL import Image, ImageDraw

size = 1024
img = Image.new("RGBA", (size, size), (22, 33, 62, 255))  # #16213E
draw = ImageDraw.Draw(img)

# "W" letter shape as rounded rect
margin = size // 4
bar_w = size // 10
bar_h = size // 2
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
# Middle V shape
draw.rounded_rectangle(
    [size // 2 - bar_w // 2, margin, size // 2 + bar_w // 2, margin + bar_h],
    radius=bar_w // 2, fill=(63, 167, 150, 255),
)

# Adaptive icon: white background + centered logo
adap = Image.new("RGBA", (size, size), (248, 247, 244, 255))  # #F8F7F4
adap.paste(img.resize((size // 2, size // 2)), (size // 4, size // 4), img.resize((size // 2, size // 2)))

img.save("icon.png")
adap.save("adaptive-icon.png")
print("Icons generated")
