import { readFile, mkdir, open, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { hashPassword, verifyPassword } from "./Password.js";
import { fail } from "./http.js";
import {
  PROFILE_KEYS,
  WALLET_KEY,
  MISSIONS_KEY,
} from "../src/data/account-profile.js";
import { PointWallet } from "../src/storage/PointWallet.js";
import { MissionProgress } from "../src/storage/MissionProgress.js";
import { SHOP_ITEMS } from "../src/data/shop.js";
import { purchasePrices } from "../src/data/purchasePrices.js";
import {
  grantMissionCosmetics,
  isMissionCosmetic,
} from "../src/data/cosmeticRewards.js";
import { MISSION_COUNTERS, MISSION_BY_ID } from "../src/data/missions.js";
const clone = (value) => JSON.parse(JSON.stringify(value));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const walletRules = new PointWallet({});
const missionRules = new MissionProgress({ wallet: walletRules });
const number = (n) => Number.isSafeInteger(n) && n >= 0;

// Tek sunucu süreci için dosya tabanlı atomik kayıt. Veriler statik dosya alanından ayrıdır.
export class AccountStore {
  constructor(directory) {
    this.directory = resolve(directory);
    this.auth = { version: 1, users: [] };
    this.profiles = new Map();
    this.queues = new Map();
    this.authQueue = Promise.resolve();
    this.ready = this.load();
  }
  async load() {
    await mkdir(join(this.directory, "profiles"), {
      recursive: true,
      mode: 0o700,
    });
    try {
      this.auth = JSON.parse(
        await readFile(join(this.directory, "accounts.json"), "utf8"),
      );
      if (this.auth.version !== 1 || !Array.isArray(this.auth.users))
        throw new Error("Invalid account database");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  async atomic(path, value) {
    const temporary = path + "." + randomUUID() + ".tmp";
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  }
  authTransaction(fn) {
    const result = this.authQueue.then(async () => {
      await this.ready;
      const next = clone(this.auth);
      const value = await fn(next);
      await this.atomic(join(this.directory, "accounts.json"), next);
      this.auth = next;
      return value;
    });
    this.authQueue = result.catch(() => {});
    return result;
  }
  username(value) {
    if (typeof value !== "string") throw fail(400, "accountFields");
    const name = value.normalize("NFKC").trim();
    if (!name || name.length > 24 || /[\u0000-\u001f\u007f]/.test(name))
      throw fail(400, "usernameInvalid");
    return name;
  }
  async register(username, password) {
    const name = this.username(username);
    if (typeof password !== "string" || !password)
      throw fail(400, "accountFields");
    await this.ready;
    if (this.auth.users.some((u) => u.canonical === name.toLowerCase()))
      throw fail(409, "usernameTaken");
    const secret = await hashPassword(password);
    return this.authTransaction(async (next) => {
      if (next.users.some((u) => u.canonical === name.toLowerCase()))
        throw fail(409, "usernameTaken");
      const user = {
        id: randomUUID(),
        username: name,
        canonical: name.toLowerCase(),
        ...secret,
        sessions: {},
        createdAt: Date.now(),
      };
      next.users.push(user);
      return { id: user.id, username: user.username };
    });
  }
  async login(username, password) {
    let name;
    try {
      name = this.username(username);
    } catch {
      throw fail(401, "loginInvalid");
    }
    if (typeof password !== "string") throw fail(401, "loginInvalid");
    await this.ready;
    const user = this.auth.users.find(
      (u) => u.canonical === name.toLowerCase(),
    );
    if (!(await verifyPassword(password, user)))
      throw fail(401, "loginInvalid");
    return { id: user.id, username: user.username };
  }
  async session(userId) {
    const token = randomBytes(32).toString("base64url"),
      expires = Date.now() + 30 * 86400000;
    await this.authTransaction((next) => {
      const user = next.users.find((u) => u.id === userId);
      user.sessions = Object.fromEntries(
        Object.entries(user.sessions)
          .filter(([, e]) => e > Date.now())
          .slice(-19),
      );
      user.sessions[digest(token)] = expires;
    });
    return token;
  }
  async identify(token) {
    if (!token) return null;
    await this.ready;
    const key = digest(token),
      user = this.auth.users.find((u) => (u.sessions[key] || 0) > Date.now());
    return user ? { id: user.id, username: user.username } : null;
  }
  async logout(token) {
    if (!token) return;
    await this.authTransaction((next) => {
      for (const u of next.users) delete u.sessions[digest(token)];
    });
  }
  async profile(id) {
    await this.ready;
    if (!this.profiles.has(id)) {
      let p;
      try {
        p = JSON.parse(
          await readFile(
            join(this.directory, "profiles", id + ".json"),
            "utf8",
          ),
        );
        if (p.version !== 1 || !number(p.revision) || !p.data)
          throw new Error("Invalid profile");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
        p = {
          version: 1,
          revision: 0,
          data: {},
          lanClaims: {},
          imported: false,
          updatedAt: 0,
        };
      }
      this.profiles.set(id, p);
    }
    return clone(this.profiles.get(id));
  }
  // Public reads wait for already queued writes, including automatic LAN awards.
  // Transactions use profile() directly to avoid waiting on their own queue.
  async readProfile(id) {
    await this.queues.get(id);
    return this.profile(id);
  }
  transaction(id, fn) {
    const result = (this.queues.get(id) || Promise.resolve()).then(async () => {
      const next = await this.profile(id),
        result = await fn(next);
      next.revision++;
      next.updatedAt = Date.now();
      await this.atomic(join(this.directory, "profiles", id + ".json"), next);
      this.profiles.set(id, next);
      return { profile: this.publicProfile(next), ...result };
    });
    this.queues.set(
      id,
      result.catch(() => {}),
    );
    return result;
  }
  publicProfile(p) {
    return {
      revision: p.revision,
      data: clone(p.data),
      updatedAt: p.updatedAt,
      canImport: !p.imported && !this.hasProgress(p),
    };
  }
  hasProgress(p) {
    const wallet = this.wallet(p);
    return (
      wallet.totalEarned > 0 ||
      wallet.owned.length > 0 ||
      !!p.data["maze-chaser-save-v1-manual"] ||
      !!p.data["maze-chaser-save-v1-auto"] ||
      Object.values(
        JSON.parse(p.data[MISSIONS_KEY] || "null")?.stats || {},
      ).some((v) => v > 0)
    );
  }
  wallet(p) {
    const value = JSON.parse(p.data[WALLET_KEY] || "null");
    if (!walletRules.validate(value)) return walletRules.empty();
    value.purchasePrices = purchasePrices(value);
    return value;
  }
  validData(key, raw) {
    if (
      !PROFILE_KEYS.includes(key) ||
      typeof raw !== "string" ||
      raw.length > 262144
    )
      throw fail(400, "profileInvalid");
    if (key === "maze-chaser-autosave") {
      if (!["true", "false"].includes(raw)) throw fail(400, "profileInvalid");
      return;
    }
    let v;
    try {
      v = JSON.parse(raw);
    } catch {
      throw fail(400, "profileInvalid");
    }
    if (key === WALLET_KEY && !walletRules.validate(v))
      throw fail(400, "profileInvalid");
    if (key === MISSIONS_KEY && !missionRules.valid(v))
      throw fail(400, "profileInvalid");
    if (key.includes("high") && !number(v)) throw fail(400, "profileInvalid");
    if (
      key.includes("save-v1") &&
      (!v ||
        v.version !== 1 ||
        !v.data ||
        !number(v.savedAt) ||
        !Number.isInteger(v.data.level) ||
        v.data.level < 1 ||
        v.data.level > 1000 ||
        !number(v.data.score) ||
        !Array.isArray(v.data.map) ||
        v.data.map.length !== 23 ||
        !v.data.map.every(
          (r) =>
            Array.isArray(r) &&
            r.length === 21 &&
            r.every((c) => [0, 1, 2, 3, 4].includes(c)),
        ))
    )
      throw fail(400, "profileInvalid");
  }
  async patch(id, revision, changes) {
    if (
      !changes ||
      Array.isArray(changes) ||
      typeof changes !== "object" ||
      Object.keys(changes).length > PROFILE_KEYS.length
    )
      throw fail(400, "profileInvalid");
    for (const [key, raw] of Object.entries(changes)) this.validData(key, raw);
    return this.transaction(id, (next) => {
      if (next.revision !== revision)
        throw Object.assign(fail(409, "profileConflict"), {
          profile: this.publicProfile(next),
        });
      for (const [key, raw] of Object.entries(changes)) {
        if (key === MISSIONS_KEY) {
          const incoming = JSON.parse(raw),
            current =
              JSON.parse(next.data[key] || "null") || missionRules.empty();
          next.missionClaims ||= clone(current.runs);
          for (const [id, counters] of Object.entries(incoming.runs)) {
            const previous =
              next.missionClaims[id] || missionRules.emptyCounters();
            for (const metric of MISSION_COUNTERS)
              current.stats[metric] += Math.max(
                0,
                counters[metric] - previous[metric],
              );
            next.missionClaims[id] = Object.fromEntries(
              MISSION_COUNTERS.map((metric) => [
                metric,
                Math.max(counters[metric], previous[metric]),
              ]),
            );
            current.runs[id] = next.missionClaims[id];
          }
          current.stats.bestRunScore = Math.max(
            current.stats.bestRunScore,
            incoming.stats.bestRunScore,
          );
          while (Object.keys(current.runs).length > 128)
            delete current.runs[Object.keys(current.runs)[0]];
          next.data[key] = JSON.stringify(current);
        } else if (key.includes("high"))
          next.data[key] = String(
            Math.max(Number(next.data[key] || 0), Number(raw)),
          );
        else if (key.includes("save-v1")) {
          const incoming = JSON.parse(raw),
            current = JSON.parse(next.data[key] || "null");
          if (!current || incoming.savedAt >= current.savedAt)
            next.data[key] = raw;
        } else if (key !== WALLET_KEY) next.data[key] = raw;
      }
      if (changes[WALLET_KEY])
        this.mergeWallet(next, JSON.parse(changes[WALLET_KEY]));
    });
  }
  // LAN geliri yalnızca sunucu makbuzundan gelir. Solo koşu eşikleri ve görev
  // ödemeleri bir kez birleştirilir; bakiye/alışveriş tutarları burada hesaplanır.
  mergeWallet(p, incoming) {
    const wallet = this.wallet(p);
    p.soloClaims ||= clone(wallet.runs);
    for (const [run, score] of Object.entries(incoming.runs)) {
      const delta = Math.max(0, score - (p.soloClaims[run] || 0));
      p.soloClaims[run] = Math.max(score, p.soloClaims[run] || 0);
      wallet.runs[run] = Math.max(score, wallet.runs[run] || 0);
      wallet.totalEarned += delta;
      wallet.balance += delta;
    }
    const missions = JSON.parse(p.data[MISSIONS_KEY] || "null");
    for (const id of incoming.missionRewards || []) {
      if ((wallet.missionRewards || []).includes(id)) continue;
      const m = MISSION_BY_ID.get(id),
        value =
          m.metric === "earned"
            ? wallet.totalEarned -
              (wallet.missionRewards || []).reduce(
                (s, id) => s + MISSION_BY_ID.get(id).reward,
                0,
              )
            : missions?.stats[m.metric] || 0;
      if (value < m.target) throw fail(400, "profileInvalid");
      wallet.missionRewards = [...(wallet.missionRewards || []), id];
      wallet.totalEarned += m.reward;
      wallet.balance += m.reward;
    }
    grantMissionCosmetics(wallet);
    for (const id of incoming.owned)
      if (!wallet.owned.includes(id)) {
        const item = SHOP_ITEMS.find((i) => i.id === id);
        if (isMissionCosmetic(item)) throw fail(400, "profileInvalid");
        if (wallet.balance < item.price) throw fail(409, "shopShort");
        wallet.balance -= item.price;
        wallet.owned.push(id);
        wallet.purchasePrices ||= {};
        wallet.purchasePrices[id] = item.price;
      }
    wallet.equipped = clone(incoming.equipped);
    while (Object.keys(wallet.runs).length > 128)
      delete wallet.runs[Object.keys(wallet.runs)[0]];
    if (!walletRules.validate(wallet)) throw fail(400, "profileInvalid");
    wallet.purchasePrices = purchasePrices(wallet);
    p.data[WALLET_KEY] = JSON.stringify(wallet);
  }
  import(id, data) {
    if (!data || Array.isArray(data) || typeof data !== "object")
      throw fail(400, "profileInvalid");
    for (const [key, raw] of Object.entries(data || {}))
      this.validData(key, raw);
    return this.transaction(id, (next) => {
      if (next.imported || this.hasProgress(next))
        throw fail(409, "importUnavailable");
      next.data = clone(data);
      next.soloClaims = clone(this.wallet(next).runs);
      next.lanClaims = Object.fromEntries(
        Object.entries(this.wallet(next).lanRewards || {}).map(([id, r]) => [
          id,
          r.points,
        ]),
      );
      next.missionClaims = clone(
        JSON.parse(next.data[MISSIONS_KEY] || "null")?.runs || {},
      );
      next.imported = true;
    });
  }
  creditLan(id, receipt) {
    return this.transaction(id, (next) => {
      if (
        !walletRules.validLanRewardId(receipt.id) ||
        !number(receipt.points) ||
        !number(receipt.startedAt)
      )
        throw fail(400, "profileInvalid");
      const previous = next.lanClaims[receipt.id] || 0,
        amount = Math.max(0, receipt.points - previous);
      if (!amount) return { amount: 0 };
      const wallet = this.wallet(next);
      wallet.totalEarned += amount;
      wallet.balance += amount;
      next.lanClaims[receipt.id] = receipt.points;
      {
        wallet.lanRewards ||= {};
        wallet.lanRewards[receipt.id] = {
          points: receipt.points,
          startedAt: receipt.startedAt,
        };
        const entries = Object.entries(wallet.lanRewards).sort(
          (a, b) => a[1].startedAt - b[1].startedAt,
        );
        while (entries.length > 512) {
          const [key, value] = entries.shift();
          delete wallet.lanRewards[key];
          wallet.lanRewardCutoff = Math.max(
            wallet.lanRewardCutoff || 0,
            value.startedAt,
          );
        }
      }
      if (!walletRules.validate(wallet)) throw fail(400, "profileInvalid");
      next.data[WALLET_KEY] = JSON.stringify(wallet);
      return { amount };
    });
  }
}
