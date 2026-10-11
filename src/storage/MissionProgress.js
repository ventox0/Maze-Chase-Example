import { GameComponent } from "../core/GameComponent.js";
import {
  MISSIONS,
  MISSION_BY_ID,
  MISSION_METRICS,
  MISSION_COUNTERS,
  MISSION_STORAGE_KEY,
} from "../data/missions.js";

// Toplam istatistikler ve koşu başına sayaç eşikleri kayıt tekrarlarını ayırır.
export class MissionProgress extends GameComponent {
  constructor(game) {
    super(game);
    this.key = MISSION_STORAGE_KEY;
    this.profile = this.empty();
    this.cursor = this.emptyCounters();
    this.cursorRun = null;
    this.legacyFence = null;
    this.storageUnavailable = false;
    this.revision = 0;
  }
  emptyCounters() {
    return Object.fromEntries(MISSION_COUNTERS.map((key) => [key, 0]));
  }
  empty() {
    return {
      version: 1,
      stats: Object.fromEntries(MISSION_METRICS.map((key) => [key, 0])),
      runs: {},
    };
  }
  validNumber(value) {
    return Number.isSafeInteger(value) && value >= 0 && value <= 1e12;
  }
  validCursor(cursor) {
    return (
      !!cursor &&
      typeof cursor === "object" &&
      !Array.isArray(cursor) &&
      Object.keys(cursor).every((k) => MISSION_COUNTERS.includes(k)) &&
      MISSION_COUNTERS.every((k) => this.validNumber(cursor[k]))
    );
  }
  valid(source) {
    return (
      !!source &&
      source.version === 1 &&
      !!source.stats &&
      MISSION_METRICS.every((k) => this.validNumber(source.stats[k])) &&
      !!source.runs &&
      typeof source.runs === "object" &&
      !Array.isArray(source.runs) &&
      Object.keys(source.runs).length <= 132 &&
      Object.entries(source.runs).every(
        ([id, c]) => this.game.wallet.validRunId(id) && this.validCursor(c),
      )
    );
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      const source = raw && raw.length < 128000 ? JSON.parse(raw) : null;
      this.profile = this.valid(source) ? source : this.empty();
    } catch (_) {
      this.storageUnavailable = true;
    }
    this.profile.stats.bestRunScore = Math.max(
      this.profile.stats.bestRunScore,
      this.game.highScore,
      this.game.challenges.best,
    );
    this.revision++;
  }
  refresh() {
    if (this.storageUnavailable) return;
    try {
      const raw = localStorage.getItem(this.key);
      const source = raw && raw.length < 128000 ? JSON.parse(raw) : null;
      if (this.valid(source)) {
        source.stats.bestRunScore = Math.max(
          source.stats.bestRunScore,
          this.profile.stats.bestRunScore,
          this.game.highScore,
          this.game.challenges.best,
        );
        this.profile = source;
        this.revision++;
      }
    } catch (_) {
      this.storageUnavailable = true;
    }
  }
  persist() {
    const protectedIds = new Set([
      this.game.runId,
      ...Object.values(this.game.saves.slots).map(
        (r) => r?.data?.runId || (r ? "legacy-" + r.savedAt : null),
      ),
    ]);
    for (const id of Object.keys(this.profile.runs)) {
      if (Object.keys(this.profile.runs).length <= 128) break;
      if (!protectedIds.has(id)) delete this.profile.runs[id];
    }
    try {
      localStorage.setItem(this.key, JSON.stringify(this.profile));
      this.storageUnavailable = false;
    } catch (_) {
      this.storageUnavailable = true;
    }
    this.revision++;
  }
  beginRun(cursor = null, legacyFence = null) {
    this.refresh();
    this.cursorRun = this.game.runId;
    this.cursor = cursor
      ? { ...cursor }
      : legacyFence !== null
        ? { ...(this.profile.runs[this.game.runId] || this.emptyCounters()) }
        : this.emptyCounters();
    this.legacyFence = legacyFence;
  }
  record(metric, amount = 1) {
    if (
      !MISSION_COUNTERS.includes(metric) ||
      !this.validNumber(amount) ||
      amount === 0
    )
      return;
    if (this.cursorRun !== this.game.runId) this.beginRun();
    // Eski kayıtların sayaç bilgisi yoktur: yalnızca eski skor eşiğinin sonrasını say.
    if (this.legacyFence !== null && this.game.score <= this.legacyFence)
      return;
    this.refresh();
    const previous = this.profile.runs[this.game.runId] || this.emptyCounters();
    const count = this.cursor[metric] + amount;
    const delta = Math.max(0, count - previous[metric]);
    if (
      !this.validNumber(count) ||
      !this.validNumber(this.profile.stats[metric] + delta)
    )
      return;
    this.cursor[metric] = count;
    previous[metric] = Math.max(previous[metric], count);
    this.profile.runs[this.game.runId] = previous;
    this.profile.stats[metric] += delta;
    this.persist();
  }
  observeScore() {
    if (this.game.score <= this.profile.stats.bestRunScore) return;
    this.refresh();
    this.profile.stats.bestRunScore = Math.max(
      this.profile.stats.bestRunScore,
      this.game.score,
    );
    this.persist();
  }
  earnedPoints() {
    const rewards = (this.game.wallet.profile.missionRewards || []).reduce(
      (total, id) => total + MISSION_BY_ID.get(id).reward,
      0,
    );
    return Math.max(0, this.game.wallet.profile.totalEarned - rewards);
  }
  value(mission) {
    return mission.metric === "earned"
      ? this.earnedPoints()
      : this.profile.stats[mission.metric];
  }
  claimed(mission) {
    return (this.game.wallet.profile.missionRewards || []).includes(mission.id);
  }
  complete(mission) {
    return this.value(mission) >= mission.target;
  }
  status(mission) {
    return this.claimed(mission)
      ? "claimed"
      : this.complete(mission)
        ? "ready"
        : "active";
  }
  summary() {
    return {
      complete: MISSIONS.filter((m) => this.complete(m) || this.claimed(m))
        .length,
      ready: MISSIONS.filter((m) => this.status(m) === "ready").length,
      claimed: (this.game.wallet.profile.missionRewards || []).length,
    };
  }
  claim(id) {
    this.game.wallet.refresh();
    this.refresh();
    const mission = MISSION_BY_ID.get(id);
    if (!mission || !this.complete(mission) || this.claimed(mission))
      return false;
    return this.game.wallet.claimMission(id);
  }
}
