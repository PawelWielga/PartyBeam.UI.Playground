import { access, readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
const spatialNavigation = await readFile("spatial-navigation.js", "utf8");
const styles = await readFile("styles.css", "utf8");
const simplifiedFlow = await readFile("simplified-flow.js", "utf8");
const simplifiedStyles = await readFile("simplified-flow.css", "utf8");
const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const stack = [];
const ids = new Set();

function fail(message) {
  console.error("Validation failed: " + message);
  process.exitCode = 1;
}

if (html.includes("\\n")) {
  fail("index.html contains a literal \\n escape instead of a real line break.");
}

const mainCount = (html.match(/<main\b/gi) || []).length;
if (mainCount !== 1) {
  fail("index.html must contain exactly one <main> landmark; found " + mainCount + ".");
}


if (/<main\b/i.test(simplifiedFlow)) {
  fail("simplified-flow.js must not render additional <main> landmarks.");
}

const spatialScriptIndex = html.indexOf('src="spatial-navigation.js');
const appScriptIndex = html.indexOf('src="app.js');
const simplifiedScriptIndex = html.indexOf('src="simplified-flow.js');
if (
  spatialScriptIndex < 0
  || appScriptIndex < 0
  || simplifiedScriptIndex < 0
  || spatialScriptIndex > appScriptIndex
  || spatialScriptIndex > simplifiedScriptIndex
) {
  fail("Shared spatial navigation must load before app.js and simplified-flow.js.");
}

for (const spatialToken of [
  "function findDirectionalTarget(origin, direction, elements)",
  "score: primary + secondary * 2.25",
  "window.PartyBeamSpatialNavigation = Object.freeze"
]) {
  if (!spatialNavigation.includes(spatialToken)) {
    fail("Shared spatial-navigation regression guard missing: " + spatialToken);
  }
}

for (const consumer of [app, simplifiedFlow]) {
  if (!consumer.includes("PartyBeamSpatialNavigation?.findDirectionalTarget")) {
    fail("A PartyBeam focus surface stopped using shared spatial navigation.");
  }
}

for (const modalFocusToken of [
  "function getActiveFocusRoot()",
  'overlay.querySelector(".pb-confirm")',
  'overlay.querySelector(".pb-game-menu-panel")',
  "target.scrollIntoView({ block: \"nearest\", inline: \"nearest\" })",
  "managePanel.inert = true",
  'managePanel.setAttribute("aria-hidden", "true")',
  "flow.confirmationOrigin = origin || document.activeElement",
  "function closeConfirmation({ restoreFocus = true } = {})",
  "function focusManageAfterRemoval(gameId)"
]) {
  if (!simplifiedFlow.includes(modalFocusToken)) {
    fail("Simplified-flow modal focus regression guard missing: " + modalFocusToken);
  }
}


for (const gameRuntimeBehavior of [
  'openOverlay("game")',
  'class="pb-game-runtime"',
  'id="pbGameRuntime"',
  "function openGameMenu()",
  "function closeGameMenu()",
  'data-flow-action="resume-game"',
  'data-flow-action="game-settings"',
  'data-flow-action="restart-game"',
  'data-flow-action="exit-game"',
  'flow.view === "game" && flow.gameMenuOpen',
  'flow.view === "game"',
  'runtime.inert = true',
  'runtime.classList.add("is-paused")'
]) {
  if (!simplifiedFlow.includes(gameRuntimeBehavior)) {
    fail("Fullscreen game/menu behavior regression guard missing: " + gameRuntimeBehavior);
  }
}

for (const gameRuntimeStyle of [
  ".pb-game-runtime {",
  ".pb-game-menu-overlay {",
  ".pb-game-menu-panel {",
  ".pb-game-menu-action {",
  ".pb-game-runtime.is-paused .pb-game-runtime__ambient span",
  ".partybeam-screen.settings-reduced-motion .pb-game-runtime__ambient span",
  "@media (prefers-reduced-motion: reduce)"
]) {
  if (!simplifiedStyles.includes(gameRuntimeStyle)) {
    fail("Fullscreen game/menu style regression guard missing: " + gameRuntimeStyle);
  }
}

const gameMenuMainStart = simplifiedStyles.indexOf(".pb-game-menu-main {");
const gameMenuMainEnd = simplifiedStyles.indexOf(".pb-game-menu-action {", gameMenuMainStart);
const gameMenuMainBlock = simplifiedStyles.slice(gameMenuMainStart, gameMenuMainEnd);
if (!gameMenuMainBlock.includes("grid-template-columns: 1fr;")
  || gameMenuMainBlock.includes("repeat(2")) {
  fail("In-game PartyBeam menu actions must stay in a single column.");
}

for (const textGlyph of ["♥", "↓", "✓", "⚠", "★"]) {
  if (html.includes(textGlyph) || app.includes(textGlyph) || simplifiedFlow.includes(textGlyph)) {
    fail("UI text-symbol icon reintroduced: " + textGlyph);
  }
}

for (const iconToken of [
  'class="catalog-filter__icon"',
  'class="game-cover-compatibility__icon"',
  'class="pb-results-icon"',
  'class="pb-message-symbol"'
]) {
  if (!(html + app + simplifiedFlow).includes(iconToken)) {
    fail("SVG icon regression guard missing: " + iconToken);
  }
}

for (const designToken of [
  "--overlay-scrim:",
  "--system-panel-surface:",
  "--text-secondary:",
  "--border-subtle:",
  "--border-strong:",
  "--warning:",
  "--shadow-system:",
  "--motion-base:",
  "--motion-ease:"
]) {
  if (!styles.includes(designToken)) {
    fail("Semantic visual token missing: " + designToken);
  }
}

for (const systemTokenUse of [
  "background: var(--overlay-scrim);",
  "border: var(--border-major) solid var(--border-strong);",
  "background: var(--system-panel-surface);",
  "box-shadow: var(--shadow-system);",
  "color: var(--text-secondary);"
]) {
  if (!styles.includes(systemTokenUse)) {
    fail("Shared system shell stopped using semantic token: " + systemTokenUse);
  }
}

for (const tv720ReadableToken of [
  '.preview-canvas[data-device="tv720"] .catalog-search__input,',
  '.preview-canvas[data-device="tv720"] .catalog-filter {',
  "min-height: 36px;",
  "font-size: 13px;",
  '.preview-canvas[data-device="tv720"] .game-details-meta-card span',
  '.preview-canvas[data-device="tv720"] .catalog-game-code > span'
]) {
  if (!styles.includes(tv720ReadableToken)) {
    fail("TV720 readability regression guard missing: " + tv720ReadableToken);
  }
}

for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
  if (ids.has(match[1])) {
    fail("Duplicate id: " + match[1]);
  }
  ids.add(match[1]);
}

const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
const tagPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?\/?\s*>/g;

for (const match of withoutComments.matchAll(tagPattern)) {
  const token = match[0];
  const tag = match[1].toLowerCase();
  const closing = token.startsWith("</");
  const selfClosing = token.endsWith("/>") || voidTags.has(tag);

  if (closing) {
    const expected = stack.pop();
    if (expected !== tag) {
      fail("Mismatched closing tag </" + tag + ">; expected </" + (expected || "none") + ">.");
      break;
    }
  } else if (!selfClosing) {
    stack.push(tag);
  }
}

if (stack.length > 0) {
  fail("Unclosed tags: " + stack.join(", "));
}



for (const systemShellMarkup of [
  "settings-overlay partybeam-system-overlay",
  "settings-panel partybeam-system-panel",
  "settings-header partybeam-system-header",
  "settings-close partybeam-system-close",
  "settings-footer partybeam-system-footer"
]) {
  if (!html.includes(systemShellMarkup)) {
    fail("Settings system-shell class regression: " + systemShellMarkup);
  }
}

for (const manageSystemShellBehavior of [
  'overlay.dataset.view = view',
  'class="partybeam-system-overlay pb-manage-overlay"',
  'class="partybeam-system-panel pb-manage-panel"',
  'class="partybeam-system-header"',
  'class="partybeam-system-close"',
  'class="partybeam-system-footer"'
]) {
  if (!simplifiedFlow.includes(manageSystemShellBehavior)) {
    fail("Manage Games system-shell regression: " + manageSystemShellBehavior);
  }
}

for (const systemShellStyle of [
  ".partybeam-system-overlay {",
  ".partybeam-system-panel {",
  ".partybeam-system-header {",
  ".partybeam-system-close {",
  ".partybeam-system-footer {"
]) {
  if (!styles.includes(systemShellStyle)) {
    fail("Shared system-shell style regression: " + systemShellStyle);
  }
}

for (const manageSystemStyle of [
  '.pb-simple-flow[data-view="manage-games"]',
  ".pb-manage-main {",
  '.preview-canvas[data-device="tv"] .pb-manage-game',
  '.preview-canvas[data-device="phone"] .pb-manage-game'
]) {
  if (!simplifiedStyles.includes(manageSystemStyle)) {
    fail("Manage Games shared-shell style regression: " + manageSystemStyle);
  }
}

if (!app.includes('tv4k: { width: 3840, height: 2160, label: "TV 3840×2160", tv: true }')) {
  fail("Missing 4K TV viewport preset.");
}

if (!html.includes('data-viewport="tv4k"') || !html.includes('>TV 4K</button>')) {
  fail("Missing visible 4K TV viewport control.");
}

for (const resolutionIndependentTvBehavior of [
  "const TV_DESIGN_WIDTH = 1920;",
  "const TV_DESIGN_HEIGHT = 1080;",
  "function getTvUiScale(width, height)",
  "return Math.min(width / TV_DESIGN_WIDTH, height / TV_DESIGN_HEIGHT);",
  "logicalWidth = physicalWidth / uiScale;",
  "logicalHeight = physicalHeight / uiScale;",
  'elements.partybeamScreen.style.transform = "scale(" + uiScale + ")";',
  "elements.previewCanvas.dataset.uiScale = uiScale.toFixed(4);"
]) {
  if (!app.includes(resolutionIndependentTvBehavior)) {
    fail("Resolution-independent TV scaling regression: " + resolutionIndependentTvBehavior);
  }
}

for (const fullPreviewBehavior of [
  "if (preset.full) {",
  "logicalWidth = Math.max(280, Math.floor(available.width));",
  "logicalHeight = Math.max(320, Math.floor(available.height));",
  "scale = 1;",
  '? logicalWidth + " × " + logicalHeight + " · live"'
]) {
  if (!app.includes(fullPreviewBehavior)) {
    fail("Full preview must fill the live browser viewport: " + fullPreviewBehavior);
  }
}

for (const fullPreviewStyle of [
  ".sr-only {",
  ".playground-shell.is-full-preview .preview-stage",
  ".playground-shell.is-full-preview .preview-viewport"
]) {
  if (!styles.includes(fullPreviewStyle)) {
    fail("Full preview/accessibility style regression guard missing: " + fullPreviewStyle);
  }
}

for (const path of ["styles.css", "app.js", "spatial-navigation.js", "simplified-flow.js", "simplified-flow.css"]) {
  try {
    await access(path);
  } catch {
    fail("Missing required runtime file: " + path);
  }
}

if (!/href=["']styles\.css(?:\?[^"']*)?["']/i.test(html)) {
  fail("index.html does not reference styles.css.");
}

if (!/src=["']app\.js(?:\?[^"']*)?["']/i.test(html)) {
  fail("index.html does not reference app.js.");
}

const reducedMotionMatches = app.match(/matchMedia\("\(prefers-reduced-motion: reduce\)"\)/g) || [];
if (reducedMotionMatches.length !== 1) {
  fail("Remote focus should create exactly one reduced-motion MediaQueryList; found " + reducedMotionMatches.length + ".");
}

const animationStart = app.indexOf("function animateRemoteFocus(timestamp)");
const inactiveGuard = app.indexOf("if (!activeTarget)", animationStart);
const nextFrameSchedule = app.indexOf(
  "remoteFocusAnimationFrame = window.requestAnimationFrame(animateRemoteFocus);",
  inactiveGuard
);

if (animationStart < 0 || inactiveGuard < 0 || nextFrameSchedule < 0 || inactiveGuard > nextFrameSchedule) {
  fail("Remote focus animation must guard inactive focus before scheduling the next frame.");
}

if (!app.includes("remoteFocusGeometry = getRemoteFocusGeometry(activeTarget)")) {
  fail("Remote focus geometry must be cached instead of recalculated every animation frame.");
}

const animatedFocusTargetStart = app.indexOf("function getAnimatedRemoteFocusTarget()");
const animatedFocusTargetEnd = app.indexOf("function stopRemoteFocusAnimation()", animatedFocusTargetStart);
const animatedFocusTargetBlock = app.slice(animatedFocusTargetStart, animatedFocusTargetEnd);
if (animatedFocusTargetBlock.includes("browserFocusInsideScreen")) {
  fail("Browser focus inside PartyBeam must keep the animated focus ring active.");
}

const focusVisualStart = app.indexOf("function renderRemoteFocusVisual()");
const focusVisualEnd = app.indexOf("function updateCatalogScrollEdgeFade()", focusVisualStart);
const focusVisualBlock = app.slice(focusVisualStart, focusVisualEnd);
if (
  !focusVisualBlock.includes("const visualTarget = getRemoteFocusVisualTarget();")
  || !focusVisualBlock.includes("if (visualTarget)")
  || focusVisualBlock.includes("!browserFocusInsideScreen")
) {
  fail("PartyBeam browser focus and remote focus must share the same remote-focused visual.");
}

for (const flowFocusToken of [
  "function getSimplifiedFlowFocusTarget()",
  "function getRemoteFocusVisualTarget()",
  "function syncFlowFocusVisual(target)",
  'target.classList.add("remote-focused")',
  'simplifiedFlow && !simplifiedFlow.hidden && simplifiedFlow.contains(event.target)'
]) {
  if (!app.includes(flowFocusToken) && !simplifiedFlow.includes(flowFocusToken)) {
    fail("Simplified flow must use the shared animated focus visual: " + flowFocusToken);
  }
}

if (
  simplifiedStyles.includes(".pb-simple-flow button:focus-visible")
  || simplifiedStyles.includes('.pb-simple-flow[data-view="manage-games"] button:focus-visible')
) {
  fail("Simplified flow must not define a separate static focus style.");
}

if (styles.includes(".settings-slider.remote-focused")) {
  fail("Settings slider must not reintroduce a separate static focus style.");
}

if (!app.includes('getComputedStyle(element, "::after")')) {
  fail("Remote focus geometry must use the rendered ::after ring radius.");
}

for (const token of ["--remote-focus-ring-inset", "--remote-focus-ring-thickness"]) {
  if (!app.includes(token) || !styles.includes(token)) {
    fail("Remote focus geometry token is not shared by JS and CSS: " + token);
  }
}

if (!app.includes("const targetCenter = targetRect.top + targetRect.height / 2;")
  || !app.includes("const viewportCenter = containerRect.top + containerRect.height / 2;")
  || !app.includes("elements.catalogScroll.scrollHeight - elements.catalogScroll.clientHeight")
  || !app.includes("Math.max(0, centeredScrollTop)")) {
  fail("Catalog focus scrolling must center the active cover and clamp cleanly at the top and bottom.");
}

for (const catalogPadding of [
  "padding: 12px 14px 24px;",
  "padding: 10px 12px 14px;",
  "padding: 9px 10px 10px;"
]) {
  if (!styles.includes(catalogPadding)) {
    fail("Catalog scroll must keep bottom spacing below the final row at every preview size: " + catalogPadding);
  }
}

for (const playersPanelSpacing of [
  "margin-bottom: 24px;",
  "margin-bottom: 14px;",
  "margin-bottom: 10px;"
]) {
  if (!styles.includes(playersPanelSpacing)) {
    fail("Catalog Players panel must keep the same bottom spacing as the game library: " + playersPanelSpacing);
  }
}

for (const catalogTitleToken of [
  "padding: 8px 12px 8px 44px;",
  "ellipse at 72% 50%",
  "rgba(4, 6, 14, 0.5) 38%",
  "transparent 82%",
  "0 2px 4px rgba(0, 0, 0, 0.92)"
]) {
  if (!styles.includes(catalogTitleToken)) {
    fail("Catalog title must keep its soft contrast scrim treatment: " + catalogTitleToken);
  }
}


for (const catalogSearchToken of [
  'id="catalogSearchInput"',
  'class="catalog-search__input"',
  'readonly',
  'aria-readonly="true"',
  'id="catalogEmptyState"'
]) {
  if (!html.includes(catalogSearchToken)) {
    fail("Catalog search markup regression guard missing: " + catalogSearchToken);
  }
}

for (const catalogSearchBehavior of [
  "catalogSearch: \"\"",
  "catalogSearchEditing: false",
  "function setCatalogSearchEditing(editing, options = {})",
  "input.readOnly = !active",
  "setCatalogSearchEditing(true)",
  "setCatalogSearchEditing(false)",
  "elements.catalogSearchInput.addEventListener(\"input\"",
  "gameTitle.includes(searchQuery)",
  "elements.catalogEmptyState.hidden = visibleCovers.length > 0"
]) {
  if (!app.includes(catalogSearchBehavior)) {
    fail("Catalog search behavior regression guard missing: " + catalogSearchBehavior);
  }
}

for (const catalogSearchStyle of [
  ".catalog-search {",
  "--remote-focus-radius: 999px;",
  ".catalog-search__input {",
  ".catalog-search.remote-focused .catalog-search__input",
  ".catalog-search__input:focus-visible {",
  ".catalog-search__input[readonly] {",
  ".catalog-search__input.is-editing {",
  ".catalog-search__icon {",
  ".catalog-empty-state {"
]) {
  if (!styles.includes(catalogSearchStyle)) {
    fail("Catalog search visual regression guard missing: " + catalogSearchStyle);
  }
}

if (styles.includes(".partybeam-screen .catalog-search__input.remote-focused")) {
  fail("Catalog search must not reintroduce its old static remote-focus box shadow.");
}

if (!app.includes('logicalTarget === elements.catalogSearchInput')
  || !app.includes('logicalTarget.closest(".catalog-search")')) {
  fail("Catalog search remote focus must render on the non-input wrapper.");
}

for (const catalogFilter of ["favorites", "downloaded", "compatible"]) {
  if (!html.includes('data-catalog-filter="' + catalogFilter + '"')) {
    fail("Catalog filter control is missing: " + catalogFilter);
  }
}

for (const catalogFilterBehavior of [
  "function matchesCatalogFilters(cover)",
  "function applyCatalogFilters()",
  "function toggleCatalogFilter(filterName)",
  'elements.gameCoverGrid.querySelectorAll(".game-cover:not(:disabled):not([hidden])")',
  "cover.dataset.favorite",
  "cover.dataset.downloaded"
]) {
  if (!app.includes(catalogFilterBehavior)) {
    fail("Catalog filter behavior regression guard missing: " + catalogFilterBehavior);
  }
}

for (const catalogFilterStyle of [
  ".catalog-library-toolbar {",
  ".catalog-filter {",
  ".catalog-filter.is-active {",
  '--remote-focus-radius: 999px;',
  "overflow: visible;",
  "padding: 10px 12px 0 14px;",
  "padding: 8px 8px 0 10px;",
  "padding: 12px 4px 0;"
]) {
  if (!styles.includes(catalogFilterStyle)) {
    fail("Catalog filter visual regression guard missing: " + catalogFilterStyle);
  }
}

for (const settingsId of [
  "settingsOverlay",
  "settingsPanel",
  "settingsCloseButton",
  "settingsDoneButton",
  "masterVolume"
]) {
  if (!ids.has(settingsId)) {
    fail("Settings prototype is missing required id: " + settingsId);
  }
}

for (const category of ["general", "display", "audio", "controllers", "language", "about"]) {
  if (!html.includes('data-settings-category="' + category + '"')
    || !html.includes('data-settings-section="' + category + '"')) {
    fail("Settings category/content pair is missing: " + category);
  }
}

for (const settingsBehavior of [
  "function openSettings()",
  "function closeSettings()",
  "function getSettingsFocusableElements()",
  "function selectSettingsCategory(category)",
  'state.settingsOpen && event.key === "Tab"',
  'button.dataset.settingToggle === "reduced-motion"',
  'elements.settingsButton.addEventListener("click", openSettings)'
]) {
  if (!app.includes(settingsBehavior)) {
    fail("Settings behavior regression guard missing: " + settingsBehavior);
  }
}

for (const settingsStyle of [
  ".settings-overlay {",
  "backdrop-filter: blur(13px) saturate(82%);",
  "grid-template-columns: 290px minmax(0, 1fr);",
  '.preview-canvas[data-device="phone"] .settings-main',
  "grid-template-columns: repeat(3, minmax(0, 1fr));",
  "@media (prefers-reduced-motion: reduce)"
]) {
  if (!styles.includes(settingsStyle)) {
    fail("Settings responsive/visual regression guard missing: " + settingsStyle);
  }
}


for (const gameLaunchId of [
  "gameLaunchScreen"
]) {
  if (!ids.has(gameLaunchId)) {
    fail("Game launch loading screen is missing required id: " + gameLaunchId);
  }
}

for (const gameLaunchBehavior of [
  "const GAME_LAUNCH_MOCK_DURATION_MS = 5000;",
  "function showGameLaunchScreen()",
  "function hideGameLaunchScreen()",
  'state.screen = "game-loading"',
  "showGameLaunchScreen();"
]) {
  if (!app.includes(gameLaunchBehavior)) {
    fail("Game launch loading behavior regression guard missing: " + gameLaunchBehavior);
  }
}

for (const gameLaunchStyle of [
  ".game-launch-screen {",
  ".game-launch-image {",
  "object-fit: cover;",
  ".game-launch-spinner-wrap {"
]) {
  if (!styles.includes(gameLaunchStyle)) {
    fail("Game launch loading style regression guard missing: " + gameLaunchStyle);
  }
}


for (const prereleaseMarkup of [
  "Show prerelease games",
  'data-setting-toggle="show-prerelease-games"'
]) {
  if (!html.includes(prereleaseMarkup)) {
    fail("Prerelease games setting markup regression: " + prereleaseMarkup);
  }
}

for (const prereleaseBehavior of [
  'const prereleaseGameNumbers = new Set(["06", "07"])',
  "showPrereleaseGames: false",
  'cover.dataset.prerelease = String(prereleaseGameNumbers.has(gameNumber))',
  'cover.dataset.prerelease === "true" && !state.showPrereleaseGames',
  'button.dataset.settingToggle === "show-prerelease-games"',
  'prereleaseBadge.className = "game-cover-prerelease"'
]) {
  if (!app.includes(prereleaseBehavior)) {
    fail("Prerelease games setting behavior regression: " + prereleaseBehavior);
  }
}

if (!styles.includes(".game-cover-prerelease {")) {
  fail("Prerelease badge style regression.");
}

for (const gameDetailsId of [
  "gameDetailsOverlay",
  "gameDetailsPanel",
  "gameDetailsCloseButton",
  "gameDetailsActionButton",
  "gameDownloadProgress",
  "gameDownloadProgressTrack",
  "gameDownloadError",
  "gamePreparationState"
]) {
  if (!ids.has(gameDetailsId)) {
    fail("Game Details prototype is missing required id: " + gameDetailsId);
  }
}

for (const gameDetailsBehavior of [
  "function openGameDetails(origin)",
  "function closeGameDetails()",
  "function getGameDetailsFocusableElements()",
  "function startGameDownloadSimulation()",
  "function setGamePreparationState(preparationState, progress)",
  'state.gamePreparationState = "ready"',
  'openGameDetails(cover)',
  'state.gameDetailsOpen && event.key === "Tab"',
  'elements.gameDetailsActionButton.addEventListener("click"'
]) {
  if (!app.includes(gameDetailsBehavior)) {
    fail("Game Details behavior regression guard missing: " + gameDetailsBehavior);
  }
}

for (const gameDetailsStyle of [
  ".game-details-overlay {",
  "backdrop-filter: blur(13px) saturate(82%);",
  "grid-template-columns: minmax(0, 1fr) minmax(330px, 430px);",
  '.preview-canvas[data-device="phone"] .game-details-main',
  "flex-direction: column;",
  ".game-download-progress-track {"
]) {
  if (!styles.includes(gameDetailsStyle)) {
    fail("Game Details responsive/visual regression guard missing: " + gameDetailsStyle);
  }
}

for (const iconReference of [
  'href="assets/icon.png"',
  'class="brand-mark" src="assets/icon.png"',
  'class="brand-mark settings-about-mark" src="assets/icon.png"'
]) {
  if (!html.includes(iconReference)) {
    fail("PartyBeam icon reference missing: " + iconReference);
  }
}

if (!process.exitCode) {
  console.log("Static site validation passed.");
}
