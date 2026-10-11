import { TILE } from "../data/config.js";
import { createLanMap } from "../gameplay/lan-map.js";
import { SPRITE_SOURCES, GHOST_ATLAS_SOURCES } from "../data/assets.js";
import { GHOSTS } from "../data/ghosts.js";
import { PlayerAnimation } from "../rendering/PlayerAnimation.js";
import {
  buildWallLayer,
  drawPellets,
  drawLifePellet,
  drawGhostEffects,
  drawGhost,
  drawAbilities,
  drawPlayer,
} from "../rendering/ArcadeDrawing.js";
import { TRANSLATIONS } from "../i18n/messages.js";
import { mapStyle } from "../gameplay/map-generation.js";

// Ağdan gelen 20 Hz snapshot'lar 90 ms gecikmeli çizim tamponunda karışır.
// Puan/çarpışma aynı sunucu verisidir; interpolasyon yalnızca görünümü etkiler.
export class LanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.previewMap = createLanMap(1);
    this.width = 0;
    this.height = 0;
    this.ctx = canvas.getContext("2d");
    this.frames = [];
    this.animations = new Map();
    this.players = {};
    this.ghosts = {};
    this.particles = [];
    this.lastEvent = 0;
    this.lastFrame = 0;
    this.myId = null;
    this.spectatingId = null;
    this.zoom = window.innerWidth < 700 ? 2 : 1;
    this.language = "tr";
    this.wallKey = null;
    this.wallLayer = null;
    this.reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.configureCanvas(this.previewMap);
    for (const [key, source] of Object.entries(SPRITE_SOURCES)) {
      const image = new Image();
      image.src = source;
      this.players[key] = image;
    }
    GHOST_ATLAS_SOURCES.forEach((source, atlas) => {
      const image = new Image();
      image.onload = () => {
        for (const ghost of GHOSTS.filter((g) => g.atlas === atlas)) {
          const crop = document.createElement("canvas");
          crop.width = 120;
          crop.height = 160;
          crop
            .getContext("2d")
            .drawImage(
              image,
              (ghost.cell * image.naturalWidth) / 4,
              0,
              image.naturalWidth / 4,
              image.naturalHeight,
              0,
              0,
              120,
              160,
            );
          this.ghosts[ghost.id] = crop;
        }
      };
      image.src = source;
    });
    requestAnimationFrame(this.frame);
  }
  configureCanvas(grid) {
    const width = grid[0].length * TILE,
      height = grid.length * TILE;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  // Yakın görünüm istemcide kalır; dünya koordinatları ve sunucu fiziği değişmez.
  camera(state) {
    const scale = this.zoom === 2 ? 2 : 1;
    const players = state?.players || [];
    const target =
      players.find((p) => p.id === this.myId && p.lives > 0) ||
      players.find(
        (p) => p.id === this.spectatingId && p.lives > 0 && p.connected,
      ) ||
      players.find((p) => p.lives > 0 && p.connected);
    const halfWidth = this.width / scale / 2,
      halfHeight = this.height / scale / 2;
    return {
      scale,
      x: Math.max(
        0,
        Math.min(
          this.width - halfWidth * 2,
          (target?.x ?? this.width / 2) - halfWidth,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          this.height - halfHeight * 2,
          (target?.y ?? this.height / 2) - halfHeight,
        ),
      ),
    };
  }
  accept(state) {
    const received = performance.now();
    if (
      this.frames.at(-1)?.state.level !== state.level ||
      this.frames.at(-1)?.state.state !== state.state
    ) {
      this.frames = [];
      this.animations.clear();
    }
    this.frames.push({ received, state });
    this.frames = this.frames
      .filter((frame) => received - frame.received < 1000)
      .slice(-24);
    for (const event of state.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (event.type === "ghost" && !this.reduced)
        for (let i = 0; i < 14; i++)
          this.particles.push({
            x: event.x,
            y: event.y,
            vx: Math.cos((i * Math.PI) / 7) * 65,
            vy: Math.sin((i * Math.PI) / 7) * 65,
            life: 0.6,
          });
    }
  }
  reset() {
    this.spectatingId = null;
    this.frames = [];
    this.animations.clear();
    this.particles = [];
    this.lastEvent = 0;
  }
  sample(now) {
    if (!this.frames.length) return null;
    const time = now - 90;
    let previous = this.frames[0],
      next = this.frames.at(-1);
    for (const frame of this.frames) {
      if (frame.received <= time) previous = frame;
      else {
        next = frame;
        break;
      }
    }
    const blend =
      previous === next
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (time - previous.received) / (next.received - previous.received),
            ),
          );
    const interpolate = (list, oldList) =>
      list.map((entity) => {
        const old = oldList.find((p) => p.id === entity.id);
        if (
          !old ||
          entity.respawning !== old.respawning ||
          Math.hypot(entity.x - old.x, entity.y - old.y) > TILE * 3
        )
          return entity;
        return {
          ...entity,
          x: old.x + (entity.x - old.x) * blend,
          y: old.y + (entity.y - old.y) * blend,
          ...(entity.jumpVisual && old.jumpVisual
            ? {
                jumpVisual: {
                  ...entity.jumpVisual,
                  elapsed:
                    old.jumpVisual.elapsed +
                    (entity.jumpVisual.elapsed - old.jumpVisual.elapsed) *
                      blend,
                },
              }
            : {}),
        };
      });
    return {
      ...next.state,
      gameTime:
        previous.state.gameTime +
        (next.state.gameTime - previous.state.gameTime) * blend,
      players: interpolate(next.state.players, previous.state.players),
      ghosts: interpolate(next.state.ghosts, previous.state.ghosts),
    };
  }
  frame = (now) => {
    const dt = Math.min(
      0.05,
      this.lastFrame ? (now - this.lastFrame) / 1000 : 0,
    );
    this.lastFrame = now;
    const state = this.sample(now);
    this.draw(state, dt, now / 1000);
    requestAnimationFrame(this.frame);
  };
  draw(state, dt, time) {
    const c = this.ctx,
      grid = state?.map || this.previewMap,
      style = mapStyle(state?.level || 1);
    this.configureCanvas(grid);
    const width = this.width,
      height = this.height,
      center = {
        col: Math.floor(grid[0].length / 2),
        row: Math.floor(grid.length / 2),
      };
    c.clearRect(0, 0, width, height);
    c.fillStyle = "#070914";
    c.fillRect(0, 0, width, height);
    const camera = this.camera(state);
    c.save();
    if (camera.scale !== 1) {
      c.scale(camera.scale, camera.scale);
      c.translate(-camera.x, -camera.y);
    }
    // Yem yenirken duvar önbelleği bozulmaz; yalnızca geometri veya palet değişirse kurulur.
    const wallKey =
      `${style.color}:${style.glow}:` +
      grid
        .map((row) => row.map((cell) => (cell === 1 ? "1" : "0")).join(""))
        .join("");
    if (wallKey !== this.wallKey) {
      this.wallLayer = buildWallLayer(grid, style);
      this.wallKey = wallKey;
    }
    c.drawImage(this.wallLayer, 0, 0, width, height);
    const clock = this.reduced ? 0 : time;
    drawPellets(c, grid, clock);
    if (!state) {
      c.restore();
      return;
    }
    const gameTime = this.reduced ? 0 : state.gameTime,
      labels = TRANSLATIONS[this.language] || TRANSLATIONS.tr;
    c.fillStyle = "#69617f";
    c.font = "6px ui-monospace,monospace";
    c.textAlign = "center";
    if (state.phase === "maze")
      c.fillText(
        labels.ghostHQ,
        (center.col + 0.5) * TILE,
        (center.row - 0.4) * TILE,
      );
    if (grid[center.row][center.col] === 4) {
      const recipient =
        state.players.find((p) => p.id === this.myId) || state.players[0];
      drawLifePellet(
        c,
        clock,
        labels.lifeCanvas,
        recipient?.lives < 3 ? labels.lifeReward : labels.pointsReward,
        center,
      );
    }
    for (const player of state.players) {
      if (player.lives <= 0 || player.respawning || !player.connected) continue;
      drawAbilities(
        c,
        player,
        player.dir,
        { ...player, jump: player.jumpVisual },
        gameTime,
      );
    }
    for (const ghost of state.ghosts) {
      drawGhostEffects(
        c,
        ghost,
        ghost,
        gameTime,
        ghost.skillsEnabled,
        ghost.skillPhase,
        ghost.sprinting,
        ghost.hop,
      );
      const blink =
        ghost.frightened &&
        !this.reduced &&
        state.powerRemaining < 3 &&
        Math.floor(gameTime * 5) % 2 === 0;
      drawGhost(
        c,
        ghost,
        ghost,
        this.ghosts[ghost.id],
        gameTime,
        ghost.frightened,
        blink,
        ghost.respawning,
      );
    }
    for (const player of state.players) {
      if (player.lives <= 0) continue;
      let animation = this.animations.get(player.id);
      if (!animation) {
        animation = new PlayerAnimation();
        this.animations.set(player.id, animation);
      }
      if (
        state.state === "playing" &&
        player.connected &&
        this.networkConnected
      )
        animation.update(dt, player, player, player.jumping);
      const alpha =
        !player.connected || player.respawning
          ? 0.35
          : player.invulnerable &&
              (this.reduced || Math.floor(gameTime * 8) % 2 === 0)
            ? 0.45
            : 1;
      drawPlayer(
        c,
        player,
        animation.pose(this.reduced),
        this.players[player.skin],
        player.dir,
        player.jumpVisual,
        alpha,
      );
      c.save();
      c.translate(player.x, player.y);
      c.globalAlpha = alpha;
      c.strokeStyle = player.color;
      c.lineWidth =
        player.id === this.myId || player.id === this.spectatingId ? 2.3 : 1.2;
      c.beginPath();
      c.arc(0, 0, 17, 0, Math.PI * 2);
      c.stroke();
      c.font = "bold 8px system-ui";
      c.textAlign = "center";
      c.fillStyle = player.color;
      c.fillText(player.name, 0, -22);
      c.restore();
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    c.fillStyle = "#ffe15b";
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      c.globalAlpha = Math.max(0, p.life / 0.6);
      c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    c.globalAlpha = 1;
    c.restore();
  }
}
