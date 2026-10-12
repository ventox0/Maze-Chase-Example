import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevServer } from "../scripts/dev-server.mjs";
import { AccountStore } from "../server/AccountStore.js";
import { PointWallet } from "../src/storage/PointWallet.js";
import { MissionProgress } from "../src/storage/MissionProgress.js";
import { WALLET_KEY, MISSIONS_KEY } from "../src/data/account-profile.js";
import { SHOP_ITEMS } from "../src/data/shop.js";
import { ProfileSession } from "../src/account/ProfileStorage.js";
import { requestAddress } from "../server/http.js";
const directory = await mkdtemp(join(tmpdir(), "kasaba-accounts-test-"));
const server = createDevServer(undefined, { lan: true, accountDir: directory });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const streams = [],
  seqs = new Map();
async function api(
  path,
  body,
  cookie = "",
  session = null,
  expected = 200,
  headers = {},
) {
  const response = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(session ? { Authorization: "Bearer " + session.token } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, expected, path);
  return {
    value: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    headers: response.headers,
  };
}
async function connect(session, cookie) {
  const controller = new AbortController();
  const response = await fetch(
    origin + "/api/lan/events?room=" + session.room,
    {
      headers: { Cookie: cookie, Authorization: "Bearer " + session.token },
      signal: controller.signal,
    },
  );
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const data = await reader.read();
  streams.push({ controller, reader });
  return { reader, first: new TextDecoder().decode(data.value) };
}
async function action(session, cookie, type, extra = {}, expected = 200) {
  const seq = (seqs.get(session.id) || 0) + 1;
  seqs.set(session.id, seq);
  return api(
    "/api/lan/action?room=" + session.room,
    { type, seq, ...extra },
    cookie,
    session,
    expected,
  );
}
const walletRules = new PointWallet({});
const wallet = (p) =>
  JSON.parse(p.data[WALLET_KEY] || JSON.stringify(walletRules.empty()));
let a, b;
try {
  a = await api("/api/account/register", {
    username: "Kasaba Test",
    password: "x",
  });
  b = await api("/api/account/register", {
    username: "Other Test",
    password: " uzunca🔒".repeat(1500),
  });
  assert.ok(a.headers.get("set-cookie").includes("HttpOnly"));
  assert.ok(a.headers.get("set-cookie").includes("SameSite=Lax"));
  await api(
    "/api/account/register",
    { username: "kasaba test", password: "q" },
    "",
    null,
    409,
  );
  await api(
    "/api/account/login",
    { username: "Kasaba Test", password: "wrong" },
    "",
    null,
    401,
  );
  await api(
    "/api/account/login",
    { username: "missing", password: "x" },
    "",
    null,
    401,
  );
  const longLogin = await api("/api/account/login", {
    username: "Other Test",
    password: " uzunca🔒".repeat(1500),
  });
  assert.equal(longLogin.value.user.id, b.value.user.id);
  const authFile = JSON.parse(
    await readFile(join(directory, "accounts.json"), "utf8"),
  );
  assert.ok(
    authFile.users.every(
      (u) =>
        u.hash.length === 128 &&
        u.salt.length === 32 &&
        !Object.hasOwn(u, "password"),
    ),
  );
  assert.ok(!JSON.stringify(authFile).includes(a.cookie.split("=")[1]));
  console.log(
    "PASS username/password only: one-character and long Unicode passwords, duplicate names, wrong credentials, hashed passwords and HttpOnly sessions",
  );
  assert.equal((await fetch(origin + "/health")).status, 200);
  assert.equal((await fetch(origin + "/.data/accounts.json")).status, 403);
  const previousProxy = process.env.TRUST_PROXY,
    previousLogin = process.env.REQUIRE_LOGIN,
    previousOrigin = process.env.PUBLIC_ORIGIN;
  try {
    process.env.TRUST_PROXY = "true";
    const secureLogin = await api(
      "/api/account/login",
      {
        username: "Kasaba Test",
        password: "x",
      },
      "",
      null,
      200,
      { "X-Forwarded-Proto": "https" },
    );
    assert.ok(secureLogin.headers.get("set-cookie").includes("; Secure"));
    assert.equal(
      requestAddress({
        headers: { "x-forwarded-for": "192.0.2.8, 127.0.0.1" },
        socket: { remoteAddress: "127.0.0.1" },
      }),
      "192.0.2.8",
    );
    process.env.TRUST_PROXY = "false";
    assert.equal(
      requestAddress({
        headers: { "x-forwarded-for": "192.0.2.8" },
        socket: { remoteAddress: "127.0.0.1" },
      }),
      "127.0.0.1",
    );
    process.env.REQUIRE_LOGIN = "true";
    await api(
      "/api/lan/create",
      { name: "Guest", mode: "coop" },
      "",
      null,
      401,
    );
    process.env.PUBLIC_ORIGIN = "https://kasaba.example";
    assert.deepEqual((await api("/api/lan/info")).value.urls, [
      "https://kasaba.example/lan.html",
    ]);
  } finally {
    if (previousProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousProxy;
    if (previousLogin === undefined) delete process.env.REQUIRE_LOGIN;
    else process.env.REQUIRE_LOGIN = previousLogin;
    if (previousOrigin === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = previousOrigin;
  }
  const publicServer = createDevServer(directory, {
    accountDir: join(directory, "private-accounts"),
  });
  await new Promise((r) => publicServer.listen(0, "127.0.0.1", r));
  try {
    assert.equal(
      (
        await fetch(
          "http://127.0.0.1:" +
            publicServer.address().port +
            "/private-accounts/accounts.json",
        )
      ).status,
      403,
    );
  } finally {
    publicServer.closeAllConnections();
    await new Promise((r) => publicServer.close(r));
    await publicServer.accounts.store.ready;
  }
  console.log(
    "PASS health, private data HTTP denial, proxy-aware Secure cookies/IP limits and production guest-login requirement",
  );
  await api("/api/account/profile", {}, "", null, 401);
  await api("/api/account/profile", {}, a.cookie, null, 403, {
    Origin: "https://foreign.test",
  });
  let guest = walletRules.empty();
  guest.totalEarned = 10000;
  guest.balance = 10000;
  guest.runs = { "run-guest-test": 10000 };
  const outfit = SHOP_ITEMS.find((i) => i.id === "sports_singlet");
  guest.owned = [outfit.id];
  guest.balance -= outfit.price;
  guest.equipped.outfit = outfit.id;
  const imported = await api(
    "/api/account/import",
    {
      data: {
        [WALLET_KEY]: JSON.stringify(guest),
        "maze-chaser-high-score": "10000",
      },
    },
    a.cookie,
  );
  assert.equal(wallet(imported.value.profile).balance, guest.balance);
  await api("/api/account/import", { data: {} }, a.cookie, null, 409);
  let profile = (await api("/api/account/me", null, a.cookie)).value.profile;
  const fake = walletRules.empty();
  fake.totalEarned = fake.balance = 999999;
  const spoof = await api(
    "/api/account/profile",
    {
      revision: b.value.profile.revision,
      changes: { [WALLET_KEY]: JSON.stringify(fake) },
    },
    b.cookie,
  );
  assert.equal(wallet(spoof.value.profile).balance, 0);
  const receipt = {
    id: "lan-server-test-once",
    points: 500,
    startedAt: Date.now(),
  };
  await server.accounts.store.creditLan(a.value.user.id, receipt);
  await server.accounts.store.creditLan(a.value.user.id, receipt);
  guest.runs["run-guest-test"] += 20;
  guest.totalEarned += 20;
  guest.balance += 20;
  await api(
    "/api/account/profile",
    {
      revision: profile.revision,
      changes: { [WALLET_KEY]: JSON.stringify(guest) },
    },
    a.cookie,
    null,
    409,
  );
  profile = (await api("/api/account/me", null, a.cookie)).value.profile;
  const patched = await api(
    "/api/account/profile",
    {
      revision: profile.revision,
      changes: { [WALLET_KEY]: JSON.stringify(guest) },
    },
    a.cookie,
  );
  assert.equal(wallet(patched.value.profile).balance, guest.balance + 500);
  assert.ok(wallet(patched.value.profile).owned.includes(outfit.id));
  console.log(
    "PASS one-time guest import, catalog inventory, profile isolation, revision conflicts and server-only LAN credit without duplicated replay",
  );
  const missions = new MissionProgress({ wallet: walletRules });
  const m = missions.empty();
  m.stats.smallPellets = 25;
  m.runs = {
    "run-missions-test": { ...missions.emptyCounters(), smallPellets: 25 },
  };
  profile = patched.value.profile;
  let p = await api(
    "/api/account/profile",
    {
      revision: profile.revision,
      changes: { [MISSIONS_KEY]: JSON.stringify(m) },
    },
    a.cookie,
  );
  let w = wallet(p.value.profile);
  w.missionRewards = ["smallPellets-1"];
  w.balance += 75;
  w.totalEarned += 75;
  p = await api(
    "/api/account/profile",
    {
      revision: p.value.profile.revision,
      changes: { [WALLET_KEY]: JSON.stringify(w) },
    },
    a.cookie,
  );
  assert.ok(wallet(p.value.profile).missionRewards.includes("smallPellets-1"));
  const replay = await api(
    "/api/account/profile",
    {
      revision: p.value.profile.revision,
      changes: {
        [WALLET_KEY]: JSON.stringify(w),
        [MISSIONS_KEY]: JSON.stringify(m),
      },
    },
    a.cookie,
  );
  assert.equal(wallet(replay.value.profile).balance, w.balance);
  assert.equal(
    JSON.parse(replay.value.profile.data[MISSIONS_KEY]).stats.smallPellets,
    25,
  );
  const freshStore = new AccountStore(directory);
  await freshStore.ready;
  assert.equal(
    (await freshStore.identify(a.cookie.split("=")[1])).id,
    a.value.user.id,
  );
  assert.equal(
    wallet(freshStore.publicProfile(await freshStore.profile(a.value.user.id)))
      .balance,
    w.balance,
  );
  console.log(
    "PASS missions paid once and profiles/sessions survive a new server store instance",
  );
  // Kayıt dosyası farklı cihazda aynı bulut anahtarlarından okunur.
  const saved = {
    version: 1,
    kind: "checkpoint",
    savedAt: Date.now(),
    data: {
      level: 5,
      score: 400,
      lives: 3,
      map: Array.from({ length: 23 }, () => Array(21).fill(2)),
    },
  };
  let savedResult = await api(
    "/api/account/profile",
    {
      revision: replay.value.profile.revision,
      changes: { "maze-chaser-save-v1-auto": JSON.stringify(saved) },
    },
    a.cookie,
  );
  assert.equal(
    JSON.parse(
      (await api("/api/account/me", null, a.cookie)).value.profile.data[
        "maze-chaser-save-v1-auto"
      ],
    ).data.level,
    5,
  );
  await api(
    "/api/account/profile",
    {
      revision: savedResult.value.profile.revision,
      accountId: b.value.user.id,
      changes: {},
    },
    a.cookie,
    null,
    401,
  );
  // Şifreli/gizli oda, iki gerçek akış ve yetkisiz izleyici girişleri.
  const owner = (
    await api(
      "/api/lan/create",
      { name: "Spoof name", mode: "coop", password: "1", listed: false },
      a.cookie,
      null,
      201,
    )
  ).value;
  const room = server.lanService.rooms.get(owner.room);
  assert.equal(room.world.players.get(owner.id).name, a.value.user.username);
  assert.ok(
    !(await api("/api/lan/rooms")).value.rooms.some(
      (r) => r.code === owner.room,
    ),
  );
  assert.ok(room.passwordHash && !Object.hasOwn(room, "password"));
  await connect(owner, a.cookie);
  await api(
    "/api/lan/join",
    { name: "Guest", room: owner.room, password: "no" },
    b.cookie,
    null,
    403,
  );
  const guestSession = (
    await api(
      "/api/lan/join",
      { name: "Guest", room: owner.room, password: "1" },
      b.cookie,
      null,
      201,
    )
  ).value;
  await connect(guestSession, b.cookie);
  await api(
    "/api/lan/join",
    { name: "Again", room: owner.room, password: "1" },
    b.cookie,
    null,
    409,
  );
  await action(owner, a.cookie, "ready");
  await action(guestSession, b.cookie, "ready");
  await action(owner, a.cookie, "start");
  const spectatorResult = await api(
    "/api/lan/join",
    { name: "Viewer", room: owner.room, password: "1", role: "spectator" },
    "",
    null,
    201,
  );
  const spectator = spectatorResult.value,
    viewerCookie = spectatorResult.cookie || "";
  const feed = await connect(spectator, viewerCookie);
  assert.equal(room.world.players.size, 2);
  assert.ok(feed.first.includes('"role":"spectator"'));
  assert.deepEqual(
    server.lanService.snapshot(room, room.members.get(spectator.id))
      .walletRewards,
    [],
  );
  await action(spectator, viewerCookie, "ability", { slot: "q" }, 403);
  await action(
    spectator,
    viewerCookie,
    "vote",
    { mode: "race", map: "rings" },
    403,
  );
  const beforeAward = wallet(
    (await api("/api/account/me", null, a.cookie)).value.profile,
  ).balance;
  room.world.credit(room.world.players.get(owner.id), 1001);
  room.world.credit(room.world.players.get(guestSession.id), 201);
  room.world.finish("time");
  server.lanService.publish(room);
  const awarded = await api(
    "/api/lan/rewards?room=" + owner.room,
    null,
    a.cookie,
    owner,
  );
  assert.equal(awarded.value.amount, 601);
  assert.equal(wallet(awarded.value.profile).balance, beforeAward + 601);
  const again = await api(
    "/api/lan/rewards?room=" + owner.room,
    null,
    a.cookie,
    owner,
  );
  assert.equal(again.value.amount, 0);
  assert.equal(wallet(again.value.profile).balance, beforeAward + 601);
  await api("/api/lan/rewards?room=" + owner.room, null, b.cookie, owner, 401);
  assert.equal(
    wallet((await api("/api/account/me", null, b.cookie)).value.profile)
      .balance,
    601,
  );
  console.log(
    "PASS completed LAN team score credits each linked account 50% durably once; foreign account cookies cannot claim another member’s rewards",
  );
  await action(guestSession, b.cookie, "kick", { target: owner.id }, 403);
  await action(owner, a.cookie, "kick", { target: guestSession.id });
  assert.equal(room.world.players.size, 1);
  await api(
    "/api/lan/join",
    { name: "Again", room: owner.room, password: "1" },
    b.cookie,
    null,
    403,
  );
  assert.ok(room.banned.has("account:" + b.value.user.id));
  console.log(
    "PASS password-protected hidden rooms, authoritative account names, live spectators without rewards/control and host-only kick/rejoin bans",
  );
  // Hesap çıkışı bu oturumun LAN bağlantısını da kapatır.
  await api("/api/account/logout", {}, a.cookie);
  assert.equal((await api("/api/account/me", null, a.cookie)).value.user, null);
  assert.ok(!server.lanService.rooms.has(owner.room));
  assert.equal(
    server.lanService.snapshot(
      {
        world: new (await import("../server/LanWorld.js")).LanWorld(),
        members: new Map(),
        code: "ZZZZZZ",
        ownerId: null,
      },
      null,
    ).spectators.length,
    0,
  );
  console.log(
    "PASS logout invalidates its session and room membership; an empty player room closes for spectators",
  );
} finally {
  streams.forEach((s) => s.controller.abort());
  server.lanService.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await rm(directory, { recursive: true, force: true });
}
// İstemci depolaması hesapları ve misafiri karıştırmaz; reddedilen/saklanmamış
// değişiklikleri önbellekten yeniden denetir.
{
  const map = new Map([[WALLET_KEY, '{"guest":true}']]);
  globalThis.localStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const profile = {
    revision: 0,
    data: { [WALLET_KEY]: '{"account":true}' },
    canImport: true,
  };
  const session = new ProfileSession();
  session.activate({ id: "first", username: "A" }, structuredClone(profile));
  assert.equal(session.getItem(WALLET_KEY), ' {"account":true}'.trim());
  session.setItem("maze-chaser-high-score", "30");
  clearTimeout(session.timer);
  assert.equal(map.get(WALLET_KEY), '{"guest":true}');
  let attempts = 0;
  session.request = async (type, body) => {
    attempts++;
    if (attempts === 1)
      throw Object.assign(new Error("profileConflict"), {
        profile: { revision: 1 },
      });
    return {
      profile: {
        revision: 2,
        data: { ...profile.data, ...body.changes },
        canImport: false,
      },
    };
  };
  await session.flush();
  assert.equal(session.profile.revision, 2);
  assert.equal(session.state, "synced");
  session.setItem("maze-chaser-high-score", "40");
  clearTimeout(session.timer);
  session.request = async () => {
    throw new Error("accountUnavailable");
  };
  await assert.rejects(session.flush());
  clearTimeout(session.timer);
  const restored = new ProfileSession();
  restored.activate({ id: "first", username: "A" }, structuredClone(profile));
  assert.equal(restored.getItem("maze-chaser-high-score"), "40");
  restored.activate({ id: "second", username: "B" }, structuredClone(profile));
  assert.equal(restored.getItem("maze-chaser-high-score"), null);
  restored.setItem(WALLET_KEY, '{"rejectedPurchase":true}');
  clearTimeout(restored.timer);
  restored.request = async (action) => {
    if (action === "profile") throw new Error("shopShort");
    return { user: { id: "second" }, profile: structuredClone(profile) };
  };
  await assert.rejects(restored.flush(), /shopShort/);
  assert.equal(restored.state, "rejected");
  assert.equal(restored.getItem(WALLET_KEY), profile.data[WALLET_KEY]);
  assert.equal(Object.keys(restored.pending).length, 0);
  restored.setItem("maze-chaser-high-score", "50");
  clearTimeout(restored.timer);
  restored.request = async (action, body) => ({
    profile: {
      ...structuredClone(profile),
      revision: 1,
      data: { ...profile.data, ...body.changes },
    },
  });
  await restored.flush();
  assert.equal(restored.state, "synced");
  assert.equal(restored.getItem("maze-chaser-high-score"), "50");
  console.log(
    "PASS guest/account separation, conflicting profile retry, owner-scoped offline cache and rejected-purchase recovery without blocking future saves",
  );
}
