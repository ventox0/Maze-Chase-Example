import { GameComponent } from "../core/GameComponent.js";
import { SHOP_ITEMS } from "../data/shop.js";

// Bölüm skorundan bağımsız kalıcı cüzdan, envanter ve puan geçmişi.
export class PointWallet extends GameComponent {
  constructor(game) {
    super(game);
    this.key = "maze-chaser-wallet-v1";
    this.profile = this.empty();
    this.storageUnavailable = false;
  }
  empty() {
    return {
      version: 1,
      totalEarned: 0,
      balance: 0,
      owned: [],
      equipped: { outfit: null, head: null },
      runs: {},
    };
  }
  integer(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }
  validRunId(id) {
    return (
      typeof id === "string" &&
      /^(?:run-[a-zA-Z0-9-]{6,72}|legacy-[0-9]{1,16})$/.test(id)
    );
  }
  newRunId() {
    return (
      "run-" +
      (window.crypto?.randomUUID?.() ||
        Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2) +
          "-" +
          Math.random().toString(36).slice(2))
    );
  }
  validate(p) {
    try {
      if (
        !p ||
        p.version !== 1 ||
        !this.integer(p.totalEarned) ||
        !this.integer(p.balance) ||
        !Array.isArray(p.owned) ||
        p.owned.length > SHOP_ITEMS.length ||
        new Set(p.owned).size !== p.owned.length
      )
        return false;
      if (p.owned.some((id) => !SHOP_ITEMS.some((item) => item.id === id)))
        return false;
      const spent = p.owned.reduce(
        (sum, id) => sum + SHOP_ITEMS.find((item) => item.id === id).price,
        0,
      );
      if (p.totalEarned !== p.balance + spent || !p.equipped) return false;
      for (const slot of ["outfit", "head"])
        if (
          p.equipped[slot] !== null &&
          (!p.owned.includes(p.equipped[slot]) ||
            !SHOP_ITEMS.some(
              (item) => item.id === p.equipped[slot] && item.category === slot,
            ))
        )
          return false;
      if (
        SHOP_ITEMS.find((item) => item.id === p.equipped.outfit)?.exclusive &&
        p.equipped.head !== null
      )
        return false;
      if (
        !p.runs ||
        typeof p.runs !== "object" ||
        Array.isArray(p.runs) ||
        Object.keys(p.runs).length > 132
      )
        return false;
      return Object.entries(p.runs).every(
        ([id, score]) => this.validRunId(id) && this.integer(score),
      );
    } catch (_) {
      return false;
    }
  }
  clone() {
    return JSON.parse(JSON.stringify(this.profile));
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key),
        p = raw && raw.length < 64000 ? JSON.parse(raw) : null;
      this.profile = this.validate(p) ? p : this.empty();
    } catch (_) {
      this.profile = this.empty();
      this.storageUnavailable = true;
    }
  }
  refresh() {
    if (this.storageUnavailable) return;
    try {
      const raw = localStorage.getItem(this.key),
        p = raw && raw.length < 64000 ? JSON.parse(raw) : null;
      if (this.validate(p)) this.profile = p;
    } catch (_) {}
  }
  persist(next, strict = false) {
    if (!this.validate(next)) return false;
    try {
      localStorage.setItem(this.key, JSON.stringify(next));
      this.storageUnavailable = false;
    } catch (_) {
      this.storageUnavailable = true;
      if (strict) {
        this.game.shop.feedback("shop.storageError");
        return false;
      }
    }
    this.profile = next;
    return true;
  }
  prune(profile) {
    const protectedIds = new Set([
      this.game.runId,
      ...Object.values(this.game.saves.slots).map((record) =>
        record?.data ? record.data.runId || "legacy-" + record.savedAt : null,
      ),
    ]);
    for (const id of Object.keys(profile.runs)) {
      if (Object.keys(profile.runs).length <= 128) break;
      if (!protectedIds.has(id)) delete profile.runs[id];
    }
  }
  // Eski kaydı tekrar oynamak cüzdana aynı puanları ikinci kez yazmaz.
  remember(runId, score) {
    this.refresh();
    const next = this.clone();
    next.runs[runId] = Math.max(next.runs[runId] || 0, score);
    this.prune(next);
    this.persist(next);
  }
  credit(points) {
    if (!Number.isSafeInteger(points) || points <= 0) return;
    this.refresh();
    const next = this.clone(),
      id = this.game.runId,
      seen = next.runs[id] || 0;
    const amount = Math.min(points, Math.max(0, this.game.score - seen));
    next.runs[id] = Math.max(seen, this.game.score);
    if (
      !this.integer(next.totalEarned + amount) ||
      !this.integer(next.balance + amount)
    )
      return;
    next.totalEarned += amount;
    next.balance += amount;
    this.prune(next);
    this.persist(next);
  }
}
