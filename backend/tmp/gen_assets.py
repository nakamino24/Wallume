"""Generate branded splash + icon assets for Matrix Finance."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

OUT = Path("/home/claude/images")
BG = (9, 9, 11)          # #09090B — Matrix dark surface
BRAND = (16, 185, 129)   # #10B981 — emerald brand
WHITE = (255, 255, 255)


def rounded_rect(size, radius, fill):
    # Return an RGBA image with a rounded square filled with fill.
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=fill)
    return img


def try_font(size):
    """Return a bold TTF font, falling back to default."""
    fonts = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVu-Sans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ]
    for p in fonts:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def draw_M(img, cx, cy, size, color):
    """Draw a bold letter M centered at (cx, cy) with a given cap height."""
    font = try_font(size)
    d = ImageDraw.Draw(img)
    text = "M"
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, fill=color, font=font)


def make_splash():
    W, H = 1242, 2688  # iPhone Pro Max size - expo will downscale
    img = Image.new("RGB", (W, H), BG)

    # Subtle radial-ish gradient using a soft green glow blob (blurred rectangle)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([(W // 2 - 700, H // 2 - 900), (W // 2 + 700, H // 2 + 900)],
               fill=(16, 185, 129, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(200))
    img.paste(glow, (0, 0), glow)

    # Rounded brand tile
    tile = rounded_rect(360, 90, BRAND + (255,))
    img.paste(tile, ((W - 360) // 2, H // 2 - 320), tile)
    draw_M(img, W // 2, H // 2 - 320 + 180, 240, WHITE)

    # Wordmark
    font_name = try_font(96)
    d = ImageDraw.Draw(img)
    text = "Matrix Finance"
    bbox = d.textbbox((0, 0), text, font=font_name)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) / 2 - bbox[0], H // 2 + 100), text, fill=WHITE, font=font_name)

    font_sub = try_font(48)
    sub = "Your money, mastered."
    bbox = d.textbbox((0, 0), sub, font=font_sub)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) / 2 - bbox[0], H // 2 + 240), sub, fill=(160, 160, 170), font=font_sub)

    img.save(OUT / "splash-image.png", "PNG")
    print("splash-image.png ok", (W, H))


def make_icon():
    S = 1024
    img = Image.new("RGB", (S, S), BG)
    # rounded emerald tile
    tile = rounded_rect(S, int(S * 0.22), BRAND + (255,))
    img_rgba = img.convert("RGBA")
    img_rgba.paste(tile, (0, 0), tile)
    draw_M(img_rgba, S // 2, S // 2, 720, WHITE)
    img_rgba.convert("RGB").save(OUT / "icon.png", "PNG")

    # adaptive icon (foreground): centered M on transparent
    ad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tile2 = rounded_rect(S, int(S * 0.22), BRAND + (255,))
    ad.paste(tile2, (0, 0), tile2)
    draw_M(ad, S // 2, S // 2, 720, WHITE)
    ad.save(OUT / "adaptive-icon.png", "PNG")

    # favicon
    fav = ad.resize((512, 512), Image.Resampling.LANCZOS)
    fav.save(OUT / "favicon.png", "PNG")

    print("icons ok")


if __name__ == "__main__":
    make_splash()
    make_icon()