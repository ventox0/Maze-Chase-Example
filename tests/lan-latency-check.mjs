import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LanClient } from "../src/lan/LanClient.js";
import { LanPrediction } from "../src/lan/LanPrediction.js";
import { LanWorld } from "../server/LanWorld.js";
import { createDevServer } from "../scripts/dev-server.mjs";

// İlk isteğin yanıtını bilinçli olarak tut: yeni yön buna rağmen gönderilmeli.
const calls = [];
let release;
const client = new LanClient(() => {}, () => {}, () => {}, {
  fetch: async (_path, options) => {
    const data = JSON.parse(options.body);
    calls.push(data);
    if (calls.length === 1) await new Promise((resolve) => { release = resolve; });
    return new Response('{"ok":true}');
  },
});
client.session = { room: "ABCDEF", token: "test" };
client.connected = true;
const first = client.action("direction", { dir: "left" });
await Promise.resolve();
const second = client.action("direction", { dir: "up" });
await second;
assert.equal(calls.length, 2, "a new turn must not wait for the previous HTTP response");
await client.action("ability", { slot: "q" });
assert.equal(calls[2].type, "ability", "held direction ACK must not block abilities");
release();
await first;
console.log("PASS delayed HTTP acknowledgements do not block new directions or abilities");

const world = new LanWorld();
const player = world.addPlayer("local", "Test", 0);
world.state = "playing";
world.gameTime = 4;
world.maze.grid = [
  [1,1,1,1,1], [1,0,0,0,1], [1,0,0,0,1], [1,0,0,0,1], [1,1,1,1,1],
];
player.connected = true;
Object.assign(player.entity, { col: 1, row: 1, dir: "right", next: "right", progress: 12 });
let now = 0;
const prediction = new LanPrediction(() => now);
const snapshot = { ...world.snapshot(), directionSeq: 0 };
const original = JSON.stringify(snapshot);
prediction.accept(snapshot, player.id);
prediction.intent("left", 1);
now = 16;
const reversed = prediction.sample();
assert.equal(reversed.dir, "left");
assert.ok(reversed.x < snapshot.players[0].x, "first rendered frame reacts before any server ACK");
assert.equal(JSON.stringify(snapshot), original, "prediction never changes server score/map/position");

now = 0;
prediction.reset();
prediction.accept(snapshot, player.id);
prediction.intent("down", 2);
now = 150;
const turned = prediction.sample();
assert.equal(turned.x, 60, "perpendicular turn waits for the tile centre");
assert.ok(turned.y > 36);
world.direction(player, "down");
world.updatePlayer(player, 0.15);
const authoritative = world.snapshot();
assert.ok(Math.abs(authoritative.players[0].x - turned.x) < 1e-8);
assert.ok(Math.abs(authoritative.players[0].y - turned.y) < 1e-8);
prediction.accept({ ...authoritative, directionSeq: 2 }, player.id);
assert.equal(prediction.inputs.length, 0, "ACK removes replayed input");

now = 0;
Object.assign(player.entity, { col: 3, row: 1, dir: "right", next: "right", progress: 0 });
prediction.reset();
prediction.accept(world.snapshot(), player.id);
now = 1000;
assert.equal(prediction.sample().x, 84, "prediction stops at a wall");
Object.assign(player.entity, { col: 1, row: 1, dir: "right", next: "right", progress: 0 });
now = 0;
prediction.accept(world.snapshot(), player.id);
now = 250;
const capped = prediction.sample();
now = 5000;
assert.equal(prediction.sample().x, capped.x, "lost snapshots cannot extrapolate indefinitely");
player.lives = 2;
player.respawnUntil = world.gameTime + 1;
prediction.accept(world.snapshot(), player.id);
assert.equal(prediction.sample(), null, "respawn clears prediction immediately");
console.log("PASS immediate reversal, shared corner alignment, authoritative reconciliation, walls and disconnect/respawn limits");

// Gerçek HTTP sunucusunda ters sıralı paketler ve bağımsız komut numaraları.
const directory = await mkdtemp(join(tmpdir(), "maze-latency-"));
const server = createDevServer(undefined, { lan: true, accountDir: directory });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const controller = new AbortController();
try {
  const response = await fetch(origin + "/api/lan/create", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", mode: "coop" }),
  });
  const session = await response.json();
  assert.equal(response.status, 201);
  const stream = await fetch(origin + "/api/lan/events?room=" + session.room, {
    headers: { Authorization: "Bearer " + session.token }, signal: controller.signal,
  });
  assert.equal(stream.status, 200);
  const room = server.lanService.rooms.get(session.room);
  const p = room.world.players.get(session.id);
  const command = async (data) => {
    const response = await fetch(origin + "/api/lan/action?room=" + session.room, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.token },
      body: JSON.stringify(data),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  await command({ type: "direction", dir: "up", seq: 3, inputSeq: 2 });
  const late = await command({ type: "direction", dir: "left", seq: 1, inputSeq: 1 });
  assert.equal(late.duplicate, true);
  assert.equal(p.entity.next, "up");
  await command({ type: "ready", seq: 2 });
  assert.equal(p.ready, true, "a newer direction cannot discard a delayed lobby command");
  const duplicate = await command({ type: "ready", seq: 2 });
  assert.equal(duplicate.duplicate, true);
  assert.equal(p.ready, true);
  const state = server.lanService.snapshot(room, room.members.get(session.id));
  assert.equal(state.directionSeq, 2);
  assert.equal(state.seq, 2);
  assert.ok(state.players[0].motion.speed > 0);
} finally {
  controller.abort();
  server.lanService.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
console.log("PASS real HTTP server ignores reordered directions while preserving independent, deduplicated lobby commands");
