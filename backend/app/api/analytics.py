from __future__ import annotations

from io import BytesIO
from typing import Optional
from fastapi import APIRouter, Header
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
from app.services.domain_services import AnalyticsService

router = APIRouter(prefix="/analytics")
svc = AnalyticsService()

# Wallet-palette colors, matching the widget's dark background.
BG_CARD = (23, 23, 28, 255)
BAR = (63, 167, 150, 255)
TEXT = (156, 163, 175, 255)
LABEL = (244, 242, 238, 255)


@router.get("/summary")
async def analytics_summary(authorization: Optional[str] = Header(None)):
    result = await svc.summary(authorization)
    return {"success": True, "data": result}


@router.get("/spending-chart")
async def spending_chart(authorization: Optional[str] = Header(None)):
    """PNG pie chart of this month's expenses by category. Rendered server-side
    with PIL because native Android widgets can't render interactive charts."""
    rows = await svc.monthly_spending(authorization)
    png = _render_pie_chart(rows)
    return Response(content=png, media_type="image/png")


# Wallet-palette category colors (matches frontend tokens).
_PIE_COLORS = [
    (63, 167, 150, 255),   # teal
    (244, 162, 97, 255),   # orange
    (211, 47, 47, 255),    # red
    (46, 125, 50, 255),    # green
    (22, 33, 62, 255),     # navy
    (237, 108, 2, 255),    # amber
    (156, 163, 175, 255),  # gray
    (34, 34, 34, 255),     # near-black
]


def _render_pie_chart(rows: list[dict]) -> bytes:
    size = 220
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    data = rows[:8]
    total = sum(r["amount"] for r in data)
    if not total:
        try:
            font_sm = ImageFont.truetype("arial.ttf", 14)
        except Exception:
            font_sm = ImageFont.load_default()
        draw.text((70, 100), "No expenses yet", font=font_sm, fill=(244, 242, 238, 255))
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    cx = cy = size / 2
    radius = 80
    start = -90  # start at 12 o'clock
    for i, r in enumerate(data):
        frac = r["amount"] / total
        sweep = 360 * frac
        color = _PIE_COLORS[i % len(_PIE_COLORS)]
        draw.pieslice(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            start=start, end=start + sweep, fill=color,
        )
        start += sweep

    # Ring border for a clean donut-like edge
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        outline=(23, 23, 28, 255), width=2,
    )

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()