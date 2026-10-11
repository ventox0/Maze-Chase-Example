import { PointWallet } from "../storage/PointWallet.js";

// LAN oturumu normal cüzdan biçimini kullanır; sunucunun kişisel makbuzları
// tarayıcıdaki aynı mağaza bakiyesine eklenir. Aynı origin'deki sekmeler kilitlenir.
export class LanRewards {
  constructor() {
    this.wallet = new PointWallet({ shop: { feedback() {} } });
    this.wallet.load();
    this.queue = Promise.resolve();
  }
  settle(receipts = []) {
    const claim = () => {
      let amount = 0,
        status = "already";
      for (const receipt of receipts) {
        const result = this.wallet.claimLanReward(receipt);
        amount += result.amount;
        if (result.status === "storageError")
          return { status: "storageError", amount };
        if (result.status === "credited") status = "credited";
      }
      return { status, amount };
    };
    const work = () =>
      globalThis.navigator?.locks?.request
        ? navigator.locks.request("maze-chaser-wallet", claim)
        : claim();
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
}
