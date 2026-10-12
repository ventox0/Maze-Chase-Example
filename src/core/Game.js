import { profileStorage } from "../account/ProfileStorage.js";
import { randomPowerSeed } from "../gameplay/power-pellets.js";
import { AudioManager } from "../audio/AudioManager.js";
import { loadoutDialog } from "./dom.js";
import { GameComponent } from "./GameComponent.js";
import { GHOST_RESPAWN_DELAY, MAX_LEVEL, STEP, TILE } from "../data/config.js";
import { GHOSTS } from "../data/ghosts.js";
import { AbilitySystem } from "../gameplay/AbilitySystem.js";
import { GhostManager } from "../gameplay/GhostManager.js";
import { MazeMap } from "../gameplay/MazeMap.js";
import { MovementSystem } from "../gameplay/MovementSystem.js";
import { PlayerController } from "../gameplay/PlayerController.js";
import { Localization } from "../i18n/Localization.js";
import { LANGUAGE_KEY } from "../i18n/messages.js";
import { InputController } from "../input/InputController.js";
import { AssetLoader } from "../rendering/AssetLoader.js";
import { CanvasRenderer } from "../rendering/CanvasRenderer.js";
import { CutsceneManager } from "../rendering/CutsceneManager.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import { PointWallet } from "../storage/PointWallet.js";
import { SaveManager } from "../storage/SaveManager.js";
import { GameUI } from "../ui/GameUI.js";
import { LevelSelection } from "../ui/LevelSelection.js";
import { PointShop } from "../ui/PointShop.js";
import { SettingsMenu } from "../ui/SettingsMenu.js";
import { ArcadePresentation } from "../rendering/ArcadePresentation.js";

import { ChallengeMode } from "../gameplay/ChallengeMode.js";
import { ChallengeSelection } from "../ui/ChallengeSelection.js";
import { CHALLENGE_HIGH_KEY } from "../data/challenges.js";

import { MissionProgress } from "../storage/MissionProgress.js";
import { MissionMenu } from "../ui/MissionMenu.js";

// Sistemleri bir araya getirir; durum geçişleri ve sabit zamanlı oyun döngüsü.
export class Game extends GameComponent {
  constructor() {
    super();
    this.mode = "campaign";
    this.menuMode = "campaign";
    this.score = 0;
    this.highScore = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "ready";
    this.gameTime = 0;
    this.powerUntil = 0;
    this.stateTime = 0;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.invulnerableUntil = 0;
    this.newRecord = false;
    this.maze = new MazeMap(this);
    this.movement = new MovementSystem(this);
    this.player = new PlayerController(this);
    this.ghosts = new GhostManager(this);
    this.abilities = new AbilitySystem(this);
    this.audio = new AudioManager(this);
    this.i18n = new Localization(this);
    this.ui = new GameUI(this);
    this.assets = new AssetLoader(this);
    this.effects = new ParticleSystem(this);
    this.cutscenes = new CutsceneManager(this);
    this.renderer = new CanvasRenderer(this);
    this.input = new InputController(this);
    this.saves = new SaveManager(this);
    this.levels = new LevelSelection(this);
    this.wallet = new PointWallet(this);
    this.shop = new PointShop(this);
    this.settings = new SettingsMenu(this);
    this.arcade = new ArcadePresentation(this);
    this.challenges = new ChallengeMode(this);
    this.challengeMenu = new ChallengeSelection(this);
    this.missions = new MissionProgress(this);
    this.missionMenu = new MissionMenu(this);
    this.runId = this.wallet.newRunId();
  }

  start() {
    // Depolama kapalıyken de oyun açılır; veri yalnızca başlangıçta okunur.
    try {
      const saved = profileStorage.getItem(LANGUAGE_KEY);
      if (saved === "tr" || saved === "en") this.i18n.language = saved;
    } catch (_) {}
    try {
      const stored = Number(profileStorage.getItem("maze-chaser-high-score"));
      this.highScore = Number.isFinite(stored) ? Math.max(0, stored) : 0;
    } catch (_) {}
    this.challenges.load();
    this.settings.load();
    this.wallet.load();
    this.saves.load();
    this.missions.load();
    this.assets.loadSprites();
    this.assets.loadGhostSprites();
    this.assets.loadActionSprites();
    this.assets.loadShopSprites();
    this.renderer.configureCanvas();
    this.loadLevel();
    this.changeState("ready");
    this.i18n.applyLanguage();
    this.input.bindEvents();
    requestAnimationFrame(this.frame);
  }

  resetActors() {
    this.cutscenes.current = null;
    this.arcade.reset();
    this.player.entity = { ...this.movement.actor(10, 17), next: "left" };
    this.renderer.playerAnimation.reset();
    this.ghosts.entities = this.ghosts
      .levelGhosts(this.level)
      .map((g, index) => {
        const releaseAt = this.gameTime + 0.6 + index * 1.1;
        return {
          ...g,
          ...this.movement.actor(9 + index, 9, index === 1 ? "up" : "left"),
          index,
          releaseAt,
          immuneUntil: 0,
          skillEpoch: releaseAt,
          skillReadyAt: releaseAt + 5,
          wallPlan: null,
          wallHop: null,
        };
      });
    this.powerUntil = 0;
    this.invulnerableUntil = this.gameTime + 2;
    this.abilities.jump = null;
    this.abilities.pendingJumpUntil = 0;
    this.abilities.magnetUntil = 0;
    this.abilities.boostUntil = 0;
    this.abilities.shieldUntil = 0;
    this.abilities.pelletTrails = [];
  }

  loadLevel() {
    this.maze.phase = "maze";
    this.maze.bonusReward = "";
    this.maze.bonusRewardKey = "";
    this.maze.grid = this.challenges.active
      ? this.challenges.createMap()
      : this.maze.createLevelMap(this.level, { powerSeed: randomPowerSeed() });
    this.maze.pellets = this.maze.grid
      .flat()
      .filter((cell) => cell === 2 || cell === 3).length;
    this.effects.particles = [];
    this.effects.floatingTexts = [];
    this.abilities.jumpReadyAt = 0;
    this.abilities.magnetReadyAt = 0;
    this.abilities.boostReadyAt = 0;
    this.abilities.shieldReadyAt = 0;
    this.resetActors();
    this.maze.buildWalls();
    this.ui.updateHUD();
  }

  startGame(startLevel = 1) {
    if (!this.saves.validLevel(startLevel)) return;
    this.challenges.leave();
    this.menuMode = "campaign";
    this.startRun(startLevel);
  }

  startRun(startLevel, lives = 3) {
    this.runId = this.wallet.newRunId();
    this.missions.beginRun();
    this.score = 0;
    this.lives = lives;
    this.level = startLevel;
    if (!this.challenges.active) this.levels.selected = startLevel;
    this.gameTime = 0;
    this.newRecord = false;
    this.cutscenes.sequence = 0;
    this.loadLevel();
    this.changeState("playing");
    this.ui.announce("announce.start");
    this.audio.resumeAudio();
    this.arcade.beginTransition();
  }

  nextLevel() {
    if (this.challenges.active || this.level >= MAX_LEVEL) return;
    this.level++;
    this.loadLevel();
    this.changeState("playing");
    this.arcade.beginTransition();
    const fresh = GHOSTS.find((g) => g.unlock === this.level);
    this.ui.announce("announce.next", {
      level: this.level,
      newGhost: fresh
        ? this.i18n.t("ghostNew", {
            name: fresh.name,
            detail: this.i18n.t("ghost." + fresh.id + ".detail"),
          })
        : "",
    });
  }

  changeState(next, checkpoint = true) {
    const previous = this.state;
    if (
      checkpoint &&
      next === "victory" &&
      previous !== next &&
      !this.challenges.active &&
      this.maze.phase === "complete"
    )
      this.missions.record("levels");
    if (next === "victory" || next === "gameover")
      this.challenges.finish(next === "victory");
    this.state = next;
    if (next === "gameover") this.arcade.hit = null;
    this.stateTime = 0;
    this.accumulator = 0;
    if (["paused", "ready", "gameover", "victory"].includes(next))
      this.audio.stopAll();
    this.ui.renderStateScreen();
    this.saves.renderFeedback();
    this.ui.updateHUD();
    if (
      checkpoint &&
      !this.challenges.active &&
      next === "victory" &&
      previous !== next
    )
      this.saves.checkpoint();
  }

  mainAction() {
    if (
      loadoutDialog.open ||
      this.levels.dialog.open ||
      this.shop.dialog.open ||
      this.settings.dialog.open ||
      this.challengeMenu.dialog.open ||
      this.missionMenu.dialog.open
    )
      return;
    this.audio.resumeAudio();
    if (
      (this.challenges.active &&
        ["victory", "gameover"].includes(this.state)) ||
      (this.state === "ready" && this.menuMode === "challenge")
    )
      this.challengeMenu.open();
    else if (this.state === "ready" || this.state === "gameover")
      this.levels.open();
    else if (this.state === "victory") {
      if (this.level === MAX_LEVEL) this.levels.open();
      else this.abilities.openLoadout("next");
    } else if (this.state === "paused") this.resumeGameplay();
    else if (this.state === "dying") {
      this.resetActors();
      this.changeState("playing");
    }
  }

  saveAndMenu() {
    if (this.challenges.active) {
      this.challenges.menu();
      return;
    }
    if (!this.saves.saveManual()) return;
    this.levels.selected = this.saves.slots.manual.data.level;
    this.cutscenes.current = null;
    this.arcade.reset();
    this.lastFrame = 0;
    this.accumulator = 0;
    this.changeState("ready");
  }

  togglePause() {
    if (
      this.settings.dialog.open ||
      this.shop.dialog.open ||
      this.missionMenu.dialog.open
    )
      return;
    if (["playing", "cutscene", "transition"].includes(this.state)) {
      this.changeState("paused");
      this.ui.announce("announce.pause");
    } else if (this.state === "paused") this.resumeGameplay();
  }

  addScore(points) {
    this.score += points;
    this.wallet.credit(points);
    this.missions.observeScore();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.newRecord = true;
      if (this.challenges.active) this.challenges.best = this.highScore;
      try {
        profileStorage.setItem(
          this.challenges.active
            ? CHALLENGE_HIGH_KEY
            : "maze-chaser-high-score",
          String(this.highScore),
        );
      } catch (_) {}
    }
  }

  checkCollisions() {
    if (
      this.state !== "playing" ||
      this.cutscenes.current ||
      this.abilities.jump
    )
      return; // Havada temas yok; inişten itibaren normal çarpışma kuralları geçerli.
    const p = this.movement.position(this.player.entity);
    for (const ghost of this.ghosts.entities) {
      if (this.gameTime < ghost.releaseAt || ghost.wallHop) continue;
      const g = this.movement.position(ghost);
      if (Math.hypot(p.x - g.x, p.y - g.y) > TILE * 0.68) continue;
      if (
        this.gameTime < this.powerUntil &&
        this.gameTime >= ghost.immuneUntil
      ) {
        if (!this.challenges.beforeGhostCaught()) break;
        this.addScore(200);
        this.missions.record("ghosts");
        this.arcade.ghostCaught();
        this.effects.burst(g.x, g.y, ghost.color, 16);
        this.effects.floatingTexts.push({
          x: g.x,
          y: g.y,
          text: "+200",
          life: 1,
        });
        Object.assign(ghost, this.movement.actor(10, 9, "up"));
        // Yenilen hayalet merkezde 3 sn bekler, güç modu bitene kadar korunur.
        ghost.releaseAt = this.gameTime + GHOST_RESPAWN_DELAY;
        ghost.immuneUntil = this.powerUntil;
        ghost.skillEpoch = ghost.releaseAt;
        ghost.skillReadyAt = ghost.releaseAt + 5;
        ghost.wallPlan = null;
        ghost.wallHop = null;
        this.audio.play("ghost");
        this.cutscenes.beginCutscene(ghost);
        break;
      } else if (
        this.gameTime >= this.invulnerableUntil &&
        this.gameTime >= this.abilities.shieldUntil
      ) {
        this.lives--;
        this.arcade.combo = 0;
        this.arcade.impact("hurt");
        this.effects.burst(p.x, p.y, "#ffe15b", 24);
        this.powerUntil = 0;
        this.abilities.magnetUntil = 0;
        this.abilities.boostUntil = 0;
        this.abilities.shieldUntil = 0;
        this.abilities.pendingJumpUntil = 0;
        this.abilities.pelletTrails = [];
        this.changeState(this.lives > 0 ? "dying" : "gameover");
        this.audio.play("hurt");
        this.ui.announce(
          this.lives > 0 ? "announce.lives" : "announce.gameover",
          { lives: this.lives, score: this.i18n.formatScore(this.score) },
        );
        break;
      }
    }
  }

  update(dt) {
    // Sunum geçişi dünyayı ilerletmez; tüm duraklatmalar süreleri birlikte dondurur.
    const inTransition = this.state === "transition";
    this.arcade.update(dt);
    if (inTransition) return;
    if (this.state === "cutscene") {
      this.cutscenes.advanceCutscene(dt);
      return;
    }
    if (this.state === "dying") {
      this.stateTime += dt;
      if (this.stateTime >= 1.3) {
        this.resetActors();
        this.changeState("playing");
      }
      return;
    }
    if (this.state !== "playing") return;
    this.gameTime += dt;
    this.challenges.update();
    if (this.state !== "playing") return;
    this.player.update(dt);
    this.renderer.playerAnimation.update(
      dt,
      this.movement.position(this.player.entity),
      this.player.entity,
      this.abilities.jump,
    );
    this.abilities.attractPellets();
    if (this.state !== "playing") return;
    this.ghosts.update(dt);
    this.checkCollisions();
    this.effects.update(dt);
    this.abilities.updateTrails(dt);
  }

  resumeGameplay() {
    this.changeState(
      this.arcade.transition
        ? "transition"
        : this.cutscenes.current
          ? "cutscene"
          : "playing",
    );
    this.audio.resumeAudio();
  }

  frame(timestamp) {
    const elapsed = this.lastFrame
      ? Math.min((timestamp - this.lastFrame) / 1000, 0.1)
      : 0;
    this.lastFrame = timestamp;
    this.accumulator += elapsed;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.update(STEP);
    }
    this.renderer.render(timestamp / 1000);
    this.ui.updateHUD();
    requestAnimationFrame(this.frame);
  }
}
