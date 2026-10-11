import { GameComponent } from "../core/GameComponent.js";
import {
  CHALLENGE_HIGH_KEY,
  generateChallenge,
  applyChallengeRule,
} from "../data/challenges.js";

// Tek haritalık denemeler; bölüm ilerlemesi ve bölüm rekoru ayrı kalır.
export class ChallengeMode extends GameComponent {
  constructor(game) {
    super(game);
    this.current = null;
    this.result = null;
    this.best = 0;
    this.campaignHigh = null;
    this.skillsUsed = 0;
    this.ghostsCaught = 0;
  }
  load() {
    try {
      const score = Number(localStorage.getItem(CHALLENGE_HIGH_KEY));
      this.best = Number.isSafeInteger(score) && score >= 0 ? score : 0;
    } catch (_) {}
  }
  create(difficulty) {
    const values = new Uint32Array(1);
    const seed = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(values)[0]
      : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return generateChallenge(seed, difficulty);
  }
  get active() {
    return this.game.mode === "challenge" && !!this.current;
  }
  skillsAllowed() {
    return (
      !this.active ||
      (this.current.rule !== "noSkills" &&
        (!this.current.abilityLimit ||
          this.skillsUsed < this.current.abilityLimit))
    );
  }
  start(definition) {
    if (!definition) return;
    // Menüden gelen tanım yalnızca doğrulanmış tohum ve zorlukla yeniden üretilir.
    const challenge = generateChallenge(definition.seed, definition.difficulty);
    if (!this.active) this.campaignHigh = this.game.highScore;
    this.current = challenge;
    this.result = null;
    this.skillsUsed = 0;
    this.ghostsCaught = 0;
    this.game.mode = "challenge";
    this.game.menuMode = "challenge";
    this.game.highScore = this.best;
    this.game.startRun(challenge.level, challenge.lives);
    this.game.ui.announce("challenge.started", {
      rule: this.game.i18n.t("challenge.rule." + challenge.rule),
    });
  }
  leave() {
    if (this.campaignHigh !== null) this.game.highScore = this.campaignHigh;
    this.campaignHigh = null;
    this.current = null;
    this.result = null;
    this.game.mode = "campaign";
  }
  createMap() {
    const c = this.current;
    const grid = this.game.maze.createLevelMap(c.level, {
      seed: c.seed,
      styleLevel: c.styleLevel,
    });
    return applyChallengeRule(grid, c.rule);
  }
  beforePellet(value) {
    if (
      this.active &&
      !this.result &&
      value === 3 &&
      this.current.rule === "powerLast" &&
      this.game.maze.grid.some((row) => row.includes(2))
    ) {
      this.fail("earlyPower");
      return false;
    }
    return true;
  }
  skillBlockKey() {
    return this.active && this.current.rule === "limitedSkills"
      ? "challenge.skillsEmpty"
      : "challenge.skillsDisabled";
  }
  recordSkill() {
    if (this.active) this.skillsUsed++;
  }
  beforeGhostCaught() {
    if (!this.active) return true;
    if (this.current.rule === "pacifist") {
      this.fail("pacifist");
      return false;
    }
    this.ghostsCaught++;
    return true;
  }
  beforeBonus() {
    if (
      this.active &&
      this.current.ghostTarget &&
      this.ghostsCaught < this.current.ghostTarget
    ) {
      this.fail("huntIncomplete");
      return false;
    }
    return true;
  }
  progressText() {
    if (!this.active) return "";
    if (this.current.abilityLimit)
      return this.game.i18n.t("challenge.skillsLeft", {
        count: Math.max(0, this.current.abilityLimit - this.skillsUsed),
      });
    if (this.current.ghostTarget)
      return this.game.i18n.t("challenge.huntProgress", {
        count: this.ghostsCaught,
        target: this.current.ghostTarget,
      });
    return "";
  }
  failureValues() {
    return { target: this.current?.ghostTarget || 0, count: this.ghostsCaught };
  }
  update() {
    if (
      this.active &&
      !this.result &&
      this.current.timeLimit &&
      this.game.gameTime >= this.current.timeLimit
    )
      this.fail("timeout");
  }
  fail(reason) {
    if (!this.active || this.result) return;
    this.result = { won: false, reason };
    this.game.changeState("gameover");
    this.game.audio.play("hurt");
    this.game.ui.announce("challenge.failed", {
      reason: this.game.i18n.t(
        "challenge.failure." + reason,
        this.failureValues(),
      ),
    });
  }
  finish(won) {
    if (!this.active || this.result) return;
    this.result = { won, reason: won ? "" : "lives" };
    if (won) {
      this.game.addScore(this.current.reward);
      this.game.missions.record("challenges");
      this.game.missions.record("rule-" + this.current.rule);
    }
  }
  menu() {
    this.leave();
    this.game.menuMode = "campaign";
    this.game.cutscenes.current = null;
    this.game.arcade.reset();
    this.game.level = this.game.levels.selected;
    this.game.gameTime = 0;
    this.game.score = 0;
    this.game.lives = 3;
    this.game.newRecord = false;
    this.game.loadLevel();
    this.game.changeState("ready");
    this.game.saves.renderFeedback();
  }
}
