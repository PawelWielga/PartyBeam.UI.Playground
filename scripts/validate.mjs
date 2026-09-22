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

if (!process.exitCode) {
  console.log("Static site validation passed.");
}
