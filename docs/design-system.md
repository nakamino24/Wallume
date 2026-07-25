# Design System — Wallume

## Philosophy
Premium, calm, focused, timeless. Inspired by Apple HIG, Linear, Notion, Stripe Dashboard. No AI-generic aesthetics, no neon, no glassmorphism overload.

## Colors

### Light Mode (Default)
| Token | Value | Usage |
|---|---|---|
| `surface` | `#F8F7F4` | Page background |
| `surface2` | `#FFFFFF` | Card background |
| `surface3` | `#F0EFED` | Secondary background |
| `onSurface` | `#222222` | Primary text |
| `onSurface2` | `#222222` | Secondary text |
| `onSurface3` | `#6B7280` | Tertiary text |
| `brand` | `#16213E` | Navy — brand primary |
| `brandPrimary` | `#3FA796` | Teal — accent/CTA |
| `onBrand` | `#FFFFFF` | Text on brand backgrounds |
| `secondary` | `#F4A261` | Warm orange accent |
| `success` | `#2E7D32` | Positive indicators |
| `warning` | `#ED6C02` | Warning indicators |
| `error` | `#D32F2F` | Error/destructive |
| `border` | `#E5E7EB` | Card/input borders |
| `muted` | `#6B7280` | Secondary text |
| `inverse` | `#16213E` | Inverse card background |

### Dark Mode
Derived from light mode with inverted values. Surface becomes `#0F0F12`, text becomes `#F5F5F5`.

## Typography
System fonts only (SF Pro on iOS, Roboto on Android).

| Token | Size | Weight | Usage |
|---|---|---|---|
| `display` | 40 | 600 | Hero numbers |
| `xxl` | 32 | 600 | Large headers |
| `xl` | 24 | 600 | Section headers (H1) |
| `lg` | 16 | 600 | Card titles (H2) |
| `base` | 14 | 400 | Body text |
| `sm` | 12 | 400 | Captions, labels |

## Spacing
Only these values. Never invent new ones.

| Token | Value |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 24 |
| `xxl` | 32 |
| `xxxl` | 48 |
| `huge` | 64 |

## Border Radius
Only these values. No pill shapes (999).

| Token | Value |
|---|---|
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |

## Shadows
Minimal. Subtle elevation. No floating cards. Cards use a 1px border instead of shadow where possible.

## Buttons
Apple-style:
- **Primary**: Filled with `brandPrimary` (`#3FA796`), 8px radius.
- **Secondary**: Outline with 1px `border`, transparent background.
- **Danger**: Red outline (`#D32F2F`), transparent background.
- **Ghost**: No border, transparent background.
- Height: 44px minimum (touch target).

## Icons
Ionicons (`@expo/vector-icons`). Never mix icon packs.

## Cards
- Background: `surface2` (`#FFFFFF`).
- Border: 1px `border` (`#E5E7EB`).
- Radius: `md` (12).
- Padding: `lg` (16).
- Meaningful — not every piece of content needs a card.

## Inputs
- Background: `surface2` (`#FFFFFF`).
- Border: 1px `border` (`#E5E7EB`).
- Radius: `sm` (8).
- Padding: `md` (12) horizontal, 12px vertical.
- Label: uppercase, 11px, muted.

## Animations
- Duration: 150-250ms.
- Easing: ease-in-out.
- Purposeful — no decorative animations.