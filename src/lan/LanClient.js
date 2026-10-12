import { LAN_RECONNECT_MS, LAN_STALE_MS } from "../data/lan-options.js";

// Skor ve hareket yalnızca sunucudan gelir. Tek komut kuyruğu, aynı sıra numarasıyla
// yeniden deneme ve snapshot sürümleri geciken/tekrarlanan ağ verisini ayıklar.
export class LanClient {
  constructor(onState, onStatus, onMetrics = () => {}, options = {}) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.onMetrics = onMetrics;
    this.fetch = options.fetch || ((...args) => fetch(...args));
    this.now = options.now || (() => Date.now());
    this.staleMs = options.staleMs || LAN_STALE_MS;
    this.retryMs = options.retryMs || 1000;
    this.session = null;
    this.controller = null;
    this.seq = 0;
    this.generation = 0;
    this.commandQueue = Promise.resolve();
    this.lastRevision = 0;
    this.lastSnapshot = 0;
    this.lostSince = 0;
    this.ping = null;
    this.connected = false;
    this.pendingDirection = null;
    this.directionPromise = null;
  }
  async request(path, body, authenticated = false, signal) {
    const headers = { "Content-Type": "application/json" };
    if (authenticated) headers.Authorization = "Bearer " + this.session.token;
    const response = await this.fetch(path, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
        : AbortSignal.timeout(5000),
    });
    const value = await response.json();
    if (!response.ok) {
      const error = new Error(value.error || "serverError");
      error.protocol = true;
      throw error;
    }
    return value;
  }
  async enter(type, data) {
    const session = await this.request("/api/lan/" + type, data);
    this.stop();
    this.session = session;
    this.seq = 0;
    this.lastRevision = 0;
    this.lastSnapshot = 0;
    try {
      sessionStorage.setItem("maze-lan-session", JSON.stringify(session));
    } catch {}
    this.connect();
    return session;
  }
  resume() {
    try {
      const session = JSON.parse(sessionStorage.getItem("maze-lan-session"));
      if (
        session &&
        /^[A-Z2-9]{6}$/.test(session.room) &&
        typeof session.id === "string" &&
        typeof session.token === "string"
      ) {
        this.session = session;
        this.connect();
        return true;
      }
    } catch {}
    return false;
  }
  metrics() {
    const age = this.lastSnapshot
      ? Math.max(0, this.now() - this.lastSnapshot)
      : null;
    this.onMetrics({
      ping: this.ping,
      age,
      reconnectRemaining: this.lostSince
        ? Math.max(
            0,
            Math.ceil(
              (LAN_RECONNECT_MS - (this.now() - this.lostSince)) / 1000,
            ),
          )
        : 30,
      quality: !this.connected
        ? "disconnected"
        : age > 1200 || this.ping > 250
          ? "slow"
          : this.ping > 120
            ? "fair"
            : "good",
    });
  }
  async measurePing(generation, signal) {
    if (!this.session || this.pinging || !this.connected) return;
    this.pinging = true;
    const start = performance.now();
    try {
      await this.request(
        "/api/lan/ping?room=" + encodeURIComponent(this.session.room),
        null,
        true,
        signal,
      );
      if (generation === this.generation)
        this.ping = Math.round(performance.now() - start);
    } catch {
      if (generation === this.generation) this.ping = null;
    } finally {
      this.pinging = false;
      if (generation === this.generation) this.metrics();
    }
  }
  connect() {
    this.controller?.abort();
    clearInterval(this.monitor);
    const generation = ++this.generation;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    let ticks = 0;
    this.monitor = setInterval(() => {
      this.metrics();
      if (++ticks % 3 === 0) void this.measurePing(generation, signal);
    }, 1000);
    void this.stream(generation, signal);
  }
  // İlk geçerli snapshot gelmeden "bağlı" durumuna geçilmez.
  receive(state) {
    if (
      !Number.isSafeInteger(state.revision) ||
      state.revision <= this.lastRevision
    )
      return false;
    this.lastRevision = state.revision;
    this.lastSnapshot = this.now();
    this.seq = Math.max(this.seq, state.seq || 0);
    this.lostSince = 0;
    if (!this.connected) {
      this.connected = true;
      this.onStatus("connected");
      void this.measurePing(this.generation, this.controller?.signal);
    }
    this.onState(state);
    this.metrics();
    return true;
  }
  async stream(generation, signal) {
    while (!signal.aborted && generation === this.generation && this.session) {
      const attempt = new AbortController();
      const attemptSignal = AbortSignal.any([signal, attempt.signal]);
      let watchdog;
      try {
        this.onStatus(this.lostSince ? "reconnecting" : "connecting");
        let activity = this.now();
        watchdog = setInterval(
          () => {
            if (this.now() - activity > this.staleMs) attempt.abort();
          },
          Math.min(500, this.staleMs),
        );
        const response = await this.fetch(
          "/api/lan/events?room=" + encodeURIComponent(this.session.room),
          {
            headers: { Authorization: "Bearer " + this.session.token },
            signal: attemptSignal,
          },
        );
        if (!response.ok) {
          const value = await response.json();
          throw new Error(value.error || "serverError");
        }
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let pending = "";
        while (!attemptSignal.aborted) {
          const { value, done } = await reader.read();
          if (attemptSignal.aborted || generation !== this.generation) return;
          if (done) throw new Error("networkLost");
          pending += decoder.decode(value, { stream: true });
          if (pending.length > 1048576) throw new Error("badRequest");
          let index;
          while ((index = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, index);
            pending = pending.slice(index + 2);
            const line = event
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (line && event.includes("event: removed")) {
              const reason = JSON.parse(line.slice(6)).reason;
              this.forget();
              this.onStatus(reason);
              return;
            }
            if (line && this.receive(JSON.parse(line.slice(6))))
              activity = this.now();
          }
        }
        throw new Error("networkLost");
      } catch (error) {
        if (signal.aborted || generation !== this.generation) return;
        this.connected = false;
        this.ping = null;
        if (
          ["roomMissing", "sessionExpired", "kicked", "loginRequired"].includes(
            error.message,
          )
        ) {
          this.forget();
          this.onStatus(error.message);
          return;
        }
        this.lostSince ||= this.now();
        if (this.now() - this.lostSince > LAN_RECONNECT_MS) {
          this.forget();
          this.onStatus("sessionExpired");
          return;
        }
        this.onStatus("reconnecting");
        this.metrics();
        await this.delay(this.retryMs, signal);
      } finally {
        clearInterval(watchdog);
        attempt.abort();
      }
    }
  }
  delay(ms, signal) {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      signal?.addEventListener("abort", finish, { once: true });
      if (signal?.aborted) finish();
    });
  }
  action(type, extra = {}) {
    if (type === "direction") {
      this.pendingDirection = { ...extra, sentAt: this.now() };
      if (this.directionPromise) return this.directionPromise;
      this.directionPromise = this.enqueue(async (generation) => {
        while (this.pendingDirection && generation === this.generation) {
          const direction = this.pendingDirection;
          this.pendingDirection = null;
          if (this.now() - direction.sentAt <= 1000)
            await this.command(type, { dir: direction.dir }, generation);
        }
      }).finally(() => {
        this.directionPromise = null;
      });
      return this.directionPromise;
    }
    const queuedAt = this.now();
    return this.enqueue((generation) => {
      if (type === "ability" && this.now() - queuedAt > 1000) return;
      return this.command(type, extra, generation);
    });
  }
  enqueue(command) {
    const generation = this.generation;
    const promise = this.commandQueue.then(() => command(generation));
    this.commandQueue = promise.catch(() => {});
    return promise;
  }
  async command(type, extra, generation) {
    if (!this.session || generation !== this.generation) return;
    if (!this.connected) throw new Error("reconnecting");
    const data = { ...extra, type, seq: ++this.seq };
    const path =
      "/api/lan/action?room=" + encodeURIComponent(this.session.room);
    const signal = this.controller?.signal;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (generation !== this.generation) return;
      try {
        return await this.request(path, data, true, signal);
      } catch (error) {
        if (error.protocol || signal?.aborted || attempt === 2) throw error;
        await this.delay(150 * (attempt + 1), signal);
      }
    }
  }
  stop() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    clearInterval(this.monitor);
    this.connected = false;
    this.ping = null;
    this.pendingDirection = null;
    this.commandQueue = Promise.resolve();
    this.directionPromise = null;
  }
  forget() {
    this.stop();
    this.session = null;
    try {
      sessionStorage.removeItem("maze-lan-session");
    } catch {}
  }
  async leave() {
    try {
      await this.action("leave");
    } finally {
      this.forget();
    }
  }
}
