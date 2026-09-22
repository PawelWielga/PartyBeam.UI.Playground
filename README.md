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

The playground also works from a local `file://` URL because it does not fetch modules or backend data.

## Device preview

The toolbar above the preview can switch between:

- **TV 1920×1080**
- **TV 1280×720**
- **Phone** (390×844)
- **Full screen**

TV presets are rendered at their logical resolution and the whole preview is scaled proportionally when the browser is smaller than the target viewport. This makes it possible to inspect the complete 16:9 TV screen from a phone without enabling the browser's desktop-site mode.

The **Phone** preset is a separate logical viewport for testing mobile UI behavior. **Full screen** uses the currently available playground area.

## Dev controls

Open **Dev controls** in the bottom-right corner to simulate visual states without changing production-like markup.

Current controls include:

- 0, 1, 2, 4, 6 or 8 players,
- normal, loading and error states,
- Continue enabled or disabled.

The default demo currently shows 6 connected players plus one waiting slot. Player tiles wrap to additional rows with a maximum of 4 tiles per row on TV previews.\n\nThese controls belong to the playground shell only and should not be copied into PartyBeam production UI.

## GitHub Pages

The site is deployed by `.github/workflows/pages.yml`.

The workflow:

- runs on every push to `main`,
- can be run manually with `workflow_dispatch`,
- uploads the repository as a static Pages artifact,
- deploys through the `github-pages` environment,
- does not create or use a `gh-pages` branch.

For a new repository, GitHub Pages must have **GitHub Actions** selected as its publishing source in **Settings → Pages → Build and deployment → Source**. After that one-time setting, pushes to `main` publish automatically.

Expected public URL:

`https://pawelwielga.github.io/PartyBeam.UI.Playground/`

## Project structure

```text
.
├── index.html
├── styles.css
├── app.js
├── README.md
└── .github/
    └── workflows/
        └── pages.yml
```

Keep the project dependency-free unless a future UI experiment has a clear reason to introduce something else.
