import assert from "node:assert/strict";
import { test } from "node:test";
import { extractText } from "./index.js";
import { htmlToText } from "./html.js";
import { normalizeWhitespace } from "./text.js";

test("normalizeWhitespace collapses spaces and caps blank runs", () => {
  const out = normalizeWhitespace("a\t  b \r\n\n\n\n c  d  ");
  assert.equal(out, "a b\n\nc d");
});

test("htmlToText drops script/style and turns blocks into lines", () => {
  const html = `
    <html><head><style>.x{color:red}</style></head>
    <body>
      <h1>Jane Developer</h1>
      <script>alert('nope')</script>
      <p>Software&nbsp;Engineer</p>
      <ul><li>TypeScript</li><li>Node.js</li></ul>
    </body></html>`;
  const text = htmlToText(html);
  assert.match(text, /Jane Developer/);
  assert.match(text, /Software Engineer/);
  assert.match(text, /- TypeScript/);
  assert.match(text, /- Node\.js/);
  assert.doesNotMatch(text, /alert/);
  assert.doesNotMatch(text, /color:red/);
});

test("htmlToText decodes named and numeric entities", () => {
  assert.equal(htmlToText("<p>R&amp;D &#38; more</p>").replace(/\n/g, " ").trim(), "R&D & more");
});

test("extractText dispatches text and html formats", async () => {
  assert.equal(await extractText({ format: "text", text: "  hello  world  " }), "hello world");
  const html = await extractText({ format: "html", text: "<p>Hi <b>there</b></p>" });
  assert.match(html, /Hi there/);
});

test("extractText accepts a buffer source (as a web upload would supply)", async () => {
  const buffer = new TextEncoder().encode("  buffered   text  ");
  assert.equal(await extractText({ format: "text", buffer }), "buffered text");
});

test("extractText errors when no source is provided", async () => {
  await assert.rejects(() => extractText({ format: "text" }), /no source provided/);
});

test("extractText rejects an unsupported format", async () => {
  // Bypass the compile-time union to exercise the defensive runtime guard.
  await assert.rejects(
    () => extractText({ format: "rtf" as unknown as "text", text: "x" }),
    /unsupported format/,
  );
});
