import { access, readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
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

if (!process.exitCode) {
  console.log("Static site validation passed.");
}
