import { access, readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
const styles = await readFile("styles.css", "utf8");
const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const stack = [];
const ids = new Set();

function fail(message) {
  console.error("Validation failed: " + message);
  process.exitCode = 1;
}

const mainCount = (html.match(/<main\b/gi) || []).length;
if (mainCount !== 1) {
  fail("index.html must contain exactly one <main> landmark; found " + mainCount + ".");
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

for (const path of ["styles.css", "app.js"]) {
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
if (!focusVisualBlock.includes('if (remoteFocusTarget)') || focusVisualBlock.includes("!browserFocusInsideScreen")) {
  fail("PartyBeam browser focus and remote focus must share the same remote-focused visual.");
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
