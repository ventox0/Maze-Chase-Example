import { profileStorage } from "../account/ProfileStorage.js";
import { LanPanels } from "./LanPanels.js";
import { LanRewards } from "./LanRewards.js";
import {
  LAN_COLS,
  LAN_ROWS,
  MAX_LAN_GHOSTS,
  LAN_REWARD_PERCENT,
} from "../data/lan.js";
import { LanClient } from "./LanClient.js";
import { LanRenderer } from "./LanRenderer.js";
import { STRINGS } from "./strings.js";
const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className || "";
  if (text !== undefined) node.textContent = text;
  return node;
};
const abilities = ["jump", "magnet", "boost", "shield"];

export class LanUI {
  constructor() {
    this.language = "tr";
    try {
      this.language =
        localStorage.getItem("maze-chaser-language") === "en" ? "en" : "tr";
    } catch {}
    this.rewards = new LanRewards();
    this.rewardKey = null;
    this.rewardFeedback = "rewardHint";
    this.rewardValues = {};
    this.rewardRetryAt = 0;
    this.state = null;
    this.info = null;
    this.status = "checking";
    this.busy = false;
    this.lastEvent = 0;
    this.rosterKey = "";
    this.scoreKey = "";
    this.spectatorKey = "";
    this.renderer = new LanRenderer($("lan-canvas"));
    this.client = new LanClient(
      (state) => this.accept(state),
      (status) => this.connection(status),
      (metrics) => {
        this.renderer.ping = metrics.ping || 0;
        this.panels?.renderNetwork(metrics);
      },
      {
        onDirection: (dir, seq) => this.renderer.prediction.intent(dir, seq),
        onDirectionRejected: (seq) => this.renderer.prediction.cancel(seq),
      },
    );
    this.rewards.client = this.client;
    if (profileStorage.user) {
      $("player-name").value = profileStorage.user.username;
      $("player-name").disabled = true;
    }
    this.panels = new LanPanels(this);
    profileStorage.listeners.add(() => {
      this.rewards.wallet.load();
      this.renderWallet();
    });
    this.renderer.onAppearanceReady = () => {
      this.rosterKey = "";
      if (this.state) this.render();
    };
    this.bind();
    this.translate();
    void this.initialize();
  }
  t(key, values = {}) {
    let text =
      STRINGS[this.language][key] || STRINGS[this.language].serverError;
    for (const [name, value] of Object.entries(values))
      text = text.replaceAll("{" + name + "}", String(value));
    return text;
  }
  abilityName(id) {
    return this.t("ability" + id[0].toUpperCase() + id.slice(1));
  }
  translate() {
    this.renderer.language = this.language;
    this.updateViewButton();
    this.renderWallet();
    document.documentElement.lang = this.language;
    for (const node of document.querySelectorAll("[data-t]"))
      node.textContent = this.t(node.dataset.t);
    $("language").textContent = this.language === "tr" ? "EN" : "TR";
    $("language").setAttribute(
      "aria-label",
      this.language === "tr" ? "Switch to English" : "Türkçeye geç",
    );
    for (const prefix of ["setup", "room"])
      for (const slot of ["q", "e"]) {
        const select = $(prefix + "-" + slot),
          value = select.value || (slot === "q" ? "jump" : "magnet");
        select.replaceChildren(
          ...abilities.map((id) => {
            const option = el("option", "", this.abilityName(id));
            option.value = id;
            return option;
          }),
        );
        select.value = value;
      }
    $("map-label").textContent = this.t("mapSize", {
      cols: LAN_COLS,
      rows: LAN_ROWS,
      ghosts: MAX_LAN_GHOSTS,
    });
    this.panels?.translate();
    this.modeDescription();
    this.rosterKey = "";
    this.scoreKey = "";
    this.connection(this.status, false);
    if (this.state) this.render();
    else if (this.info) this.renderRooms();
  }
  async initialize() {
    const room = new URL(location.href).searchParams.get("room");
    if (room) $("room-code").value = room.trim().toUpperCase().slice(0, 6);
    try {
      this.info = await this.client.request("/api/lan/info");
      this.status = this.info.enabled ? "online" : "offline";
      this.connection(this.status);
      this.buttons();
      if (!this.info.enabled) {
        this.feedback("disabled");
        return;
      }
      const urls = this.info.urls.length
        ? this.info.urls
        : [location.origin + "/lan.html"];
      $("addresses").replaceChildren(
        ...urls.map((url) => {
          const a = el("a", "", url);
          a.href = url;
          return a;
        }),
      );
      if (!this.client.resume()) await this.renderRooms();
      this.roomsTimer = setInterval(() => {
        if (!this.client.session) void this.renderRooms();
      }, 4000);
    } catch {
      this.connection("offline");
      this.feedback("serverError");
    }
  }
  async renderRooms() {
    if (!this.info?.enabled) return;
    try {
      const data = await this.client.request("/api/lan/rooms");
      const mode = $("filter-mode").value || "all",
        status = $("filter-status").value || "all";
      const rooms = data.rooms.filter(
        (room) =>
          (mode === "all" || room.mode === mode) &&
          (status === "all" ||
            (status === "lobby" && room.state === "lobby") ||
            (status === "active" && room.state !== "lobby") ||
            (status === "available" &&
              room.state === "lobby" &&
              room.players < 4)),
      );
      $("rooms").replaceChildren(
        ...(rooms.length
          ? rooms.map((room) => {
              const row = el("div", "room-list-card");
              row.append(
                el("strong", "", (room.locked ? "🔒 " : "") + room.code),
                el(
                  "span",
                  "muted",
                  this.t(room.mode) +
                    " · " +
                    room.players +
                    "/4 · " +
                    this.t(room.state === "lobby" ? "waiting" : "playing"),
                ),
              );
              for (const role of ["player", "spectator"]) {
                if (
                  role === "player" &&
                  (room.players >= 4 || room.state !== "lobby")
                )
                  continue;
                if (role === "spectator" && room.spectators >= 8) continue;
                const button = el(
                  "button",
                  "quiet",
                  this.t(role === "player" ? "join" : "watchRoom"),
                );
                button.type = "button";
                button.addEventListener("click", () => {
                  $("room-code").value = room.code;
                  $("join-role").value = role;
                  if (room.locked && !$("join-password").value) {
                    this.feedback("roomPasswordNeeded");
                    $("join-password").focus();
                    return;
                  }
                  void this.enter("join");
                });
                row.append(button);
              }
              return row;
            })
          : [el("p", "muted", this.t("noRooms"))]),
      );
    } catch {
      this.feedback("serverError");
    }
  }
  feedback(key, values = {}) {
    $("feedback").textContent = this.t(key, values);
  }
  modeDescription() {
    $("mode-description").textContent = this.t(
      document.querySelector("[name=mode]:checked").value + "Desc",
    );
  }
  connection(status, clear = true) {
    const previous = this.status;
    this.status = status;
    this.renderer.networkConnected = status === "connected";
    $("connection").textContent = this.t(status);
    $("connection").classList.toggle(
      "live",
      ["online", "connected"].includes(status),
    );
    if (
      ["roomMissing", "sessionExpired", "kicked", "loginRequired"].includes(
        status,
      ) &&
      clear
    ) {
      this.state = null;
      this.panels?.reset();
      $("spectator-controls").hidden = true;
      this.renderer.reset();
      this.rosterKey = "";
      this.scoreKey = "";
      $("setup").hidden = false;
      $("room-panel").hidden = true;
      $("scoreboard").replaceChildren(el("p", "muted", this.t("emptyScores")));
      $("arena-message").hidden = false;
      $("arena-message").replaceChildren(
        el("strong", "", this.t("welcome")),
        el("p", "", this.t("createHint")),
      );
      this.feedback(status);
      this.buttons();
    }
    this.panels?.renderNetwork();
    if (status === "connected" && previous === "reconnecting")
      this.feedback("connectionRestored");
    if (status === "reconnecting") this.feedback("networkLost");
    if (this.state) this.render();
  }
  buttons() {
    for (const id of ["create", "join"])
      $(id).disabled =
        !this.info?.enabled || this.busy || !!this.client.session;
  }
  loadout(prefix) {
    return { q: $(prefix + "-q").value, e: $(prefix + "-e").value };
  }
  async enter(type) {
    if (this.busy || this.client.session) return;
    if (!$("player-name").value.trim()) {
      this.feedback("badRequest");
      $("player-name").focus();
      return;
    }
    this.busy = true;
    this.buttons();
    try {
      await this.client.enter(type, {
        name: $("player-name").value,
        room: $("room-code").value.trim().toUpperCase(),
        mode: document.querySelector("[name=mode]:checked").value,
        loadout: this.loadout("setup"),
        appearance: this.rewards.wallet.profile.equipped,
        role: $("join-role").value || "player",
        password:
          type === "create"
            ? $("create-password").value
            : $("join-password").value,
        listed: !$("hide-room").checked,
      });
      $("feedback").textContent = "";
      $("create-password").value = "";
      $("join-password").value = "";
      this.renderer.myId = this.client.session.id;
    } catch (error) {
      this.feedback(error.message);
    } finally {
      this.busy = false;
      this.buttons();
    }
  }
  async send(type, extra = {}) {
    try {
      // Oyun girdileri dükkân/ödül senkronizasyonunun ağ yanıtını beklemez.
      if (!["direction", "ability"].includes(type))
        await this.processRewards(this.state);
      await this.client.action(type, extra);
    } catch (error) {
      this.feedback(error.message);
    }
  }
  accept(state) {
    const initial = !this.state;
    const beganPlaying =
      state.state === "playing" && this.state?.state !== "playing";
    this.state = state;
    this.renderer.myId = this.client.session.id;
    this.renderer.accept(state);
    if (initial) this.lastEvent = state.events.at(-1)?.id || 0;
    for (const event of state.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const name =
        state.players.find((p) => p.id === event.playerId)?.name || "";
      const keys = {
        ghost: "ghostEvent",
        hurt: "hurtEvent",
        power: "powerEvent",
        bonusReady: "bonusEvent",
        bonus: "bonusCollected",
      };
      if (keys[event.type]) this.feedback(keys[event.type], { name });
    }
    void this.processRewards(state);
    this.render();
    if (beganPlaying)
      $("lan-canvas").focus({ preventScroll: window.innerWidth > 700 });
  }
  render() {
    const s = this.state;
    if (!s) return;
    const me =
      s.players.find((p) => p.id === this.client.session?.id) ||
      (s.viewer?.role === "spectator"
        ? {
            id: s.viewer.id,
            role: "spectator",
            name: s.spectators.find((p) => p.id === s.viewer.id)?.name || "",
            lives: 0,
            score: 0,
            ready: false,
            loadout: { q: "jump", e: "magnet" },
            cooldowns: { q: 0, e: 0 },
            connected: true,
          }
        : null);
    if (!me) return;
    const owner = s.ownerId === me.id,
      spectator = me.role === "spectator",
      lobby = s.state === "lobby",
      connected = this.status === "connected";
    $("setup").hidden = true;
    $("room-panel").hidden = false;
    $("room-title").textContent = s.room;
    $("room-mode").textContent = this.t(s.mode);
    const base = this.info?.urls[0] || location.origin + "/lan.html";
    const invite = new URL(base);
    invite.searchParams.set("room", s.room);
    $("invite").value = invite.href;
    const rosterKey = JSON.stringify([
      this.language,
      s.ownerId,
      this.status,
      s.players.map((p) => [p.id, p.ready, p.connected, p.name, p.appearance]),
      s.spectators,
    ]);
    if (rosterKey !== this.rosterKey) {
      this.rosterKey = rosterKey;
      $("roster").replaceChildren(
        ...s.players.map((p) => {
          const row = el("div", "roster-row"),
            dot = el("span", "player-dot");
          dot.style.background = p.color;
          const avatar = el("img", "roster-avatar");
          avatar.alt = "";
          avatar.src =
            this.renderer.appearance?.source(p.appearance) ||
            "./assets/players/normal.webp";
          row.append(
            avatar,
            dot,
            el(
              "span",
              "roster-name",
              p.name +
                (p.id === me.id ? " · " + this.t("you") : "") +
                (p.id === s.ownerId ? " ★" : ""),
            ),
            el(
              "span",
              "roster-status",
              this.t(
                !p.connected
                  ? "disconnected"
                  : p.ready
                    ? "isReady"
                    : "readyWaiting",
              ),
            ),
          );
          if (owner && p.id !== me.id) {
            const kick = el("button", "kick-player", this.t("kick"));
            kick.type = "button";
            kick.disabled = !connected;
            kick.addEventListener(
              "click",
              () => void this.send("kick", { target: p.id }),
            );
            row.append(kick);
          }
          return row;
        }),
      );
    }
    $("room-loadout").hidden = spectator;
    $("room-loadout").disabled = spectator || !lobby || !connected;
    $("room-q").value = me.loadout.q;
    $("room-e").value = me.loadout.e;
    $("ready").hidden = !lobby || spectator;
    $("ready").disabled = !connected;
    $("ready").textContent = this.t(me.ready ? "unready" : "ready");
    $("ready").setAttribute("aria-pressed", String(me.ready));
    $("start").hidden = !owner || !lobby;
    $("start").disabled =
      !connected ||
      s.players.length < 2 ||
      !s.players.every((p) => p.connected && p.ready);
    $("next").hidden = !owner || s.state !== "roundComplete";
    $("next").disabled = !connected;
    $("rematch").hidden = !owner || s.state !== "finished";
    $("rematch").disabled = !connected;
    const spectatorListKey = JSON.stringify([
      this.language,
      s.spectators,
      owner,
      connected,
    ]);
    if (this.spectatorListKey !== spectatorListKey) {
      this.spectatorListKey = spectatorListKey;
      $("spectators-list").replaceChildren(
        ...(s.spectators || []).map((p) => {
          const row = el(
            "div",
            "spectator-row",
            p.name + " · " + this.t("watchRole"),
          );
          if (owner) {
            const kick = el("button", "kick-player", this.t("kick"));
            kick.addEventListener(
              "click",
              () => void this.send("kick", { target: p.id }),
            );
            row.append(kick);
          }
          return row;
        }),
      );
    }
    $("room-hint").textContent = this.t(
      spectator
        ? "spectatorHint"
        : lobby
          ? owner
            ? "hostHint"
            : "guestHint"
          : s.state === "roundComplete"
            ? "roundHint"
            : s.state === "finished"
              ? "finishedHint"
              : "playingHint",
    );
    $("match-title").textContent = this.t(
      lobby
        ? "waiting"
        : s.state === "countdown"
          ? "countdownTitle"
          : s.state === "roundComplete"
            ? "roundComplete"
            : s.state === "finished"
              ? "finished"
              : "playing",
    );
    $("points-kind").textContent = this.t(
      s.mode === "coop" || spectator ? "teamPoints" : "yourPoints",
    );
    $("level-label").textContent = this.t("level", { level: s.level });
    $("points-label").textContent = (
      s.mode === "coop" || spectator ? s.teamScore : me.score
    ).toLocaleString(this.language === "tr" ? "tr-TR" : "en-US");
    $("pellets-label").textContent = this.t("pellets", { count: s.pellets });
    $("power-label").textContent =
      s.powerRemaining > 0
        ? this.t("power", { seconds: Math.ceil(s.powerRemaining) })
        : "";
    $("timer-label").textContent =
      s.mode === "race"
        ? this.t("time", { seconds: Math.ceil(s.timeRemaining) })
        : "";
    let message = "",
      detail = "";
    if (!connected) {
      // Yeniden bağlanma şeridi ayrı gösterilir; haritayı karartmaz.
    } else if (lobby) {
      message = this.t("waiting");
      detail = this.t("startMessage");
    } else if (s.state === "countdown")
      message = this.t("countdown", { seconds: Math.ceil(s.countdown) });
    else if (s.state === "roundComplete") {
      message = this.t("roundComplete");
      detail = this.t("roundMessage");
    } else if (s.state === "finished") {
      if (s.mode === "coop")
        message = this.t(s.reason === "lives" ? "defeat" : "victory");
      else {
        const names = s.players
          .filter((p) => s.winners.includes(p.id))
          .map((p) => p.name)
          .join(", ");
        message = this.t(s.winners.length > 1 ? "draw" : "winner", { names });
      }
      detail = this.t("finishedHint");
    }
    this.panels?.renderLobby(s, me, connected);
    this.panels?.renderResults(s);
    this.panels?.renderNetwork();
    this.renderSpectator(s, me);
    const overlay = $("arena-message");
    overlay.classList.toggle("lobby-preview", lobby && connected);
    overlay.hidden = !message && !detail;
    if (message || detail)
      overlay.replaceChildren(el("strong", "", message), el("p", "", detail));
    const scoreKey = JSON.stringify([
      this.language,
      s.players.map((p) => [p.id, p.score, p.lives, p.connected, p.name]),
    ]);
    if (scoreKey !== this.scoreKey) {
      this.scoreKey = scoreKey;
      $("scoreboard").replaceChildren(
        ...[...s.players]
          .sort((a, b) => b.score - a.score || a.slot - b.slot)
          .map((p) => {
            const row = el(
                "div",
                "score-row" + (p.id === me.id ? " mine" : ""),
              ),
              dot = el("span", "player-dot");
            dot.style.background = p.color;
            row.append(
              dot,
              el(
                "span",
                "score-name",
                p.name + (p.id === me.id ? " · " + this.t("you") : ""),
              ),
              el("span", "score-lives", "♥ " + p.lives),
              el("strong", "score-points", p.score.toLocaleString()),
            );
            return row;
          }),
      );
    }
    for (const slot of ["q", "e"]) {
      const cooldown = Math.ceil(me.cooldowns[slot]);
      $("skill-" + slot).textContent =
        slot.toUpperCase() +
        " · " +
        this.abilityName(me.loadout[slot]) +
        (cooldown > 0 ? " · " + cooldown + "s" : "");
      $("skill-" + slot).disabled =
        s.state !== "playing" ||
        !connected ||
        me.lives <= 0 ||
        me.respawning ||
        cooldown > 0;
    }
    for (const button of document.querySelectorAll("[data-dir]"))
      button.disabled = s.state !== "playing" || !connected || me.lives <= 0;
  }
  processRewards(state, force = false) {
    const receipts = state?.walletRewards || [],
      key = JSON.stringify(receipts);
    if (
      !force &&
      key === this.rewardKey &&
      (this.rewardFeedback !== "rewardStorageError" ||
        Date.now() < this.rewardRetryAt)
    )
      return this.rewardPromise || Promise.resolve();
    this.rewardKey = key;
    this.rewardPromise = this.rewards
      .settle(receipts.map((r) => ({ ...r })))
      .then((result) => {
        if (result.status === "storageError") {
          this.rewardFeedback = "rewardStorageError";
          this.rewardRetryAt = Date.now() + 5000;
        } else if (result.amount > 0) {
          this.rewardFeedback = "rewardAdded";
          this.rewardValues = { points: result.amount };
        } else if (receipts.length && this.rewardFeedback !== "rewardAdded") {
          this.rewardFeedback = "rewardSynced";
        } else if (!receipts.length) this.rewardFeedback = "rewardHint";
        this.renderWallet();
      })
      .catch(() => {
        this.rewardFeedback = "rewardStorageError";
        this.rewardRetryAt = Date.now() + 5000;
        this.renderWallet();
      });
    return this.rewardPromise;
  }
  renderWallet() {
    $("lan-wallet-balance").textContent = this.t("walletBalance", {
      points: this.rewards.wallet.profile.balance.toLocaleString(
        this.language === "tr" ? "tr-TR" : "en-US",
      ),
    });
    $("lan-reward-status").textContent = this.t(this.rewardFeedback, {
      percent: LAN_REWARD_PERCENT,
      ...this.rewardValues,
    });
    $("reward-retry").hidden = this.rewardFeedback !== "rewardStorageError";
  }
  renderSpectator(state, me) {
    const spectating = state.state === "playing" && me.lives <= 0;
    $("spectator-controls").hidden = !spectating;
    if (!spectating) {
      this.renderer.spectatingId = null;
      return;
    }
    const available = state.players.filter((p) => p.lives > 0 && p.connected);
    if (!available.some((p) => p.id === this.renderer.spectatingId))
      this.renderer.spectatingId = available[0]?.id || null;
    const key = JSON.stringify([
      this.language,
      available.map((p) => [p.id, p.name]),
    ]);
    if (key !== this.spectatorKey) {
      this.spectatorKey = key;
      $("spectator-player").replaceChildren(
        ...available.map((p) => {
          const option = el("option", "", p.name);
          option.value = p.id;
          return option;
        }),
      );
    }
    $("spectator-player").value = this.renderer.spectatingId || "";
    $("spectator-player").disabled = !available.length;
    const target = available.find((p) => p.id === this.renderer.spectatingId);
    $("spectator-status").textContent = target
      ? this.t("watching", { name: target.name })
      : this.t("spectatorWaiting");
  }
  updateViewButton() {
    $("view-toggle").textContent = this.t(
      this.renderer.zoom === 2 ? "overview" : "closeView",
    );
    $("view-toggle").setAttribute(
      "aria-pressed",
      String(this.renderer.zoom === 2),
    );
  }
  bind() {
    $("reward-retry").addEventListener(
      "click",
      () => void this.processRewards(this.state, true),
    );
    window.addEventListener("storage", (event) => {
      if (event.key === this.rewards.wallet.key) {
        this.rewards.wallet.refresh();
        this.renderWallet();
      }
    });
    $("spectator-player").addEventListener("change", () => {
      this.renderer.spectatingId = $("spectator-player").value;
      if (this.state) this.render();
    });
    $("view-toggle").addEventListener("click", () => {
      this.renderer.zoom = this.renderer.zoom === 2 ? 1 : 2;
      this.updateViewButton();
    });
    $("language").addEventListener("click", () => {
      this.language = this.language === "tr" ? "en" : "tr";
      try {
        localStorage.setItem("maze-chaser-language", this.language);
      } catch {}
      this.translate();
    });
    for (const radio of document.querySelectorAll("[name=mode]"))
      radio.addEventListener("change", () => this.modeDescription());
    for (const id of ["filter-mode", "filter-status"])
      $(id).addEventListener("change", () => void this.renderRooms());
    $("create").addEventListener("click", () => void this.enter("create"));
    $("join").addEventListener("click", () => void this.enter("join"));
    $("room-code").addEventListener("input", () => {
      $("room-code").value = $("room-code")
        .value.toUpperCase()
        .replace(/[^A-Z2-9]/g, "");
    });
    for (const type of ["ready", "start", "next", "rematch"])
      $(type).addEventListener("click", () => void this.send(type));
    $("leave").addEventListener("click", async () => {
      try {
        await this.processRewards(this.state);
        await this.client.leave();
      } catch {}
      this.state = null;
      this.panels?.reset();
      $("spectator-controls").hidden = true;
      this.renderer.reset();
      this.rosterKey = "";
      this.scoreKey = "";
      $("setup").hidden = false;
      $("room-panel").hidden = true;
      $("scoreboard").replaceChildren(el("p", "muted", this.t("emptyScores")));
      $("arena-message").hidden = false;
      $("arena-message").replaceChildren(
        el("strong", "", this.t("welcome")),
        el("p", "", this.t("createHint")),
      );
      this.connection("online");
      this.feedback("left");
      this.buttons();
      await this.renderRooms();
    });
    for (const prefix of ["setup", "room"])
      for (const slot of ["q", "e"])
        $(prefix + "-" + slot).addEventListener("change", () => {
          const other = slot === "q" ? "e" : "q",
            current = $(prefix + "-" + slot).value;
          if ($(prefix + "-" + other).value === current)
            $(prefix + "-" + other).value = abilities.find(
              (a) => a !== current,
            );
          if (prefix === "room")
            void this.send("loadout", { loadout: this.loadout(prefix) });
        });
    $("copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("invite").value);
        this.feedback("copied");
      } catch {
        $("invite").select();
        this.feedback("copyManual");
      }
    });
    for (const button of document.querySelectorAll("[data-dir]"))
      button.addEventListener("click", () => {
        void this.send("direction", { dir: button.dataset.dir });
        $("lan-canvas").focus({ preventScroll: true });
      });
    for (const slot of ["q", "e"])
      $("skill-" + slot).addEventListener("click", () => {
        void this.send("ability", { slot });
        $("lan-canvas").focus({ preventScroll: true });
      });
    window.addEventListener("keydown", (event) => {
      if (document.getElementById("account-dialog")?.open) return;
      if (
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(
          event.target.tagName,
        )
      )
        return;
      if (
        this.state?.viewer?.role === "spectator" ||
        this.state?.state !== "playing" ||
        this.status !== "connected"
      )
        return;
      const key = event.key.toLowerCase(),
        dir = {
          arrowup: "up",
          w: "up",
          arrowdown: "down",
          s: "down",
          arrowleft: "left",
          a: "left",
          arrowright: "right",
          d: "right",
        }[key];
      if (!dir && !["q", "e"].includes(key)) return;
      event.preventDefault();
      if (event.repeat) return;
      if (dir) void this.send("direction", { dir });
      else void this.send("ability", { slot: key });
    });
    window.addEventListener("pagehide", () => this.client.stop());
    window.addEventListener("pageshow", () => {
      if (this.client.session && !this.client.controller) this.client.connect();
    });
  }
}
