import { profileStorage } from "./ProfileStorage.js";
import { ACCOUNT_TEXT } from "./messages.js";
export class AccountUI {
  constructor() {
    this.busy = false;
    const dialog = document.createElement("dialog");
    dialog.className = "account-dialog";
    dialog.id = "account-dialog";
    dialog.innerHTML = `<div class="account-heading"><h2 data-account-t="title"></h2><button type="button" id="account-close" data-account-t="close"></button></div>
      <p id="account-status" role="status"></p><form id="account-form"><p data-account-t="intro"></p>
      <label for="account-username" data-account-t="username"></label><input id="account-username" name="username" maxlength="24" autocomplete="username" required />
      <label for="account-password" data-account-t="password"></label><input id="account-password" name="password" type="password" autocomplete="current-password" required />
      <div class="account-actions"><button type="submit" class="primary" data-account-t="login"></button><button type="button" id="account-register" data-account-t="register"></button></div></form>
      <section id="account-profile" hidden><strong id="account-name"></strong><div class="account-actions"><button id="account-refresh" type="button" data-account-t="refresh"></button><button id="account-logout" type="button" data-account-t="logout"></button></div>
      <section id="account-import" hidden><h3 data-account-t="importTitle"></h3><p id="account-import-info"></p><button id="account-import-button" data-account-t="importButton"></button></section></section>
      <button id="account-retry" type="button" data-account-t="retry" hidden></button><p id="account-error" role="alert"></p>`;
    document.body.append(dialog);
    this.dialog = dialog;
    this.$ = (id) => document.getElementById("account-" + id);
    for (const button of document.querySelectorAll("[data-account-open]"))
      button.addEventListener("click", () => {
        this.render();
        dialog.showModal();
        window.dispatchEvent(new Event("account-open"));
      });
    dialog.addEventListener("close", () =>
      window.dispatchEvent(new Event("account-close")),
    );
    this.$("close").addEventListener("click", () => dialog.close());
    this.$("form").addEventListener("submit", (e) => {
      e.preventDefault();
      void this.authenticate("login");
    });
    this.$("register").addEventListener("click", () => {
      if (this.$("form").reportValidity()) void this.authenticate("register");
    });
    this.$("logout").addEventListener(
      "click",
      () =>
        void this.run(async () => {
          await profileStorage.logout();
          location.reload();
        }),
    );
    this.$("refresh").addEventListener(
      "click",
      () =>
        void this.run(async () => {
          await profileStorage.refresh();
          location.reload();
        }),
    );
    this.$("retry").addEventListener(
      "click",
      () => void this.run(() => profileStorage.flush()),
    );
    this.$("import-button").addEventListener(
      "click",
      () =>
        void this.run(async () => {
          await profileStorage.importGuest();
          location.reload();
        }),
    );
    profileStorage.listeners.add(() => this.render());
    new MutationObserver(() => this.render()).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["lang"] },
    );
    window.addEventListener(
      "online",
      () => void profileStorage.flush().catch(() => {}),
    );
    this.render();
  }
  t(key, values = {}) {
    let text =
      ACCOUNT_TEXT[document.documentElement.lang === "en" ? "en" : "tr"][key] ||
      key;
    for (const [key, value] of Object.entries(values))
      text = text.replaceAll("{" + key + "}", value);
    return text;
  }
  render() {
    for (const n of this.dialog.querySelectorAll("[data-account-t]"))
      n.textContent = this.t(n.dataset.accountT);
    for (const n of document.querySelectorAll("[data-account-open]")) {
      n.textContent =
        (profileStorage.user?.username || this.t("account")) +
        (profileStorage.state === "pending"
          ? " · ⟳"
          : ["syncError", "rejected", "sessionExpired"].includes(
                profileStorage.state,
              )
            ? " · !"
            : "");
      n.dataset.state = profileStorage.state;
      n.title = this.t(profileStorage.state);
    }
    this.$("form").hidden = !!profileStorage.user;
    this.$("profile").hidden = !profileStorage.user;
    this.$("name").textContent = profileStorage.user?.username || "";
    this.$("status").textContent = this.t(
      this.busy ? "working" : profileStorage.state,
    );
    this.$("import").hidden =
      !profileStorage.user || !profileStorage.profile?.canImport;
    const wallet = (() => {
      try {
        return JSON.parse(localStorage.getItem("maze-chaser-wallet-v1"));
      } catch {
        return null;
      }
    })();
    this.$("import-info").textContent = this.t("importInfo", {
      points: wallet?.balance || 0,
    });
    this.$("retry").hidden = profileStorage.state !== "syncError";
    for (const button of this.dialog.querySelectorAll(
      "button:not(#account-close)",
    ))
      button.disabled = this.busy;
  }
  async authenticate(type) {
    const username = this.$("username").value,
      password = this.$("password").value;
    await this.run(async () => {
      await profileStorage.authenticate(type, username, password);
      this.$("password").value = "";
      location.reload();
    });
  }
  async run(fn) {
    if (this.busy) return;
    this.busy = true;
    this.$("error").textContent = "";
    this.render();
    try {
      await fn();
    } catch (error) {
      this.$("error").textContent = this.t(error.message);
    } finally {
      this.busy = false;
      this.render();
    }
  }
}
