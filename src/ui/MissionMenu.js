import { $, canvas, loadoutDialog } from "../core/dom.js";
import { GameComponent } from "../core/GameComponent.js";
import { missionCosmetics } from "../data/cosmeticRewards.js";
import { MISSIONS, MISSION_CATEGORIES } from "../data/missions.js";

// Tüm hedefler paralel ilerler. Filtre ve sayfalama oyuncunun hedef bulmasını kolaylaştırır.
export class MissionMenu extends GameComponent {
  constructor(game) {
    super(game);
    this.dialog = $("missions-dialog");
    this.filter = "all";
    this.category = "all";
    this.page = 0;
    this.pageSize = 10;
    this.resumeAfterClose = false;
    this.lastBadge = "";
    this.feedbackKey = "missions.hint";
  }
  open() {
    if (
      this.dialog.open ||
      this.game.shop.dialog.open ||
      this.game.settings.dialog.open ||
      this.game.levels.dialog.open ||
      this.game.challengeMenu.dialog.open ||
      loadoutDialog.open ||
      this.game.state === "dying"
    )
      return;
    this.resumeAfterClose = ["playing", "cutscene", "transition"].includes(
      this.game.state,
    );
    if (this.resumeAfterClose) this.game.togglePause();
    this.game.wallet.refresh();
    this.game.missions.refresh();
    this.render();
    this.dialog.showModal();
    this.game.ui.updateHUD();
  }
  close() {
    this.dialog.close();
    if (this.resumeAfterClose && this.game.state === "paused")
      this.game.resumeGameplay();
    this.resumeAfterClose = false;
    this.game.ui.updateHUD();
    canvas.focus({ preventScroll: true });
  }
  visible() {
    return MISSIONS.filter(
      (m) =>
        (this.category === "all" || m.category === this.category) &&
        (this.filter === "all" || this.game.missions.status(m) === this.filter),
    );
  }
  setFilter(value) {
    if (!["all", "active", "ready", "claimed"].includes(value)) return;
    this.filter = value;
    this.page = 0;
    this.render();
  }
  setCategory(value) {
    if (value !== "all" && !MISSION_CATEGORIES.includes(value)) return;
    this.category = value;
    this.page = 0;
    this.render();
  }
  changePage(delta) {
    this.page = Math.max(
      0,
      Math.min(
        Math.ceil(this.visible().length / this.pageSize) - 1,
        this.page + delta,
      ),
    );
    this.render();
    this.dialog.scrollTop = 0;
  }
  claim(id) {
    this.feedbackKey = this.game.missions.claim(id)
      ? "missions.claimedMessage"
      : this.game.missions.complete(
            MISSIONS.find((m) => m.id === id) || {
              target: Infinity,
              metric: "earned",
            },
          )
        ? "missions.rewardError"
        : "missions.notReady";
    this.render();
    this.game.ui.updateHUD();
  }
  claimAll() {
    const ready = MISSIONS.filter(
      (m) => this.game.missions.status(m) === "ready",
    );
    let count = 0;
    for (const m of ready) if (this.game.missions.claim(m.id)) count++;
    this.feedbackKey = count
      ? "missions.allClaimed"
      : this.game.missions.storageUnavailable
        ? "missions.storageWarning"
        : "missions.rewardError";
    this.render();
    this.game.ui.updateHUD();
  }
  text(mission) {
    const values = {
      target: this.game.i18n.formatScore(mission.target),
      ability: mission.ability
        ? this.game.i18n.abilityName(mission.ability)
        : "",
      rule: mission.rule
        ? this.game.i18n.t("challenge.rule." + mission.rule)
        : "",
    };
    return {
      name: this.game.i18n.t("missions.name." + mission.kind, values),
      description: this.game.i18n.t("missions.goal." + mission.kind, values),
    };
  }
  updateBadge() {
    const key = [
      this.game.missions.revision,
      this.game.wallet.profile.totalEarned,
      (this.game.wallet.profile.missionRewards || []).length,
      this.game.i18n.language,
    ].join("|");
    if (this.lastBadge !== key) {
      const count = this.game.missions.summary().ready;
      $("missions-badge").textContent = String(count);
      $("missions-badge").hidden = count === 0;
      $("missions-button").setAttribute(
        "aria-label",
        this.game.i18n.t(count ? "missions.buttonReady" : "missions.title", {
          count,
        }),
      );
      this.lastBadge = key;
    }
    $("missions-button").disabled =
      this.game.state === "dying" ||
      this.game.shop.dialog.open ||
      this.game.settings.dialog.open ||
      this.game.levels.dialog.open ||
      this.game.challengeMenu.dialog.open ||
      loadoutDialog.open;
  }
  render() {
    const t = this.game.i18n.t,
      tracker = this.game.missions,
      summary = tracker.summary();
    $("missions-complete").textContent = summary.complete + "/100";
    $("missions-ready").textContent = String(summary.ready);
    $("missions-claimed").textContent = String(summary.claimed);
    $("missions-overall").style.width = summary.complete + "%";
    $("missions-claim-all").disabled = summary.ready === 0;
    $("missions-category").value = this.category;
    document
      .querySelectorAll("[data-mission-filter]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.missionFilter === this.filter),
        ),
      );
    const items = this.visible(),
      maxPage = Math.max(0, Math.ceil(items.length / this.pageSize) - 1);
    this.page = Math.min(this.page, maxPage);
    const start = this.page * this.pageSize,
      pageItems = items.slice(start, start + this.pageSize);
    $("missions-range").textContent = items.length
      ? t("missions.range", {
          start: start + 1,
          end: Math.min(start + this.pageSize, items.length),
          total: items.length,
        })
      : t("missions.empty");
    $("missions-prev").disabled = this.page === 0;
    $("missions-next").disabled = this.page === maxPage;
    $("missions-list").innerHTML =
      pageItems
        .map((m) => {
          const status = tracker.status(m),
            progress = tracker.claimed(m)
              ? m.target
              : Math.min(tracker.value(m), m.target),
            percent = Math.min(100, (progress / m.target) * 100),
            text = this.text(m);
          const cosmetics = missionCosmetics(m.id).map((item) =>
            this.game.shop.name(item)).join(", ");
          const cosmeticReward = cosmetics
            ? `<small class="mission-cosmetic-reward">${t("missions.cosmeticReward", { names: cosmetics })}</small>`
            : "";
          return `<article class="mission-card ${status}"><div class="mission-number">${String(m.number).padStart(3, "0")}</div><div class="mission-content"><span class="mission-category">${t("missions.category." + m.category)}</span><h3>${text.name}</h3><p>${text.description}</p><div class="mission-progress" role="progressbar" aria-label="${text.description}" aria-valuemin="0" aria-valuemax="${m.target}" aria-valuenow="${progress}"><span style="width:${percent}%"></span></div><small>${this.game.i18n.formatScore(progress)} / ${this.game.i18n.formatScore(m.target)}</small></div><div class="mission-reward">${cosmeticReward}<strong>+${this.game.i18n.formatScore(m.reward)}</strong><span>${t("missions.points")}</span><button class="icon-button" type="button" data-mission-claim="${m.id}" ${status !== "ready" ? "disabled" : ""} aria-label="${t(status === "claimed" ? "missions.rewardClaimed" : status === "ready" ? "missions.claimNamed" : "missions.inProgressNamed", { number: m.number })}">${t(status === "claimed" ? "missions.claimed" : status === "ready" ? "missions.claim" : "missions.active")}</button></div></article>`;
        })
        .join("") || `<p class="missions-empty">${t("missions.empty")}</p>`;
    $("missions-feedback").textContent = t(
      tracker.storageUnavailable ? "missions.storageWarning" : this.feedbackKey,
    );
    this.updateBadge();
  }
}
