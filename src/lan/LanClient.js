// Bearer oturumu yalnızca bu sekmenin sessionStorage'ında tutulur.
// Snapshot akışı SSE'dir; HTTP komutları yalnızca yön/hazır/yetenek niyeti taşır.
export class LanClient {
  constructor(onState, onStatus) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.session = null;
    this.controller = null;
    this.seq = 0;
    this.generation = 0;
    this.commandQueue = Promise.resolve();
  }
  async request(path, body, authenticated = false) {
    const headers = { "Content-Type": "application/json" };
    if (authenticated) headers.Authorization = "Bearer " + this.session.token;
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "serverError");
    return value;
  }
  async enter(type, data) {
    const session = await this.request("/api/lan/" + type, data);
    this.stop();
    this.session = session;
    this.seq = 0;
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
  connect() {
    const generation = ++this.generation;
    this.controller = new AbortController();
    void this.stream(generation, this.controller.signal);
  }
  async stream(generation, signal) {
    let lostSince = 0;
    while (!signal.aborted && generation === this.generation && this.session) {
      try {
        this.onStatus(lostSince ? "reconnecting" : "connecting");
        const response = await fetch(
          "/api/lan/events?room=" + encodeURIComponent(this.session.room),
          {
            headers: { Authorization: "Bearer " + this.session.token },
            signal,
          },
        );
        if (!response.ok) {
          const value = await response.json();
          throw new Error(value.error || "serverError");
        }
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let pending = "";
        this.onStatus("connected");
        lostSince = 0;
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) throw new Error("networkLost");
          pending += decoder.decode(value, { stream: true });
          let index;
          while ((index = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, index);
            pending = pending.slice(index + 2);
            const line = event
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (line) {
              const state = JSON.parse(line.slice(6));
              this.seq = Math.max(this.seq, state.seq || 0);
              this.onState(state);
            }
          }
        }
      } catch (error) {
        if (signal.aborted || generation !== this.generation) return;
        if (["roomMissing", "sessionExpired"].includes(error.message)) {
          this.forget();
          this.onStatus(error.message);
          return;
        }
        lostSince ||= Date.now();
        if (Date.now() - lostSince > 30000) {
          this.forget();
          this.onStatus("sessionExpired");
          return;
        }
        this.onStatus("reconnecting");
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 1000);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
    }
  }
  action(type, extra = {}) {
    const generation = this.generation;
    const command = async () => {
      if (!this.session || generation !== this.generation) return;
      return this.request(
        "/api/lan/action?room=" + encodeURIComponent(this.session.room),
        { type, seq: ++this.seq, ...extra },
        true,
      );
    };
    const promise = this.commandQueue.then(command);
    this.commandQueue = promise.catch(() => {});
    return promise;
  }
  stop() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
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
