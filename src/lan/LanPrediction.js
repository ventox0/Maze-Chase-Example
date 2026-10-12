import { MovementSystem } from "../gameplay/MovementSystem.js";
import { DIRS, OPPOSITE } from "../data/config.js";

// Yalnızca kendi oyuncumuzun çizimi tahmin edilir. Duvar hizalama kodu sunucuyla
// ortaktır; yemler, canlar, puanlar ve yetenekler kesin sunucu verisi olarak kalır.
export class LanPrediction {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.reset();
  }
  reset() {
    this.base = null;
    this.inputs = [];
  }
  intent(dir, seq) {
    if (!Object.hasOwn(DIRS, dir)) return;
    this.inputs.push({ dir, seq, at: this.now() });
    this.inputs = this.inputs.slice(-64);
  }
  cancel(seq) {
    this.inputs = this.inputs.filter((input) => input.seq > seq);
  }
  accept(state, id, ping = 0, received = this.now()) {
    const player = state.players.find((p) => p.id === id);
    const previous = this.base;
    if (previous && (previous.state.matchId !== state.matchId ||
        previous.state.level !== state.level || previous.player.lives !== player?.lives))
      this.reset();
    if (state.state !== "playing" || !player?.connected || player.lives <= 0 ||
        player.respawning || player.jumping || !player.motion) {
      this.reset();
      return;
    }
    this.inputs = this.inputs.filter((input) =>
      input.seq > (state.directionSeq || 0) && received - input.at < 1000);
    this.base = { state, player, received, latency: Math.min(125, Math.max(0, ping / 2)) };
  }
  sample(now = this.now()) {
    if (!this.base) return null;
    const { state, player, received, latency } = this.base;
    // Kopan bağlantıda sınırsız yürümeyi önlemek için tahmin en fazla 250 ms'dir.
    const origin = received - latency;
    const elapsed = Math.min(250, Math.max(0, now - origin));
    const actor = { ...player.motion, dir: player.dir, moving: player.moving };
    const game = {
      state: "playing", player: { entity: actor }, abilities: { jump: null },
      maze: { walkable: (col, row) => state.map[row]?.[col] !== undefined && state.map[row][col] !== 1 },
    };
    const movement = new MovementSystem(game);
    const advance = (ms) => movement.move(actor, actor.speed * ms / 1000, () => {
      if (movement.canGo(actor, actor.next)) actor.dir = actor.next;
      return movement.canGo(actor, actor.dir) ? actor.dir : null;
    });
    let cursor = 0;
    for (const input of this.inputs) {
      if (input.at > now) continue;
      const at = Math.min(elapsed, Math.max(cursor, input.at - origin));
      advance(at - cursor);
      actor.next = input.dir;
      if (actor.progress > 0 && input.dir === OPPOSITE[actor.dir])
        movement.reverse(actor);
      cursor = at;
    }
    advance(elapsed - cursor);
    return { ...player, ...movement.position(actor), dir: actor.dir, moving: actor.moving };
  }
}
