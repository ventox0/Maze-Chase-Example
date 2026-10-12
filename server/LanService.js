import { hashPassword, verifyPassword } from "./Password.js";
import { cookies, sameOrigin } from "./http.js";
import { createLanMap } from "../src/gameplay/lan-map.js";
import { LanLobby } from "./LanLobby.js";
import { LAN_RECONNECT_MS, lanBalance } from "../src/data/lan-options.js";
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
  constructor(server, accounts = null) {
    this.accounts = accounts;
    this.rewardWrites = new Map();
    this.rewardDone = new Map();
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
  makeMember(
    room,
    name,
    loadout,
    role = "player",
    account = null,
    guestId = null,
  ) {
    if (role === "player" && room.world.players.size >= 4)
      throw fail(409, "roomFull");
    if (
      role === "spectator" &&
      [...room.members.values()].filter((m) => m.role === "spectator").length >=
        8
    )
      throw fail(409, "spectatorsFull");
    const used = [...room.world.players.values()].map((p) => p.slot);
    const slot = [0, 1, 2, 3].find((s) => !used.includes(s));
    const member = {
      role,
      name,
      accountId: account?.id || null,
      banKey: account ? "account:" + account.id : "guest:" + guestId,
      lastSeq: 0,
      lastRewardSeen: {},
      id: randomBytes(8).toString("hex"),
      token: randomBytes(24).toString("base64url"),
      stream: null,
      disconnectedAt: Date.now(),
      lastRequest: 0,
      requests: 0,
    };
    room.members.set(member.id, member);
    if (role === "player") {
      const player = room.world.addPlayer(member.id, name, slot, loadout);
      player.accountId = member.accountId;
    }
    room.touched = Date.now();
    return member;
  }
  promote(room) {
    if (
      room.members.get(room.ownerId)?.stream &&
      room.members.get(room.ownerId)?.role !== "spectator"
    )
      return;
    room.ownerId =
      [...room.members.values()].find((m) => m.stream && m.role !== "spectator")
        ?.id ||
      [...room.members.values()].find((m) => m.role !== "spectator")?.id ||
      null;
  }
  snapshot(room, member) {
    const lobby = room.lobby?.snapshot(
      [...room.world.players.values()],
      room.ownerId,
    );
    if (
      room.world.state === "lobby" &&
      lobby &&
      room.previewKey !== `${lobby.mode}|${lobby.map}`
    ) {
      room.previewKey = `${lobby.mode}|${lobby.map}`;
      room.world.mode = lobby.mode;
      room.world.mapChoice = lobby.map;
      room.world.maze.grid = createLanMap(1, 1, {
        mode: lobby.mode,
        map: lobby.map,
      });
      room.world.pellets = room.world.maze.grid
        .flat()
        .filter((v) => v === 2 || v === 3).length;
      room.world.mapRevision++;
    }
    if (room.world.state === "lobby")
      room.world.balance = lanBalance(room.world.players.size);
    return {
      ...room.world.snapshot(),
      revision: (room.revision = (room.revision || 0) + 1),
      serverTime: Date.now(),
      lobby,
      room: room.code,
      ownerId: room.ownerId,
      viewer: member ? { id: member.id, role: member.role || "player" } : null,
      spectators: [...(room.members?.values() || [])]
        .filter((m) => m.role === "spectator")
        .map((m) => ({
          id: m.id,
          name: m.name,
          connected: !!m.stream,
          role: "spectator",
        })),
      seq: room.world.players.get(member?.id)?.lastSeq || member?.lastSeq || 0,
      walletRewards: room.world.players.get(member?.id)?.walletRewards || [],
    };
  }
  publish(room) {
    this.flushRewards(room);
    for (const member of room.members.values()) {
      const res = member.stream;
      if (!res || res.destroyed || res.writableLength > 65536) continue;
      res.write(
        `event: state\ndata: ${JSON.stringify(this.snapshot(room, member))}\n\n`,
      );
    }
  }
  queueReward(player, receipt) {
    if (!this.accounts || !player.accountId) return Promise.resolve();
    const key = player.accountId + ":" + receipt.id;
    if ((this.rewardDone.get(key) || 0) >= receipt.points)
      return Promise.resolve();
    const active = this.rewardWrites.get(key);
    if (active) return active.then(() => this.queueReward(player, receipt));
    const work = this.accounts.store
      .creditLan(player.accountId, receipt)
      .then(() => this.rewardDone.set(key, receipt.points))
      .finally(() => this.rewardWrites.delete(key));
    this.rewardWrites.set(key, work);
    return work;
  }
  flushRewards(room) {
    for (const p of room.world.players.values())
      for (const receipt of p.walletRewards)
        void this.queueReward(p, receipt).catch(() => {});
  }
  disconnectAccount(id, token) {
    for (const room of [...this.rooms.values()])
      for (const m of [...room.members.values()])
        if (m.accountId === id && (!token || m.accountSession === token)) {
          m.stream?.write(
            `event: removed\ndata: ${JSON.stringify({ reason: "loginRequired" })}\n\n`,
          );
          this.remove(room, m);
        }
  }
  remove(room, member) {
    room.members.delete(member.id);
    room.world.players.delete(member.id);
    room.lobby.votes.delete(member.id);
    const stream = member.stream;
    member.stream = null;
    stream?.end();
    this.promote(room);
    room.touched = Date.now();
    if (!room.world.players.size) {
      for (const m of room.members.values()) m.stream?.end();
      this.rooms.delete(room.code);
    } else this.publish(room);
  }
  tick() {
    const now = performance.now(),
      dt = Math.min((now - this.lastTick) / 1000, 0.1);
    this.lastTick = now;
    for (const room of this.rooms.values()) {
      for (const member of [...room.members.values()])
        if (
          !member.stream &&
          Date.now() - member.disconnectedAt > LAN_RECONNECT_MS
        )
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
      if (!sameOrigin(req)) throw fail(403, "badOrigin");
      if (url.pathname === "/api/lan/info" && req.method === "GET") {
        this.json(res, 200, {
          enabled: true,
          urls: process.env.PUBLIC_ORIGIN
            ? [new URL("/lan.html", process.env.PUBLIC_ORIGIN).href]
            : lanUrls(this.server.address().port),
          maxPlayers: 4,
        });
        return true;
      }
      if (url.pathname === "/api/lan/rooms" && req.method === "GET") {
        this.json(res, 200, {
          rooms: [...this.rooms.values()]
            .filter((r) => r.listed !== false)
            .map((r) => ({
              code: r.code,
              mode: r.world.mode,
              players: r.world.players.size,
              state: r.world.state,
              locked: !!r.passwordHash,
              spectators: [...r.members.values()].filter(
                (m) => m.role === "spectator",
              ).length,
              host: r.world.players.get(r.ownerId)?.name || "",
            })),
        });
        return true;
      }
      if (
        ["/api/lan/create", "/api/lan/join"].includes(url.pathname) &&
        req.method === "POST"
      ) {
        this.accounts?.limit(req);
        const account = this.accounts ? await this.accounts.user(req) : null;
        if (process.env.REQUIRE_LOGIN === "true" && !account)
          throw fail(401, "loginRequired");
        let guestId = cookies(req)["maze-visitor"];
        if (!guestId || !/^[a-f0-9]{32}$/.test(guestId)) {
          guestId = randomBytes(16).toString("hex");
          res.setHeader(
            "Set-Cookie",
            `maze-visitor=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
          );
        }
        const data = await this.body(req),
          name = nameOf(account?.username || data.name),
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
            lobby: new LanLobby(data.mode),
            members: new Map(),
            ownerId: null,
            touched: Date.now(),
            listed: data.listed !== false,
            passwordHash:
              typeof data.password === "string" && data.password
                ? await hashPassword(data.password)
                : null,
            banned: new Set(),
          };
          this.rooms.set(code, room);
        } else {
          const code = String(data.room || "")
            .trim()
            .toUpperCase();
          room = this.rooms.get(code);
          if (!room) throw fail(404, "roomMissing");
          if (
            (room.banned || new Set()).has(
              account ? "account:" + account.id : "guest:" + guestId,
            )
          )
            throw fail(403, "kicked");
          if (
            room.passwordHash &&
            !(await verifyPassword(
              typeof data.password === "string" ? data.password : "",
              room.passwordHash,
            ))
          )
            throw fail(403, "roomPasswordWrong");
          if (data.role !== "spectator" && room.world.state !== "lobby")
            throw fail(409, "alreadyStarted");
        }
        const role = url.pathname.endsWith("/create")
          ? "player"
          : data.role || "player";
        if (!["player", "spectator"].includes(role))
          throw fail(400, "badRequest");
        if (
          account &&
          [...room.members.values()].some((m) => m.accountId === account.id)
        )
          throw fail(409, "accountInRoom");
        const member = this.makeMember(
          room,
          name,
          loadout,
          role,
          account,
          guestId,
        );
        member.accountSession = cookies(req)["maze-account"];
        if (!room.ownerId) room.ownerId = member.id;
        const createdPlayer = room.world.players.get(member.id);
        if (createdPlayer) {
          const equipment = account
            ? JSON.parse(
                (await this.accounts.store.readProfile(account.id)).data[
                  "maze-chaser-wallet-v1"
                ] || "null",
              )?.equipped
            : data.appearance;
          room.world.setAppearance(createdPlayer, equipment);
        }
        this.json(res, 201, {
          room: room.code,
          id: member.id,
          token: member.token,
          role: member.role,
        });
        this.publish(room);
        return true;
      }
      const { room, member, player } = this.member(req, url);
      if (
        member.accountId &&
        (await this.accounts?.user(req))?.id !== member.accountId
      )
        throw fail(401, "loginRequired");
      room.touched = Date.now();
      if (url.pathname === "/api/lan/rewards" && req.method === "GET") {
        if (!member.accountId || !player) throw fail(403, "loginRequired");
        let amount = 0;
        for (const receipt of player.walletRewards) {
          await this.queueReward(player, receipt);
          amount += Math.max(
            0,
            receipt.points - (member.lastRewardSeen[receipt.id] || 0),
          );
          member.lastRewardSeen[receipt.id] = receipt.points;
        }
        {
          this.json(res, 200, {
            amount,
            profile: this.accounts.store.publicProfile(
              await this.accounts.store.readProfile(member.accountId),
            ),
          });
        }
        return true;
      }
      if (url.pathname === "/api/lan/ping" && req.method === "GET") {
        this.json(res, 200, { serverTime: Date.now() });
        return true;
      }
      if (url.pathname === "/api/lan/events" && req.method === "GET") {
        const old = member.stream;
        member.stream = res;
        old?.end();
        if (player) player.connected = true;
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
          if (player) {
            player.connected = false;
            player.ready = false;
            player.entity.moving = false;
          }
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
      if (data.seq <= (player?.lastSeq || member.lastSeq)) {
        this.json(res, 200, { ok: true, duplicate: true });
        return true;
      }
      member.lastSeq = data.seq;
      if (player) player.lastSeq = data.seq;
      const world = room.world,
        lobby = world.state === "lobby",
        owner = room.ownerId === member.id;
      if (data.type === "leave") {
        this.remove(room, member);
        this.json(res, 200, { ok: true });
        return true;
      }
      if (member.role === "spectator") throw fail(403, "spectatorOnly");
      if (data.type === "kick") {
        if (!owner) throw fail(403, "hostOnly");
        const target = room.members.get(data.target);
        if (!target || target.id === member.id) throw fail(400, "badRequest");
        room.banned ||= new Set();
        room.banned.add(target.banKey);
        target.stream?.write(
          `event: removed\ndata: ${JSON.stringify({ reason: "kicked" })}\n\n`,
        );
        this.remove(room, target);
      } else if (data.type === "direction") {
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
      } else if (data.type === "vote") {
        if (!lobby) throw fail(409, "alreadyStarted");
        if (!room.lobby.vote(player, data)) throw fail(400, "badRequest");
      } else if (data.type === "appearance") {
        if (!lobby) throw fail(409, "alreadyStarted");
        const equipment = member.accountId
          ? JSON.parse(
              (await this.accounts.store.readProfile(member.accountId)).data[
                "maze-chaser-wallet-v1"
              ] || "null",
            )?.equipped
          : data.appearance;
        world.setAppearance(player, equipment);
        player.ready = false;
      } else if (data.type === "start") {
        if (!owner) throw fail(403, "hostOnly");
        if (!lobby) throw fail(409, "alreadyStarted");
        const players = [...world.players.values()];
        if (players.length < 2 || !players.every((p) => p.connected && p.ready))
          throw fail(409, "notReady");
        const choice = room.lobby.resolve(players, room.ownerId);
        world.mode = choice.mode;
        world.mapChoice = choice.map;
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
