const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { fileURLToPath } = require("node:url");

(async () => {
  const { sandbox, element, stored, events, motion, t } = await import(
    "./helpers/game-harness.mjs"
  );
  let count = 0;
  function check(name, fn) {
    fn();
    console.log("PASS " + name);
    count++;
  }
  check("başlatma / 3 can / dört köşe güç yemi", () => {
    t.startGame();
    let s = t.get();
    assert.equal(s.state, "playing");
    assert.equal(s.lives, 3);
    assert.equal(s.map.flat().filter((v) => v === 3).length, 4);
    assert.equal(s.pellets, 208);
  });
  check("duvara çarpınca durma", () => {
    Object.assign(t.get().player, {
      col: 1,
      row: 1,
      dir: "left",
      next: "left",
      progress: 0,
    });
    t.move(t.get().player, 24, t.choosePlayerDirection);
    assert.equal(t.get().player.col, 1);
    assert.equal(t.get().player.progress, 0);
  });
  check("hücre merkezinde tamponlanmış dönüş", () => {
    Object.assign(t.get().player, {
      col: 8,
      row: 1,
      dir: "right",
      next: "down",
      progress: 12,
    });
    t.move(t.get().player, 36, t.choosePlayerDirection);
    assert.equal(t.get().player.col, 9);
    assert.equal(t.get().player.row, 2);
    assert.equal(t.get().player.progress, 0);
  });
  check("anlık ters dönüş konumu korur", () => {
    Object.assign(t.get().player, {
      col: 8,
      row: 1,
      dir: "right",
      next: "right",
      progress: 7,
    });
    const before = t.position(t.get().player);
    t.setDirection("left");
    const after = t.position(t.get().player);
    assert.deepEqual(after, before);
    assert.equal(t.get().player.dir, "left");
  });
  check("küçük yem +10 ve silinme", () => {
    t.startGame();
    Object.assign(t.get().player, { col: 2, row: 1, progress: 0 });
    t.eatPellet();
    assert.equal(t.get().score, 10);
    assert.equal(t.get().map[1][2], 0);
    t.eatPellet();
    assert.equal(t.get().score, 10);
  });
  check("güç yemi +50 ve 10 saniye", () => {
    t.startGame();
    Object.assign(t.get().player, { col: 1, row: 1, progress: 0 });
    t.eatPellet();
    assert.equal(t.get().score, 50);
    assert.equal(t.get().powerUntil - t.get().gameTime, 10);
  });
  check("korkmuş hayalet +200 ve merkezde 3 saniye bekleme", () => {
    t.set("time", 3);
    const s = t.get();
    Object.assign(s.ghosts[0], { col: 1, row: 1, progress: 0, releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().score, 250);
    assert.equal(s.ghosts[0].col, 10);
    assert.equal(s.ghosts[0].row, 9);
    assert.equal(s.ghosts[0].releaseAt, 6);
  });
  check("hayalet hızında tam yüzde 30 azalma", () => {
    t.startGame();
    let g = t.get().ghosts[0];
    g.releaseAt = 0;
    t.update(1 / 120);
    const normal = g.progress;
    t.startGame();
    g = t.get().ghosts[0];
    g.releaseAt = 0;
    t.set("power", 10);
    t.update(1 / 120);
    assert.ok(Math.abs(g.progress / normal - 0.7) < 1e-10);
  });
  check("normal temas can kaybettirir / Game Over / restart", () => {
    t.startGame();
    t.set("time", 3);
    t.set("invulnerable", 0);
    const s = t.get();
    Object.assign(s.ghosts[0], s.player, { releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().lives, 2);
    assert.equal(t.get().state, "dying");
    t.update(1.4);
    assert.equal(t.get().state, "playing");
    t.set("lives", 1);
    t.set("invulnerable", 0);
    Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().state, "gameover");
    assert.equal(t.get().lives, 0);
    t.startGame();
    assert.equal(t.get().lives, 3);
    assert.equal(t.get().score, 0);
  });
  check("zafer / bölüm geçişi / skor korunur", () => {
    t.startGame();
    Object.assign(t.get().player, { col: 2, row: 1, progress: 0 });
    t.set("pellets", 1);
    t.eatPellet();
    assert.equal(t.get().state, "playing");
    assert.equal(t.get().roundPhase, "bonus");
    Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
    t.eatPellet();
    assert.equal(t.get().state, "victory");
    t.nextLevel();
    assert.equal(t.get().level, 2);
    assert.equal(t.get().score, 510);
    assert.equal(
      t.get().pellets,
      t
        .get()
        .map.flat()
        .filter((v) => v === 2 || v === 3).length,
    );
  });
  check("duraklatma zamanı dondurur", () => {
    t.changeState("paused");
    const time = t.get().gameTime;
    t.update(5);
    assert.equal(t.get().gameTime, time);
  });
  check("güç modu 10 saniyede biter", () => {
    t.startGame();
    t.set("power", 10);
    t.set("time", 10);
    assert.equal(t.get().powerUntil > t.get().gameTime, false);
  });
  check("5 dakika simülasyonda aktörler duvara girmez", () => {
    t.startGame();
    const dirs = ["left", "right", "up", "down"];
    for (let i = 0; i < 36000; i++) {
      if (t.get().state !== "playing") {
        t.startGame();
      }
      if (i % 24 === 0) t.setDirection(dirs[Math.floor(Math.random() * 4)]);
      t.update(1 / 120);
      for (const a of [t.get().player, ...t.get().ghosts])
        assert.ok(t.walkable(a.col, a.row));
    }
  });

  check("Q: duvar üzerinden geçerli yola animasyonlu atlayış", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 1,
      row: 2,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.useJump();
    assert.ok(t.get().jump);
    assert.equal(t.get().jump.col, 5);
    assert.equal(t.get().jump.row, 2);
    assert.equal(t.get().jumpReadyAt, 8);
    t.advanceJump(0.35);
    assert.equal(t.get().player.col, 5);
    assert.equal(t.get().jump, null);
    assert.ok(t.walkable(t.get().player.col, t.get().player.row));
  });
  check("Q: dış duvar ve duvarsız atlayış reddi / bekleme harcanmaz", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 1,
      row: 1,
      dir: "left",
      next: "left",
      progress: 0,
    });
    t.useJump();
    assert.equal(t.get().jump, null);
    assert.equal(t.get().jumpReadyAt, 0);
    t.get().player.next = "right";
    t.useJump();
    assert.equal(t.get().jump, null);
    assert.equal(t.get().jumpReadyAt, 0);
  });
  check("Q: hareket ortasında istek hücre merkezine tamponlanır", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 2,
      row: 1,
      dir: "right",
      next: "down",
      progress: 12,
    });
    t.useJump();
    assert.equal(t.get().jump, null);
    assert.ok(t.get().pendingJumpUntil > 0);
    t.move(t.get().player, 24, t.choosePlayerDirection);
    assert.ok(t.get().jump);
    assert.equal(t.get().jump.col, 3);
    assert.equal(t.get().jump.row, 4);
  });
  check("Q: havada çarpışma yok, inişte normal temas", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 1,
      row: 2,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.set("time", 3);
    t.set("invulnerable", 0);
    t.useJump();
    Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().lives, 3);
    t.advanceJump(0.35);
    Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().lives, 2);
  });
  check("Q: 8 saniye bekleme / tekrar kullanma engeli", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 1,
      row: 2,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.useJump();
    t.advanceJump(0.35);
    t.get().player.next = "left";
    t.useJump();
    assert.equal(t.get().jump, null);
    t.set("time", 8);
    t.useJump();
    assert.ok(t.get().jump);
  });
  check("E: 3 hücre yarıçapında küçük yemler +10, güç yemleri korunur", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 1,
      row: 1,
      dir: "right",
      progress: 0,
    });
    const s = t.get();
    let expected = 0;
    for (let y = 0; y < s.map.length; y++)
      for (let x = 0; x < s.map[0].length; x++)
        if (s.map[y][x] === 2 && Math.hypot(x - 1, y - 1) <= 3) expected++;
    t.useMagnet();
    assert.equal(t.get().score, expected * 10);
    assert.equal(t.get().pellets, 208 - expected);
    assert.equal(t.get().map[1][1], 3);
    assert.equal(t.get().map[1][5], 2);
    assert.equal(t.get().magnetUntil, 5);
    assert.equal(t.get().magnetReadyAt, 14);
    assert.equal(t.get().pelletTrails.length, expected);
  });
  check("E: hareket sırasında yeni yemleri çekme / tekrar puanlamama", () => {
    t.startGame();
    t.useMagnet();
    const previous = t.get().score;
    t.attractPellets();
    assert.equal(t.get().score, previous);
    Object.assign(t.get().player, { col: 1, row: 1, progress: 0 });
    t.attractPellets();
    assert.ok(t.get().score > previous);
  });
  check("E: 5 saniye sonra biter, 14 saniye sonra tekrar hazır", () => {
    t.startGame();
    t.useMagnet();
    t.set("time", 5);
    Object.assign(t.get().player, { col: 2, row: 1, progress: 0 });
    const previous = t.get().score;
    t.attractPellets();
    assert.equal(t.get().score, previous);
    t.useMagnet();
    assert.equal(t.get().magnetUntil, 5);
    t.set("time", 14);
    t.useMagnet();
    assert.equal(t.get().magnetUntil, 19);
  });
  check("E: son yemle can yemi aşaması açılır", () => {
    t.startGame();
    Object.assign(t.get().player, { col: 10, row: 17, progress: 0 });
    const s = t.get();
    for (let y = 0; y < s.map.length; y++)
      for (let x = 0; x < s.map[0].length; x++)
        if (s.map[y][x] === 2 || s.map[y][x] === 3) s.map[y][x] = 0;
    s.map[16][10] = 2;
    t.set("pellets", 1);
    t.useMagnet();
    assert.equal(t.get().state, "playing");
    assert.equal(t.get().roundPhase, "bonus");
    assert.equal(t.get().score, 10);
  });
  check("yetenekler duraklatmada tetiklenmez ve süreleri donar", () => {
    t.startGame();
    t.useMagnet();
    t.changeState("paused");
    t.update(10);
    assert.equal(t.get().gameTime, 0);
    t.useMagnet();
    assert.equal(t.get().magnetUntil, 5);
    t.useJump();
    assert.equal(t.get().jump, null);
  });
  check("restart ve bölüm geçişinde yetenekler yenilenir", () => {
    t.startGame();
    t.useMagnet();
    t.nextLevel();
    assert.equal(t.get().magnetUntil, 0);
    assert.equal(t.get().magnetReadyAt, 0);
    assert.equal(t.get().jumpReadyAt, 0);
    t.startGame();
    assert.equal(t.get().magnetUntil, 0);
    assert.equal(t.get().pelletTrails.length, 0);
  });
  check("yetenek efektleri canvas üzerinde çizilir", () => {
    t.startGame();
    t.useMagnet();
    t.render(1);
    t.startGame();
    Object.assign(t.get().player, {
      col: 1,
      row: 2,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.useJump();
    t.render(1);
  });

  check("seçim ekranı başlatmadan açılır, onay sonrası oyun başlar", () => {
    t.changeState("ready");
    t.mainAction();
    assert.equal(element("level-dialog").open, true);
    sandbox.game.levels.confirmSelection();
    assert.equal(t.get().state, "ready");
    assert.equal(element("loadout-dialog").open, true);
    t.selectAbility("boost");
    t.selectSlot("e");
    t.selectAbility("shield");
    assert.equal(t.get().loadout.q, "jump");
    t.confirmLoadout();
    assert.equal(t.get().state, "playing");
    assert.equal(t.get().loadout.q, "boost");
    assert.equal(t.get().loadout.e, "shield");
    assert.equal(element("loadout-dialog").open, false);
  });
  check("yetenek seçimi aynı yeteneği iki yuvaya koymaz, takas eder", () => {
    t.changeState("ready");
    t.openLoadout("start");
    t.selectSlot("q");
    t.selectAbility("shield");
    assert.equal(t.get().draftLoadout.q, "shield");
    assert.equal(t.get().draftLoadout.e, "boost");
    element("loadout-dialog").close();
    assert.equal(t.get().loadout.q, "boost");
    assert.equal(t.get().loadout.e, "shield");
  });
  check("dört yeteneğin tüm ikilileri Q ve E yuvalarına atanır", () => {
    const ids = ["jump", "magnet", "boost", "shield"];
    for (const q of ids)
      for (const e of ids) {
        if (q === e) continue;
        t.changeState("ready");
        t.openLoadout("start");
        t.selectSlot("q");
        t.selectAbility(q);
        t.selectSlot("e");
        t.selectAbility(e);
        t.confirmLoadout();
        assert.equal(t.get().loadout.q, q);
        assert.equal(t.get().loadout.e, e);
      }
  });
  check(
    "Q/E seçilmiş boost ve kalkanı tetikler, HUD isimleri güncellenir",
    () => {
      t.changeState("ready");
      t.openLoadout("start");
      t.selectSlot("q");
      t.selectAbility("boost");
      t.selectSlot("e");
      t.selectAbility("shield");
      t.confirmLoadout();
      t.useAbility("q");
      t.useAbility("e");
      t.updateHUD();
      assert.equal(t.get().boostUntil, 3);
      assert.equal(t.get().shieldUntil, 4);
      assert.equal(element("q-name").textContent, "Boost");
      assert.equal(element("e-name").textContent, "Hasar görmezlik");
      assert.equal(element("q-status").textContent, "3 sn aktif");
    },
  );
  check("boost yüzde 65 hız artışı ve 3 saniye etki", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 5,
      row: 1,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.update(1 / 120);
    const normal = t.get().player.progress;
    t.startGame();
    Object.assign(t.get().player, {
      col: 5,
      row: 1,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.useBoost();
    t.update(1 / 120);
    assert.ok(Math.abs(t.get().player.progress / normal - 1.65) < 1e-10);
    t.set("time", 3);
    Object.assign(t.get().player, {
      col: 5,
      row: 1,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.update(1 / 120);
    assert.ok(Math.abs(t.get().player.progress - normal) < 1e-10);
  });
  check("boost 12 saniyelik bekleme süresine uyar", () => {
    t.startGame();
    t.useBoost();
    t.set("time", 3);
    t.useBoost();
    assert.equal(t.get().boostUntil, 3);
    assert.equal(t.get().boostReadyAt, 12);
    t.set("time", 12);
    t.useBoost();
    assert.equal(t.get().boostUntil, 15);
  });
  check("hasar görmezlik teması engeller, 4 saniye sonra normal hasar", () => {
    t.startGame();
    t.set("time", 3);
    t.set("invulnerable", 0);
    t.useShield();
    Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().lives, 3);
    t.set("time", 6.99);
    t.checkCollisions();
    assert.equal(t.get().lives, 3);
    t.set("time", 7);
    t.checkCollisions();
    assert.equal(t.get().lives, 2);
  });
  check("kalkan 18 saniye bekler, korkmuş hayalet yenebilir", () => {
    t.startGame();
    t.set("time", 3);
    t.useShield();
    t.set("power", 13);
    Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
    t.checkCollisions();
    assert.equal(t.get().score, 200);
    t.finishCutscene();
    t.set("time", 7);
    t.useShield();
    assert.equal(t.get().shieldUntil, 7);
    t.set("time", 21);
    t.useShield();
    assert.equal(t.get().shieldUntil, 25);
  });
  check("yeni yeteneklerde duraklatma, can kaybı ve bölüm sıfırlaması", () => {
    t.startGame();
    t.useBoost();
    t.useShield();
    t.changeState("paused");
    t.update(20);
    assert.equal(t.get().gameTime, 0);
    assert.equal(t.get().boostUntil, 3);
    t.useBoost();
    assert.equal(t.get().boostReadyAt, 12);
    t.changeState("playing");
    t.resetActors();
    assert.equal(t.get().boostUntil, 0);
    assert.equal(t.get().shieldUntil, 0);
    assert.equal(t.get().boostReadyAt, 12);
    t.nextLevel();
    assert.equal(t.get().boostReadyAt, 0);
    assert.equal(t.get().shieldReadyAt, 0);
  });
  check("zafer sonrası seçim onayına kadar sonraki bölüm başlamaz", () => {
    t.startGame();
    t.changeState("victory");
    t.mainAction();
    assert.equal(t.get().level, 1);
    assert.equal(element("loadout-dialog").open, true);
    t.confirmLoadout();
    assert.equal(t.get().level, 2);
    assert.equal(t.get().state, "playing");
  });
  check("boost ve hasar görmezlik efektleri çizilir", () => {
    t.startGame();
    t.useBoost();
    t.useShield();
    t.render(1);
  });
  check("tüm yeteneklerle simülasyonda duvara girilmez", () => {
    t.startGame();
    const dirs = ["left", "right", "up", "down"];
    for (let i = 0; i < 18000; i++) {
      if (t.get().state !== "playing") t.startGame();
      if (i % 20 === 0) t.setDirection(dirs[Math.floor(Math.random() * 4)]);
      if (i % 70 === 0) t.useBoost();
      if (i % 90 === 0) t.useShield();
      if (i % 110 === 0) t.useJump();
      if (i % 130 === 0) t.useMagnet();
      t.update(1 / 120);
      for (const a of [t.get().player, ...t.get().ghosts])
        assert.ok(t.walkable(a.col, a.row));
    }
  });

  function finishNormalPellets() {
    const s = t.get();
    for (let y = 0; y < s.map.length; y++)
      for (let x = 0; x < s.map[0].length; x++)
        if (s.map[y][x] === 2 || s.map[y][x] === 3) s.map[y][x] = 0;
    s.map[1][2] = 2;
    Object.assign(s.player, { col: 2, row: 1, progress: 0 });
    t.set("pellets", 1);
    t.eatPellet();
  }
  check(
    "son yem: hayaletler kalkar, merkezde tek can yemi oluşur, oyun sürer",
    () => {
      t.startGame();
      finishNormalPellets();
      const s = t.get();
      assert.equal(s.state, "playing");
      assert.equal(s.roundPhase, "bonus");
      assert.equal(s.ghosts.length, 0);
      assert.equal(s.pellets, 0);
      assert.equal(s.map[11][10], 4);
      assert.equal(s.map.flat().filter((v) => v === 4).length, 1);
      assert.equal(s.powerUntil, 0);
      assert.equal(element("bonus-banner").hidden, false);
    },
  );
  check("can yemi tam geometrik merkezde ve erişilebilir", () => {
    const s = t.get();
    assert.equal(s.LIFE_PELLET.col, Math.floor(s.map[0].length / 2));
    assert.equal(s.LIFE_PELLET.row, Math.floor(s.map.length / 2));
    const queue = [[s.player.col, s.player.row]],
      seen = new Set([queue[0].join(",")]);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (t.walkable(nx, ny) && !seen.has(nx + "," + ny)) {
          seen.add(nx + "," + ny);
          queue.push([nx, ny]);
        }
      }
    }
    assert.ok(seen.has("10,11"));
  });
  check("1 ve 2 can: sadece +1 can, ek puan yok", () => {
    for (const lives of [1, 2]) {
      t.startGame();
      t.set("lives", lives);
      finishNormalPellets();
      const score = t.get().score;
      Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
      t.eatPellet();
      assert.equal(t.get().lives, lives + 1);
      assert.equal(t.get().score, score);
      assert.equal(t.get().state, "victory");
      assert.equal(t.get().roundPhase, "complete");
      assert.equal(t.get().map[11][10], 0);
    }
  });
  check("3 can: tam +500 puan, maksimum can aşılmaz, rekor güncellenir", () => {
    t.startGame();
    finishNormalPellets();
    const score = t.get().score;
    Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
    t.eatPellet();
    assert.equal(t.get().lives, 3);
    assert.equal(t.get().score, score + 500);
    assert.ok(t.get().highScore >= score + 500);
    assert.ok(t.get().bonusReward.includes("+500"));
    t.eatPellet();
    t.collectLifePellet();
    assert.equal(t.get().score, score + 500);
  });
  check("mıknatıs can yemini çekmez, fiziksel toplama gerekir", () => {
    t.startGame();
    finishNormalPellets();
    Object.assign(t.get().player, { col: 10, row: 10, progress: 0 });
    t.useMagnet();
    assert.equal(t.get().map[11][10], 4);
    t.collectPellet(10, 11, true);
    assert.equal(t.get().state, "playing");
    assert.equal(t.get().map[11][10], 4);
    t.collectPellet(10, 11);
    assert.equal(t.get().map[11][10], 4);
    Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
    t.eatPellet();
    assert.equal(t.get().state, "victory");
  });
  check("bonus aşamasında hareket ve duraklatma sürer, hasar oluşmaz", () => {
    t.startGame();
    finishNormalPellets();
    Object.assign(t.get().player, {
      col: 5,
      row: 1,
      dir: "right",
      next: "right",
      progress: 0,
    });
    t.set("invulnerable", 0);
    t.update(0.1);
    assert.ok(t.get().player.progress > 0);
    assert.equal(t.get().lives, 3);
    t.changeState("paused");
    const time = t.get().gameTime;
    t.update(5);
    assert.equal(t.get().gameTime, time);
    assert.equal(t.get().roundPhase, "bonus");
    t.changeState("playing");
    assert.equal(t.get().ghosts.length, 0);
  });
  check("bonus tekrar tetiklenmez ve ödül bir kez verilir", () => {
    t.startGame();
    finishNormalPellets();
    t.beginRoundBonus();
    assert.equal(
      t
        .get()
        .map.flat()
        .filter((v) => v === 4).length,
      1,
    );
    t.set("lives", 2);
    Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
    t.eatPellet();
    t.collectLifePellet();
    assert.equal(t.get().lives, 3);
    assert.equal(t.get().score, 10);
  });
  check("son güç yeminden sonra hayaletler ve güç süresi temizlenir", () => {
    t.startGame();
    const s = t.get();
    for (let y = 0; y < s.map.length; y++)
      for (let x = 0; x < s.map[0].length; x++)
        if (s.map[y][x] === 2 || s.map[y][x] === 3) s.map[y][x] = 0;
    s.map[1][1] = 3;
    t.set("pellets", 1);
    Object.assign(s.player, { col: 1, row: 1, progress: 0 });
    t.eatPellet();
    assert.equal(t.get().score, 50);
    assert.equal(t.get().ghosts.length, 0);
    assert.equal(t.get().powerUntil, 0);
    assert.equal(t.get().roundPhase, "bonus");
  });
  check(
    "sonraki bölüm ödülü korur, hayaletler ve normal yemler yenilenir",
    () => {
      t.startGame();
      t.set("lives", 1);
      finishNormalPellets();
      Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
      t.eatPellet();
      t.nextLevel();
      assert.equal(t.get().lives, 2);
      assert.equal(t.get().score, 10);
      assert.equal(t.get().roundPhase, "maze");
      assert.equal(t.get().ghosts.length, 4);
      assert.equal(
        t.get().pellets,
        t
          .get()
          .map.flat()
          .filter((v) => v === 2 || v === 3).length,
      );
      assert.equal(t.get().map[11][10], 0);
      assert.equal(element("bonus-banner").hidden, true);
    },
  );
  check("restart bonus aşamasını tamamen sıfırlar", () => {
    t.startGame();
    finishNormalPellets();
    t.startGame();
    assert.equal(t.get().roundPhase, "maze");
    assert.equal(
      t
        .get()
        .map.flat()
        .filter((v) => v === 4).length,
      0,
    );
    assert.equal(t.get().ghosts.length, 3);
    assert.equal(t.get().lives, 3);
    assert.equal(t.get().score, 0);
  });
  check("can yemi görseli ve bonus arayüzü çizilir", () => {
    t.startGame();
    finishNormalPellets();
    t.render(1);
    t.updateHUD();
    assert.equal(element("mode-label").textContent, "BÖLÜM SONU");
    assert.equal(element("mode-text").textContent, "Merkezdeki can yemini al");
  });

  check("beş oyuncu görseli dış dosyalardan yüklenmiş", () => {
    assert.deepEqual(Object.keys(t.get().sprites).sort(), [
      "boost",
      "magnet",
      "normal",
      "power",
      "shield",
    ]);
    for (const source of Object.values(t.get().SPRITE_SOURCES))
      assert.ok(
        source.endsWith(".webp") && fs.existsSync(fileURLToPath(source)),
      );
  });
  check("normal, Boost, mıknatıs, güçlenmiş, zırhlı doğru seçilir", () => {
    t.startGame();
    assert.equal(t.currentPlayerSkin(), "normal");
    t.useBoost();
    assert.equal(t.currentPlayerSkin(), "boost");
    t.startGame();
    t.useMagnet();
    assert.equal(t.currentPlayerSkin(), "magnet");
    t.startGame();
    t.set("power", 10);
    assert.equal(t.currentPlayerSkin(), "power");
    t.startGame();
    t.useShield();
    assert.equal(t.currentPlayerSkin(), "shield");
  });
  check("birleşik güçlerde görünüm önceliği ve bitince geri dönüş", () => {
    t.startGame();
    t.useBoost();
    t.useMagnet();
    t.set("power", 10);
    t.useShield();
    assert.equal(t.currentPlayerSkin(), "shield");
    t.set("time", 4);
    assert.equal(t.currentPlayerSkin(), "power");
    t.set("power", 0);
    assert.equal(t.currentPlayerSkin(), "magnet");
    t.set("time", 5);
    assert.equal(t.currentPlayerSkin(), "normal");
  });
  check("yetenek sonrası portre ve model etiketi birlikte değişir", () => {
    t.startGame();
    t.useShield();
    t.updateHUD();
    assert.equal(element("player-model").textContent, "Zırhlı");
    assert.equal(element("player-portrait").src, t.get().SPRITE_SOURCES.shield);
    t.set("time", 4);
    t.updateHUD();
    assert.equal(element("player-model").textContent, "Normal");
    assert.equal(element("player-portrait").src, t.get().SPRITE_SOURCES.normal);
  });
  check(
    "beş görünüm dört yönde çizilir; görsel yüklenmezse klasik model çalışır",
    () => {
      for (const effect of ["normal", "boost", "magnet", "power", "shield"]) {
        t.startGame();
        if (effect === "boost") t.useBoost();
        if (effect === "magnet") t.useMagnet();
        if (effect === "power") t.set("power", 10);
        if (effect === "shield") t.useShield();
        for (const dir of ["left", "right", "up", "down"]) {
          t.get().player.dir = dir;
          t.drawPlayer();
        }
      }
      const sprite = t.get().sprites.shield;
      sprite.complete = false;
      t.drawPlayer();
      sprite.complete = true;
    },
  );
  check("can kaybı ve yeni bölüm sonrası görünüm sıfırlanır", () => {
    t.startGame();
    t.useBoost();
    t.useShield();
    t.resetActors();
    assert.equal(t.currentPlayerSkin(), "normal");
    t.useMagnet();
    t.nextLevel();
    assert.equal(t.currentPlayerSkin(), "normal");
  });
  console.log(count + " mekanik kontrolü geçti.");

  check("dil sözlüklerinin anahtarları ve değişkenleri eşleşir", () => {
    assert.deepEqual(
      Object.keys(t.TRANSLATIONS.tr).sort(),
      Object.keys(t.TRANSLATIONS.en).sort(),
    );
    for (const key of Object.keys(t.TRANSLATIONS.tr)) {
      assert.ok(t.TRANSLATIONS.tr[key]);
      assert.ok(t.TRANSLATIONS.en[key]);
      assert.deepEqual(
        (t.TRANSLATIONS.tr[key].match(/\{\w+\}/g) || []).sort(),
        (t.TRANSLATIONS.en[key].match(/\{\w+\}/g) || []).sort(),
      );
    }
  });
  check("ilk menü İngilizce ve Türkçe arasında geçer", () => {
    t.changeState("ready");
    t.setLanguage("en");
    assert.equal(sandbox.document.documentElement.lang, "en");
    assert.equal(element("overlay-title").textContent, "Ready to play?");
    assert.equal(
      element("main-action").firstElementChild.textContent,
      "Choose a level",
    );
    assert.equal(element("menu-language").hidden, false);
    assert.equal(
      element("q-name").textContent,
      t.t("ability." + t.get().loadout.q),
    );
    assert.equal(
      element("e-name").textContent,
      t.t("ability." + t.get().loadout.e),
    );
    assert.equal(stored.get("maze-chaser-language"), "en");
    t.setLanguage("tr");
    assert.equal(element("overlay-title").textContent, "Hazır mısın?");
    assert.equal(stored.get("maze-chaser-language"), "tr");
  });
  check("geçersiz dil tercihi reddedilir", () => {
    t.setLanguage("es");
    assert.equal(t.get().language, "tr");
  });
  check(
    "aktif oyun dil değişiminde konum, skor, can, harita ve zaman korunur",
    () => {
      t.startGame();
      t.useBoost();
      t.useShield();
      t.useMagnet();
      t.update(0.1);
      const before = JSON.stringify(t.get(), (key, value) =>
        ["sprites", "SPRITE_SOURCES"].includes(key) ? undefined : value,
      );
      t.setLanguage("en");
      const after = t.get();
      const old = JSON.parse(before);
      for (const key of [
        "score",
        "highScore",
        "lives",
        "level",
        "gameTime",
        "powerUntil",
        "boostUntil",
        "shieldUntil",
        "magnetUntil",
        "pellets",
        "stateTime",
        "accumulator",
      ])
        assert.equal(after[key], old[key]);
      assert.equal(JSON.stringify(after.player), JSON.stringify(old.player));
      assert.equal(JSON.stringify(after.map), JSON.stringify(old.map));
      assert.equal(after.state, "playing");
      assert.equal(element("overlay").hidden, true);
      assert.equal(element("menu-language").hidden, true);
      assert.equal(element("player-model").textContent, "Armored");
      assert.match(element("e-status").textContent, /s active/);
    },
  );
  check("duraklatılmış oyun dil değişiminden sonra donmuş kalır", () => {
    t.togglePause();
    const before = t.get().gameTime;
    t.setLanguage("tr");
    t.update(10);
    assert.equal(t.get().state, "paused");
    assert.equal(t.get().gameTime, before);
    assert.equal(element("overlay-title").textContent, "Oyun duraklatıldı");
    t.setLanguage("en");
    assert.equal(element("overlay-title").textContent, "Game paused");
    assert.equal(element("pause-label").textContent, "Resume");
  });
  check("yetenek taslağı ve seçili yuva dil değişince korunur", () => {
    t.changeState("ready");
    t.openLoadout("start");
    t.selectAbility("boost");
    t.selectSlot("e");
    t.selectAbility("shield");
    const draft = JSON.stringify(t.get().draftLoadout);
    t.setLanguage("en");
    assert.equal(JSON.stringify(t.get().draftLoadout), draft);
    assert.equal(t.get().selectedSlot, "e");
    assert.equal(element("loadout-dialog").open, true);
    assert.equal(element("slot-e-name").textContent, "Invulnerability");
    t.setLanguage("tr");
    assert.equal(element("slot-e-name").textContent, "Hasar görmezlik");
    element("loadout-dialog").close();
  });
  check("bonus hedefi ve güç süresi iki dilde güncellenir", () => {
    t.startGame();
    t.set("power", 10);
    t.setLanguage("en");
    assert.equal(element("mode-text").textContent, "10 s · Time to hunt!");
    t.beginRoundBonus();
    assert.equal(
      element("mode-text").textContent,
      "Collect the life pellet in the center",
    );
    t.setLanguage("tr");
    assert.equal(element("mode-text").textContent, "Merkezdeki can yemini al");
  });
  check("can ve 500 puan ödülleri zaferde yeniden çevrilir", () => {
    for (const lives of [2, 3]) {
      t.startGame();
      t.set("lives", lives);
      t.beginRoundBonus();
      Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
      t.eatPellet();
      t.setLanguage("en");
      assert.equal(element("overlay-title").textContent, "Level Complete");
      assert.match(
        element("overlay-description").textContent,
        lives === 2
          ? /You gained \+1 life!/
          : /Lives are full: you gained \+500 points!/,
      );
      assert.doesNotMatch(element("announcement").textContent, /kazandın/);
      t.setLanguage("tr");
      assert.equal(element("overlay-title").textContent, "Bölüm Tamamlandı");
      assert.match(element("overlay-description").textContent, /kazandın/);
    }
  });
  check("can kaybı ve oyun sonu ekranı İngilizce", () => {
    t.startGame();
    t.set("time", 3);
    t.set("invulnerable", 0);
    Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
    t.checkCollisions();
    t.setLanguage("en");
    assert.equal(element("overlay-title").textContent, "A ghost caught you!");
    assert.match(element("overlay-description").textContent, /2 lives left/);
    t.set("lives", 0);
    t.addScore(1250);
    t.changeState("gameover");
    assert.match(element("overlay-description").textContent, /1,250/);
    assert.equal(
      element("main-action").firstElementChild.textContent,
      "Restart",
    );
  });
  check("localStorage kapalıyken dil değiştirme çalışır", () => {
    const get = sandbox.localStorage.getItem,
      set = sandbox.localStorage.setItem;
    sandbox.localStorage.getItem = () => {
      throw new Error("disabled");
    };
    sandbox.localStorage.setItem = () => {
      throw new Error("disabled");
    };
    t.setLanguage("tr");
    assert.equal(t.get().language, "tr");
    t.setLanguage("en");
    assert.equal(t.get().language, "en");
    sandbox.localStorage.getItem = get;
    sandbox.localStorage.setItem = set;
  });
  console.log(count + " total checks passed (including language regression).");

  check("1–30. bölümlerde 3/4 farklı, açılmış hayalet ve tüm 8 tür", () => {
    const seen = new Set();
    for (let level = 1; level <= 30; level++) {
      const roster = t.levelGhosts(level);
      assert.equal(roster.length, level === 1 ? 3 : 4);
      assert.equal(new Set(roster.map((g) => g.id)).size, roster.length);
      for (const ghost of roster) {
        assert.ok(ghost.unlock <= level);
        seen.add(ghost.id);
      }
    }
    assert.equal(seen.size, 8);
    for (let level = 2; level <= 6; level++)
      assert.ok(t.levelGhosts(level).some((g) => g.unlock === level));
  });
  function ghostAt(id, col, row) {
    const definition = t.get().levelGhostTypes.find((g) => g.id === id);
    return {
      ...definition,
      col,
      row,
      dir: "up",
      index: 0,
      progress: 0,
      moving: false,
      releaseAt: 0,
      immuneUntil: 0,
      skillEpoch: 0,
      skillReadyAt: 10000,
      wallPlan: null,
      wallHop: null,
    };
  }
  check("pembe ve camgöbeği kırmızıdan farklı rota seçer", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 5,
      row: 1,
      dir: "right",
      progress: 0,
    });
    t.set("time", 2);
    assert.equal(t.chooseGhostDirection(ghostAt("blaze", 6, 1)), "left");
    assert.equal(t.chooseGhostDirection(ghostAt("pinky", 6, 1)), "right");
    assert.equal(t.chooseGhostDirection(ghostAt("glitch", 6, 1)), "right");
  });
  check("turuncu yakında uzaklaşır, sarı güç yemine yönelir", () => {
    t.startGame();
    Object.assign(t.get().player, {
      col: 3,
      row: 1,
      dir: "right",
      progress: 0,
    });
    t.set("time", 2);
    assert.equal(t.chooseGhostDirection(ghostAt("blaze", 2, 1)), "right");
    assert.equal(t.chooseGhostDirection(ghostAt("cinder", 2, 1)), "left");
    assert.equal(t.chooseGhostDirection(ghostAt("dozer", 2, 1)), "left");
  });
  check("sarı tüm güç yemleri bitince oyuncuyu kovalar", () => {
    const s = t.get();
    for (const row of s.map)
      for (let col = 0; col < row.length; col++)
        if (row[col] === 3) row[col] = 0;
    assert.equal(t.chooseGhostDirection(ghostAt("dozer", 2, 1)), "right");
  });
  check("mor uyarıdan sonra yüzde 35 hızlanır, güç yeminde iptal", () => {
    t.startGame();
    const g = ghostAt("rush", 6, 1);
    t.set("time", 6.5);
    const base = t.ghostSpeed(g);
    assert.equal(t.sprinting(g), false);
    t.set("time", 7.5);
    assert.equal(t.sprinting(g), true);
    assert.ok(Math.abs(t.ghostSpeed(g) / base - 1.35) < 1e-10);
    t.set("power", 20);
    assert.equal(t.sprinting(g), false);
    assert.ok(Math.abs(t.ghostSpeed(g) / base - 0.7) < 1e-10);
    t.set("power", 0);
    t.set("time", 8.5);
    assert.equal(t.sprinting(g), false);
  });
  check("tüm türlerde korku hızı tam yüzde 30 düşer", () => {
    t.startGame();
    t.set("time", 2);
    for (const type of t.get().levelGhostTypes) {
      const g = ghostAt(type.id, 6, 1);
      const speed = t.ghostSpeed(g);
      t.set("power", 10);
      assert.ok(Math.abs(t.ghostSpeed(g) / speed - 0.7) < 1e-10);
      t.set("power", 0);
    }
  });
  check(
    "yeşil yavaşlatması 3 saniye sürer, yüzde 20 etkiler; zırh ve güç engeller",
    () => {
      t.startGame();
      t.set("level", 4);
      t.loadLevel();
      const s = t.get(),
        moss = s.ghosts.find((g) => g.id === "moss");
      Object.assign(moss, s.player, { releaseAt: 0, skillEpoch: 0 });
      t.set("time", 3.5);
      assert.equal(t.playerSlowed(), false);
      t.set("time", 4.5);
      assert.equal(t.playerSlowed(), true);
      const normal = (4.65 + 3 * 0.12) * 24;
      Object.assign(s.player, {
        col: 2,
        row: 1,
        dir: "right",
        next: "right",
        progress: 0,
      });
      Object.assign(moss, { col: 2, row: 1, progress: 0 });
      t.set("invulnerable", 1e9);
      t.update(1 / 120);
      assert.ok(Math.abs(s.player.progress / (normal / 120) - 0.8) < 1e-8);
      t.useShield();
      assert.equal(t.playerSlowed(), false);
      t.set("time", 6);
      t.set("power", 10);
      assert.equal(t.playerSlowed(), false);
      t.set("power", 0);
      t.set("time", 7);
      assert.equal(t.playerSlowed(), false);
    },
  );
  check("yeşil alanı 2 hücreden uzağı yavaşlatmaz", () => {
    t.startGame();
    t.set("level", 4);
    t.loadLevel();
    const moss = t.get().ghosts.find((g) => g.id === "moss");
    Object.assign(moss, { col: 1, row: 1, releaseAt: 0, skillEpoch: 0 });
    t.set("time", 4.5);
    assert.equal(t.playerSlowed(), false);
  });
  // İzole Shade kontrolleri bilinen bir duvar geometrisini kullanır; bölüm simülasyonları üretilen haritaları kullanır.
  function setupShade() {
    t.startGame();
    t.set("level", 6);
    t.loadLevel();
    t.get().map.splice(
      0,
      t.get().map.length,
      ...sandbox.mapTest.BASE_MAP.map((row) => row.slice()),
    );
    t.set("time", 10);
    const s = t.get(),
      g = s.ghosts.find((g) => g.id === "shade");
    Object.assign(g, {
      col: 2,
      row: 4,
      dir: "right",
      progress: 0,
      releaseAt: 0,
      skillEpoch: 0,
      skillReadyAt: 0,
      wallPlan: null,
      wallHop: null,
    });
    Object.assign(s.player, { col: 2, row: 6, dir: "right", progress: 0 });
    return g;
  }
  check(
    "gri tek duvarı önce işaretler; sonra güvenli yola iner ve 10 sn bekler",
    () => {
      const g = setupShade();
      assert.equal(t.updateGhostSkill(g, 0), true);
      assert.equal(g.wallPlan.col, 2);
      assert.equal(g.wallPlan.row, 6);
      assert.equal(g.wallPlan.startsAt, 10.9);
      assert.equal(g.skillReadyAt, 20);
      assert.equal(g.wallHop, null);
      t.set("time", 11);
      t.updateGhostSkill(g, 0);
      assert.ok(g.wallHop);
      assert.equal(g.col, 2);
      assert.equal(g.row, 4);
      t.updateGhostSkill(g, 0.5);
      assert.equal(g.row, 6);
      assert.equal(g.wallHop, null);
      assert.ok(t.walkable(g.col, g.row));
      assert.equal(t.updateGhostSkill(g, 0), false);
    },
  );
  check(
    "gri yeteneği hücre ortasında tetiklenmez; merkezde yapay zekâ tetikler",
    () => {
      const g = setupShade();
      g.progress = 3;
      assert.equal(t.updateGhostSkill(g, 0), false);
      g.progress = 0;
      assert.equal(t.chooseGhostDirection(g), null);
      assert.ok(g.wallPlan);
    },
  );
  check("gri iki/üç hücrelik duvarı aşamaz", () => {
    const g = setupShade();
    Object.assign(g, { col: 1, row: 2, dir: "right", progress: 0 });
    Object.assign(t.get().player, { col: 5, row: 2, progress: 0 });
    t.updateGhostSkill(g, 0);
    if (g.wallPlan) assert.notEqual(g.wallPlan.col, 5);
  });
  check("gri havadayken temas yok; inişte temas kuralları geri gelir", () => {
    const g = setupShade();
    t.updateGhostSkill(g, 0);
    t.set("time", 11);
    t.updateGhostSkill(g, 0);
    t.set("invulnerable", 0);
    Object.assign(t.get().player, { col: 2, row: 4, progress: 0 });
    const lives = t.get().lives;
    t.checkCollisions();
    assert.equal(t.get().lives, lives);
    t.updateGhostSkill(g, 0.5);
    Object.assign(t.get().player, { col: 2, row: 6, progress: 0 });
    t.checkCollisions();
    assert.equal(t.get().lives, lives - 1);
  });
  check("güç yemi gri atlayışı iptal eder, duvarda kalmaz", () => {
    const g = setupShade();
    t.updateGhostSkill(g, 0);
    t.set("time", 11);
    t.updateGhostSkill(g, 0);
    t.collectPellet(1, 1);
    assert.equal(g.wallHop, null);
    assert.equal(g.wallPlan, null);
    assert.ok(t.walkable(g.col, g.row));
    assert.equal(t.updateGhostSkill(g, 1), false);
  });
  check("pause özel yetenek zamanlarını dondurur", () => {
    const g = setupShade();
    t.updateGhostSkill(g, 0);
    const before = JSON.stringify(g);
    t.changeState("paused");
    t.update(100);
    assert.equal(JSON.stringify(g), before);
    assert.equal(t.get().gameTime, 10);
  });
  check("dil değişirken hayalet özellikleri ve kadro korunur", () => {
    const g = setupShade();
    t.updateGhostSkill(g, 0);
    const before = JSON.stringify(t.get().ghosts);
    t.setLanguage("en");
    assert.equal(JSON.stringify(t.get().ghosts), before);
    assert.match(element("active-ghost-list").innerHTML, /Jumps one wall/);
    assert.match(element("ghost-level-summary").textContent, /LEVEL 6/);
    t.setLanguage("tr");
    assert.match(element("active-ghost-list").innerHTML, /tek duvar/);
  });
  check(
    "1–12. bölüm simülasyonu: duvar aşma, farklı AI, güvenli grid konumu",
    () => {
      let hops = 0;
      for (let level = 1; level <= 12; level++) {
        t.startGame();
        t.set("level", level);
        t.loadLevel();
        t.set("invulnerable", 1e9);
        for (let i = 0; i < 3600; i++) {
          if (i % 80 === 0)
            t.setDirection(
              ["left", "up", "right", "down"][Math.floor(i / 80) % 4],
            );
          t.update(1 / 120);
          for (const ghost of t.get().ghosts) {
            assert.ok(t.walkable(ghost.col, ghost.row));
            if (ghost.wallPlan || ghost.wallHop) hops++;
          }
          if (t.get().state === "victory") break;
        }
      }
      assert.ok(
        hops > 0,
        "Shade must actually use its wall skill during movement",
      );
    },
  );
  check("korku hali, özel alanlar ve sekiz tür canvas çizimi", () => {
    t.startGame();
    t.set("time", 7.5);
    for (const type of t.get().levelGhostTypes) {
      const g = ghostAt(type.id, 6, 1);
      t.drawGhostEffects(g);
    }
    const g = setupShade();
    t.updateGhostSkill(g, 0);
    t.drawGhostEffects(g);
    t.render(10);
    t.set("power", 20);
    t.render(10.1);
  });
  console.log(
    count + " total checks passed (ghost progression + regressions).",
  );

  check("yeni hayalet bildirimi dil değiştirilince yeniden çevrilir", () => {
    t.setLanguage("tr");
    t.startGame();
    t.nextLevel();
    assert.match(element("announcement").textContent, /Yeni hayalet: Cinder/);
    t.setLanguage("en");
    assert.match(element("announcement").textContent, /New ghost: Cinder/);
    assert.doesNotMatch(element("announcement").textContent, /Yeni hayalet/);
    t.setLanguage("tr");
  });
  check("yenilen hayalet 3 saniye hareket etmez; pause süreyi dondurur", () => {
    t.startGame();
    t.set("invulnerable", 1e9);
    t.set("time", 2);
    const s = t.get();
    Object.assign(s.player, { col: 1, row: 1, progress: 0 });
    t.eatPellet();
    const ghost = s.ghosts[0];
    Object.assign(ghost, {
      col: 1,
      row: 1,
      progress: 0,
      releaseAt: 0,
      immuneUntil: 0,
    });
    t.checkCollisions();
    assert.equal(ghost.releaseAt, 5);
    t.changeState("paused");
    t.update(10);
    assert.equal(t.get().gameTime, 2);
    assert.equal(ghost.progress, 0);
    t.togglePause();
    t.finishCutscene();
    t.set("time", 4.98);
    t.update(0.01);
    assert.equal(ghost.col, 10);
    assert.equal(ghost.row, 9);
    assert.equal(ghost.progress, 0);
    t.update(0.02);
    assert.ok(ghost.progress > 0);
  });
  check(
    "güç modu erken bitse de 3 saniyelik respawn beklemesi tamamlanır",
    () => {
      t.startGame();
      t.set("invulnerable", 1e9);
      const s = t.get();
      Object.assign(s.player, { col: 1, row: 1, progress: 0 });
      t.eatPellet();
      t.set("time", 9.5);
      const ghost = s.ghosts[0];
      Object.assign(ghost, {
        col: 1,
        row: 1,
        progress: 0,
        releaseAt: 0,
        immuneUntil: 0,
      });
      t.checkCollisions();
      assert.equal(ghost.releaseAt, 12.5);
      t.finishCutscene();
      t.set("time", 12.49);
      t.update(0.005);
      assert.equal(ghost.progress, 0);
      t.update(0.01);
      assert.ok(ghost.progress > 0);
    },
  );
  check("1–100. bölüm ve tekrar doğmalarında en fazla 4 hayalet oluşur", () => {
    for (let level = 1; level <= 100; level++) {
      t.startGame();
      t.set("level", level);
      t.loadLevel();
      const s = t.get();
      assert.equal(s.ghosts.length, level === 1 ? 3 : 4);
      assert.ok(s.ghosts.length <= 4);
      t.set("power", 10);
      const ghost = s.ghosts[0];
      Object.assign(ghost, s.player, { releaseAt: 0, immuneUntil: 0 });
      t.checkCollisions();
      assert.equal(t.get().ghosts.length, level === 1 ? 3 : 4);
      t.resetActors();
      assert.equal(t.get().ghosts.length, level === 1 ? 3 : 4);
    }
  });
  console.log(count + " verified checks passed.");

  function capture(id = "blaze") {
    const s = t.get(),
      g = ghostAt(id, s.player.col, s.player.row);
    s.ghosts.splice(0, s.ghosts.length, g);
    t.set("power", s.gameTime + 10);
    t.checkCollisions();
    return g;
  }
  check("güç modunda temas: doğru hayaletle tek +200 ve ara sahne", () => {
    t.startGame();
    const g = capture("glitch"),
      s = t.get();
    assert.equal(s.state, "cutscene");
    assert.equal(s.score, 200);
    assert.equal(s.cutscene.ghost.id, "glitch");
    assert.equal(s.cutscene.ghost.color, g.color);
    assert.equal(element("cutscene-ui").hidden, false);
    assert.equal(element("overlay").hidden, true);
    t.checkCollisions();
    assert.equal(t.get().score, 200);
  });
  check("ara sahne oyun, güç, yetenek ve respawn sürelerini dondurur", () => {
    t.startGame();
    t.useBoost();
    t.useShield();
    t.useMagnet();
    capture();
    const s = t.get(),
      before = JSON.stringify({
        player: s.player,
        ghosts: s.ghosts,
        map: s.map,
      });
    const timers = [
      "gameTime",
      "powerUntil",
      "boostUntil",
      "shieldUntil",
      "magnetUntil",
      "jumpReadyAt",
      "magnetReadyAt",
      "boostReadyAt",
      "shieldReadyAt",
    ];
    const values = timers.map((k) => s[k]);
    t.update(0.8);
    const after = t.get();
    timers.forEach((k, i) => assert.equal(after[k], values[i]));
    assert.equal(
      JSON.stringify({
        player: after.player,
        ghosts: after.ghosts,
        map: after.map,
      }),
      before,
    );
    assert.equal(after.cutscene.elapsed, 0.8);
  });
  check(
    "1,3 saniye sonra kaldığı yerden devam eder; respawn hâlâ 3 saniyedir",
    () => {
      t.startGame();
      t.set("time", 2);
      const g = capture();
      t.update(0.6);
      t.update(0.7);
      assert.equal(t.get().state, "playing");
      assert.equal(t.get().cutscene, null);
      assert.equal(t.get().gameTime, 2);
      assert.equal(t.get().powerUntil, 12);
      assert.equal(g.releaseAt - t.get().gameTime, 3);
    },
  );
  check("Enter ile atlama ve tekrar bitirme ek puan vermez", () => {
    t.startGame();
    capture();
    events.window.keydown({
      key: "Enter",
      code: "Enter",
      target: {},
      repeat: false,
      preventDefault() {},
    });
    assert.equal(t.get().state, "playing");
    assert.equal(t.get().score, 200);
    t.finishCutscene();
    assert.equal(t.get().score, 200);
  });
  check(
    "yumruk, aparkat ve yakın darbe sırayla döner; restart sıfırlar",
    () => {
      t.startGame();
      for (const kind of ["punch", "uppercut", "hook", "punch"]) {
        capture();
        assert.equal(t.get().cutscene.kind, kind);
        t.finishCutscene();
      }
      t.startGame();
      capture();
      assert.equal(t.get().cutscene.kind, "punch");
    },
  );
  check("Space sahneyi duraklatır ve kaldığı pozdan sürdürür", () => {
    t.startGame();
    capture();
    t.update(0.4);
    t.togglePause();
    t.update(20);
    assert.equal(t.get().cutscene.elapsed, 0.4);
    assert.equal(element("cutscene-ui").hidden, true);
    t.finishCutscene();
    assert.equal(t.get().state, "paused");
    t.togglePause();
    assert.equal(t.get().state, "cutscene");
    assert.equal(element("cutscene-ui").hidden, false);
    t.update(0.2);
    assert.ok(Math.abs(t.get().cutscene.elapsed - 0.6) < 1e-10);
    t.togglePause();
    t.mainAction();
    assert.equal(t.get().state, "cutscene");
  });
  check(
    "sekme gizlenmesi ve pencere odağı kaybı ara sahneyi duraklatır",
    () => {
      t.startGame();
      capture();
      events.window.blur();
      assert.equal(t.get().state, "paused");
      t.togglePause();
      sandbox.document.hidden = true;
      events.document.visibilitychange();
      assert.equal(t.get().state, "paused");
      sandbox.document.hidden = false;
      t.togglePause();
      assert.equal(t.get().state, "cutscene");
    },
  );
  check(
    "dil değişimi ara sahneyi sıfırlamadan başlık ve bildirimi çevirir",
    () => {
      t.startGame();
      capture();
      t.update(0.3);
      t.setLanguage("en");
      assert.match(element("cutscene-title").textContent, /PUNCH!.*Blaze/);
      assert.match(element("announcement").textContent, /defeated/);
      assert.equal(t.get().cutscene.elapsed, 0.3);
      assert.equal(t.get().state, "cutscene");
      t.setLanguage("tr");
      assert.match(element("cutscene-title").textContent, /YUMRUK!/);
    },
  );
  check(
    "Q/E ara sahnede çalışmaz; yön tamponu hareket ettirmeden kaydolur",
    () => {
      t.startGame();
      capture();
      const old = t.position(t.get().player);
      t.useBoost();
      t.useShield();
      t.useMagnet();
      t.useJump();
      assert.equal(t.get().boostUntil, 0);
      assert.equal(t.get().shieldUntil, 0);
      assert.equal(t.get().magnetUntil, 0);
      assert.equal(t.get().jump, null);
      t.setDirection("left");
      assert.equal(t.get().player.next, "left");
      assert.deepEqual(t.position(t.get().player), old);
    },
  );
  check("aynı karede iki temas yalnızca bir hayalet yakalar", () => {
    t.startGame();
    const s = t.get(),
      a = ghostAt("blaze", s.player.col, s.player.row),
      b = ghostAt("pinky", s.player.col, s.player.row);
    s.ghosts.splice(0, s.ghosts.length, a, b);
    t.set("power", 10);
    t.checkCollisions();
    assert.equal(t.get().score, 200);
    assert.equal(b.releaseAt, 0);
    t.checkCollisions();
    assert.equal(t.get().score, 200);
    t.finishCutscene();
    t.checkCollisions();
    assert.equal(t.get().score, 400);
    assert.equal(t.get().cutscene.ghost.id, "pinky");
  });
  check(
    "normal temas ara sahne başlatmaz; restart ve bölüm geçişi sahneyi temizler",
    () => {
      t.startGame();
      t.set("invulnerable", 0);
      Object.assign(t.get().ghosts[0], t.get().player, { releaseAt: 0 });
      t.checkCollisions();
      assert.equal(t.get().cutscene, null);
      assert.equal(t.get().state, "dying");
      t.startGame();
      capture();
      t.nextLevel();
      assert.equal(t.get().cutscene, null);
      assert.equal(t.get().state, "playing");
      capture();
      t.startGame();
      assert.equal(t.get().cutscene, null);
      assert.equal(element("cutscene-ui").hidden, true);
    },
  );
  check("azaltılmış hareket tercihinde kısa, sarsıntısız sahne", () => {
    motion.matches = true;
    t.startGame();
    capture();
    assert.equal(t.get().cutscene.reduced, true);
    assert.equal(t.get().cutscene.duration, 0.65);
    t.update(0.35);
    t.drawCutscene();
    t.update(0.31);
    assert.equal(t.get().state, "playing");
    motion.matches = false;
  });
  check(
    "üç hareket, sekiz hayalet ve yüklenmeyen atlas için Canvas çizimi",
    () => {
      t.startGame();
      for (const type of t.get().levelGhostTypes) {
        capture(type.id);
        for (const p of [0, 0.3, 0.42, 0.6, 0.95]) {
          t.get().cutscene.elapsed = t.get().cutscene.duration * p;
          t.drawCutscene();
        }
        t.finishCutscene();
      }
    },
  );
  console.log(
    count + " verified checks passed (action cutscenes + regressions).",
  );

  const maps = sandbox.mapTest;
  function roadsReachable(grid) {
    const queue = [[10, 17]],
      seen = new Set(["10,17"]);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          key = nx + "," + ny;
        if (
          grid[ny]?.[nx] !== undefined &&
          grid[ny][nx] !== 1 &&
          !seen.has(key)
        ) {
          seen.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    return seen;
  }
  check(
    "ilk 1000 bölüm: farklı labirent, tüm yollar bağlı, sınırlar kapalı, dört köşe güç yemi",
    () => {
      const fingerprints = new Set();
      for (let level = 1; level <= 1000; level++) {
        const grid = maps.createLevelMap(level),
          seen = roadsReachable(grid);
        assert.equal(grid.length, 23);
        assert.ok(grid.every((row) => row.length === 21));
        assert.ok(grid.flat().every((v) => [0, 1, 2, 3].includes(v)));
        for (let y = 0; y < 23; y++)
          for (let x = 0; x < 21; x++) {
            if (x === 0 || x === 20 || y === 0 || y === 22)
              assert.equal(grid[y][x], 1);
            if (grid[y][x] !== 1)
              assert.ok(
                seen.has(x + "," + y),
                "Unreachable tile at level " + level,
              );
          }
        assert.equal(grid.flat().filter((v) => v === 3).length, 4);
        for (const [x, y] of [
          [1, 1],
          [19, 1],
          [1, 21],
          [19, 21],
        ])
          assert.equal(grid[y][x], 3);
        for (const [x, y] of [
          [10, 17],
          [9, 9],
          [10, 9],
          [11, 9],
          [12, 9],
          [10, 11],
        ])
          assert.equal(grid[y][x], 0);
        const fingerprint = JSON.stringify(
          grid.map((row) => row.map((v) => (v === 1 ? 1 : 0))),
        );
        assert.ok(
          !fingerprints.has(fingerprint),
          "Repeated geometry at level " + level,
        );
        fingerprints.add(fingerprint);
      }
    },
  );
  check(
    "aynı bölüm aynı haritayı üretir; diziler birbirinden ve klasik haritadan bağımsızdır",
    () => {
      const base = JSON.stringify(maps.BASE_MAP);
      for (const level of [1, 2, 3, 4, 5, 17, 99, 1000]) {
        const a = maps.createLevelMap(level),
          b = maps.createLevelMap(level);
        assert.equal(JSON.stringify(a), JSON.stringify(b));
        a[1][1] = 0;
        assert.equal(b[1][1], 3);
        assert.equal(JSON.stringify(maps.BASE_MAP), base);
      }
    },
  );
  check(
    "üretilen haritalarda çıkmaz yok; zıplama için geçilebilir duvarlar var",
    () => {
      for (let level = 2; level <= 100; level++) {
        const grid = maps.createLevelMap(level);
        let jumps = 0;
        for (let y = 1; y < 22; y++)
          for (let x = 1; x < 20; x++)
            if (grid[y][x] !== 1) {
              assert.ok(
                [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                ].filter(([dx, dy]) => grid[y + dy][x + dx] !== 1).length >= 2,
              );
              for (const [dx, dy] of [
                [1, 0],
                [0, 1],
              ])
                if (
                  grid[y + dy]?.[x + dx] === 1 &&
                  grid[y + dy * 2]?.[x + dx * 2] !== undefined &&
                  grid[y + dy * 2][x + dx * 2] !== 1
                )
                  jumps++;
            }
        assert.ok(jumps > 0);
      }
    },
  );
  check(
    "can kaybı haritayı ve toplanmış yemleri korur; yeni bölüm ve restart haritayı değiştirir",
    () => {
      t.startGame();
      t.nextLevel();
      const map = t.get().map,
        geometry = JSON.stringify(map);
      map[1][1] = 0;
      t.resetActors();
      assert.equal(t.get().map, map);
      assert.equal(t.get().map[1][1], 0);
      t.loadLevel();
      assert.equal(JSON.stringify(t.get().map), geometry);
      t.nextLevel();
      assert.notEqual(JSON.stringify(t.get().map), geometry);
      t.startGame();
      assert.equal(JSON.stringify(t.get().map), JSON.stringify(maps.BASE_MAP));
    },
  );
  check(
    "yeni haritaların yem sayısı doğru; tüm yemlerden sonra merkez can yemi ve zafer",
    () => {
      for (const level of [2, 3, 4, 5, 10]) {
        t.startGame();
        t.set("level", level);
        t.loadLevel();
        const grid = t.get().map,
          foods = [];
        for (let y = 0; y < 23; y++)
          for (let x = 0; x < 21; x++)
            if (grid[y][x] === 2 || grid[y][x] === 3) foods.push([x, y]);
        assert.equal(t.get().pellets, foods.length);
        assert.ok(foods.length > 150);
        for (const [col, row] of foods) {
          Object.assign(t.get().player, { col, row, progress: 0 });
          t.eatPellet();
        }
        assert.equal(t.get().score, (foods.length - 4) * 10 + 4 * 50);
        assert.equal(t.get().pellets, 0);
        assert.equal(t.get().ghosts.length, 0);
        assert.equal(t.get().map[11][10], 4);
        assert.equal(t.get().roundPhase, "bonus");
        Object.assign(t.get().player, { col: 10, row: 11, progress: 0 });
        t.eatPellet();
        assert.equal(t.get().state, "victory");
      }
    },
  );
  check(
    "harita etiketi ve sonraki bölüm önizlemesi iki dilde doğru; dil değişimi haritayı korur",
    () => {
      t.startGame();
      t.nextLevel();
      t.setLanguage("tr");
      assert.equal(element("map-label").textContent, "HARİTA · Neon Sokaklar");
      const map = JSON.stringify(t.get().map);
      t.setLanguage("en");
      assert.equal(element("map-label").textContent, "MAP · Neon Streets");
      assert.equal(JSON.stringify(t.get().map), map);
      t.changeState("victory");
      t.mainAction();
      assert.match(element("loadout-map").textContent, /Crossroads/);
      assert.equal(t.get().level, 2);
      t.confirmLoadout();
      assert.equal(t.get().level, 3);
      assert.equal(element("map-label").textContent, "MAP · Crossroads");
      t.setLanguage("tr");
      assert.equal(element("map-label").textContent, "HARİTA · Kavşaklar");
    },
  );
  console.log(count + " verified checks passed (1000 maps + all regressions).");

  const game = sandbox.game,
    save = game.saves,
    levels = game.levels;
  function freshRun(level = 1) {
    levels.dialog.close();
    element("loadout-dialog").close();
    game.startGame(level);
  }
  function clearSlots() {
    save.slots = { manual: null, auto: null };
    stored.delete(save.key("manual"));
    stored.delete(save.key("auto"));
  }
  function completeLevel(level, lives = 3) {
    freshRun(level);
    game.lives = lives;
    const foods = [];
    game.maze.grid.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v === 2 || v === 3) foods.push([x, y]);
      }),
    );
    for (const [col, row] of foods) {
      Object.assign(game.player.entity, { col, row, progress: 0 });
      game.player.eatPellet();
    }
    Object.assign(game.player.entity, { col: 10, row: 11, progress: 0 });
    game.player.eatPellet();
  }
  check(
    "menü bölüm seçimini açar; 12 kart, sayfalama ve numarayla bölüm bulma",
    () => {
      freshRun();
      game.changeState("ready");
      game.mainAction();
      assert.equal(levels.dialog.open, true);
      assert.equal(
        (element("level-grid").innerHTML.match(/data-level=/g) || []).length,
        12,
      );
      assert.match(element("level-grid").innerHTML, /data-level="1"/);
      levels.changePage(1);
      assert.match(element("level-grid").innerHTML, /data-level="13"/);
      levels.changePage(-100);
      assert.equal(levels.page, 0);
      element("level-number").value = "999";
      levels.jumpToLevel();
      assert.equal(levels.selected, 999);
      assert.equal(levels.page, 83);
      assert.match(element("level-grid").innerHTML, /data-level="999"/);
      levels.dialog.close();
    },
  );
  check(
    "seçim oyun durumunu değiştirmez; onay ve yetenek seçimi istenen bölümden başlatır",
    () => {
      freshRun();
      const before = JSON.stringify(game.maze.grid);
      game.changeState("ready");
      levels.open();
      levels.selectLevel(17);
      assert.equal(game.level, 1);
      assert.equal(JSON.stringify(game.maze.grid), before);
      levels.confirmSelection();
      assert.equal(element("loadout-dialog").open, true);
      assert.match(element("loadout-enemies").textContent, /17/);
      game.abilities.confirmLoadout();
      assert.equal(game.level, 17);
      assert.equal(game.state, "playing");
      assert.equal(game.lives, 3);
      assert.equal(game.score, 0);
      assert.equal(
        JSON.stringify(game.maze.grid),
        JSON.stringify(game.maze.createLevelMap(17)),
      );
    },
  );
  check("geçersiz bölüm numaraları reddedilir; seçim ve oyun korunur", () => {
    freshRun();
    levels.selectLevel(8);
    for (const value of [
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER,
      "8",
    ])
      assert.equal(levels.selectLevel(value), false);
    assert.equal(levels.selected, 8);
    assert.equal(game.level, 1);
  });
  check(
    "yetenek ekranından Geri bölüm seçimine döner; seçim ve dil korunur",
    () => {
      freshRun();
      game.changeState("ready");
      levels.open();
      levels.selectLevel(9);
      levels.confirmSelection();
      game.abilities.cancelLoadout();
      assert.equal(levels.dialog.open, true);
      assert.equal(levels.selected, 9);
      game.i18n.setLanguage("en");
      assert.match(element("level-choice").textContent, /Selected: 9/);
      assert.match(element("level-grid").innerHTML, /Level 9/);
      game.i18n.setLanguage("tr");
      levels.dialog.close();
    },
  );
  check("harita küçük görselleri önbelleği 48 ile sınırlıdır", () => {
    for (let page = 0; page < 10; page++) {
      levels.page = page;
      levels.renderMenu();
    }
    assert.ok(levels.thumbnails.size <= 48);
  });
  check(
    "elle kayıt: skor, can, harita, hareket, güç, yetenekler ve hayalet zamanları aynen döner",
    () => {
      clearSlots();
      freshRun();
      game.lives = 2;
      game.gameTime = 2;
      Object.assign(game.player.entity, {
        col: 2,
        row: 1,
        dir: "right",
        next: "down",
        progress: 7,
      });
      game.player.eatPellet();
      game.abilities.useBoost();
      game.abilities.useShield();
      game.powerUntil = 12;
      assert.equal(save.saveManual(), true);
      const before = JSON.stringify(save.slots.manual.data);
      freshRun(20);
      game.gameTime = 500;
      assert.equal(save.resume("manual"), true);
      assert.equal(JSON.stringify(save.capture().data), before);
      assert.equal(game.state, "playing");
      assert.equal(game.lastFrame, 0);
      assert.equal(game.accumulator, 0);
    },
  );
  check(
    "kayıt yaşayan dizilere bağlı değildir; yüklenen oyun da kayıt yuvasını değiştirmez",
    () => {
      freshRun();
      save.saveManual();
      const before = JSON.stringify(save.slots.manual);
      game.maze.grid[1][1] = 0;
      game.ghosts.entities[0].releaseAt = 99;
      assert.equal(JSON.stringify(save.slots.manual), before);
      save.resume("manual");
      game.maze.grid[1][1] = 0;
      assert.equal(JSON.stringify(save.slots.manual), before);
    },
  );
  check(
    "korkmuş hayaletin respawn/bağışıklık süresi ve ara sahne yüklenir; puan iki kez verilmez",
    () => {
      freshRun();
      game.powerUntil = 10;
      Object.assign(game.ghosts.entities[0], game.player.entity, {
        releaseAt: 0,
        immuneUntil: 0,
      });
      game.checkCollisions();
      game.cutscenes.advanceCutscene(0.4);
      assert.equal(save.saveManual(), true);
      const score = game.score,
        release = game.ghosts.entities[0].releaseAt;
      freshRun();
      save.resume("manual");
      assert.equal(game.state, "cutscene");
      assert.equal(game.cutscenes.current.elapsed, 0.4);
      assert.equal(game.score, score);
      assert.equal(game.ghosts.entities[0].releaseAt, release);
      game.checkCollisions();
      assert.equal(game.score, score);
      game.cutscenes.finishCutscene();
      assert.equal(game.powerUntil - game.gameTime, 10);
    },
  );
  check(
    "havada zıplama ve kalan bekleme süresi yüklenir; doğru hücreye iner",
    () => {
      freshRun();
      Object.assign(game.player.entity, {
        col: 1,
        row: 2,
        dir: "right",
        next: "right",
        progress: 0,
      });
      game.abilities.useJump();
      game.abilities.advanceJump(0.1);
      assert.equal(save.saveManual(), true);
      freshRun();
      save.resume("manual");
      assert.equal(game.abilities.jump.elapsed, 0.1);
      assert.equal(game.abilities.jumpReadyAt, 8);
      game.abilities.advanceJump(0.25);
      assert.equal(game.player.entity.col, 5);
      assert.equal(game.player.entity.row, 2);
    },
  );
  check("Shade duvar atlayışı bütün plan ve iniş verileriyle döner", () => {
    const ghost = setupShade();
    game.ghosts.updateGhostSkill(ghost, 0);
    game.gameTime = 11;
    game.ghosts.updateGhostSkill(ghost, 0.2);
    const original = JSON.stringify(ghost.wallHop);
    // İzole AI geometrisini kullanan test haritası gerçek 6. bölümle değiştirilemez.
    assert.equal(save.validate(save.capture()), false);
    freshRun(6);
    const shade = game.ghosts.entities.find((g) => g.id === "shade");
    const grid = game.maze.grid;
    let found;
    for (let y = 1; y < 22 && !found; y++)
      for (let x = 1; x < 20 && !found; x++)
        if (
          grid[y][x] !== 1 &&
          grid[y]?.[x + 1] === 1 &&
          grid[y]?.[x + 2] !== undefined &&
          grid[y][x + 2] !== 1
        )
          found = { col: x, row: y };
    assert.ok(found);
    Object.assign(shade, found, { dir: "right", progress: 0, releaseAt: 0 });
    const target = { col: found.col + 2, row: found.row };
    shade.wallHop = {
      ...target,
      dir: "right",
      from: { x: (found.col + 0.5) * 24, y: (found.row + 0.5) * 24 },
      to: { x: (target.col + 0.5) * 24, y: (target.row + 0.5) * 24 },
      startsAt: 0,
      elapsed: 0.2,
    };
    game.gameTime = 1;
    assert.equal(save.saveManual(), true);
    const hop = JSON.stringify(shade.wallHop);
    freshRun();
    save.resume("manual");
    assert.equal(
      JSON.stringify(
        game.ghosts.entities.find((g) => g.id === "shade").wallHop,
      ),
      hop,
    );
  });
  check(
    "merkez can yemi aşaması kaydedilir; yüklenince ödül bir kez verilir",
    () => {
      freshRun();
      game.lives = 2;
      const foods = [];
      game.maze.grid.forEach((r, y) =>
        r.forEach((v, x) => {
          if (v === 2 || v === 3) foods.push([x, y]);
        }),
      );
      for (const [col, row] of foods) {
        Object.assign(game.player.entity, { col, row, progress: 0 });
        game.player.eatPellet();
      }
      assert.equal(save.saveManual(), true);
      const score = game.score;
      freshRun(4);
      save.resume("manual");
      assert.equal(game.maze.phase, "bonus");
      assert.equal(game.maze.grid[11][10], 4);
      assert.equal(game.ghosts.entities.length, 0);
      Object.assign(game.player.entity, { col: 10, row: 11, progress: 0 });
      game.player.eatPellet();
      game.maze.collectLifePellet();
      assert.equal(game.lives, 3);
      assert.equal(game.score, score);
      assert.equal(game.state, "victory");
    },
  );
  check(
    "5. bölüm sonunda checkpoint 6. bölümü skor ve can ödülüyle hazırlar",
    () => {
      clearSlots();
      save.autoEnabled = true;
      completeLevel(5, 2);
      assert.equal(game.level, 5);
      assert.equal(game.state, "victory");
      assert.equal(save.slots.auto.data.level, 6);
      assert.equal(save.slots.auto.data.lives, 3);
      assert.equal(save.slots.auto.data.score, game.score);
      assert.equal(save.slots.auto.data.gameTime, 0);
      assert.equal(save.slots.auto.data.phase, "maze");
      assert.equal(save.slots.auto.kind, "checkpoint");
      const record = save.slots.auto;
      game.changeState("victory");
      assert.equal(save.slots.auto, record);
      save.resume("auto");
      assert.equal(game.level, 6);
      assert.equal(game.state, "playing");
    },
  );
  check(
    "otomatik kayıt 4. ve 6. bölümde oluşmaz; 10. bölüm sonrası 11 kaydedilir",
    () => {
      clearSlots();
      save.autoEnabled = true;
      completeLevel(4);
      assert.equal(save.slots.auto, null);
      completeLevel(6);
      assert.equal(save.slots.auto, null);
      completeLevel(10);
      assert.equal(save.slots.auto.data.level, 11);
    },
  );
  check(
    "otomatik kayıt kapatılabilir; elle kayıt çalışır ve tercih yeniden okunur",
    () => {
      clearSlots();
      save.setAuto(false);
      completeLevel(5);
      assert.equal(save.slots.auto, null);
      assert.equal(save.saveManual(), true);
      assert.equal(save.slots.manual.data.level, 6);
      assert.equal(save.slots.manual.kind, "checkpoint");
      save.autoEnabled = true;
      save.load();
      assert.equal(save.autoEnabled, false);
      save.setAuto(true);
    },
  );
  check(
    "iki kayıt yuvası birbirini ezmez; son kayıttan devam ve Kaydet ve menü çalışır",
    () => {
      clearSlots();
      freshRun(2);
      save.saveManual();
      const manual = JSON.stringify(save.slots.manual);
      completeLevel(5);
      assert.equal(JSON.stringify(save.slots.manual), manual);
      assert.ok(save.slots.auto);
      freshRun(9);
      game.saveAndMenu();
      assert.equal(game.state, "ready");
      assert.equal(element("resume-game").hidden, false);
      assert.equal(save.slots.manual.data.level, 9);
      assert.equal(save.slots.auto.data.level, 6);
      assert.equal(levels.selected, 9);
      save.resume();
      assert.equal(game.level, 9);
    },
  );
  check(
    "menü ve yetenek seçimi sırasında kayıt engellenir; K oyun sırasında kaydeder",
    () => {
      freshRun();
      game.changeState("ready");
      assert.equal(save.saveManual(), false);
      levels.open();
      assert.equal(save.canSave(), false);
      levels.dialog.close();
      freshRun(3);
      events.window.keydown({
        key: "k",
        code: "KeyK",
        target: {},
        repeat: false,
        preventDefault() {},
      });
      assert.equal(save.slots.manual.data.level, 3);
      const record = save.slots.manual;
      events.window.keydown({
        key: "k",
        code: "KeyK",
        target: {},
        repeat: true,
        preventDefault() {},
      });
      assert.equal(save.slots.manual, record);
    },
  );
  check(
    "depolama dolu/kapalıyken kayıt başarısızdır; oyun ve eski kayıt korunur",
    () => {
      freshRun();
      save.saveManual();
      const record = save.slots.manual,
        old = stored.get(save.key("manual")),
        set = sandbox.localStorage.setItem;
      sandbox.localStorage.setItem = () => {
        throw Error("quota");
      };
      assert.equal(save.saveManual(), false);
      assert.equal(game.state, "playing");
      assert.equal(save.slots.manual, record);
      assert.equal(stored.get(save.key("manual")), old);
      assert.match(element("save-feedback").textContent, /Kayıt yazılamadı/);
      game.saveAndMenu();
      assert.equal(game.state, "playing");
      sandbox.localStorage.setItem = set;
    },
  );
  check(
    "bozuk, eski sürüm ve değiştirilmiş harita/aktör kayıtları reddedilir",
    () => {
      freshRun();
      const valid = save.capture();
      assert.equal(save.validate(valid), true);
      for (const mutate of [
        (r) => (r.version = 99),
        (r) => (r.data.level = -1),
        (r) => (r.data.lives = 4),
        (r) => (r.data.map[0][0] = 0),
        (r) => (r.data.map[1][2] = 3),
        (r) => (r.data.player.progress = 24),
        (r) => (r.data.player.dir = "oops"),
        (r) => (r.data.abilities.boostUntil = "bad"),
        (r) => (r.data.abilities.loadout.e = r.data.abilities.loadout.q),
        (r) => (r.data.ghosts[0].id = "missing"),
        (r) => (r.data.ghosts[0].wallHop = { elapsed: 0 }),
        (r) => (r.data.cutscene = { kind: "oops" }),
        (r) => (r.data.score = Infinity),
      ]) {
        const invalid = save.clone(valid);
        mutate(invalid);
        assert.equal(save.validate(invalid), false);
      }
      const state = JSON.stringify(save.capture().data);
      save.slots.manual = { version: 999 };
      assert.equal(save.resume("manual"), false);
      assert.equal(JSON.stringify(save.capture().data), state);
    },
  );
  check("bozuk JSON açılışı bozmaz ve iyi otomatik kayıt hâlâ yüklenir", () => {
    freshRun();
    const record = save.capture(6);
    stored.set(save.key("auto"), JSON.stringify(record));
    stored.set(save.key("manual"), "{bad");
    save.load();
    assert.equal(save.slots.manual, null);
    assert.equal(save.slots.auto.data.level, 6);
    assert.equal(save.resume("auto"), true);
  });
  check(
    "kayıt yüklemek mevcut dili korur; bölüm kartları ve kayıt metni iki dilde çevrilir",
    () => {
      freshRun(8);
      save.saveManual();
      game.i18n.setLanguage("en");
      freshRun();
      save.resume("manual");
      assert.equal(game.i18n.language, "en");
      assert.match(element("save-feedback").textContent, /Save loaded.*8/);
      game.saveAndMenu();
      levels.open();
      assert.match(element("saved-games").innerHTML, /Manual save/);
      game.i18n.setLanguage("tr");
      assert.match(element("saved-games").innerHTML, /Elle kayıt/);
      assert.match(element("level-choice").textContent, /Seçilen: 8/);
      levels.dialog.close();
    },
  );
  check(
    "yeni Game örneği kayıtları depolamadan okur ve bıraktığı sürelerle devam eder",
    () => {
      freshRun(12);
      game.gameTime = 4;
      game.lives = 2;
      game.abilities.useBoost();
      save.saveManual();
      const expected = JSON.stringify(save.slots.manual.data);
      const rebooted = new game.constructor();
      rebooted.start();
      assert.equal(rebooted.state, "ready");
      assert.equal(rebooted.saves.slots.manual.data.level, 12);
      assert.equal(rebooted.saves.resume("manual"), true);
      assert.equal(JSON.stringify(rebooted.saves.capture().data), expected);
      assert.equal(rebooted.abilities.boostUntil - rebooted.gameTime, 3);
      assert.equal(rebooted.lives, 2);
    },
  );
  console.log(
    count +
      " verified checks passed (level selection + saves + all regressions).",
  );

  check(
    "bölümler 1–1000 ile sınırlı; son sayfada yalnızca 997–1000 ve Sonraki kapalı",
    () => {
      freshRun();
      game.changeState("ready");
      levels.open();
      levels.selectLevel(1000);
      assert.equal(
        (element("level-grid").innerHTML.match(/data-level=/g) || []).length,
        4,
      );
      assert.match(element("level-grid").innerHTML, /data-level="997"/);
      assert.match(element("level-grid").innerHTML, /data-level="1000"/);
      assert.doesNotMatch(element("level-grid").innerHTML, /data-level="1001"/);
      assert.equal(element("level-next").disabled, true);
      levels.changePage(1);
      assert.equal(levels.page, 83);
      assert.equal(levels.selectLevel(1001), false);
      assert.equal(levels.selected, 1000);
      game.startGame(1001);
      assert.equal(game.level, 1);
      levels.dialog.close();
    },
  );
  check(
    "1000. bölüm: final ekranı, ödül tek kez, tamamlanma kaydı ve 1001 oluşmaz",
    () => {
      clearSlots();
      save.setAuto(true);
      completeLevel(1000, 3);
      assert.equal(game.level, 1000);
      assert.equal(game.state, "victory");
      assert.equal(
        element("overlay-title").textContent,
        "1.000 Bölüm Tamamlandı!",
      );
      const completedScore = game.score,
        record = JSON.stringify(save.slots.auto);
      assert.equal(save.slots.auto.kind, "completion");
      assert.equal(save.slots.auto.data.level, 1000);
      assert.equal(save.validate(save.slots.auto), true);
      game.nextLevel();
      assert.equal(game.level, 1000);
      game.abilities.openLoadout("next");
      assert.equal(element("loadout-dialog").open, false);
      freshRun();
      assert.equal(save.resume("auto"), true);
      assert.equal(game.state, "victory");
      assert.equal(game.score, completedScore);
      assert.equal(JSON.stringify(save.slots.auto), record);
      game.player.eatPellet();
      assert.equal(game.score, completedScore);
      assert.equal(save.saveManual(), true);
      assert.equal(save.slots.manual.kind, "completion");
      game.i18n.setLanguage("en");
      assert.equal(
        element("overlay-title").textContent,
        "1,000 Levels Complete!",
      );
      game.mainAction();
      assert.equal(levels.dialog.open, true);
      levels.selectLevel(2);
      levels.confirmSelection();
      game.abilities.confirmLoadout();
      assert.equal(game.level, 2);
      assert.equal(game.state, "playing");
      assert.equal(game.score, 0);
      game.i18n.setLanguage("tr");
    },
  );
  console.log(
    count +
      " verified checks passed (1000-level cap + final completion + saves).",
  );

  const wallet = game.wallet,
    shop = game.shop,
    catalog = sandbox.SHOP_ITEMS;
  function freshShop() {
    shop.dialog.close();
    shop.resumeAfterClose = false;
    freshRun();
    wallet.profile = wallet.empty();
    wallet.storageUnavailable = false;
    stored.delete(wallet.key);
    shop.avatarCache.clear();
    shop.imageCache.clear();
    shop.previewId = "royal_cloak";
    shop.category = "outfit";
  }
  check(
    "dükkânda 20 kostüm + 20 başlık, dört tam set ve iki özgün özel model",
    () => {
      assert.equal(catalog.length, 40);
      assert.equal(new Set(catalog.map((item) => item.id)).size, 40);
      assert.equal(
        catalog.filter((item) => item.category === "outfit").length,
        20,
      );
      assert.equal(
        catalog.filter((item) => item.category === "head").length,
        20,
      );
      assert.equal(
        catalog
          .filter((item) => item.exclusive)
          .map((item) => item.id)
          .sort()
          .join(","),
        "cyber_armor,pumpkin,space_suit,viking_armor",
      );
      assert.equal(
        catalog
          .filter((item) => item.original)
          .map((item) => item.id)
          .sort()
          .join(","),
        "cyber_armor,pumpkin",
      );
      for (const item of catalog) {
        assert.ok(item.name.tr && item.name.en);
        assert.ok(Number.isSafeInteger(item.price) && item.price > 0);
      }
      assert.ok(
        Object.values(sandbox.SHOP_ATLAS_SOURCES).every(
          (source) =>
            source.endsWith(".png") && fs.existsSync(fileURLToPath(source)),
        ),
      );
    },
  );
  check(
    "yem + güç yemi + hayalet + can bonusu toplam puana ve bakiyeye eklenir",
    () => {
      freshShop();
      for (const points of [10, 50, 200, 500]) game.addScore(points);
      assert.equal(game.score, 760);
      assert.equal(wallet.profile.totalEarned, 760);
      assert.equal(wallet.profile.balance, 760);
      assert.equal(wallet.validate(wallet.profile), true);
      game.addScore(0);
      assert.equal(wallet.profile.totalEarned, 760);
      freshRun();
      game.addScore(10);
      assert.equal(game.score, 10);
      assert.equal(wallet.profile.totalEarned, 770);
    },
  );
  check(
    "satın alma yalnızca bakiyeyi harcar; skor, rekor ve toplam kazanılan korunur",
    () => {
      freshShop();
      game.addScore(5000);
      const high = game.highScore;
      assert.equal(shop.purchase("sports_singlet"), true);
      assert.equal(wallet.profile.balance, 2500);
      assert.equal(wallet.profile.totalEarned, 5000);
      assert.equal(game.score, 5000);
      assert.equal(game.highScore, high);
      assert.equal(wallet.profile.owned.join(","), "sports_singlet");
      assert.equal(wallet.profile.equipped.outfit, "sports_singlet");
      const after = JSON.stringify(wallet.profile);
      assert.equal(shop.purchase("sports_singlet"), false);
      assert.equal(JSON.stringify(wallet.profile), after);
    },
  );
  check("yetersiz bakiye veya geçersiz ürün harcama/ürün oluşturmaz", () => {
    freshShop();
    game.addScore(500);
    const after = JSON.stringify(wallet.profile);
    assert.equal(shop.purchase("crown"), false);
    assert.equal(shop.purchase("unknown"), false);
    assert.equal(shop.equip("royal_cloak"), false);
    assert.equal(shop.remove("unknown"), false);
    assert.equal(JSON.stringify(wallet.profile), after);
  });
  check(
    "kostüm ve başlık birlikte/ayrı takılır; çıkarmak sahipliği ve puanı korur",
    () => {
      freshShop();
      game.addScore(5000);
      shop.purchase("sports_singlet");
      shop.purchase("baseball_cap");
      assert.equal(wallet.profile.equipped.outfit, "sports_singlet");
      assert.equal(wallet.profile.equipped.head, "baseball_cap");
      const balance = wallet.profile.balance;
      shop.remove("outfit");
      assert.equal(wallet.profile.equipped.outfit, null);
      assert.equal(wallet.profile.equipped.head, "baseball_cap");
      shop.equip("sports_singlet");
      shop.remove("head");
      assert.equal(wallet.profile.equipped.outfit, "sports_singlet");
      assert.equal(wallet.profile.equipped.head, null);
      shop.equip("baseball_cap");
      shop.remove("all");
      assert.equal(wallet.profile.equipped.outfit, null);
      assert.equal(wallet.profile.equipped.head, null);
      assert.equal(wallet.profile.owned.length, 2);
      assert.equal(wallet.profile.balance, balance);
      assert.equal(wallet.validate(wallet.profile), true);
    },
  );
  check(
    "dört tam set başlığı çıkarır; başlık takmak tam seti çıkarır, ücret tekrar alınmaz",
    () => {
      freshShop();
      game.addScore(100000);
      shop.purchase("baseball_cap");
      for (const item of catalog.filter((item) => item.exclusive)) {
        shop.equip("baseball_cap");
        shop.purchase(item.id);
        assert.equal(wallet.profile.equipped.outfit, item.id);
        assert.equal(wallet.profile.equipped.head, null);
        const balance = wallet.profile.balance;
        shop.equip("baseball_cap");
        assert.equal(wallet.profile.equipped.outfit, null);
        assert.equal(wallet.profile.equipped.head, "baseball_cap");
        shop.equip(item.id);
        assert.equal(wallet.profile.equipped.outfit, item.id);
        assert.equal(wallet.profile.equipped.head, null);
        assert.equal(wallet.profile.balance, balance);
      }
    },
  );
  check(
    "yeni Game örneği toplamı, bakiyeyi, koleksiyonu ve giyilen parçaları okur",
    () => {
      freshShop();
      game.addScore(5000);
      shop.purchase("sports_singlet");
      shop.purchase("baseball_cap");
      const other = new game.constructor();
      other.wallet.load();
      assert.equal(
        JSON.stringify(other.wallet.profile),
        JSON.stringify(wallet.profile),
      );
      freshRun(8);
      assert.equal(wallet.profile.equipped.outfit, "sports_singlet");
      assert.equal(wallet.profile.totalEarned, 5000);
    },
  );
  check(
    "eski kayda dönüş harcanan parayı/ürünü geri almaz; tekrar oynanan puan iki kez eklenmez",
    () => {
      freshShop();
      game.addScore(5000);
      const saved = save.capture();
      save.write("manual", saved);
      shop.purchase("sports_singlet");
      game.addScore(100);
      assert.equal(wallet.profile.balance, 2600);
      save.resume("manual");
      assert.equal(game.score, 5000);
      assert.equal(wallet.profile.balance, 2600);
      assert.equal(wallet.profile.equipped.outfit, "sports_singlet");
      game.addScore(50);
      game.addScore(50);
      assert.equal(wallet.profile.balance, 2600);
      assert.equal(wallet.profile.totalEarned, 5100);
      game.addScore(10);
      assert.equal(wallet.profile.balance, 2610);
      assert.equal(wallet.profile.totalEarned, 5110);
      freshRun();
      game.addScore(10);
      assert.equal(wallet.profile.totalEarned, 5120);
    },
  );
  check(
    "runId içermeyen eski kayıt uyumludur; geçmiş skor toplam puana yeniden eklenmez",
    () => {
      freshShop();
      game.addScore(10);
      const old = save.capture();
      delete old.data.runId;
      old.data.score = 1000;
      save.write("manual", old);
      assert.equal(save.resume("manual"), true);
      assert.equal(wallet.profile.totalEarned, 10);
      game.addScore(10);
      assert.equal(wallet.profile.totalEarned, 20);
      assert.match(game.runId, /^legacy-/);
    },
  );
  check(
    "kapalı/dolu depolamada satın alma ve kuşanma geri alınır, kazanılan puan oyunda korunur",
    () => {
      freshShop();
      game.addScore(5000);
      shop.purchase("baseball_cap");
      const after = JSON.stringify(wallet.profile),
        previous = stored.get(wallet.key),
        original = sandbox.localStorage.setItem;
      sandbox.localStorage.setItem = () => {
        throw Error("QuotaExceededError");
      };
      assert.equal(shop.purchase("sports_singlet"), false);
      assert.equal(shop.remove("head"), false);
      assert.equal(JSON.stringify(wallet.profile), after);
      assert.equal(stored.get(wallet.key), previous);
      game.addScore(10);
      assert.equal(wallet.profile.totalEarned, 5010);
      assert.equal(game.score, 5010);
      sandbox.localStorage.setItem = original;
      assert.equal(shop.purchase("sports_singlet"), true);
      assert.equal(wallet.profile.balance, 1760);
    },
  );
  check("bozuk bakiye/ürün/tam set/veri sürümü açılışı bozmaz", () => {
    freshShop();
    game.addScore(5000);
    const valid = wallet.clone();
    for (const mutate of [
      (p) => (p.balance = -1),
      (p) => (p.totalEarned = 1),
      (p) => (p.version = 999),
      (p) => (p.owned = ["unknown"]),
      (p) => (p.owned = ["crown", "crown"]),
      (p) => (p.equipped.head = "crown"),
      (p) => (p.runs = { constructor: 100 }),
    ]) {
      const broken = JSON.parse(JSON.stringify(valid));
      mutate(broken);
      assert.equal(wallet.validate(broken), false);
    }
    stored.set(wallet.key, "{bad");
    wallet.load();
    assert.equal(wallet.profile.balance, 0);
    assert.equal(wallet.profile.owned.length, 0);
    stored.set(wallet.key, JSON.stringify(valid));
    wallet.load();
    assert.equal(wallet.profile.balance, 5000);
  });
  check(
    "dükkân oynarken/ara sahnede süreleri dondurur, kapanınca doğru duruma döner",
    () => {
      freshShop();
      game.addScore(1000);
      game.gameTime = 3;
      game.powerUntil = 13;
      shop.open();
      assert.equal(shop.dialog.open, true);
      assert.equal(game.state, "paused");
      game.update(10);
      assert.equal(game.gameTime, 3);
      assert.equal(game.powerUntil, 13);
      assert.equal(save.canSave(), false);
      shop.close();
      assert.equal(game.state, "playing");
      game.togglePause();
      shop.open();
      shop.close();
      assert.equal(game.state, "paused");
      game.cutscenes.beginCutscene(game.ghosts.entities[0]);
      shop.open();
      assert.equal(game.state, "paused");
      shop.close();
      assert.equal(game.state, "cutscene");
      game.cutscenes.finishCutscene();
    },
  );
  check(
    "başlık/giysi/koleksiyon listeleri ve fiyatlar iki dilde güncellenir",
    () => {
      freshShop();
      game.addScore(5000);
      shop.purchase("baseball_cap");
      shop.open();
      shop.chooseCategory("head");
      assert.equal(shop.visibleItems().length, 20);
      shop.chooseCategory("owned");
      assert.equal(shop.visibleItems().length, 1);
      game.i18n.setLanguage("en");
      assert.match(element("shop-items").innerHTML, /Baseball Cap/);
      assert.equal(element("shop-equipped-head").textContent, "Baseball Cap");
      assert.match(
        element("shop-feedback").textContent,
        /Bought and equipped Baseball Cap/,
      );
      game.i18n.setLanguage("tr");
      assert.equal(
        element("shop-equipped-head").textContent,
        "Beyzbol Şapkası",
      );
      shop.close();
      shop.chooseCategory("outfit");
      assert.equal(shop.visibleItems().length, 20);
    },
  );
  check(
    "kozmetik model dört yönde çizilir; yetenek görünümleri önceliğini korur",
    () => {
      freshShop();
      game.addScore(10000);
      shop.purchase("sports_singlet");
      shop.purchase("baseball_cap");
      for (const dir of ["left", "right", "up", "down"]) {
        game.player.entity.dir = dir;
        game.renderer.drawPlayer();
      }
      assert.ok(shop.playerSprite("normal"));
      assert.equal(shop.playerSprite("power"), null);
      assert.equal(shop.playerSprite("shield"), null);
      game.ui.updateHUD();
      assert.match(
        element("player-model").textContent,
        /Spor Forması.*Beyzbol Şapkası/,
      );
      game.powerUntil = 10;
      game.ui.updateHUD();
      assert.equal(
        element("player-model").textContent,
        game.i18n.modelName("power"),
      );
    },
  );
  check(
    "puan geçmişi büyümesi sınırlı, iki kayıt yuvasının runId verisi korunur",
    () => {
      freshShop();
      game.addScore(10);
      const old = save.capture();
      save.write("manual", old);
      for (let i = 0; i < 150; i++) {
        freshRun();
        game.addScore(10);
      }
      assert.ok(Object.keys(wallet.profile.runs).length <= 128);
      assert.equal(wallet.profile.runs[old.data.runId], 10);
      assert.equal(wallet.validate(wallet.profile), true);
      const bad = save.capture();
      bad.data.runId = "invalid";
      assert.equal(save.validate(bad), false);
    },
  );
  console.log(
    count +
      " verified checks passed (wallet + 40-item shop + wardrobe + all regressions).",
  );
  check("eski biçimdeki kayıt kimliği de uzun puan geçmişinde korunur", () => {
    freshShop();
    game.addScore(10);
    const old = save.capture();
    delete old.data.runId;
    save.write("manual", old);
    save.resume("manual");
    game.addScore(100);
    const earned = wallet.profile.totalEarned;
    for (let i = 0; i < 150; i++) {
      freshRun();
      game.addScore(10);
    }
    assert.equal(wallet.profile.runs["legacy-" + old.savedAt], 110);
    save.resume("manual");
    game.addScore(100);
    assert.equal(wallet.profile.totalEarned, earned + 1500);
  });
  console.log(
    count + " verified checks passed (shop and legacy-save reward protection).",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
