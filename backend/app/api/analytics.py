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
    """PNG bar chart of this month's expenses by category. Rendered server-side
    with PIL because native Android widgets can't render interactive charts."""
    rows = await svc.monthly_spending(authorization)
    png = _render_bar_chart(rows)
    return Response(content=png, media_type="image/png")


def _render_bar_chart(rows: list[dict]) -> bytes:
    width, height = 400, 220
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    try:
        font_sm = ImageFont.truetype("arial.ttf", 13)
        font_title = ImageFont.truetype("arialbd.ttf", 15)
    except Exception:
        font_sm = ImageFont.load_default()
        font_title = ImageFont.load_default()

    draw.text((16, 12), "SPENDING THIS MONTH", font=font_title, fill=TEXT)

    data = rows[:6]
    if not data:
        draw.text((16, 60), "No expenses yet", font=font_sm, fill=LABEL)
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    max_amount = max(r["amount"] for r in data)
    chart_top = 42
    chart_bottom = height - 20
    chart_height = chart_bottom - chart_top
    label_x = 16
    bar_x = 150
    bar_max_w = width - bar_x - 16
    row_h = chart_height / len(data)

    for i, r in enumerate(data):
        y0 = chart_top + i * row_h
        frac = r["amount"] / max_amount if max_amount else 0
        bar_w = max(4, int(bar_max_w * frac))
        bar_h = max(8, int(row_h * 0.4))
        y_center = y0 + (row_h - bar_h) / 2

        label = r["category"][:14]
        draw.text((label_x, y_center + 1), label, font=font_sm, fill=LABEL)
        draw.rounded_rectangle(
            [bar_x, y_center, bar_x + bar_w, y_center + bar_h],
            radius=4, fill=BAR,
        )
        amount_txt = f"{r['amount']:,.0f}"
        draw.text((bar_x + bar_w + 6, y_center + 1), amount_txt, font=font_sm, fill=TEXT)

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()