import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchJobHtml, type FetchLike } from "./fetch.js";

test("fetchJobHtml returns the body on a 2xx response", async () => {
  const fake: FetchLike = async (url) => {
    assert.equal(url, "https://jobs.example.com/1");
    return { ok: true, status: 200, text: async () => "<html>job</html>" };
  };
  assert.equal(await fetchJobHtml("https://jobs.example.com/1", fake), "<html>job</html>");
});

test("fetchJobHtml throws on a non-2xx response", async () => {
  const fake: FetchLike = async () => ({ ok: false, status: 404, text: async () => "" });
  await assert.rejects(() => fetchJobHtml("https://jobs.example.com/missing", fake), /responded 404/);
});
