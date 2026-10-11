import assert from "node:assert/strict";
import { sandbox, element, stored, events } from "./helpers/game-harness.mjs";
import {
  MISSIONS,
  MISSION_BY_ID,
  MISSION_CATEGORIES,
  MISSION_COUNTERS,
} from "../src/data/missions.js";
import { MissionProgress } from "../src/storage/MissionProgress.js";
import { generateChallenge, CHALLENGE_RULES } from "../src/data/challenges.js";
import { LIFE_PELLET, ROWS, COLS } from "../src/data/config.js";
const game = sandbox.game;
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS " + name);
}
function finishLevel() {
  game.maze.beginRoundBonus();
  Object.assign(game.player.entity, {
    col: LIFE_PELLET.col,
    row: LIFE_PELLET.row,
    progress: 0,
  });
  game.maze.collectLifePellet();
}
function collidingGhost() {
  return {
    ...game.ghosts.levelGhosts(game.level)[0],
    ...game.movement.actor(
      game.player.entity.col,
      game.player.entity.row,
      "left",
    ),
    releaseAt: 0,
    immuneUntil: 0,
  };
}
function startChallenge(rule) {
  game.missionMenu.close();
  game.challengeMenu.dialog.close();
  const c = Array.from({ length: 100 }, (_, s) => generateChallenge(s)).find(
    (c) => c.rule === rule,
  );
  game.challenges.start(c);
  game.ghosts.entities = [];
  return c;
}
check(
  "100 sabit görev, benzersiz kimlikler, altı kategori ve bütün challenge kuralları",
  () => {
    assert.equal(MISSIONS.length, 100);
    assert.equal(MISSION_BY_ID.size, 100);
    assert.deepEqual(
      MISSIONS.map((m) => m.number),
      Array.from({ length: 100 }, (_, i) => i + 1),
    );
    assert.equal(new Set(MISSIONS.slice(0, 10).map((m) => m.kind)).size, 10);
    for (const m of MISSIONS) {
      assert.ok(Number.isSafeInteger(m.target) && m.target > 0);
      assert.ok(Number.isSafeInteger(m.reward) && m.reward > 0);
      assert.ok(MISSION_CATEGORIES.includes(m.category));
    }
    assert.deepEqual(
      MISSIONS.filter((m) => m.rule).map((m) => m.rule),
      CHALLENGE_RULES,
    );
    assert.equal(MISSIONS.filter((m) => m.ability).length, 10);
  },
);
check(
  "gerçek küçük/güç/mıknatıs yemleri ve hayaletler doğru sayaçları artırır",
  () => {
    game.startGame(1);
    game.ghosts.entities = [];
    game.maze.collectPellet(2, 1);
    game.maze.collectPellet(1, 1);
    game.maze.collectPellet(3, 1, true);
    assert.equal(game.missions.profile.stats.smallPellets, 2);
    assert.equal(game.missions.profile.stats.powerPellets, 1);
    assert.equal(game.missions.profile.stats.magnetPellets, 1);
    game.gameTime = 3;
    game.powerUntil = 30;
    game.ghosts.entities = [collidingGhost()];
    game.checkCollisions();
    assert.equal(game.missions.profile.stats.ghosts, 1);
    game.cutscenes.finishCutscene();
    const before = game.missions.profile.stats.ghosts;
    startChallenge("pacifist");
    game.gameTime = 3;
    game.powerUntil = 30;
    game.ghosts.entities = [collidingGhost()];
    game.checkCollisions();
    assert.equal(game.missions.profile.stats.ghosts, before);
  },
);
check(
  "yalnızca başarılı yetenekler sayılır; tampon ve bekleme basışları sayılmaz",
  () => {
    game.startGame(1);
    game.ghosts.entities = [];
    const before = { ...game.missions.profile.stats };
    game.abilities.useBoost();
    game.abilities.useBoost();
    assert.equal(
      game.missions.profile.stats["skill-boost"],
      before["skill-boost"] + 1,
    );
    game.abilities.useShield();
    game.abilities.useShield();
    assert.equal(
      game.missions.profile.stats["skill-shield"],
      before["skill-shield"] + 1,
    );
    game.abilities.useMagnet();
    game.abilities.useMagnet();
    assert.equal(
      game.missions.profile.stats["skill-magnet"],
      before["skill-magnet"] + 1,
    );
    game.player.entity.progress = 5;
    game.abilities.useJump();
    assert.equal(
      game.missions.profile.stats["skill-jump"],
      before["skill-jump"],
    );
    game.player.entity.progress = 0;
    game.maze.grid[17][9] = 1;
    game.maze.grid[17][8] = 0;
    game.player.entity.next = "left";
    game.abilities.attemptJump();
    assert.equal(
      game.missions.profile.stats["skill-jump"],
      before["skill-jump"] + 1,
    );
    const after = { ...game.missions.profile.stats };
    startChallenge("noSkills");
    game.abilities.useAbility("q");
    game.abilities.useAbility("e");
    assert.equal(
      game.missions.profile.stats["skill-jump"],
      after["skill-jump"],
    );
    assert.equal(
      game.missions.profile.stats["skill-magnet"],
      after["skill-magnet"],
    );
  },
);
check(
  "bölüm ve başarılı challenge ayrı hedeflere işlenir; başarısız deneme sayılmaz",
  () => {
    game.startGame(5);
    game.ghosts.entities = [];
    const before = { ...game.missions.profile.stats };
    finishLevel();
    assert.equal(game.missions.profile.stats.levels, before.levels + 1);
    game.changeState("victory");
    assert.equal(game.missions.profile.stats.levels, before.levels + 1);
    startChallenge("noPower");
    game.challenges.fail("lives");
    assert.equal(game.missions.profile.stats.challenges, before.challenges);
    startChallenge("noPower");
    finishLevel();
    assert.equal(game.missions.profile.stats.challenges, before.challenges + 1);
    assert.equal(
      game.missions.profile.stats["rule-noPower"],
      before["rule-noPower"] + 1,
    );
    assert.equal(game.missions.profile.stats.levels, before.levels + 1);
    game.changeState("victory");
    assert.equal(game.missions.profile.stats.challenges, before.challenges + 1);
  },
);
check(
  "eski kaydı yeniden yüklemek kaydedilmiş sayaçları iki kez kredilendirmez",
  () => {
    game.startGame(1);
    game.maze.collectPellet(2, 1);
    assert.ok(game.saves.saveManual());
    const before = game.missions.profile.stats.smallPellets;
    game.maze.collectPellet(3, 1);
    game.maze.collectPellet(4, 1);
    const grown = game.missions.profile.stats.smallPellets;
    assert.equal(grown, before + 2);
    assert.ok(game.saves.resume("manual"));
    game.maze.collectPellet(3, 1);
    game.maze.collectPellet(4, 1);
    assert.equal(game.missions.profile.stats.smallPellets, grown);
    game.maze.collectPellet(5, 1);
    assert.equal(game.missions.profile.stats.smallPellets, grown + 1);
    const valid = game.saves.capture();
    assert.ok(game.saves.validate(valid));
    valid.data.missionCursor.smallPellets = -1;
    assert.equal(game.saves.validate(valid), false);
  },
);
check(
  "sayaçsız eski kayıt uyumludur; eski skor aşılınca yeni olaylar sayılır",
  () => {
    game.startGame(1);
    game.maze.collectPellet(2, 1);
    const legacy = game.saves.capture();
    delete legacy.data.missionCursor;
    game.addScore(100);
    game.saves.slots.manual = legacy;
    assert.ok(game.saves.validate(legacy));
    assert.ok(game.saves.resume("manual"));
    const before = game.missions.profile.stats.smallPellets;
    game.maze.collectPellet(3, 1);
    assert.equal(game.missions.profile.stats.smallPellets, before);
    game.addScore(100);
    game.maze.collectPellet(4, 1);
    assert.equal(game.missions.profile.stats.smallPellets, before + 1);
  },
);
check(
  "ödül cüzdana bir kez eklenir; skor/rekor ve kazanılan puan hedefi değişmez",
  () => {
    game.startGame(1);
    game.addScore(3000);
    game.missionMenu.open();
    const m = MISSION_BY_ID.get("earned-1");
    assert.ok(game.missions.complete(m));
    const score = game.score,
      high = game.highScore,
      earned = game.missions.earnedPoints(),
      balance = game.wallet.profile.balance,
      total = game.wallet.profile.totalEarned;
    assert.ok(game.missions.claim(m.id));
    assert.equal(game.wallet.profile.balance, balance + m.reward);
    assert.equal(game.wallet.profile.totalEarned, total + m.reward);
    assert.equal(game.missions.earnedPoints(), earned);
    assert.equal(game.score, score);
    assert.equal(game.highScore, high);
    assert.equal(game.missions.claim(m.id), false);
    assert.equal(game.wallet.claimMission(m.id), false);
    assert.equal(game.wallet.profile.balance, balance + m.reward);
    assert.ok(game.wallet.validate(game.wallet.profile));
    assert.equal(game.missions.claim("missing"), false);
    const newTracker = new MissionProgress(game);
    newTracker.load();
    assert.ok(newTracker.claimed(m));
    assert.equal(
      newTracker.profile.stats.smallPellets,
      game.missions.profile.stats.smallPellets,
    );
    game.missionMenu.close();
  },
);
check(
  "kayıt yazılamadığında ödül verilmez ve bozuk görev/ödül verisi reddedilir",
  () => {
    const m = MISSION_BY_ID.get("earned-2");
    assert.ok(game.missions.complete(m));
    const balance = game.wallet.profile.balance;
    const setter = localStorage.setItem;
    localStorage.setItem = () => {
      throw Error("quota");
    };
    try {
      assert.equal(game.missions.claim(m.id), false);
      assert.equal(game.wallet.profile.balance, balance);
      assert.equal(game.missions.claimed(m), false);
    } finally {
      localStorage.setItem = setter;
      game.wallet.storageUnavailable = false;
    }
    const corrupt = JSON.parse(JSON.stringify(game.missions.profile));
    corrupt.stats.ghosts = -1;
    assert.equal(game.missions.valid(corrupt), false);
    const wallet = game.wallet.clone();
    wallet.missionRewards = ["missing"];
    assert.equal(game.wallet.validate(wallet), false);
    wallet.missionRewards = [m.id, m.id];
    assert.equal(game.wallet.validate(wallet), false);
    const copy = new MissionProgress(game);
    stored.set(copy.key, "bad json");
    copy.load();
    assert.equal(copy.profile.stats.ghosts, 0);
    game.missions.persist();
  },
);
check(
  "katalogdaki 100 ödülün tamamı alınabilir, yeniden alınamaz ve zincir hedef üretmez",
  () => {
    const metrics = game.missions.profile.stats;
    for (const m of MISSIONS)
      if (m.metric !== "earned")
        metrics[m.metric] = Math.max(metrics[m.metric], m.target);
    game.missions.persist();
    game.addScore(250000);
    game.missions.persist();
    game.missionMenu.open();
    const ready = MISSIONS.filter((m) => game.missions.status(m) === "ready"),
      amount = ready.reduce((n, m) => n + m.reward, 0),
      balance = game.wallet.profile.balance;
    game.missionMenu.claimAll();
    assert.equal(game.wallet.profile.balance, balance + amount);
    assert.equal(game.missions.summary().claimed, 100);
    assert.equal(game.missions.summary().ready, 0);
    assert.equal(game.missions.summary().complete, 100);
    game.missionMenu.claimAll();
    assert.equal(game.wallet.profile.balance, balance + amount);
    game.missionMenu.close();
  },
);
check(
  "sayfalama, kategori/durum filtreleri ve iki dil 100 görevi gösterir",
  () => {
    const menu = game.missionMenu;
    menu.open();
    menu.setCategory("all");
    menu.setFilter("all");
    const ids = [];
    for (let i = 0; i < 10; i++) {
      ids.push(
        ...menu
          .visible()
          .slice(menu.page * 10, menu.page * 10 + 10)
          .map((m) => m.id),
      );
      menu.changePage(1);
    }
    assert.equal(new Set(ids).size, 100);
    assert.equal(menu.page, 9);
    menu.changePage(1);
    assert.equal(menu.page, 9);
    menu.setCategory("ghosts");
    assert.equal(menu.visible().length, 10);
    menu.setFilter("ready");
    assert.equal(menu.visible().length, 0);
    assert.equal(menu.page, 0);
    menu.changePage(1);
    assert.equal(menu.page, 0);
    menu.setFilter("claimed");
    assert.equal(menu.visible().length, 10);
    for (const lang of ["tr", "en"]) {
      game.i18n.setLanguage(lang);
      for (const m of MISSIONS) {
        const text = menu.text(m);
        assert.ok(text.name && text.description);
        assert.doesNotMatch(text.description, /missions\.|\{\w+\}/);
      }
    }
    game.i18n.setLanguage("tr");
    menu.close();
  },
);
check("görev ekranı oyun, süre, yetenek girişi ve kayıtları duraklatır", () => {
  game.startGame(1);
  game.ghosts.entities = [];
  const time = game.gameTime;
  game.missionMenu.open();
  assert.equal(game.state, "paused");
  assert.equal(game.saves.canSave(), false);
  events.window.keydown({ key: "q", code: "KeyQ", target: { id: "game" } });
  assert.equal(game.abilities.pendingJumpUntil, 0);
  game.update(10);
  assert.equal(game.gameTime, time);
  game.settings.open();
  assert.equal(game.settings.dialog.open, false);
  game.shop.open();
  assert.equal(game.shop.dialog.open, false);
  game.missionMenu.close();
  assert.equal(game.state, "playing");
  assert.equal(game.saves.canSave(), true);
  game.togglePause();
  game.missionMenu.open();
  game.missionMenu.close();
  assert.equal(game.state, "paused");
});
check("koşu geçmişi sınırlı; mevcut ve kayıtlardaki koşular korunur", () => {
  game.missions.refresh();
  const protectedRun = game.saves.slots.manual.data.runId;
  game.missions.profile.runs[protectedRun] = game.missions.emptyCounters();
  for (let i = 0; i < 140; i++)
    game.missions.profile.runs["run-prunetest-" + i] =
      game.missions.emptyCounters();
  game.missions.profile.runs[game.runId] = game.missions.emptyCounters();
  game.missions.persist();
  assert.ok(Object.keys(game.missions.profile.runs).length <= 128);
  assert.ok(game.missions.profile.runs[protectedRun]);
  assert.ok(game.missions.profile.runs[game.runId]);
  assert.ok(game.missions.valid(game.missions.profile));
});
console.log(`${checks} mission checks passed (100 missions and rewards).`);
