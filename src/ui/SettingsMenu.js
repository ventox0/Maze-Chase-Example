import { $, canvas, loadoutDialog, motionPreference } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { REDUCED_CUTSCENE_DURATION } from "../rendering/animation.js";

export const SETTINGS_KEY = "maze-chaser-settings-v1";
export const DEFAULT_SETTINGS = Object.freeze({
  sound: false,
  volume: 0.65,
  shake: true,
  particles: true,
  transitions: true,
  reducedMotion: false,
});

// Tercihler oyun kaydından bağımsızdır; bozuk/kapalı depolama oyunu engellemez.
export class SettingsMenu extends GameComponent {
  constructor(game) {
    super(game);
    this.values = { ...DEFAULT_SETTINGS };
    this.dialog = $("settings-dialog");
    this.resumeAfterClose = false;
    this.feedbackKey = "settings.savedHint";
  }
  normalize(source) {
    const values = { ...DEFAULT_SETTINGS };
    if (!source || typeof source !== "object") return values;
    for (const key of Object.keys(values)) {
      if (key === "volume") {
        if (typeof source.volume === "number" && Number.isFinite(source.volume))
          values.volume = Math.max(0, Math.min(1, source.volume));
      } else if (typeof source[key] === "boolean") values[key] = source[key];
    }
    return values;
  }
  load() {
    try {
      this.values = this.normalize(
        JSON.parse(localStorage.getItem(SETTINGS_KEY)),
      );
    } catch {
      this.values = { ...DEFAULT_SETTINGS };
    }
    this.apply();
  }
  get reduced() {
    return this.values?.reducedMotion || Boolean(motionPreference?.matches);
  }
  effectsAllowed(key) {
    return this.values[key] && !this.reduced;
  }
  apply() {
    this.game.audio.enabled = this.values.sound;
    this.game.audio.syncVolume();
    if (!this.values.sound) this.game.audio.stopAll();
    if (!this.effectsAllowed("particles")) this.game.effects.particles = [];
    document.documentElement.dataset.motion = this.reduced ? "reduced" : "full";
    const scene = this.game.cutscenes.current;
    if (this.reduced && scene && !scene.reduced) {
      scene.elapsed =
        (scene.elapsed / scene.duration) * REDUCED_CUTSCENE_DURATION;
      scene.duration = REDUCED_CUTSCENE_DURATION;
      scene.reduced = true;
    }
    const intro = this.game.arcade.transition;
    if (this.reduced && intro && intro.duration > 0.5) {
      intro.elapsed = (intro.elapsed / intro.duration) * 0.5;
      intro.duration = 0.5;
    }
    this.game.ui.renderSoundControl();
    this.render();
  }
  update(key, value) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) return;
    if (
      key === "volume"
        ? typeof value !== "number" || !Number.isFinite(value)
        : typeof value !== "boolean"
    )
      return;
    this.values = this.normalize({ ...this.values, [key]: value });
    this.feedbackKey = "settings.saved";
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.values));
    } catch {
      this.feedbackKey = "settings.unsaved";
    }
    this.apply();
    if (this.values.sound) this.game.audio.resumeAudio();
    if (!this.values.transitions && this.game.arcade.transition)
      this.game.arcade.finishTransition();
  }
  open() {
    if (
      this.dialog.open ||
      this.game.shop.dialog.open ||
      this.game.challengeMenu.dialog.open ||
      this.game.missionMenu.dialog.open ||
      this.game.levels.dialog.open ||
      loadoutDialog.open ||
      this.game.state === "dying"
    )
      return;
    this.resumeAfterClose = ["playing", "cutscene", "transition"].includes(
      this.game.state,
    );
    if (this.resumeAfterClose) this.game.togglePause();
    this.render();
    this.dialog.showModal();
    this.game.ui.updateHUD();
  }
  close() {
    if (!this.dialog.open) return;
    this.dialog.close();
    if (this.resumeAfterClose && this.game.state === "paused")
      this.game.resumeGameplay();
    this.resumeAfterClose = false;
    this.game.ui.updateHUD();
    canvas.focus({ preventScroll: true });
  }
  render() {
    for (const key of Object.keys(DEFAULT_SETTINGS))
      if (key !== "volume") $("settings-" + key).checked = this.values[key];
    $("settings-volume").value = Math.round(this.values.volume * 100);
    $("settings-volume-value").textContent =
      Math.round(this.values.volume * 100) + "%";
    $("settings-preview").disabled =
      !this.values.sound || this.values.volume === 0;
    $("settings-status").textContent = this.game.i18n.t(this.feedbackKey);
    $("settings-motion-note").textContent = this.game.i18n.t(
      motionPreference?.matches
        ? "settings.systemReduced"
        : "settings.motionHint",
    );
  }
  bindEvents() {
    $("settings-button").addEventListener("click", this.open);
    $("settings-close").addEventListener("click", this.close);
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const control = $("settings-" + key);
      control.addEventListener(key === "volume" ? "input" : "change", () =>
        this.update(
          key,
          key === "volume" ? Number(control.value) / 100 : control.checked,
        ),
      );
    }
    $("settings-preview").addEventListener("click", () => {
      this.game.audio.resumeAudio();
      this.game.audio.play("preview");
    });
    motionPreference?.addEventListener?.("change", this.apply);
  }
}
