import { randomUUID } from "node:crypto";
import { randomPowerSeed } from "../src/gameplay/power-pellets.js";
import { MovementSystem } from "../src/gameplay/MovementSystem.js";
import { GhostManager } from "../src/gameplay/GhostManager.js";
import { createLanMap, lanGhosts } from "../src/gameplay/lan-map.js";
import {
  LAN_COLS as COLS,
  LAN_ROWS as ROWS,
  LAN_LIFE_PELLET as LIFE_PELLET,
  LAN_SPAWNS as SPAWNS,
  LAN_REWARD_PERCENT,
} from "../src/data/lan.js";
import {
  TILE,
  DIRS,
  OPPOSITE,
  MAX_LEVEL,
  POWER_DURATION,
  GHOST_RESPAWN_DELAY,
} from "../src/data/config.js";
import {
  ABILITIES,
  JUMP_DURATION,
  MAGNET_RADIUS,
  BOOST_MULTIPLIER,
} from "../src/data/abilities.js";

export const PLAYER_COLORS = ["#ffe15b", "#53dbed", "#f3a0da", "#91eb89"];
export function validLoadout(value) {
  return (
    value &&
    ["q", "e"].every((k) => Object.hasOwn(ABILITIES, value[k])) &&
    value.q !== value.e
  );
}
const abilityState = () => ({
  jump: null,
  pendingJumpUntil: 0,
  jumpReadyAt: 0,
  magnetUntil: 0,
  magnetReadyAt: 0,
  boostUntil: 0,
  boostReadyAt: 0,
  shieldUntil: 0,
  shieldReadyAt: 0,
});

// Yetkili simülasyon yalnızca sunucuda çalışır. İstemci skor veya konum göndermez.
// Izgara hareketi, harita üretimi ve sekiz hayaletin AI'ı tek oyunculu oyunla ortaktır.
export class LanWorld {
  constructor(mode = "coop") {
    this.mode = mode;
    this.matchId = randomUUID();
    this.matchStartedAt = Date.now();
    this.players = new Map();
    this.level = 1;
    this.state = "lobby";
    this.gameTime = 0;
    this.stateTime = 0;
    this.powerUntil = 0;
    this.teamScore = 0;
    this.roundTime = 0;
    this.winners = [];
    this.reason = "";
    this.events = [];
    this.eventId = 0;
    this.mapRevision = 0;
    this.maze = {
      grid: createLanMap(1),
      phase: "maze",
      walkable: (col, row) =>
        row >= 0 &&
        row < ROWS &&
        col >= 0 &&
        col < COLS &&
        this.maze.grid[row][col] !== 1,
    };
    this.player = { entity: null };
    this.abilities = abilityState();
    this.challenges = { active: false };
    this.effects = { burst() {} };
    this.movement = new MovementSystem(this);
    this.ghosts = new GhostManager(this);
    this.pellets = this.maze.grid
      .flat()
      .filter((cell) => cell === 2 || cell === 3).length;
  }
  addPlayer(id, name, slot, loadout = { q: "jump", e: "magnet" }) {
    const p = {
      id,
      name,
      slot,
      color: PLAYER_COLORS[slot],
      ready: false,
      connected: false,
      loadout: { ...loadout },
      score: 0,
      lives: 3,
      respawnUntil: 0,
      invulnerableUntil: 0,
      abilities: abilityState(),
      lastSeq: 0,
      walletRewards: [],
    };
    p.entity = {
      ...this.movement.actor(
        SPAWNS[slot].col,
        SPAWNS[slot].row,
        SPAWNS[slot].dir,
      ),
      next: SPAWNS[slot].dir,
    };
    this.players.set(id, p);
    return p;
  }
  start() {
    this.matchId = randomUUID();
    this.matchStartedAt = Date.now();
    this.level = 1;
    this.gameTime = 0;
    this.teamScore = 0;
    this.events = [];
    this.winners = [];
    this.reason = "";
    for (const p of this.players.values()) {
      p.score = 0;
      p.lives = 3;
    }
    this.loadRound();
  }
  loadRound() {
    this.maze.grid = createLanMap(this.level, randomPowerSeed());
    this.maze.phase = "maze";
    this.powerUntil = 0;
    this.roundTime = 0;
    for (const p of this.players.values()) {
      this.respawn(p, 0);
      const s = SPAWNS[p.slot];
      this.maze.grid[s.row][s.col] = 0;
    }
    this.pellets = this.maze.grid
      .flat()
      .filter((c) => c === 2 || c === 3).length;
    this.ghosts.entities = lanGhosts(this.level).map((g, index) => ({
      ...g,
      ...this.movement.actor(
        LIFE_PELLET.col - 1 + (index % 3),
        LIFE_PELLET.row - 2 + Math.floor(index / 3),
      ),
      index,
      releaseAt: this.gameTime + 3 + index,
      immuneUntil: 0,
      skillEpoch: this.gameTime + 3,
      skillReadyAt: this.gameTime + 8,
      wallPlan: null,
      wallHop: null,
    }));
    this.state = "countdown";
    this.stateTime = 0;
    this.mapRevision++;
  }
  respawn(p, delay = 1.3) {
    const spawn = SPAWNS[p.slot];
    p.entity = {
      ...this.movement.actor(spawn.col, spawn.row, spawn.dir),
      next: spawn.dir,
    };
    p.abilities = abilityState();
    p.respawnUntil = this.gameTime + delay;
    p.invulnerableUntil = p.respawnUntil + 2;
  }
  context(p) {
    this.player.entity = p.entity;
    this.abilities = p.abilities;
  }
  position(p) {
    this.context(p);
    return this.movement.position(p.entity);
  }
  activePlayers() {
    return [...this.players.values()].filter((p) => p.connected && p.lives > 0);
  }
  event(type, p, extra = {}) {
    this.events.push({ id: ++this.eventId, type, playerId: p?.id, ...extra });
    this.events = this.events.slice(-24);
  }
  credit(p, points) {
    p.score += points;
    this.teamScore += points;
  }
  direction(p, dir) {
    if (!Object.hasOwn(DIRS, dir)) return;
    p.entity.next = dir;
    if (
      this.state === "playing" &&
      !p.abilities.jump &&
      p.entity.progress > 0 &&
      dir === OPPOSITE[p.entity.dir]
    )
      this.movement.reverse(p.entity);
  }
  useAbility(p, slot) {
    if (
      this.state !== "playing" ||
      !p.connected ||
      p.lives <= 0 ||
      this.gameTime < p.respawnUntil ||
      !["q", "e"].includes(slot)
    )
      return false;
    const id = p.loadout[slot],
      a = p.abilities;
    if (this.gameTime < a[id + "ReadyAt"]) return false;
    if (id === "jump") {
      if (a.jump) return false;
      if (p.entity.progress > 1e-6) {
        a.pendingJumpUntil = this.gameTime + 0.65;
        return false;
      }
      return this.jump(p);
    }
    a[id + "Until"] = this.gameTime + ABILITIES[id].duration;
    a[id + "ReadyAt"] = this.gameTime + ABILITIES[id].cooldown;
    this.event("ability", p, { ability: id });
    return true;
  }
  jump(p) {
    const a = p.abilities;
    a.pendingJumpUntil = 0;
    if (a.jump || this.gameTime < a.jumpReadyAt) return false;
    const dir = p.entity.next,
      d = DIRS[dir];
    let col = p.entity.col + d.x,
      row = p.entity.row + d.y,
      walls = 0;
    while (
      row >= 0 &&
      row < ROWS &&
      col >= 0 &&
      col < COLS &&
      this.maze.grid[row][col] === 1 &&
      walls < 3
    ) {
      walls++;
      col += d.x;
      row += d.y;
    }
    if (!walls || !this.maze.walkable(col, row)) return false;
    a.jump = {
      from: this.position(p),
      to: { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE },
      col,
      row,
      dir,
      elapsed: 0,
    };
    p.entity.dir = dir;
    p.entity.moving = true;
    a.jumpReadyAt = this.gameTime + ABILITIES.jump.cooldown;
    this.event("ability", p, { ability: "jump" });
    return true;
  }
  collect(p, col, row) {
    const value = this.maze.grid[row][col];
    if (value === 4 && this.maze.phase === "bonus") {
      this.maze.grid[row][col] = 0;
      this.maze.phase = "complete";
      this.mapRevision++;
      const recipients =
        this.mode === "coop"
          ? [...this.players.values()].filter((member) => member.lives > 0)
          : [p];
      for (const member of recipients) {
        if (member.lives < 3) member.lives++;
        else this.credit(member, 500);
      }
      this.event("bonus", p);
      if (this.mode === "race" || this.level >= MAX_LEVEL)
        this.finish("pellets");
      else {
        this.state = "roundComplete";
        this.stateTime = 0;
        this.settleRewards();
      }
      return;
    }
    if (value !== 2 && value !== 3) return;
    this.maze.grid[row][col] = 0;
    this.pellets--;
    this.mapRevision++;
    this.credit(p, value === 3 ? 50 : 10);
    if (value === 3) {
      this.powerUntil = this.gameTime + POWER_DURATION;
      for (const g of this.ghosts.entities) {
        g.wallPlan = null;
        g.wallHop = null;
        if (this.gameTime >= g.releaseAt) this.movement.reverse(g);
      }
      this.event("power", p);
    }
    if (this.pellets === 0) {
      this.maze.phase = "bonus";
      this.ghosts.entities = [];
      this.powerUntil = 0;
      this.maze.grid[LIFE_PELLET.row][LIFE_PELLET.col] = 4;
      this.event("bonusReady", p);
    }
  }
  updatePlayer(p, dt) {
    this.context(p);
    const a = p.abilities;
    if (this.gameTime < p.respawnUntil) return;
    if (a.jump) {
      a.jump.elapsed += dt;
      if (a.jump.elapsed >= JUMP_DURATION) {
        const landing = a.jump;
        Object.assign(p.entity, {
          col: landing.col,
          row: landing.row,
          dir: landing.dir,
          progress: 0,
          moving: false,
        });
        a.jump = null;
        this.collect(p, landing.col, landing.row);
      }
    } else {
      this.collect(p, p.entity.col, p.entity.row);
      const speed =
        (4.65 + Math.min(this.level - 1, 8) * 0.12) *
        TILE *
        (this.gameTime < a.boostUntil ? BOOST_MULTIPLIER : 1) *
        (this.ghosts.playerSlowed() ? 0.8 : 1);
      this.movement.move(
        p.entity,
        speed * dt,
        () => {
          if (a.pendingJumpUntil > this.gameTime && this.jump(p)) return null;
          if (this.movement.canGo(p.entity, p.entity.next))
            p.entity.dir = p.entity.next;
          return this.movement.canGo(p.entity, p.entity.dir)
            ? p.entity.dir
            : null;
        },
        () => this.collect(p, p.entity.col, p.entity.row),
      );
    }
    if (this.gameTime < a.magnetUntil && this.state === "playing") {
      const position = this.position(p);
      for (
        let row = Math.max(0, p.entity.row - 3);
        row <= Math.min(ROWS - 1, p.entity.row + 3);
        row++
      )
        for (
          let col = Math.max(0, p.entity.col - 3);
          col <= Math.min(COLS - 1, p.entity.col + 3);
          col++
        )
          if (
            this.maze.grid[row][col] === 2 &&
            Math.hypot(
              (col + 0.5) * TILE - position.x,
              (row + 0.5) * TILE - position.y,
            ) <= MAGNET_RADIUS
          )
            this.collect(p, col, row);
    }
  }
  updateGhosts(dt, players) {
    for (const ghost of this.ghosts.entities) {
      if (this.gameTime < ghost.releaseAt) continue;
      const targets = players.filter((p) => this.gameTime >= p.respawnUntil);
      if (!targets.length) continue;
      const pos = this.movement.position(ghost);
      const target = targets.reduce((best, p) => {
        const a = this.position(p),
          b = this.position(best);
        return Math.hypot(pos.x - a.x, pos.y - a.y) <
          Math.hypot(pos.x - b.x, pos.y - b.y)
          ? p
          : best;
      });
      this.context(target);
      if (this.ghosts.updateGhostSkill(ghost, dt)) continue;
      this.movement.move(
        ghost,
        this.ghosts.ghostSpeed(ghost) * dt,
        this.ghosts.chooseGhostDirection,
      );
    }
  }
  collisions(players) {
    for (const p of players) {
      if (p.abilities.jump || this.gameTime < p.respawnUntil) continue;
      const pos = this.position(p);
      for (const ghost of this.ghosts.entities) {
        if (this.gameTime < ghost.releaseAt || ghost.wallHop) continue;
        const gpos = this.movement.position(ghost);
        if (Math.hypot(pos.x - gpos.x, pos.y - gpos.y) >= TILE * 0.7) continue;
        if (this.ghosts.ghostFrightened(ghost)) {
          this.credit(p, 200);
          this.event("ghost", p, { ghostId: ghost.id, x: gpos.x, y: gpos.y });
          Object.assign(ghost, {
            col: LIFE_PELLET.col,
            row: LIFE_PELLET.row - 2,
            dir: "up",
            progress: 0,
            moving: false,
            releaseAt: this.gameTime + GHOST_RESPAWN_DELAY,
            immuneUntil: this.gameTime + GHOST_RESPAWN_DELAY + 2,
            wallPlan: null,
            wallHop: null,
          });
        } else if (
          this.gameTime >= p.invulnerableUntil &&
          this.gameTime >= p.abilities.shieldUntil
        ) {
          p.lives--;
          this.event("hurt", p);
          this.respawn(p);
          break;
        }
      }
    }
  }
  settleRewards() {
    for (const p of this.players.values()) {
      // İş birliğinde HUD takım toplamını gösterir; herkes bu toplamın payını alır.
      // Yarışta HUD kişisel skoru gösterir. Kümülatif makbuz çift ödemeyi önler.
      const score = this.mode === "coop" ? this.teamScore : p.score;
      const points = Math.floor((score * LAN_REWARD_PERCENT) / 100);
      if (points <= 0) continue;
      const receipt = {
        id: `lan-${this.matchId}-${p.id}`,
        points,
        startedAt: this.matchStartedAt,
      };
      const index = p.walletRewards.findIndex((r) => r.id === receipt.id);
      if (index >= 0) p.walletRewards[index] = receipt;
      else p.walletRewards.push(receipt);
      p.walletRewards = p.walletRewards.slice(-16);
    }
  }
  finish(reason) {
    this.state = "finished";
    this.reason = reason;
    const players = [...this.players.values()],
      best = Math.max(0, ...players.map((p) => p.score));
    this.winners =
      this.mode === "race"
        ? players.filter((p) => p.score === best).map((p) => p.id)
        : players.filter((p) => p.lives > 0).map((p) => p.id);
    this.settleRewards();
    this.event("finished", null, { reason });
  }
  update(dt) {
    if (
      this.state === "playing" &&
      this.players.size &&
      ![...this.players.values()].some((p) => p.lives > 0)
    ) {
      this.finish("lives");
      return;
    }
    const active = this.activePlayers();
    if (!active.length) return;
    if (this.state === "countdown") {
      this.stateTime += dt;
      if (this.stateTime >= 3) {
        this.state = "playing";
        this.event("start", null);
      }
      return;
    }
    if (this.state !== "playing") return;
    this.gameTime += dt;
    this.roundTime += dt;
    for (const p of active) {
      if (this.state !== "playing") break;
      this.updatePlayer(p, dt);
    }
    if (this.state !== "playing") return;
    this.updateGhosts(dt, active);
    this.collisions(active);
    const survivors = [...this.players.values()].filter((p) => p.lives > 0);
    if (!survivors.length) this.finish("lives");
    else if (
      this.mode === "race" &&
      (survivors.length <= 1 || this.roundTime >= 180)
    )
      this.finish(this.roundTime >= 180 ? "time" : "lives");
  }
  snapshot() {
    return {
      mode: this.mode,
      cols: COLS,
      rows: ROWS,
      state: this.state,
      level: this.level,
      gameTime: this.gameTime,
      countdown: Math.max(0, 3 - this.stateTime),
      powerRemaining: Math.max(0, this.powerUntil - this.gameTime),
      timeRemaining: Math.max(0, 180 - this.roundTime),
      teamScore: this.teamScore,
      pellets: this.pellets,
      phase: this.maze.phase,
      map: this.maze.grid,
      mapRevision: this.mapRevision,
      winners: this.winners,
      reason: this.reason,
      events: this.events,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        slot: p.slot,
        ready: p.ready,
        connected: p.connected,
        loadout: p.loadout,
        score: p.score,
        lives: p.lives,
        dir: p.entity.dir,
        moving: p.entity.moving,
        ...this.position(p),
        respawning: this.gameTime < p.respawnUntil,
        invulnerable: this.gameTime < p.invulnerableUntil,
        skin:
          this.gameTime < p.abilities.shieldUntil
            ? "shield"
            : this.gameTime < this.powerUntil
              ? "power"
              : this.gameTime < p.abilities.magnetUntil
                ? "magnet"
                : this.gameTime < p.abilities.boostUntil
                  ? "boost"
                  : "normal",
        jumping: !!p.abilities.jump,
        // Yalnızca çizim verisi; çarpışma ve yetenek zamanlaması sunucuda kalır.
        jumpVisual: p.abilities.jump
          ? {
              from: p.abilities.jump.from,
              to: p.abilities.jump.to,
              elapsed: p.abilities.jump.elapsed,
            }
          : null,
        boost: this.gameTime < p.abilities.boostUntil,
        shield: this.gameTime < p.abilities.shieldUntil,
        magnet: this.gameTime < p.abilities.magnetUntil,
        cooldowns: Object.fromEntries(
          ["q", "e"].map((slot) => [
            slot,
            Math.max(
              0,
              p.abilities[p.loadout[slot] + "ReadyAt"] - this.gameTime,
            ),
          ]),
        ),
      })),
      ghosts: this.ghosts.entities.map((g) => ({
        id: g.id,
        index: g.index,
        color: g.color,
        dir: g.dir,
        ...this.movement.position(g),
        frightened: this.ghosts.ghostFrightened(g),
        respawning: this.gameTime < g.releaseAt,
        wallHop: !!g.wallHop,
        skillsEnabled: this.ghosts.ghostSkillsEnabled(g),
        skillPhase: this.ghosts.ghostCycle(g, g.id === "moss" ? 8 : 9),
        sprinting: this.ghosts.sprinting(g),
        hop:
          g.wallPlan || g.wallHop
            ? {
                from: (g.wallPlan || g.wallHop).from,
                to: (g.wallPlan || g.wallHop).to,
              }
            : null,
      })),
    };
  }
}
