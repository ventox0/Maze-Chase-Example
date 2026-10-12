import { LAN_MAP_OPTIONS, LAN_MODES } from "../data/lan-options.js";
import { SHOP_ITEMS } from "../data/shop.js";
const $ = (id) => document.getElementById(id);
const node = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};

// Lobi, sonuç ve bağlantı sunumu oyun fiziğinden ayrı tutulur.
export class LanPanels {
  constructor(ui) {
    this.ui = ui;
    this.metrics = {};
    this.resultsKey = "";
    for (const id of ["vote-mode", "vote-map"])
      $(id).addEventListener("change", () => {
        void ui.send("vote", {
          mode: $("vote-mode").value,
          map: $("vote-map").value,
        });
      });
    $("wear-current").addEventListener("click", () => {
      ui.rewards.wallet.refresh();
      void ui.send("appearance", {
        appearance: ui.rewards.wallet.profile.equipped,
      });
    });
    $("retry-connection").addEventListener("click", () => ui.client.connect());
  }
  translate() {
    const ui = this.ui;
    $("vote-mode").replaceChildren(
      ...LAN_MODES.map((id) => {
        const option = node("option", ui.t(id));
        option.value = id;
        return option;
      }),
    );
    $("vote-map").replaceChildren(
      ...LAN_MAP_OPTIONS.map((m) => {
        const option = node("option", m[ui.language]);
        option.value = m.id;
        return option;
      }),
    );
    this.resultsKey = "";
    this.renderNetwork();
  }
  renderLobby(s, me, connected) {
    const ui = this.ui,
      lobby = s.state === "lobby" && me.role !== "spectator",
      choice = s.lobby;
    $("lobby-options").hidden = !lobby;
    for (const id of ["vote-mode", "vote-map", "wear-current"])
      $(id).disabled = !connected || me.ready;
    if (!lobby || !choice) return;
    $("vote-mode").value = choice.votes[me.id]?.mode || s.mode;
    $("vote-map").value = choice.votes[me.id]?.map || "streets";
    const map = LAN_MAP_OPTIONS.find((m) => m.id === choice.map);
    $("vote-summary").textContent = ui.t("voteSummary", {
      mode: ui.t(choice.mode),
      map: map[ui.language],
      votes: choice.mapVotes[choice.map],
    });
    $("my-appearance").src = ui.renderer.appearance.source(me.appearance);
    $("appearance-name").textContent =
      [me.appearance?.outfit, me.appearance?.head]
        .filter(Boolean)
        .map((id) => SHOP_ITEMS.find((i) => i.id === id)?.name[ui.language])
        .join(" + ") || ui.t("normalAppearance");
  }
  renderResults(s) {
    const ui = this.ui,
      visible = ["roundComplete", "finished"].includes(s.state);
    $("match-results").hidden = !visible;
    if (!visible) {
      this.resultsKey = "";
      return;
    }
    const key = JSON.stringify([
      ui.language,
      s.matchId,
      s.state,
      s.players.map((p) => [p.score, p.stats]),
    ]);
    if (key === this.resultsKey) return;
    this.resultsKey = key;
    $("results-title").textContent = ui.t("resultsTitle");
    $("results-summary").textContent = ui.t("resultsSummary", {
      points: s.teamScore.toLocaleString(
        ui.language === "tr" ? "tr-TR" : "en-US",
      ),
    });
    const head = node("thead"),
      headers = node("tr");
    for (const key of [
      "name",
      "statScore",
      "statPellets",
      "statPower",
      "statGhosts",
      "statDeaths",
      "statSkills",
    ])
      headers.append(node("th", ui.t(key)));
    head.append(headers);
    const body = node("tbody");
    for (const p of [...s.players].sort(
      (a, b) => b.score - a.score || a.slot - b.slot,
    )) {
      const row = node("tr"),
        stats = p.stats || {};
      for (const value of [
        p.name,
        p.score,
        stats.pellets || 0,
        stats.powerPellets || 0,
        stats.ghosts || 0,
        stats.deaths || 0,
        stats.abilities || 0,
      ])
        row.append(node("td", String(value)));
      body.append(row);
    }
    $("results-table").replaceChildren(head, body);
  }
  reset() {
    this.resultsKey = "";
    this.metrics = {};
    for (const id of [
      "match-results",
      "lobby-options",
      "reconnect-panel",
      "network-details",
    ])
      $(id).hidden = true;
    $("arena-message").classList.remove("lobby-preview");
  }
  renderNetwork(metrics = this.metrics) {
    this.metrics = metrics;
    const ui = this.ui,
      hasSession = !!ui.client?.session;
    $("network-details").hidden = !hasSession;
    $("ping-label").textContent = ui.t("pingLabel", {
      ms: metrics.ping ?? "—",
    });
    $("network-quality").textContent = ui.t(
      "quality" + (metrics.quality || "disconnected"),
    );
    $("network-quality").dataset.quality = metrics.quality || "disconnected";
    const balance = ui.state?.balance;
    $("balance-label").textContent = balance
      ? ui.t("balanceLabel", {
          players: balance.players,
          percent: Math.round(balance.ghostSpeed * 100),
        })
      : "";
    const reconnecting =
      hasSession && ["connecting", "reconnecting"].includes(ui.status);
    $("reconnect-panel").hidden = !reconnecting;
    $("reconnect-title").textContent = ui.t(
      ui.status === "connecting" ? "connecting" : "reconnecting",
    );
    $("reconnect-detail").textContent = ui.t("reconnectCountdown", {
      seconds: metrics.reconnectRemaining ?? 30,
    });
    $("reconnect-progress").value = metrics.reconnectRemaining ?? 30;
    $("reconnect-progress").setAttribute("aria-label", ui.t("reconnectTime"));
  }
}
