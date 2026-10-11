import assert from "node:assert/strict";
import { createDevServer } from "../scripts/dev-server.mjs";
import { LanWorld, validLoadout } from "../server/LanWorld.js";
import { STRINGS } from "../src/lan/strings.js";
import { TILE } from "../src/data/config.js";
import {
  LAN_COLS as COLS,
  LAN_ROWS as ROWS,
  MAX_LAN_GHOSTS,
  LAN_LIFE_PELLET,
} from "../src/data/lan.js";
import { readFile } from "node:fs/promises";
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS " + name);
}
function world(mode = "coop", count = 2) {
  const w = new LanWorld(mode);
  for (let i = 0; i < count; i++) {
    const p = w.addPlayer("p" + i, "Pac " + i, i);
    p.connected = true;
    p.ready = true;
  }
  w.start();
  w.update(3);
  return w;
}
const step = (w, seconds) => {
  for (let time = 0; time < seconds; time += 1 / 120) w.update(1 / 120);
};
await check(
  "LAN sözlükleri, 2–4 renk ve iki farklı yetenek doğrulaması",
  () => {
    assert.deepEqual(
      Object.keys(STRINGS.tr).sort(),
      Object.keys(STRINGS.en).sort(),
    );
    for (const key of Object.keys(STRINGS.tr))
      assert.deepEqual(
        [...STRINGS.tr[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
        [...STRINGS.en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      );
    assert.equal(validLoadout({ q: "jump", e: "magnet" }), true);
    assert.equal(validLoadout({ q: "jump", e: "jump" }), false);
    assert.equal(validLoadout({ q: "__proto__", e: "magnet" }), false);
    const w = world("coop", 4);
    assert.equal(new Set([...w.players.values()].map((p) => p.color)).size, 4);
    assert.equal(w.ghosts.entities.length, MAX_LAN_GHOSTS);
  },
);
await check("ortak yem yalnızca bir kez yenir; puan toplayana yazılır", () => {
  const w = world();
  const [a, b] = w.players.values();
  const row = w.maze.grid.findIndex((r) => r.includes(2)),
    col = w.maze.grid[row].indexOf(2);
  assert.equal(w.maze.grid[row][col], 2);
  w.collect(a, col, row);
  w.collect(b, col, row);
  assert.equal(a.score, 10);
  assert.equal(b.score, 0);
  assert.equal(w.teamScore, 10);
  const powerRow = w.maze.grid.findIndex((r) => r.includes(3));
  w.collect(a, w.maze.grid[powerRow].indexOf(3), powerRow);
  assert.equal(a.score, 60);
  assert.equal(w.powerUntil - w.gameTime, 10);
});
await check(
  "aynı hayaletin eşzamanlı teması tek +200 ve üç saniye respawn verir",
  () => {
    const w = world();
    const [a, b] = w.players.values(),
      g = w.ghosts.entities[0];
    g.releaseAt = 0;
    g.immuneUntil = 0;
    w.powerUntil = 10;
    for (const p of [a, b])
      Object.assign(p.entity, { col: g.col, row: g.row, progress: 0 });
    w.collisions([a, b]);
    assert.equal(a.score + b.score, 200);
    assert.equal(g.releaseAt - w.gameTime, 3);
  },
);
await check(
  "can kaybı yalnızca ilgili oyuncuya etki eder; kalkan ve zıplama teması engeller",
  () => {
    const w = world();
    const [a, b] = w.players.values(),
      g = w.ghosts.entities[0];
    g.releaseAt = 0;
    Object.assign(a.entity, { col: g.col, row: g.row, progress: 0 });
    a.invulnerableUntil = 0;
    a.abilities.shieldUntil = 1;
    w.collisions([a, b]);
    assert.equal(a.lives, 3);
    a.abilities.shieldUntil = 0;
    w.collisions([a, b]);
    assert.equal(a.lives, 2);
    assert.equal(b.lives, 3);
    assert.ok(a.respawnUntil > 0);
  },
);
await check(
  "Q/E sunucu bekleme sürelerine uyar, geçersiz duvar atlayışı harcanmaz",
  () => {
    const w = world(),
      p = w.players.get("p0");
    p.respawnUntil = 0;
    p.loadout = { q: "boost", e: "shield" };
    assert.equal(w.useAbility(p, "q"), true);
    assert.equal(w.useAbility(p, "q"), false);
    assert.equal(p.abilities.boostUntil, 3);
    assert.equal(p.abilities.boostReadyAt, 12);
    assert.equal(w.useAbility(p, "e"), true);
    p.loadout = { q: "jump", e: "magnet" };
    p.entity.dir = "left";
    p.entity.next = "left";
    assert.equal(w.useAbility(p, "q"), false);
    assert.equal(p.abilities.jumpReadyAt, 0);
    let takeoff;
    for (let row = 1; row < ROWS - 1 && !takeoff; row++)
      for (let col = 1; col < COLS - 3 && !takeoff; col++)
        if (
          w.maze.walkable(col, row) &&
          w.maze.grid[row][col + 1] === 1 &&
          w.maze.walkable(col + 2, row)
        )
          takeoff = { col, row };
    assert.ok(takeoff);
    Object.assign(p.entity, {
      ...takeoff,
      dir: "right",
      next: "right",
      progress: 0,
    });
    assert.equal(w.useAbility(p, "q"), true);
    step(w, 0.4);
    assert.ok(!p.abilities.jump);
    assert.equal(w.maze.grid[p.entity.row][p.entity.col] === 1, false);
  },
);
await check(
  "iş birliği can yemi bütün takıma ödül verir ve sonraki haritayı açar",
  () => {
    const w = world(),
      [a, b] = w.players.values();
    a.lives = 2;
    w.maze.phase = "bonus";
    w.maze.grid[LAN_LIFE_PELLET.row][LAN_LIFE_PELLET.col] = 4;
    w.collect(a, LAN_LIFE_PELLET.col, LAN_LIFE_PELLET.row);
    assert.equal(w.state, "roundComplete");
    assert.equal(a.lives, 3);
    assert.equal(a.score, 0);
    assert.equal(b.score, 500);
    w.level++;
    w.loadRound();
    assert.equal(w.level, 2);
    assert.equal(w.state, "countdown");
    assert.equal(w.ghosts.entities.length, MAX_LAN_GHOSTS);
  },
);
await check(
  "puan yarışı süresinde sonuç ve beraberlik yalnızca sunucuda hesaplanır",
  () => {
    const w = world("race"),
      [a, b] = w.players.values();
    a.score = 100;
    b.score = 100;
    w.roundTime = 180;
    w.update(1 / 120);
    assert.equal(w.state, "finished");
    assert.deepEqual(w.winners, ["p0", "p1"]);
    const v = world("race"),
      [c, d] = v.players.values();
    c.score = 110;
    d.score = 50;
    v.roundTime = 180;
    v.update(1 / 120);
    assert.deepEqual(v.winners, ["p0"]);
  },
);
await check(
  "30 saniyelik kopma rezervi sırasında bağlantısı olmayan aktör durur",
  () => {
    const w = world(),
      p = w.players.get("p0");
    p.connected = false;
    const before = JSON.stringify(p.entity);
    step(w, 0.5);
    assert.equal(JSON.stringify(p.entity), before);
    for (const member of w.players.values()) member.connected = false;
    const time = w.gameTime;
    step(w, 1);
    assert.equal(w.gameTime, time);
  },
);
await check(
  "dört oyuncu ve farklı haritalar uzun simülasyonda duvara girmez",
  () => {
    const w = world("coop", 4);
    for (let level = 1; level <= 8; level++) {
      w.level = level;
      for (const p of w.players.values()) p.lives = 100;
      w.loadRound();
      w.update(3);
      for (let i = 0; i < 1200; i++) {
        if (i % 24 === 0)
          for (const p of w.players.values())
            w.direction(
              p,
              ["up", "left", "down", "right"][(i / 24 + p.slot) % 4],
            );
        w.update(1 / 120);
        for (const p of w.players.values())
          assert.notEqual(w.maze.grid[p.entity.row][p.entity.col], 1);
        for (const g of w.ghosts.entities)
          assert.notEqual(w.maze.grid[g.row][g.col], 1);
      }
    }
  },
);

await check("son yaşayan oyuncu ayrıldığında takım sonucu kilitlenmez", () => {
  const w = world(),
    [a, b] = w.players.values();
  b.lives = 0;
  w.players.delete(a.id);
  w.update(1 / 120);
  assert.equal(w.state, "finished");
  assert.equal(w.reason, "lives");
});

const server = createDevServer(undefined, { lan: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const streams = [];
const seqs = new Map();
async function api(path, body, session, expected = 200) {
  const response = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, expected, path);
  return response.json();
}
const create = (mode = "coop") =>
  api("/api/lan/create", { name: "Host", mode }, null, 201);
const join = (room, name = "Guest") =>
  api("/api/lan/join", { name, room }, null, 201);
async function connect(session) {
  const controller = new AbortController();
  const response = await fetch(
    origin + "/api/lan/events?room=" + session.room,
    {
      headers: { Authorization: "Bearer " + session.token },
      signal: controller.signal,
    },
  );
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  await reader.read();
  streams.push({ controller, reader });
  return streams.at(-1);
}
function action(session, type, extra = {}, expected = 200) {
  const seq = (seqs.get(session.id) || 0) + 1;
  seqs.set(session.id, seq);
  return api(
    "/api/lan/action?room=" + session.room,
    { type, seq, ...extra },
    session,
    expected,
  );
}
async function until(fn) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("timed out");
}
try {
  await check(
    "gerçek HTTP sunucusu LAN bilgisi, oda listesi ve iki mod sunar",
    async () => {
      assert.equal((await api("/api/lan/info")).enabled, true);
      for (const mode of ["coop", "race"]) {
        const owner = await create(mode);
        assert.ok(/^[A-Z2-9]{6}$/.test(owner.room));
        assert.equal(server.lanService.rooms.get(owner.room).world.mode, mode);
      }
    },
  );
  let owner, guest, room, ownerStream;
  await check(
    "iki gerçek istemci akışı aynı odaya bağlanır; tek oyuncu maçı başlatamaz",
    async () => {
      owner = await create();
      room = server.lanService.rooms.get(owner.room);
      ownerStream = await connect(owner);
      await action(owner, "ready");
      await action(owner, "start", {}, 409);
      guest = await join(owner.room);
      await connect(guest);
      assert.equal(room.world.players.size, 2);
      assert.ok([...room.world.players.values()].every((p) => p.connected));
      await action(guest, "start", {}, 403);
      await action(owner, "start", {}, 409);
      await action(guest, "ready");
      await action(owner, "start");
      assert.equal(room.world.state, "countdown");
    },
  );
  await check(
    "maç sırasında yeni oyuncu reddedilir; sahte skor/konum komutları etkisizdir",
    async () => {
      await api("/api/lan/join", { name: "Late", room: owner.room }, null, 409);
      const p = room.world.players.get(owner.id);
      await action(owner, "direction", { dir: "up", score: 999999, x: -100 });
      assert.equal(p.score, 0);
      assert.ok(room.world.position(p).x > 0);
      await action(owner, "direction", { dir: "__proto__" }, 400);
    },
  );
  await check(
    "aynı komut sıra numarası yinelendiğinde yetenek veya hazır iki kez işlenmez",
    async () => {
      const session = await create();
      await connect(session);
      const payload = { type: "ready", seq: 1 };
      await api("/api/lan/action?room=" + session.room, payload, session);
      const duplicate = await api(
        "/api/lan/action?room=" + session.room,
        payload,
        session,
      );
      assert.equal(duplicate.duplicate, true);
      assert.equal(
        server.lanService.rooms.get(session.room).world.players.get(session.id)
          .ready,
        true,
      );
    },
  );
  await check(
    "oda dört oyuncu ile sınırlıdır, oturumsuz ve başka origin istekleri reddedilir",
    async () => {
      const host = await create();
      await join(host.room, "P2");
      await join(host.room, "P3");
      await join(host.room, "P4");
      await api("/api/lan/join", { name: "P5", room: host.room }, null, 409);
      await api(
        "/api/lan/action?room=" + host.room,
        { type: "ready", seq: 1 },
        null,
        401,
      );
      const response = await fetch(origin + "/api/lan/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://evil.invalid",
        },
        body: JSON.stringify({ name: "Other", mode: "coop" }),
      });
      assert.equal(response.status, 403);
    },
  );
  await check(
    "bağlantı kopuşunda liderlik devri ve aynı token ile yeniden bağlanma",
    async () => {
      ownerStream.controller.abort();
      await until(() => !room.world.players.get(owner.id).connected);
      assert.equal(room.ownerId, guest.id);
      await connect(owner);
      assert.equal(room.world.players.get(owner.id).connected, true);
      assert.equal(room.world.players.size, 2);
    },
  );
  await check(
    "30 saniye sonrası boş bağlantı temizlenir; ayrılan oyuncu artık komut gönderemez",
    async () => {
      const host = await create();
      const r = server.lanService.rooms.get(host.room);
      r.members.get(host.id).disconnectedAt = Date.now() - 31000;
      server.lanService.tick();
      assert.equal(server.lanService.rooms.has(host.room), false);
      await action(owner, "leave");
      assert.equal(room.members.has(owner.id), false);
      await api(
        "/api/lan/action?room=" + owner.room,
        { type: "ready", seq: 99 },
        owner,
        401,
      );
    },
  );
  await check(
    "LAN sayfası ve modüller HTTP üzerinden servis edilir; gizli dosyalar kapalıdır",
    async () => {
      for (const path of ["/lan.html", "/src/lan/main.js", "/styles/lan.css"])
        assert.equal((await fetch(origin + path)).status, 200);
      assert.equal((await fetch(origin + "/.git/config")).status, 403);
      const html = await readFile(
        new URL("../lan.html", import.meta.url),
        "utf8",
      );
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length);
    },
  );
} finally {
  for (const stream of streams) {
    stream.controller.abort();
    await stream.reader.cancel().catch(() => {});
  }
  server.lanService.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  `${checks} LAN checks passed (real HTTP streams and both game modes).`,
);
