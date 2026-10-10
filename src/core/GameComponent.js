export class GameComponent {
  constructor(game) {
    Object.defineProperty(this, "game", { value: game || this });
    for (const name of Object.getOwnPropertyNames(
      Object.getPrototypeOf(this),
    )) {
      if (name !== "constructor" && typeof this[name] === "function")
        this[name] = this[name].bind(this);
    }
  }
}
