import { PROFILE_KEYS, WALLET_KEY } from "../data/account-profile.js";
const parse = (value, fallback) => {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
};

// Misafir anahtarları değişmez. Hesap verisi ayrı önbellekte ve sunucuda tutulur.
export class ProfileSession {
  constructor() {
    this.user = null;
    this.profile = null;
    this.pending = {};
    this.listeners = new Set();
    this.state = "guest";
    this.inflight = null;
  }
  emit() {
    for (const fn of this.listeners) fn(this);
  }
  async request(action, body) {
    const response = await fetch("/api/account/" + action, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(value.error || "accountUnavailable"), {
        profile: value.profile,
      });
    return value;
  }
  async initialize() {
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      this.channel = new window.BroadcastChannel("maze-account-profile");
      this.channel.onmessage = ({ data }) => {
        if (data.type === "sessionChanged") {
          location.reload();
          return;
        }
        if (
          this.user?.id === data.userId &&
          data.profile?.revision > this.profile.revision
        )
          this.update(data.profile, false);
      };
    }
    try {
      const value = await this.request("me");
      if (value.user) this.activate(value.user, value.profile);
    } catch {
      this.state = "unavailable";
    }
    this.emit();
    if (this.user && Object.keys(this.pending).length) this.schedule();
  }
  activate(user, profile) {
    this.user = user;
    this.profile = profile;
    this.pending = {};
    let cached = null;
    try {
      cached = parse(
        localStorage.getItem("maze-account-cache-" + user.id),
        null,
      );
    } catch {}
    if (
      cached?.userId === user.id &&
      cached.pending &&
      typeof cached.pending === "object"
    ) {
      for (const [key, value] of Object.entries(cached.pending))
        if (PROFILE_KEYS.includes(key) && typeof value === "string")
          this.pending[key] = value;
    }
    Object.assign(this.profile.data, this.pending);
    this.state = Object.keys(this.pending).length ? "pending" : "synced";
    this.cache();
    this.emit();
  }
  cache() {
    if (!this.user) return;
    try {
      localStorage.setItem(
        "maze-account-cache-" + this.user.id,
        JSON.stringify({ userId: this.user.id, pending: this.pending }),
      );
    } catch {
      this.state = "syncError";
    }
  }
  getItem(key) {
    return this.user && PROFILE_KEYS.includes(key)
      ? (this.profile.data[key] ?? null)
      : localStorage.getItem(key);
  }
  setItem(key, value) {
    if (!this.user || !PROFILE_KEYS.includes(key)) {
      localStorage.setItem(key, value);
      return;
    }
    this.profile.data[key] = String(value);
    this.pending[key] = String(value);
    this.state = "pending";
    this.cache();
    this.emit();
    this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush().catch(() => {}), 500);
  }
  async flush() {
    if (this.inflight) {
      await this.inflight;
      if (Object.keys(this.pending).length) return this.flush();
      return;
    }
    if (!this.user || !Object.keys(this.pending).length) return;
    const userId = this.user.id,
      changes = { ...this.pending };
    const work = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const result = await this.request("profile", {
            revision: this.profile.revision,
            accountId: userId,
            changes,
          });
          if (this.user?.id !== userId) return;
          for (const [key, value] of Object.entries(changes))
            if (this.pending[key] === value) delete this.pending[key];
          this.update(result.profile);
          return;
        } catch (error) {
          if (error.message === "profileConflict" && error.profile) {
            this.profile.revision = error.profile.revision;
            continue;
          }
          // A rejected purchase must not trap every later save in an endless retry.
          // Keep newer edits, but restore the server's accepted wallet/profile.
          if (["shopShort", "profileInvalid"].includes(error.message)) {
            const latest = await this.request("me");
            if (latest.user?.id !== userId) throw new Error("loginRequired");
            for (const [key, value] of Object.entries(changes))
              if (this.pending[key] === value) delete this.pending[key];
            this.update(latest.profile);
            this.state = "rejected";
            this.emit();
            throw error;
          }
          this.state =
            error.message === "loginRequired" ? "sessionExpired" : "syncError";
          this.cache();
          this.emit();
          throw error;
        }
      }
      this.state = "syncError";
      this.emit();
      throw new Error("profileConflict");
    };
    this.inflight = work();
    try {
      await this.inflight;
    } finally {
      this.inflight = null;
      if (Object.keys(this.pending).length && this.state !== "sessionExpired")
        this.timer = setTimeout(() => void this.flush().catch(() => {}), 5000);
    }
  }
  update(profile, broadcast = true) {
    if (!this.user) return;
    this.profile = profile;
    if (broadcast)
      this.channel?.postMessage({
        type: "profile",
        userId: this.user.id,
        profile,
      });
    Object.assign(this.profile.data, this.pending);
    this.state = Object.keys(this.pending).length ? "pending" : "synced";
    this.cache();
    this.emit();
  }
  async authenticate(type, username, password) {
    await this.flush();
    const result = await this.request(type, { username, password });
    this.activate(result.user, result.profile);
    this.channel?.postMessage({ type: "sessionChanged" });
  }
  async logout() {
    await this.flush();
    await this.request("logout", {});
    this.channel?.postMessage({ type: "sessionChanged" });
    this.user = null;
    this.profile = null;
    this.pending = {};
    clearTimeout(this.timer);
    this.state = "guest";
    this.emit();
  }
  guestData() {
    return Object.fromEntries(
      PROFILE_KEYS.flatMap((key) => {
        const value = localStorage.getItem(key);
        return value === null ? [] : [[key, value]];
      }),
    );
  }
  async importGuest() {
    await this.flush();
    const result = await this.request("import", {
      data: this.guestData(),
      accountId: this.user.id,
    });
    this.pending = {};
    this.update(result.profile);
  }
  async refresh() {
    await this.flush();
    const result = await this.request("me");
    if (!result.user || result.user.id !== this.user?.id)
      throw new Error("loginRequired");
    this.update(result.profile);
  }
  get wallet() {
    return parse(this.getItem(WALLET_KEY), null);
  }
}
export const profileStorage = new ProfileSession();
