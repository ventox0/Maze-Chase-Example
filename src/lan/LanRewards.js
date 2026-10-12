import { profileStorage } from "../account/ProfileStorage.js";
import { PointWallet } from "../storage/PointWallet.js";

// Hesap ödülleri sunucuda, misafir ödülleri yerel cüzdanda saklanır.
// Aynı origin'deki sekmeler eşzamanlı talepleri kilitler.
export class LanRewards {
  constructor() {
    this.wallet = new PointWallet({ shop: { feedback() {} } });
    this.wallet.load();
    this.queue = Promise.resolve();
  }
  settle(receipts = []) {
    const claim = async () => {
      if (
        profileStorage.user &&
        this.client?.session &&
        this.client.session.role !== "spectator" &&
        receipts.length
      ) {
        await profileStorage.flush();
        const result = await this.client.request(
          "/api/lan/rewards?room=" +
            encodeURIComponent(this.client.session.room),
          null,
          true,
        );
        profileStorage.update(result.profile);
        this.wallet.load();
        return {
          status: result.amount ? "credited" : "already",
          amount: result.amount,
        };
      }
      if (profileStorage.user) return { status: "already", amount: 0 };
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
