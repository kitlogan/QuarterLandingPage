# The Quarter Athletic Club — Landing Page PRD

*Draft v0.1 — pre-launch "coming soon" page*

---

## 1. Overview

A single-page "coming soon" site for **The Quarter Athletic Club** — a human-coaching-led performance club "for the everyday athlete." The page holds the brand and domain ahead of launch and captures interested emails (the waitlist).

The full Quarter product (coach-facing performance system, member app) is **out of scope** here — this is purely the pre-launch landing page.

## 2. Goals & success metrics

- **Primary:** capture waitlist email signups.
- **Secondary:** establish brand presence, reserve the domain, look premium on mobile.
- **Metrics:** number of signups; signup conversion rate; fast load (Lighthouse 90+); zero layout issues on mobile.

## 3. Scope

**In scope (v1):**
- One static page matching the attached design.
- Email capture ("Register Interest" / "Waitlist").
- Fully responsive (desktop + mobile).
- Meta tags, favicon, social share (OG) image.

**Out of scope:** member/coach system, login, multi-page site, blog, any backend beyond email capture.

## 4. Page content & layout

Matching the design:

- **Top bar:** `QTR / MMXXVII` (left), `WAITLIST` (right) — small letter-spaced caps. MMXXVII = 2027 (launch year).
- **Center block:** `THE QUARTER` wordmark (large serif), `ATHLETIC CLUB` beneath (spaced caps), a `COMING SOON` pill/outline button, the tagline **"For The Everyday Athlete."**, and a solid **`REGISTER INTEREST`** CTA.
- **Footer:** `© THE QUARTER ATHLETIC CLUB`.
- **Decorative:** faint concentric arc line-work bottom-left and bottom-right; subtle paper texture and crease/fold lines. These should be lightweight (SVG or CSS), not heavy images.

Both `WAITLIST` and `REGISTER INTEREST` trigger the same email-capture flow.

## 5. Design spec

- **Background:** off-white `#E8E2D6`.
- **Ink / green:** dark green `#12190A` for text, arcs, and the CTA fill.
- **Typography:**
  - Display wordmark + tagline: **TT Ramillas** (high-contrast serif).
  - Small caps / labels (`QTR / MMXXVII`, `WAITLIST`, `ATHLETIC CLUB`, `COMING SOON`, footer): a letter-spaced mono or geometric sans. Pick a free Google Font that matches the design's spaced-caps look (e.g. a mono like Space Mono, or a sans tracked wide).
- **Feel:** generous whitespace, centered, calm, premium.

### Background line animation
The concentric "athletic track" arcs animate subtly to signal craft.

- **Effect:** keep the arc lines very faint; send a short, slightly brighter segment gliding slowly along each arc, like light tracing a running lane. (This is the inverse of a moving *gap* — reads as craft, not a loading spinner.)
- **Technique:** SVG paths animated via CSS `stroke-dasharray` / `stroke-dashoffset`. No per-frame JS. GPU-friendly (stroke/opacity only).
- **Tone:** slow multi-second loop; low contrast; **staggered** speeds and start offsets across arcs so they never move in lockstep; strictly peripheral — must never compete with the CTA.
- **On load:** one-time "draw-on" of the arcs as the page loads, then settle into the looping trace.
- **Reduced motion:** wrap the animation in `@media (prefers-reduced-motion: reduce)` and render the arcs static. (~3 lines; keep it.)

## 6. Functional requirements — email capture

**Decision: MailerLite.** Because the site is static (GitHub Pages), there's no server to receive form posts, so email capture goes through a third-party service. MailerLite's free tier covers up to 1,000 subscribers / 12,000 sends per month, gives good design control over its embedded form (to match the aesthetic), and upgrades cheaply ($10/mo) if the list grows. *(Mailchimp's free plan is now only 250 contacts / 500 sends with no automation — too small for a launch waitlist. Kit is the alternative if we expect >1,000 signups before launch, free to 10,000.)*

**Implementation:**
- Create a MailerLite account + a "Quarter Waitlist" group/form.
- Embed as a styled inline form or small modal, triggered by both `WAITLIST` and `REGISTER INTEREST`.
- Email validation, success + error states, keyboard/focus accessibility.
- Style the form to match the design (green CTA, off-white field, Ramillas/placeholder type) rather than using MailerLite's default styling.

## 7. Technical requirements

- **Stack:** plain static `index.html` + CSS + minimal JS. No framework needed.
- **Hosting:** GitHub Pages from the **public** `QuarterLandingPage` repo (public required for Pages on the free plan; a static site's source is public anyway, and this project holds no secrets), deploy on push to `main`.
- **Domain:** custom domain via GoDaddy → point DNS at GitHub Pages (A/AAAA records + `www` CNAME), add a `CNAME` file to the repo, enable "Enforce HTTPS."
- **Fonts:** TT Ramillas is **commercial** — the free download is trial/personal-use only. For a live site you need a **webfont license from TypeType** (or via MyFonts), then self-host the `.woff2` files. Until licensed, build with a close free serif placeholder (e.g. Playfair Display or Cormorant) so nothing blocks progress.
- **Performance:** self-hosted woff2, `font-display: swap`, compressed SVG/texture, no heavy libraries.
- **Analytics:** Cloudflare Web Analytics — free, single beacon script, cookieless (no consent banner needed), reports page views + unique visitors.

## 8. Deliverables

- `index.html`, `styles.css`, `script.js` (or inline), `/assets` (favicon, OG image, fonts, arcs).
- `CNAME` file for the custom domain.
- Live site at the GoDaddy domain over HTTPS.

## 9. Decisions (all resolved)

1. **Email capture** — ✅ MailerLite (free tier; Kit as fallback if >1,000 signups expected).
2. **Font** — ✅ Build with a free placeholder serif now (Playfair Display or Cormorant), swap in licensed TT Ramillas woff2 later.
3. **Repo** — ✅ `QuarterLandingPage`, **public**.
4. **Green hex** — ✅ `#12190A`.
5. **Analytics** — ✅ Cloudflare Web Analytics (free, cookieless, views + unique visitors).

---

# Sprint Plan (for Claude Code)

Structured so each sprint is a self-contained prompt you can hand to Claude Code, ending in something testable.

### Sprint 0 — Scaffold & deploy pipeline
- Initialise the `QuarterLandingPage` repo with `index.html` (minimal), `styles.css`, `.gitignore`, `README`.
- Set the off-white background and confirm a "hello" renders.
- Enable GitHub Pages; confirm the blank page is live at `username.github.io/QuarterLandingPage`.
- **Done when:** blank styled page is live on the github.io URL.

### Sprint 1 — Static page to match design
- Match the **attached design image** (provide it to Claude Code as the visual source of truth).
- Build the full layout: top bar, wordmark, `ATHLETIC CLUB`, `COMING SOON` pill, tagline, `REGISTER INTEREST` CTA, footer.
- Apply colours, typography (placeholder serif until licensed), spacing, paper texture.
- Build the concentric arcs as SVG and add the background line animation per §5 (light-trace, slow, staggered, draw-on, reduced-motion static fallback).
- Fully responsive; verify on mobile widths.
- **Done when:** page visually matches the design on desktop + mobile, arcs animate subtly, no form logic yet.

### Sprint 2 — Email capture (MailerLite)
- Integrate the MailerLite embedded form as a styled inline form or modal, triggered by both `WAITLIST` and `REGISTER INTEREST`.
- Restyle to match the design (don't ship MailerLite's default look); email validation, success + error states, keyboard/focus accessibility.
- **Done when:** a real email submission lands in the MailerLite "Quarter Waitlist" group and the user sees a success state.

### Sprint 3 — Domain, polish & launch QA
- Add `CNAME`, configure GoDaddy DNS, enable Enforce HTTPS.
- Swap placeholder serif → licensed TT Ramillas woff2 (once the webfont licence is purchased).
- Meta tags, favicon, OG share image, Cloudflare Web Analytics beacon.
- Cross-browser + mobile QA, Lighthouse pass.
- **Done when:** site is live on the custom domain over HTTPS, passing QA.
