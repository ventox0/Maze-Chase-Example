import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDevServer, PROJECT_ROOT } from "../scripts/dev-server.mjs";
import * as assets from "../src/data/assets.js";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
assert.doesNotMatch(html, /<style>|<script>|data:image/);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML kimlikleri benzersiz olmalı");

async function inspectModules(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await inspectModules(url);
    else if (entry.name.endsWith(".js")) {
      const source = await readFile(url, "utf8");
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        assert.ok(
          match[1].startsWith("."),
          `Harici çalışma zamanı bağımlılığı: ${match[1]}`,
        );
        await access(new URL(match[1], url));
      }
    }
  }
}
await inspectModules(new URL("src/", root));
const urls = Object.values(assets).flatMap((value) =>
  typeof value === "string" ? [value] : Object.values(value),
);
assert.equal(urls.length, 13);
for (const url of urls) await access(fileURLToPath(url));
const css = await readFile(new URL("styles/main.css", root), "utf8");
for (const match of css.matchAll(/@import url\("([^"\)]+)"\)/g))
  await access(new URL(match[1], new URL("styles/main.css", root)));
console.log("PASS HTML, ESM importları, 13 görsel ve CSS dosyaları");

const server = createDevServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  const routes = [
    ["/", "text/html"],
    ["/src/main.js", "text/javascript"],
    ["/styles/main.css", "text/css"],
    ["/assets/players/normal.webp", "image/webp"],
    ["/assets/shop/special-outfits-v2.png", "image/png"],
    [
      `/${encodeURIComponent(PROJECT_ROOT.split("/").filter(Boolean).at(-1))}/index-ghosts.html`,
      "text/html",
    ],
  ];
  for (const [route, mime] of routes) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.ok(response.headers.get("content-type").startsWith(mime), route);
    assert.ok((await response.arrayBuffer()).byteLength > 0, route);
  }
  const head = await fetch(origin, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const [route, method, status] of [
    ["/missing.js", "GET", 404],
    ["/.git/config", "GET", 403],
    ["/", "POST", 405],
    ["/%ZZ", "GET", 400],
  ]) {
    assert.equal(
      (await fetch(origin + route, { method })).status,
      status,
      route,
    );
  }
  console.log("PASS HTTP yolları, MIME türleri, eski adres ve hata yanıtları");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
