import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { networkInterfaces } from "node:os";
import { LanWorld, validLoadout } from "./LanWorld.js";

const fail = (status, code) => Object.assign(new Error(code), { status, code });
const nameOf = (value) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 22)
    : "";
export const roomCode = () =>
  Array.from(
    randomBytes(6),
    (byte) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[byte % 32],
  ).join("");
export function lanUrls(port) {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flat()
        .filter((i) => i.family === "IPv4" && !i.internal)
        .map((i) => `http://${i.address}:${port}/lan.html`),
    ),
  ];
}

// Odalar RAM'de tutulur; 30 saniyelik yeniden bağlanma süresi, oda liderliği
// devri ve yavaş bağlantılarda biriken snapshot'ları atma burada yönetilir.
export class LanService {
  constructor(server) {
    this.server = server;
    this.rooms = new Map();
    this.closed = false;
    this.lastTick = performance.now();
    this.lastBroadcast = 0;
    this.timer = setInterval(() => this.tick(), 1000 / 60);
    this.timer.unref();
    server.on("close", () => this.close());
  }
  json(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
  async body(req) {
    if (
      !String(req.headers["content-type"] || "").startsWith("application/json")
    )
      throw fail(415, "badRequest");
    const parts = [];
    let bytes = 0;
    for await (const part of req) {
      bytes += part.length;
      if (bytes > 4096) throw fail(413, "badRequest");
      parts.push(part);
    }
    try {
      const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
      if (!value || Array.isArray(value) || typeof value !== "object") throw 0;
      return value;
    } catch {
      throw fail(400, "badRequest");
    }
  }
  member(req, url) {
    const room = this.rooms.get(url.searchParams.get("room"));
    if (!room) throw fail(404, "roomMissing");
    const token = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    const member = [...room.members.values()].find((m) => m.token === token);
    if (!member) throw fail(401, "sessionExpired");
    return { room, member, player: room.world.players.get(member.id) };
  }
  makeMember(room, name, loadout) {
    if (room.members.size >= 4) throw fail(409, "roomFull");
    const used = [...room.world.players.values()].map((p) => p.slot);
    const slot = [0, 1, 2, 3].find((s) => !used.includes(s));
    const member = {
      id: randomBytes(8).toString("hex"),
      token: randomBytes(24).toString("base64url"),
      stream: null,
      disconnectedAt: Date.now(),
      lastRequest: 0,
      requests: 0,
    };
    room.members.set(member.id, member);
    room.world.addPlayer(member.id, name, slot, loadout);
    room.touched = Date.now();
    return member;
  }
  promote(room) {
    if (room.members.get(room.ownerId)?.stream) return;
    room.ownerId =
      [...room.members.values()].find((m) => m.stream)?.id ||
      room.members.keys().next().value ||
      null;
  }
  snapshot(room, member) {
    return {
      ...room.world.snapshot(),
      room: room.code,
      ownerId: room.ownerId,
      seq: room.world.players.get(member?.id)?.lastSeq || 0,
      walletRewards: room.world.players.get(member?.id)?.walletRewards || [],
    };
  }
  publish(room) {
    for (const member of room.members.values()) {
      const res = member.stream;
      if (!res || res.destroyed || res.writableLength > 65536) continue;
      res.write(
        `event: state\ndata: ${JSON.stringify(this.snapshot(room, member))}\n\n`,
      );
    }
  }
  remove(room, member) {
    room.members.delete(member.id);
    room.world.players.delete(member.id);
    const stream = member.stream;
    member.stream = null;
    stream?.end();
    this.promote(room);
    room.touched = Date.now();
    if (!room.members.size) this.rooms.delete(room.code);
    else this.publish(room);
  }
  tick() {
    const now = performance.now(),
      dt = Math.min((now - this.lastTick) / 1000, 0.1);
    this.lastTick = now;
    for (const room of this.rooms.values()) {
      for (const member of [...room.members.values()])
        if (!member.stream && Date.now() - member.disconnectedAt > 30000)
          this.remove(room, member);
      if (!this.rooms.has(room.code)) continue;
      // Sabit üst adımla grid dönüşleri ve çarpışmalar ağ yayın hızından bağımsızdır.
      let remaining = dt;
      while (remaining > 1e-8) {
        const step = Math.min(remaining, 1 / 120);
        room.world.update(step);
        remaining -= step;
      }
      if (now - this.lastBroadcast >= 50) this.publish(room);
    }
    if (now - this.lastBroadcast >= 50) this.lastBroadcast = now;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    for (const room of this.rooms.values())
      for (const member of room.members.values()) member.stream?.end();
    this.rooms.clear();
  }
  async handle(req, res, url) {
    if (!url.pathname.startsWith("/api/lan/")) return false;
    try {
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}`
      )
        throw fail(403, "badOrigin");
      if (url.pathname === "/api/lan/info" && req.method === "GET") {
        this.json(res, 200, {
          enabled: true,
          urls: lanUrls(this.server.address().port),
          maxPlayers: 4,
        });
        return true;
      }
      if (url.pathname === "/api/lan/rooms" && req.method === "GET") {
        this.json(res, 200, {
          rooms: [...this.rooms.values()]
            .filter((r) => r.world.state === "lobby" && r.members.size < 4)
            .map((r) => ({
              code: r.code,
              mode: r.world.mode,
              players: r.members.size,
              host: r.world.players.get(r.ownerId)?.name || "",
            })),
        });
        return true;
      }
      if (
        ["/api/lan/create", "/api/lan/join"].includes(url.pathname) &&
        req.method === "POST"
      ) {
        const data = await this.body(req),
          name = nameOf(data.name),
          loadout = data.loadout || { q: "jump", e: "magnet" };
        if (!name || !validLoadout(loadout)) throw fail(400, "badRequest");
        let room;
        if (url.pathname.endsWith("/create")) {
          if (this.rooms.size >= 20) throw fail(429, "serverFull");
          if (!["coop", "race"].includes(data.mode))
            throw fail(400, "badRequest");
          let code;
          do {
            code = roomCode();
          } while (this.rooms.has(code));
          room = {
            code,
            world: new LanWorld(data.mode),
            members: new Map(),
            ownerId: null,
            touched: Date.now(),
          };
          this.rooms.set(code, room);
        } else {
          const code = String(data.room || "")
            .trim()
            .toUpperCase();
          room = this.rooms.get(code);
          if (!room) throw fail(404, "roomMissing");
          if (room.world.state !== "lobby") throw fail(409, "alreadyStarted");
        }
        const member = this.makeMember(room, name, loadout);
        if (!room.ownerId) room.ownerId = member.id;
        this.json(res, 201, {
          room: room.code,
          id: member.id,
          token: member.token,
        });
        this.publish(room);
        return true;
      }
      const { room, member, player } = this.member(req, url);
      room.touched = Date.now();
      if (url.pathname === "/api/lan/events" && req.method === "GET") {
        const old = member.stream;
        member.stream = res;
        old?.end();
        player.connected = true;
        member.disconnectedAt = 0;
        this.promote(room);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        res.write(
          `event: state\ndata: ${JSON.stringify(this.snapshot(room, member))}\n\n`,
        );
        res.on("close", () => {
          if (member.stream !== res) return;
          member.stream = null;
          member.disconnectedAt = Date.now();
          player.connected = false;
          player.ready = false;
          player.entity.moving = false;
          this.promote(room);
          this.publish(room);
        });
        this.publish(room);
        return true;
      }
      if (url.pathname !== "/api/lan/action" || req.method !== "POST")
        throw fail(405, "badRequest");
      if (!member.stream) throw fail(409, "reconnecting");
      const now = Date.now();
      if (now - member.lastRequest > 1000) {
        member.lastRequest = now;
        member.requests = 0;
      }
      if (++member.requests > 60) throw fail(429, "tooFast");
      const data = await this.body(req);
      if (!Number.isSafeInteger(data.seq) || data.seq <= 0)
        throw fail(400, "badRequest");
      if (data.seq <= player.lastSeq) {
        this.json(res, 200, { ok: true, duplicate: true });
        return true;
      }
      player.lastSeq = data.seq;
      const world = room.world,
        lobby = world.state === "lobby",
        owner = room.ownerId === member.id;
      if (data.type === "leave") {
        this.remove(room, member);
        this.json(res, 200, { ok: true });
        return true;
      }
      if (data.type === "direction") {
        if (!Object.hasOwn({ up: 1, down: 1, left: 1, right: 1 }, data.dir))
          throw fail(400, "badRequest");
        world.direction(player, data.dir);
      } else if (data.type === "ability") {
        if (!["q", "e"].includes(data.slot)) throw fail(400, "badRequest");
        world.useAbility(player, data.slot);
      } else if (data.type === "ready") {
        if (!lobby) throw fail(409, "alreadyStarted");
        player.ready = !player.ready;
      } else if (data.type === "loadout") {
        if (!lobby || !validLoadout(data.loadout))
          throw fail(400, "badRequest");
        player.loadout = { ...data.loadout };
        player.ready = false;
      } else if (data.type === "start") {
        if (!owner) throw fail(403, "hostOnly");
        if (!lobby) throw fail(409, "alreadyStarted");
        const players = [...world.players.values()];
        if (players.length < 2 || !players.every((p) => p.connected && p.ready))
          throw fail(409, "notReady");
        world.start();
      } else if (data.type === "next") {
        if (!owner) throw fail(403, "hostOnly");
        if (world.state !== "roundComplete") throw fail(409, "badRequest");
        world.level++;
        for (const p of world.players.values()) p.lives = Math.max(1, p.lives);
        world.loadRound();
      } else if (data.type === "rematch") {
        if (!owner) throw fail(403, "hostOnly");
        if (world.state !== "finished") throw fail(409, "badRequest");
        world.state = "lobby";
        world.winners = [];
        world.reason = "";
        for (const p of world.players.values()) p.ready = false;
      } else throw fail(400, "badRequest");
      this.json(res, 200, { ok: true });
      this.publish(room);
    } catch (error) {
      if (!res.headersSent)
        this.json(res, error.status || 500, {
          error: error.code || "serverError",
        });
      else res.end();
    }
    return true;
  }
}
