# Typography decision

## Context

Issue #19 evaluated whether PartyBeam should use a more distinctive display typeface for headings while retaining a highly readable UI/body typeface.

The playground previously declared `Inter` first in its font stack, but it did not bundle or download Inter. On devices without Inter installed, the UI already fell back to the platform system font.

PartyBeam also needs to work from `file://`, over a local network, and on older TV browsers where external font loading is a poor dependency.

## Options evaluated

### A. System UI stack

Use one local system stack for headings, controls and body text:

```css
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Visual hierarchy comes from size, weight, spacing and casing rather than a second font family.

**Advantages**

- no network dependency
- no font download or flash of invisible text
- smallest runtime footprint
- best chance of rendering reliably on older TV browsers
- consistent with the dependency-free playground

**Trade-off**

- less distinctive brand personality than a dedicated display face

### B. Space Grotesk headings + Inter/system body

This produces a more distinctive display treatment and was the primary alternative considered.

**Advantages**

- stronger visual identity in large PartyBeam headings
- good contrast between display and UI text roles

**Trade-offs**

- reliable offline use requires vendoring WOFF2 files
- multiple weights add runtime payload
- fallback metrics can cause visible text reflow while fonts load
- the font must be tested on the older TV/browser matrix before becoming part of the production design system
- using Google Fonts or another remote CDN would conflict with the local/offline PartyBeam goal

## MVP decision

Keep a **single system UI font stack for the MVP**.

The unused leading `Inter` declaration is removed so the CSS reflects what the application actually guarantees. No external font is loaded.

PartyBeam headings stay visually distinctive through:

- larger type scale
- heavy weight
- controlled negative tracking on large headings
- uppercase eyebrow labels
- spacing and contrast

## Revisit after MVP

A dedicated display font can be reconsidered when PartyBeam has a production asset pipeline and can:

1. vendor the font locally,
2. limit the number of weights,
3. test fallback metrics and layout shift,
4. verify rendering on the supported TV/browser matrix,
5. keep the application functional with fonts unavailable.

If a display font is adopted later, Space Grotesk remains a suitable candidate for another visual comparison.
