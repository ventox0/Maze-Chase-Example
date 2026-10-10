import { $ } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { ABILITIES, JUMP_DURATION } from "../data/abilities.js";
import { SPRITE_SOURCES } from "../data/assets.js";
import { MAX_LEVEL, POWER_DURATION } from "../data/config.js";
import { GHOSTS } from "../data/ghosts.js";

// Menüler, skor/can göstergeleri, model portresi ve erişilebilir bildirimler.
export class GameUI extends GameComponent {
  constructor(game) {
    super(game);
    this.elements = {
      score: $("score"),
      high: $("high-score"),
      lives: $("lives"),
      level: $("level"),
      overlay: $("overlay"),
      title: $("overlay-title"),
      description: $("overlay-description"),
      kicker: $("overlay-kicker"),
      action: $("main-action"),
      hint: $("overlay-hint"),
      mode: $("mode-text"),
      bar: $("power-bar"),
      pause: $("pause-label"),
    };
    this.lastHud = "";
    this.ghostHudKey = "";
    this.lastPlayerSkin = "";
    this.lastAnnouncement = null;
  }

  renderSoundControl() {
    $("sound-label").textContent = this.game.i18n.t(
      this.game.audio.enabled ? "soundOn" : "soundOff",
    );
    $("sound-button").setAttribute(
      "aria-label",
      this.game.i18n.t(this.game.audio.enabled ? "mute" : "unmute"),
    );
    $("sound-button").setAttribute(
      "aria-pressed",
      String(this.game.audio.enabled),
    );
  }

  announce(key, values = {}) {
    this.lastAnnouncement = { key, values };
    $("announcement").textContent = this.game.i18n.t(key, values);
  }

  renderStateScreen() {
    this.elements.overlay.hidden =
      this.game.state === "playing" || this.game.state === "cutscene";
    this.renderCutsceneUI();
    $("menu-language").hidden = this.game.state !== "ready";
    const slot = this.game.saves.latest(),
      record = slot ? this.game.saves.slots[slot] : null;
    $("resume-game").hidden =
      !record || !["ready", "gameover"].includes(this.game.state);
    if (record)
      $("resume-game").textContent = this.game.i18n.t("save.continue", {
        level: record.data.level,
      });
    this.elements.overlay.classList.toggle(
      "language-menu",
      this.game.state === "ready",
    );
    this.elements.pause.textContent = this.game.i18n.t(
      this.game.state === "paused" ? "resume" : "pause",
    );
    $("pause-button").setAttribute(
      "aria-label",
      this.game.i18n.t(
        this.game.state === "paused" ? "resumeAria" : "pauseAria",
      ),
    );
    this.game.maze.bonusReward = this.game.maze.bonusRewardKey
      ? this.game.i18n.t(this.game.maze.bonusRewardKey)
      : "";
    const values = {
      lives: this.game.lives,
      level: this.game.level,
      score: this.game.i18n.formatScore(this.game.score),
      reward: this.game.maze.bonusReward,
    };
    const screens = {
      ready: [
        "ready.kicker",
        "ready.title",
        "ready.description",
        "ready.action",
      ],
      paused: ["paused.kicker", "paused.title", "paused.description", "resume"],
      dying: ["dying.kicker", "dying.title", "dying.description", "resume"],
      victory:
        this.game.level === MAX_LEVEL
          ? [
              "finished.kicker",
              "finished.title",
              "finished.description",
              "finished.action",
            ]
          : [
              "victory.kicker",
              "victory.title",
              "victory.description",
              "victory.action",
            ],
      gameover: [
        this.game.newRecord ? "record" : "gameover.kicker",
        "gameover.title",
        "gameover.description",
        "gameover.action",
      ],
    };
    if (screens[this.game.state]) {
      const [kicker, title, description, button] = screens[this.game.state];
      this.elements.kicker.textContent = this.game.i18n.t(kicker);
      this.elements.title.textContent = this.game.i18n.t(title);
      this.elements.description.textContent = this.game.i18n.t(
        description,
        values,
      );
      this.elements.action.firstElementChild.textContent =
        this.game.i18n.t(button);
      this.elements.hint.textContent = this.game.i18n.t(
        this.game.state === "dying" ? "dying.hint" : "hint",
      );
    }
  }

  updateHUD() {
    const remaining = Math.max(0, this.game.powerUntil - this.game.gameTime);
    const key = [
      this.game.score,
      this.game.highScore,
      this.game.lives,
      this.game.level,
      this.game.state,
      this.game.maze.phase,
      Math.ceil(remaining),
    ].join("|");
    if (key !== this.lastHud) {
      this.elements.score.textContent = String(this.game.score).padStart(
        5,
        "0",
      );
      this.elements.high.textContent = String(this.game.highScore).padStart(
        5,
        "0",
      );
      this.elements.level.textContent = String(this.game.level).padStart(
        2,
        "0",
      );
      $("map-label").textContent = this.game.i18n.t("map.label", {
        name: this.game.i18n.t(
          "map." + this.game.maze.mapStyle(this.game.level).id,
        ),
      });
      $("map-label").style.color = this.game.maze.mapStyle(
        this.game.level,
      ).color;
      [...this.elements.lives.children].forEach((el, i) =>
        el.classList.toggle("lost", i >= this.game.lives),
      );
      this.elements.lives.setAttribute(
        "aria-label",
        this.game.i18n.t("livesAria", { lives: this.game.lives }),
      );
      $("mode-label").textContent = this.game.i18n.t(
        this.game.maze.phase === "bonus" ? "bonusMode" : "powerMode",
      );
      this.elements.mode.textContent =
        this.game.maze.phase === "bonus"
          ? this.game.i18n.t("bonusTarget")
          : remaining > 0
            ? this.game.i18n.t("hunt", { seconds: Math.ceil(remaining) })
            : this.game.i18n.t("findPower");
      this.lastHud = key;
    }
    this.game.shop.updateWallet();
    $("save-button").disabled = !this.game.saves.canSave();
    $("home-button").disabled = !this.game.saves.canSave();
    $("bonus-banner").hidden =
      this.game.maze.phase !== "bonus" || this.game.state !== "playing";
    this.renderGhostRoster();
    $("slow-notice").hidden = !this.game.ghosts.playerSlowed();
    $("slow-notice").textContent = this.game.i18n.t("ghostSlow");
    const skin = this.game.player.currentPlayerSkin(),
      equipment = this.game.wallet.profile.equipped;
    const customized =
        skin === "normal" && (equipment.outfit || equipment.head),
      skinKey = skin + "|" + equipment.outfit + "|" + equipment.head;
    if (skinKey !== this.lastPlayerSkin) {
      $("player-model").textContent = customized
        ? this.game.shop.equippedName()
        : this.game.i18n.modelName(skin);
      $("player-portrait").src = customized
        ? this.game.shop.avatar(equipment.outfit, equipment.head)
        : SPRITE_SOURCES[skin];
      $("player-portrait").setAttribute(
        "alt",
        this.game.i18n.t("modelAlt", {
          model: customized
            ? this.game.shop.equippedName()
            : this.game.i18n.modelName(skin),
        }),
      );
      this.lastPlayerSkin = skinKey;
    }
    this.elements.bar.style.width = `${(remaining / POWER_DURATION) * 100}%`;
    const readyAt = {
      jump: this.game.abilities.jumpReadyAt,
      magnet: this.game.abilities.magnetReadyAt,
      boost: this.game.abilities.boostReadyAt,
      shield: this.game.abilities.shieldReadyAt,
    };
    const until = {
      jump: this.game.abilities.jump ? this.game.gameTime + JUMP_DURATION : 0,
      magnet: this.game.abilities.magnetUntil,
      boost: this.game.abilities.boostUntil,
      shield: this.game.abilities.shieldUntil,
    };
    for (const slot of ["q", "e"]) {
      const id = this.game.abilities.loadout[slot],
        ability = ABILITIES[id],
        wait = Math.max(0, readyAt[id] - this.game.gameTime),
        active = Math.max(0, until[id] - this.game.gameTime),
        button = $(`${slot}-button`);
      $(`${slot}-name`).textContent = this.game.i18n.abilityName(id);
      $(`${slot}-help`).textContent = this.game.i18n.abilityName(id);
      $(`${slot}-status`).textContent =
        id === "jump" && this.game.abilities.jump
          ? this.game.i18n.t("jumping")
          : id === "jump" &&
              this.game.abilities.pendingJumpUntil > this.game.gameTime
            ? this.game.i18n.t("pendingJump")
            : active > 0
              ? this.game.i18n.t("active", { seconds: Math.ceil(active) })
              : wait > 0
                ? this.game.i18n.t("cooldown", { seconds: Math.ceil(wait) })
                : this.game.i18n.t("abilityReady", {
                    seconds: ability.duration || ability.cooldown,
                    kind: this.game.i18n.t(
                      ability.duration ? "durationKind" : "cooldownKind",
                    ),
                  });
      button.disabled =
        this.game.state !== "playing" ||
        wait > 0 ||
        (id === "jump" && !!this.game.abilities.jump);
      button.classList.toggle("active", active > 0);
      button.setAttribute(
        "aria-label",
        `${slot.toUpperCase()}: ${this.game.i18n.abilityName(id)}`,
      );
    }
  }

  renderCutsceneUI() {
    $("cutscene-ui").hidden = this.game.state !== "cutscene";
    if (!this.game.cutscenes.current) return;
    $("cutscene-title").textContent =
      this.game.i18n.t("action." + this.game.cutscenes.current.kind) +
      " · " +
      this.game.cutscenes.current.ghost.name;
  }

  ghostRow(g, guide = false) {
    const unlocked = this.game.level >= g.unlock,
      sprite = this.game.assets.ghosts[g.id];
    const portrait = sprite
      ? `<img class="ghost-portrait" src="${sprite.toDataURL()}" alt="" aria-hidden="true">`
      : `<span class="ghost-icon" aria-hidden="true"></span>`;
    return `<div class="enemy-row ${guide && !unlocked ? "locked" : ""}" style="--ghost:${g.color}">${portrait}<div><div class="enemy-name">${g.name}</div><div class="enemy-note">${this.game.i18n.t("ghost." + g.id + ".detail")}</div>${guide ? `<div class="ghost-unlock">${this.game.i18n.t(unlocked ? "ghostUnlocked" : "ghostUnlock", { level: g.unlock })}</div>` : ""}</div></div>`;
  }

  renderGhostRoster() {
    const roster = this.game.ghosts.levelGhosts(this.game.level),
      key =
        this.game.i18n.language +
        "|" +
        this.game.level +
        "|" +
        Object.keys(this.game.assets.ghosts).length;
    if (key === this.ghostHudKey) return;
    this.ghostHudKey = key;
    $("active-ghost-list").innerHTML = roster
      .map((g) => this.ghostRow(g))
      .join("");
    $("ghost-guide-list").innerHTML = GHOSTS.map((g) =>
      this.ghostRow(g, true),
    ).join("");
    const next = GHOSTS.find((g) => g.unlock > this.game.level);
    $("next-ghost").textContent = next
      ? this.game.i18n.t("ghostNext", { name: next.name, level: next.unlock })
      : this.game.i18n.t("ghostAllUnlocked");
    $("ghost-level-summary").textContent = this.game.i18n.t("ghostLevel", {
      level: this.game.level,
      count: roster.length,
    });
  }
}
