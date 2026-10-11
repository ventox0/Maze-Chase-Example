import assert from "node:assert/strict";
import { BODY_HEAD_ANCHORS, HEAD_MOUNTS } from "../src/data/avatar-fitting.js";
import { avatarLayout, AVATAR_SIZE } from "../src/rendering/AvatarLayout.js";
import { SHOP_ITEMS, SHOP_ATLAS_REGIONS } from "../src/data/shop.js";

const heads = SHOP_ITEMS.filter((p) => p.category === "head");
const outfits = SHOP_ITEMS.filter(
  (p) => p.category === "outfit" && !p.exclusive,
);
assert.equal(heads.length, 20);
for (const item of heads)
  assert.ok(HEAD_MOUNTS[item.id], "Başlık bağlantısı eksik: " + item.id);
for (const item of outfits)
  assert.ok(BODY_HEAD_ANCHORS[item.id], "Kostüm kafası eksik: " + item.id);
console.log(
  "PASS 20 başlık ve tüm birleştirilebilir kostümler için hizalama verisi",
);

let combinations = 0;
for (const outfit of [null, ...outfits.map((item) => item.id)]) {
  const dims = outfit
    ? SHOP_ATLAS_REGIONS.outfits[SHOP_ITEMS.find((p) => p.id === outfit).index]
    : [0, 0, 384, 384];
  for (const head of heads) {
    const region = SHOP_ATLAS_REGIONS.heads[head.index];
    const layout = avatarLayout(
      dims[2],
      dims[3],
      outfit,
      head.id,
      region[2],
      region[3],
    );
    for (const rect of [layout.body, layout.hat]) {
      assert.ok(
        Object.values(rect).every(Number.isFinite),
        outfit + "/" + head.id,
      );
      assert.ok(rect.x >= 6 - 1e-9 && rect.y >= 6 - 1e-9);
      assert.ok(rect.x + rect.width <= AVATAR_SIZE - 6 + 1e-9);
      assert.ok(rect.y + rect.height <= AVATAR_SIZE - 6 + 1e-9);
    }
    // İki katmanın oranı korunmalı; kafa büyürken başlık tek başına küçülmemeli.
    assert.ok(
      Math.abs(layout.body.width / layout.body.height - dims[2] / dims[3]) <
        1e-9,
    );
    assert.ok(
      Math.abs(layout.hat.width / layout.hat.height - region[2] / region[3]) <
        1e-9,
    );
    const mount = HEAD_MOUNTS[head.id];
    assert.ok(
      Math.abs(layout.hat.x + mount[0] * layout.hat.width - layout.face.x) <
        1e-9,
    );
    assert.ok(
      Math.abs(layout.hat.y + mount[1] * layout.hat.height - layout.face.y) <
        1e-9,
    );
    assert.ok(
      Math.abs(mount[2] * layout.hat.width - layout.face.radius) < 1e-9,
    );
    combinations++;
  }
}
console.log(
  `PASS ${combinations} birleşimde bağlantı, oran ve tuval sınırları`,
);

const plain = avatarLayout(384, 384);
assert.equal(plain.hat, null);
assert.equal(plain.body.width, 142);
assert.equal(plain.body.y, 42);
console.log("PASS başlıksız görünümün boyutu ve konumu korunur");
