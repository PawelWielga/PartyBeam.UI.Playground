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
  "justify-self: end;",
  "border: var(--border-control) solid rgba(215, 204, 255, 0.24);",
  "linear-gradient(135deg, rgba(8, 10, 20, 0.92), rgba(18, 19, 40, 0.88));",
  "0 2px 10px rgba(0, 0, 0, 0.72)"
]) {
  if (!styles.includes(catalogTitleToken)) {
    fail("Catalog title must keep its high-contrast surface treatment: " + catalogTitleToken);
  }
}

if (!process.exitCode) {
  console.log("Static site validation passed.");
}
