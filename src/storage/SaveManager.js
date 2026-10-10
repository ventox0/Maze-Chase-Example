import { $, canvas, loadoutDialog, motionPreference } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { GridActor } from "../core/GridActor.js";
import { ABILITIES, JUMP_DURATION } from "../data/abilities.js";
import {
  COLS,
  DIRS,
  HEIGHT,
  LIFE_PELLET,
  MAX_GHOSTS,
  MAX_LEVEL,
  ROWS,
  TILE,
  WIDTH,
} from "../data/config.js";
import { GHOSTS } from "../data/ghosts.js";

// Kayıtlar yalnızca bu tarayıcıda tutulur. İki yuva birbirini ezmez.
export class SaveManager extends GameComponent {
  constructor(game) {
    super(game);
    this.slots = { manual: null, auto: null };
    this.autoEnabled = true;
    this.feedbackKey = "save.hint";
    this.feedbackValues = {};
    this.timerKeys = [
      "jumpReadyAt",
      "pendingJumpUntil",
      "magnetUntil",
      "magnetReadyAt",
      "boostUntil",
      "boostReadyAt",
      "shieldUntil",
      "shieldReadyAt",
    ];
    this.ghostKeys = [
      "id",
      "col",
      "row",
      "dir",
      "progress",
      "moving",
      "index",
      "releaseAt",
      "immuneUntil",
      "skillEpoch",
      "skillReadyAt",
      "wallPlan",
      "wallHop",
    ];
  }

  key(slot) {
    return "maze-chaser-save-v1-" + slot;
  }
  clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  number(value) {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value < Number.MAX_SAFE_INTEGER - 100
    );
  }
  validLevel(value) {
    return Number.isSafeInteger(value) && value >= 1 && value <= MAX_LEVEL;
  }

  load() {
    for (const slot of ["manual", "auto"]) {
      try {
        const raw = localStorage.getItem(this.key(slot));
        const record = raw && raw.length < 128000 ? JSON.parse(raw) : null;
        this.slots[slot] = this.validate(record) ? record : null;
      } catch (_) {
        this.slots[slot] = null;
      }
    }
    try {
      this.autoEnabled =
        localStorage.getItem("maze-chaser-autosave") !== "false";
    } catch (_) {}
  }

  setAuto(enabled) {
    this.autoEnabled = Boolean(enabled);
    try {
      localStorage.setItem("maze-chaser-autosave", String(this.autoEnabled));
    } catch (_) {
      this.feedback("save.error");
    }
    this.renderFeedback();
    this.game.levels.renderMenu();
  }

  latest() {
    return (
      Object.entries(this.slots)
        .filter(([, record]) => this.validate(record))
        .sort((a, b) => b[1].savedAt - a[1].savedAt)[0]?.[0] || null
    );
  }

  canSave() {
    return (
      ["playing", "paused", "cutscene", "victory"].includes(this.game.state) &&
      !loadoutDialog.open &&
      !this.game.levels.dialog.open &&
      !this.game.shop.dialog.open
    );
  }

  // Can yemi ödülünden sonra oluşturulan checkpoint, sıradaki temiz bölümü saklar.
  capture(nextLevel = null) {
    const game = this.game,
      fresh = nextLevel !== null,
      level = fresh ? nextLevel : game.level;
    const abilities = {
      loadout: { ...game.abilities.loadout },
      jump: fresh ? null : game.abilities.jump,
    };
    for (const key of this.timerKeys)
      abilities[key] = fresh ? 0 : game.abilities[key];
    const ghosts = fresh
      ? game.ghosts.levelGhosts(level).map((g, index) => {
          const releaseAt = 0.6 + index * 1.1;
          return {
            id: g.id,
            ...new GridActor(9 + index, 9, index === 1 ? "up" : "left"),
            index,
            releaseAt,
            immuneUntil: 0,
            skillEpoch: releaseAt,
            skillReadyAt: releaseAt + 5,
            wallPlan: null,
            wallHop: null,
          };
        })
      : game.ghosts.entities.map((ghost) =>
          Object.fromEntries(this.ghostKeys.map((key) => [key, ghost[key]])),
        );
    return this.clone({
      version: 1,
      kind: fresh
        ? "checkpoint"
        : game.maze.phase === "complete"
          ? "completion"
          : "session",
      savedAt: Date.now(),
      data: {
        level,
        score: game.score,
        lives: game.lives,
        newRecord: game.newRecord,
        runId: game.runId,
        gameTime: fresh ? 0 : game.gameTime,
        powerUntil: fresh ? 0 : game.powerUntil,
        invulnerableUntil: fresh ? 2 : game.invulnerableUntil,
        map: fresh ? game.maze.createLevelMap(level) : game.maze.grid,
        phase: fresh ? "maze" : game.maze.phase,
        player: fresh
          ? { ...new GridActor(10, 17), next: "left" }
          : game.player.entity,
        ghosts,
        abilities,
        cutscene: fresh ? null : game.cutscenes.current,
        actionSequence: game.cutscenes.sequence,
      },
    });
  }

  point(point) {
    return (
      point &&
      this.number(point.x) &&
      this.number(point.y) &&
      point.x <= WIDTH &&
      point.y <= HEIGHT
    );
  }
  road(grid, col, row) {
    return (
      Number.isInteger(col) &&
      Number.isInteger(row) &&
      col >= 0 &&
      col < COLS &&
      row >= 0 &&
      row < ROWS &&
      grid[row][col] !== 1
    );
  }
  actorValid(actor, grid) {
    if (
      !actor ||
      !this.road(grid, actor.col, actor.row) ||
      !Object.hasOwn(DIRS, actor.dir) ||
      !this.number(actor.progress) ||
      actor.progress >= TILE ||
      typeof actor.moving !== "boolean"
    )
      return false;
    const dir = DIRS[actor.dir];
    return (
      !actor.progress || this.road(grid, actor.col + dir.x, actor.row + dir.y)
    );
  }
  leapValid(leap, grid, duration = null) {
    if (leap === null) return true;
    if (
      !leap ||
      !this.road(grid, leap.col, leap.row) ||
      !Object.hasOwn(DIRS, leap.dir) ||
      !this.point(leap.from) ||
      !this.point(leap.to)
    )
      return false;
    if (
      leap.to.x !== (leap.col + 0.5) * TILE ||
      leap.to.y !== (leap.row + 0.5) * TILE
    )
      return false;
    return duration === null
      ? this.number(leap.startsAt)
      : this.number(leap.elapsed) && leap.elapsed <= duration;
  }

  // Sürüm, ızgara ve aktörler doğrulanır; bozuk/eski kayıt oyunun açılışını bozmaz.
  validate(record) {
    try {
      if (
        !record ||
        record.version !== 1 ||
        !["session", "checkpoint", "completion"].includes(record.kind) ||
        !Number.isInteger(record.savedAt) ||
        !this.number(record.savedAt) ||
        record.savedAt > 8640000000000000
      )
        return false;
      const d = record.data;
      if (d?.runId !== undefined && !this.game.wallet.validRunId(d.runId))
        return false;
      if (
        !d ||
        !this.validLevel(d.level) ||
        !Number.isSafeInteger(d.score) ||
        d.score < 0 ||
        !Number.isInteger(d.lives) ||
        d.lives < 1 ||
        d.lives > 3 ||
        typeof d.newRecord !== "boolean"
      )
        return false;
      if (
        !["maze", "bonus", "complete"].includes(d.phase) ||
        !this.number(d.gameTime) ||
        !this.number(d.powerUntil) ||
        !this.number(d.invulnerableUntil) ||
        !Number.isSafeInteger(d.actionSequence) ||
        d.actionSequence < 0
      )
        return false;
      if (
        !Array.isArray(d.map) ||
        d.map.length !== ROWS ||
        !d.map.every((row) => Array.isArray(row) && row.length === COLS)
      )
        return false;
      const original = this.game.maze.createLevelMap(d.level);
      let foods = 0,
        life = 0;
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const cell = d.map[y][x],
            base = original[y][x];
          if (!Number.isInteger(cell) || cell < 0 || cell > 4) return false;
          if (cell === 4) {
            if (
              d.phase !== "bonus" ||
              x !== LIFE_PELLET.col ||
              y !== LIFE_PELLET.row
            )
              return false;
            life++;
          } else if (
            base === 1
              ? cell !== 1
              : base === 0
                ? cell !== 0
                : cell !== 0 && cell !== base
          )
            return false;
          if (cell === 2 || cell === 3) foods++;
        }
      if (d.phase === "complete") {
        if (
          record.kind !== "completion" ||
          d.level !== MAX_LEVEL ||
          foods !== 0 ||
          life !== 0
        )
          return false;
      } else if (
        record.kind === "completion" ||
        (d.phase === "bonus"
          ? foods !== 0 || life !== 1
          : life !== 0 || foods === 0)
      )
        return false;
      if (
        !this.actorValid(d.player, d.map) ||
        !Object.hasOwn(DIRS, d.player.next)
      )
        return false;
      const abilities = d.abilities;
      if (
        !abilities ||
        !abilities.loadout ||
        !Object.hasOwn(ABILITIES, abilities.loadout.q) ||
        !Object.hasOwn(ABILITIES, abilities.loadout.e) ||
        abilities.loadout.q === abilities.loadout.e
      )
        return false;
      if (
        this.timerKeys.some((key) => !this.number(abilities[key])) ||
        !this.leapValid(abilities.jump, d.map, JUMP_DURATION)
      )
        return false;
      const roster =
        d.phase === "maze" ? this.game.ghosts.levelGhosts(d.level) : [];
      if (
        !Array.isArray(d.ghosts) ||
        d.ghosts.length !== roster.length ||
        new Set(d.ghosts.map((g) => g.id)).size !== roster.length
      )
        return false;
      for (const ghost of d.ghosts) {
        if (
          !roster.some((g) => g.id === ghost.id) ||
          !this.actorValid(ghost, d.map) ||
          !Number.isInteger(ghost.index) ||
          ghost.index < 0 ||
          ghost.index >= MAX_GHOSTS
        )
          return false;
        if (
          ["releaseAt", "immuneUntil", "skillEpoch", "skillReadyAt"].some(
            (key) => !this.number(ghost[key]),
          )
        )
          return false;
        if (
          !this.leapValid(ghost.wallPlan, d.map) ||
          !this.leapValid(ghost.wallHop, d.map, 0.5)
        )
          return false;
      }
      if (d.cutscene !== null) {
        const c = d.cutscene,
          kinds = ["punch", "uppercut", "hook"];
        if (
          !c ||
          d.phase !== "maze" ||
          !GHOSTS.some((g) => g.id === c.ghost?.id) ||
          kinds[c.index] !== c.kind ||
          !Number.isInteger(c.index)
        )
          return false;
        if (
          ![0.65, 1.3].includes(c.duration) ||
          !this.number(c.elapsed) ||
          c.elapsed > c.duration ||
          typeof c.reduced !== "boolean" ||
          typeof c.impactPlayed !== "boolean"
        )
          return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  write(slot, record) {
    if (!["manual", "auto"].includes(slot) || !this.validate(record)) {
      this.feedback("save.invalid");
      return false;
    }
    try {
      localStorage.setItem(this.key(slot), JSON.stringify(record));
    } catch (_) {
      this.feedback("save.error");
      return false;
    }
    this.slots[slot] = record;
    this.feedback(slot === "auto" ? "save.autoDone" : "save.manualDone", {
      level: record.data.level,
    });
    this.game.ui.updateHUD();
    return true;
  }
  saveManual() {
    if (!this.canSave()) return false;
    return this.write(
      "manual",
      this.capture(
        this.game.state === "victory" && this.game.level < MAX_LEVEL
          ? this.game.level + 1
          : null,
      ),
    );
  }
  checkpoint() {
    if (
      this.autoEnabled &&
      this.game.level % 5 === 0 &&
      this.game.maze.phase === "complete"
    )
      this.write(
        "auto",
        this.capture(this.game.level < MAX_LEVEL ? this.game.level + 1 : null),
      );
  }

  resume(slot = this.latest()) {
    const record = this.slots[slot];
    if (!this.validate(record)) {
      this.feedback("save.invalid");
      return false;
    }
    const d = this.clone(record.data),
      game = this.game;
    loadoutDialog.close();
    game.levels.dialog.close();
    game.runId = d.runId || "legacy-" + record.savedAt;
    game.wallet.remember(game.runId, d.score);
    game.level = d.level;
    game.score = d.score;
    game.lives = d.lives;
    game.newRecord = d.newRecord;
    game.gameTime = d.gameTime;
    game.powerUntil = d.powerUntil;
    game.invulnerableUntil = d.invulnerableUntil;
    game.maze.grid = d.map;
    game.maze.phase = d.phase;
    game.maze.bonusReward = "";
    game.maze.bonusRewardKey = "";
    game.maze.pellets = d.map
      .flat()
      .filter((cell) => cell === 2 || cell === 3).length;
    game.player.entity = {
      ...new GridActor(d.player.col, d.player.row, d.player.dir),
      progress: d.player.progress,
      moving: d.player.moving,
      next: d.player.next,
    };
    game.ghosts.entities = d.ghosts.map((saved) => {
      const ghost = { ...GHOSTS.find((g) => g.id === saved.id) };
      for (const key of this.ghostKeys) ghost[key] = saved[key];
      return ghost;
    });
    game.abilities.loadout = { ...d.abilities.loadout };
    game.abilities.draftLoadout = { ...game.abilities.loadout };
    for (const key of this.timerKeys) game.abilities[key] = d.abilities[key];
    game.abilities.jump = d.abilities.jump;
    game.abilities.pelletTrails = [];
    game.cutscenes.current = d.cutscene;
    game.cutscenes.sequence = d.actionSequence;
    if (d.cutscene) {
      const definition = GHOSTS.find((g) => g.id === d.cutscene.ghost.id);
      d.cutscene.ghost = {
        id: definition.id,
        name: definition.name,
        color: definition.color,
      };
      if (motionPreference?.matches && !d.cutscene.reduced) {
        d.cutscene.elapsed = (d.cutscene.elapsed / d.cutscene.duration) * 0.65;
        d.cutscene.duration = 0.65;
        d.cutscene.reduced = true;
      }
    }
    game.effects.particles = [];
    game.effects.floatingTexts = [];
    game.lastFrame = 0;
    game.accumulator = 0;
    game.levels.selected = d.level;
    game.ui.lastHud = "";
    game.ui.lastPlayerSkin = "";
    game.ui.ghostHudKey = "";
    game.maze.buildWalls();
    game.addScore(0);
    game.changeState(
      d.phase === "complete" ? "victory" : d.cutscene ? "cutscene" : "playing",
      false,
    );
    game.audio.resumeAudio();
    canvas.focus({ preventScroll: true });
    this.feedback("save.loaded", { level: d.level });
    return true;
  }

  feedback(key, values = {}) {
    this.feedbackKey = key;
    this.feedbackValues = values;
    this.renderFeedback();
  }
  renderFeedback() {
    const key =
      this.feedbackKey === "save.hint" && !this.autoEnabled
        ? "save.manualHint"
        : this.feedbackKey;
    $("save-feedback").textContent = this.game.i18n.t(key, this.feedbackValues);
    $("save-feedback").classList.toggle(
      "save-error",
      ["save.error", "save.invalid"].includes(this.feedbackKey),
    );
  }
}
