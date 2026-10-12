import { LAN_MAP_OPTIONS, LAN_MODES } from "../src/data/lan-options.js";

// Eşit oyda bağlı oda sahibinin oyu, sonra sabit seçenek sırası belirleyicidir.
export class LanLobby {
  constructor(mode = "coop") {
    this.defaultMode = mode;
    this.votes = new Map();
  }
  vote(player, { mode, map }) {
    if (!LAN_MODES.includes(mode) || !LAN_MAP_OPTIONS.some((m) => m.id === map))
      return false;
    this.votes.set(player.id, { mode, map });
    player.ready = false;
    return true;
  }
  resolve(players, ownerId) {
    const connected = players.filter((p) => p.connected);
    const tally = (key, options, fallback) => {
      const counts = Object.fromEntries(options.map((id) => [id, 0]));
      for (const p of connected)
        counts[this.votes.get(p.id)?.[key] || fallback]++;
      const best = Math.max(...Object.values(counts));
      const tied = options.filter((id) => counts[id] === best);
      const host = connected.some((p) => p.id === ownerId)
        ? this.votes.get(ownerId)?.[key] || fallback
        : null;
      return { value: tied.includes(host) ? host : tied[0], counts };
    };
    const mode = tally("mode", LAN_MODES, this.defaultMode);
    const map = tally(
      "map",
      LAN_MAP_OPTIONS.map((m) => m.id),
      "streets",
    );
    return {
      mode: mode.value,
      map: map.value,
      modeVotes: mode.counts,
      mapVotes: map.counts,
    };
  }
  snapshot(players, ownerId) {
    return {
      ...this.resolve(players, ownerId),
      votes: Object.fromEntries(
        players.map((p) => [
          p.id,
          this.votes.get(p.id) || { mode: this.defaultMode, map: "streets" },
        ]),
      ),
    };
  }
}
