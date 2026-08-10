# Design Specification — Royal Enfield Vendor Quality
**Reference structure:** industrial metal-fabrication layout pattern (americanalloyfab.com structure/layout only)
**Purpose:** Source of truth for visual system of the vendor quality app.

---

## 1. Brand & Identity

| Item | Value |
|---|---|
| Company name | Royal Enfield Vendor Quality |
| Logo | Royal Enfield wordmark (red) + classic crest where needed |
| Tagline | SOP-Driven Plating & Heat Treatment Quality |
| Partner context | Unique Enterprises and RE plating / heat-treatment vendors |
| Cert / trust badge | RE Vendor Partner desk (utility bar) |

---

## 2. Color Palette

```css
:root {
  --color-navy-primary:   #1B2A4A;   /* header utility, hero overlay, footer top border */
  --color-navy-deep:      #14213D;   /* darkest navy, hero gradient */
  --color-red-accent:     #BF1E2E;   /* CTA buttons, accent bars, active nav */
  --color-white:          #FFFFFF;   /* card/header/footer backgrounds */
  --color-text-body:      #1C1C1C;   /* body copy */
  --color-text-heading:   #333333;   /* bold labels / card headings */
  --color-bg-light-gray:  #F2F2F2;   /* alternating section background */
  --color-nav-link:       #000000;   /* nav link text */
  --color-hero-heading:   #E1E3E4;   /* hero H1 */
}
```

**Usage rules:**
- Navy = utility bar, hero overlay, footer top rule, section title text.
- Red = primary CTAs, thin accent bars on section headings, active nav underline, star accents.
- Sections alternate **white → light gray → white → light gray**.
- Never use red for large fills — accent only.

---

## 3. Typography

- Headings: **Share Tech** (uppercase, tracked, weight 400)
- Body: **Mulish** (400 regular, 700 bold) — successor to Muli on Google Fonts

---

## 4. Layout

- Max content width ~1080px
- Two-tier header: navy utility bar + white sticky nav
- Full-width navy-overlaid hero with dual CTAs (filled red + outlined)
- Alternating section bands for analytics / toolkit / logs
- Footer: white with navy top border, link row + legal/meta row

---

## 5. Components

- Buttons: sharp corners (no radius), Share Tech uppercase, chevron prefix
- Panels/cards: flat, light borders, no heavy shadows
- Nav: uppercase text links with red active underline
- Section titles: red vertical accent bar before heading

---

## 6. App sitemap (functional)

```
/                 Analytics dashboard
/sops             SOP library
/sops/new         Feed SOP
/sops/[id]        SOP detail + analytics
/loads/new        Upload plating load report (.xls)
/inspections      Inspection log
/inspections/new  Manual quality check entry
```
