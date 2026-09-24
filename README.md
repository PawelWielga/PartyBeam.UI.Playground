# PartyBeam.UI.Playground

Lightweight visual playground for designing and reviewing the PartyBeam ecosystem UI.

This repository is intentionally **not** a production frontend. It contains only static HTML, CSS and vanilla JavaScript. There is no .NET, Blazor, Android project, backend, package manager or frontend framework.

## Purpose

Use this repository to iterate quickly on screens and states such as:

- TV lobby and room flows,
- phone/controller screens,
- game catalog and game management,
- loading, error and empty states,
- focus behavior for remote controls and keyboards.

The workflow is intentionally manual:

```text
PartyBeam.UI.Playground
        ↓
design and accept UI
        ↓
PartyBeam.Platform
        ↓
functional test on real TV / phone
```

The playground is the visual reference. [PartyBeam.Platform](https://github.com/PawelWielga/PartyBeam.Platform) remains the source of truth for production code.

## Run locally

No build step is required.

1. Clone or download the repository.
2. Open `index.html` in a browser.

The playground also works from a local `file://` URL because it does not fetch modules, fonts or backend data.

## Device preview

The toolbar above the preview can switch between:

- **TV 4K** (3840×2160)
- **TV 1920×1080**
- **TV 1280×720**
- **Phone** (390×844)
- **Full screen**

TV presets are rendered at their logical resolution and scaled proportionally when the browser is smaller than the target viewport. **Full screen** switches to a live viewport that fills the available browser area 1:1.

## Dev controls

Open **Dev controls** to simulate:

- 0, 1, 2, 4, 6 or 8 players,
- normal, loading and error states,
- Continue enabled or disabled.

These controls belong to the playground shell only and should not be copied into PartyBeam production UI.

## TV remote simulator

Open **TV remote** to test directional navigation, OK activation and Back/Home simulation. The animated PartyBeam focus ring is intentional. Browsers that do not support the modern CSS required by that ring receive a static high-contrast fallback, and `prefers-reduced-motion` disables continuous focus animation.

## Design tokens

The screen uses a small shared radius scale:

- `--radius-sm: 12px`
- `--radius-md: 16px`
- `--radius-lg: 24px`

The primary action gradient is intentionally kept dark enough for white text to remain readable on the phone preset.

## Validation

The repository stays dependency-free. Before Pages deployment, GitHub Actions runs:

```text
node --check app.js
node scripts/validate.mjs
```

The custom validator checks the basic HTML structure, duplicate IDs, the single-main-landmark rule and required runtime file references.

CI also opens the playground in headless Chrome and runs `scripts/layout-audit.html`. The audit covers the supported viewport presets, player counts, long names, Continue enabled/disabled, loading/error states, footer containment and TV focus clipping.

## Typography

The MVP intentionally uses a local system UI font stack so the playground remains reliable offline and on older TV browsers. The comparison with a dedicated display font and the reasons for deferring it are recorded in [docs/typography.md](docs/typography.md).

## GitHub Pages

The site is deployed by `.github/workflows/pages.yml`.

The workflow:

- validates pushes and pull requests targeting `main`,
- deploys only after validation succeeds,
- packages only `index.html`, `styles.css` and `app.js`,
- does not include `.agents` or other developer tooling in the Pages artifact,
- does not create or use a `gh-pages` branch.

Expected public URL:

`https://pawelwielga.github.io/PartyBeam.UI.Playground/`

## Project structure

```text
.
├── index.html
├── styles.css
├── app.js
├── README.md
├── scripts/
│   └── validate.mjs
└── .github/
    └── workflows/
        └── pages.yml
```

Keep the project dependency-free unless a future UI experiment has a clear reason to introduce something else.
