import assert from "node:assert/strict";
import { sandbox, element, stored } from "./helpers/game-harness.mjs";
import {
  CHALLENGE_RULES,
  generateChallenge,
  applyChallengeRule,
  CHALLENGE_HIGH_KEY,
} from "../src/data/challenges.js";
import { COLS, ROWS, LIFE_PELLET } from "../src/data/config.js";
import { loadoutDialog } from "../src/core/dom.js";
const game = sandbox.game;
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS " + name);
}
const definitions = Object.fromEntries(
  CHALLENGE_RULES.map((rule) => [
    rule,
    Array.from({ length: 100 }, (_, seed) => generateChallenge(seed)).find(
      (c) => c.rule === rule,
    ),
  ]),
);
function start(rule) {
  game.challenges.start(definitions[rule]);
  game.ghosts.entities = [];
}
function reachable(grid, blockedPower = false) {
  const seen = new Set(["10,17"]),
    queue = [[10, 17]];
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
        nx >= 0 &&
        nx < COLS &&
        ny >= 0 &&
        ny < ROWS &&
        grid[ny][nx] !== 1 &&
        (!blockedPower || grid[ny][nx] !== 3) &&
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
  "aynı tohum aynı harita ve kuralı üretir; farklı tohumlar çeşitlidir",
  () => {
    const signatures = new Set(),
      rules = new Set();
    for (const difficulty of ["easy", "normal", "hard"])
      for (let seed = 0; seed < 150; seed++) {
        const c = generateChallenge(seed, difficulty);
        assert.deepEqual(c, generateChallenge(seed, difficulty));
        rules.add(c.rule);
        const grid = applyChallengeRule(
          game.maze.createLevelMap(c.level, {
            seed: c.seed,
            styleLevel: c.styleLevel,
          }),
          c.rule,
        );
        assert.deepEqual(
          grid,
          applyChallengeRule(
            game.maze.createLevelMap(c.level, {
              seed: c.seed,
              styleLevel: c.styleLevel,
            }),
            c.rule,
          ),
        );
        signatures.add(JSON.stringify(grid));
        const seen = reachable(grid);
        const avoiding = reachable(grid, true);
        assert.equal(grid.length, ROWS);
        assert.ok(grid.every((row) => row.length === COLS));
        assert.ok(
          grid[0].every((v) => v === 1) && grid.at(-1).every((v) => v === 1),
        );
        assert.ok(grid.every((row) => row[0] === 1 && row.at(-1) === 1));
        assert.ok(seen.has(LIFE_PELLET.col + "," + LIFE_PELLET.row));
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if (grid[y][x] !== 1) {
              assert.ok(seen.has(x + "," + y), `unreachable ${seed} ${x},${y}`);
              if (c.rule === "powerLast" && grid[y][x] === 2)
                assert.ok(
                  avoiding.has(x + "," + y),
                  `power pellet blocks ${seed} ${x},${y}`,
                );
            }
        const power = grid.flat().filter((v) => v === 3).length;
        assert.equal(power, c.rule === "noPower" ? 0 : 5);
        assert.ok(game.ghosts.levelGhosts(c.level).length <= 4);
      }
    assert.ok(signatures.size > 140);
    assert.equal(rules.size, CHALLENGE_RULES.length);
  },
);
check("yeteneksiz koşu Q/E ve doğrudan yetenek yollarını kapatır", () => {
  start("noSkills");
  game.abilities.useAbility("q");
  game.abilities.useAbility("e");
  game.abilities.useBoost();
  game.abilities.useShield();
  game.abilities.useJump();
  game.abilities.useMagnet();
  game.abilities.attemptJump();
  assert.equal(game.abilities.jump, null);
  assert.equal(game.abilities.pendingJumpUntil, 0);
  assert.equal(game.abilities.boostUntil, 0);
  assert.equal(game.abilities.shieldUntil, 0);
  assert.equal(game.abilities.magnetUntil, 0);
  assert.equal(element("q-button").disabled, true);
  assert.equal(element("e-button").disabled, true);
  const row = game.maze.grid.findIndex((r) => r.includes(3));
  game.maze.collectPellet(game.maze.grid[row].indexOf(3), row);
  assert.ok(game.powerUntil > 0);
});
check("erken güç yemi denemeyi bitirir, yem ve skor verilmez", () => {
  start("powerLast");
  const pellets = game.maze.pellets;
  const row = game.maze.grid.findIndex((r) => r.includes(3)),
    col = game.maze.grid[row].indexOf(3);
  game.maze.collectPellet(col, row);
  assert.equal(game.state, "gameover");
  assert.equal(game.challenges.result.reason, "earlyPower");
  assert.equal(game.score, 0);
  assert.equal(game.maze.grid[row][col], 3);
  assert.equal(game.maze.pellets, pellets);
});
check("tüm küçük yemlerden sonra beş güç yemi toplanabilir", () => {
  start("powerLast");
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (game.maze.grid[y][x] === 2) game.maze.collectPellet(x, y, true);
  const powers = [];
  game.maze.grid.forEach((r, y) =>
    r.forEach((v, x) => {
      if (v === 3) powers.push([x, y]);
    }),
  );
  for (const [x, y] of powers) game.maze.collectPellet(x, y);
  assert.equal(game.state, "playing");
  assert.equal(game.maze.phase, "bonus");
  assert.equal(game.maze.pellets, 0);
});
check("güç yemsiz harita güç modunu başlatmaz ve yetenekleri korur", () => {
  start("noPower");
  assert.ok(!game.maze.grid.flat().includes(3));
  game.maze.collectPellet(1, 1);
  assert.equal(game.powerUntil, 0);
  assert.equal(game.score, 10);
  game.abilities.useBoost();
  assert.ok(game.abilities.boostUntil > 0);
});
check("tek can kuralı ilk ölümde sona erer", () => {
  start("oneLife");
  assert.equal(game.lives, 1);
  game.gameTime = 3;
  game.invulnerableUntil = 0;
  game.ghosts.entities = [
    {
      ...game.ghosts.levelGhosts(game.level)[0],
      ...game.movement.actor(10, 17, "left"),
      releaseAt: 0,
      immuneUntil: 0,
    },
  ];
  game.checkCollisions();
  assert.equal(game.state, "gameover");
  assert.equal(game.challenges.result.reason, "lives");
});
check(
  "süre duraklatma, giriş ve ara sahnede donar; bonus turunda işler",
  () => {
    start("timeTrial");
    game.changeState("paused");
    game.update(10);
    assert.equal(game.gameTime, 0);
    game.settings.values.transitions = true;
    game.arcade.beginTransition();
    game.update(0.1);
    assert.equal(game.gameTime, 0);
    game.arcade.finishTransition();
    game.settings.values.transitions = false;
    game.cutscenes.beginCutscene(game.ghosts.levelGhosts(game.level)[0]);
    game.update(0.1);
    assert.equal(game.gameTime, 0);
    game.cutscenes.finishCutscene();
    game.maze.beginRoundBonus();
    game.gameTime = game.challenges.current.timeLimit - 0.01;
    game.update(0.02);
    assert.equal(game.state, "gameover");
    assert.equal(game.challenges.result.reason, "timeout");
  },
);
check("challenge başarı bonusu bir kez ödenir; sonraki bölüme geçilmez", () => {
  start("noPower");
  game.maze.beginRoundBonus();
  Object.assign(game.player.entity, {
    col: LIFE_PELLET.col,
    row: LIFE_PELLET.row,
    progress: 0,
  });
  game.maze.collectLifePellet();
  assert.equal(game.state, "victory");
  assert.equal(game.score, 500 + game.challenges.current.reward);
  const score = game.score;
  game.changeState("victory");
  game.maze.collectLifePellet();
  assert.equal(game.score, score);
  const level = game.level;
  game.nextLevel();
  assert.equal(game.level, level);
});
check(
  "bölüm kayıtları ve rekoru korunur; cüzdan challenge puanlarını alır",
  () => {
    game.challenges.menu();
    game.startGame(7);
    game.addScore(7777);
    game.saves.saveManual();
    game.saves.setAuto(true);
    const manual = stored.get(game.saves.key("manual")),
      high = stored.get("maze-chaser-high-score"),
      selected = game.levels.selected,
      balance = game.wallet.profile.balance;
    start("noPower");
    game.addScore(8000);
    assert.equal(game.saves.canSave(), false);
    assert.equal(game.saves.saveManual(), false);
    game.saves.checkpoint();
    assert.equal(stored.get(game.saves.key("manual")), manual);
    assert.equal(stored.get("maze-chaser-high-score"), high);
    assert.equal(Number(stored.get(CHALLENGE_HIGH_KEY)), game.highScore);
    assert.equal(game.wallet.profile.balance, balance + 8000);
    assert.equal(game.levels.selected, selected);
    assert.ok(game.saves.resume("manual"));
    assert.equal(game.mode, "campaign");
    assert.equal(game.level, 7);
    assert.equal(game.highScore, 7777);
    assert.equal(game.score, 7777);
    assert.equal(game.wallet.profile.balance, balance + 8000);
  },
);
check("yeniden deneme aynı haritayla başlar; iptal geri döner", () => {
  start("noPower");
  const first = game.maze.grid.map((row) => row.slice());
  game.challenges.fail("lives");
  game.challengeMenu.retry();
  assert.equal(loadoutDialog.open, true);
  game.abilities.cancelLoadout();
  assert.equal(game.challengeMenu.dialog.open, true);
  game.challengeMenu.confirm();
  game.abilities.confirmLoadout();
  assert.equal(game.state, "playing");
  assert.deepEqual(game.maze.grid, first);
  assert.equal(game.score, 0);
  assert.equal(game.challenges.result, null);
  game.challenges.menu();
  assert.equal(game.state, "ready");
  assert.equal(game.mode, "campaign");
  assert.equal(game.saves.canSave(), false);
});
check("kısa güç dört saniyedir; bölüm modunda on saniye korunur", () => {
  start("shortPower");
  const row = game.maze.grid.findIndex((r) => r.includes(3));
  game.maze.collectPellet(game.maze.grid[row].indexOf(3), row);
  assert.equal(game.powerUntil - game.gameTime, 4);
  game.arcade.ghostCaught();
  game.ui.updateHUD();
  assert.equal(element("power-bar").style.width, "100%");
  assert.equal(element("combo-meter").style.width, "100%");
  game.gameTime = 4.01;
  assert.equal(
    game.ghosts.ghostFrightened({
      ...game.ghosts.levelGhosts(game.level)[0],
      releaseAt: 0,
      immuneUntil: 0,
    }),
    false,
  );
  game.startGame(1);
  game.ghosts.entities = [];
  game.maze.collectPellet(1, 1);
  assert.equal(game.powerUntil - game.gameTime, 10);
});
check(
  "hızlı hayaletler normalde yüzde 20 hızlanır, korku hızları korunur",
  () => {
    start("fastGhosts");
    game.gameTime = 3;
    const ghost = {
      ...game.ghosts.levelGhosts(game.level)[0],
      releaseAt: 0,
      immuneUntil: 0,
      skillEpoch: 0,
    };
    const fast = game.ghosts.ghostSpeed(ghost);
    game.powerUntil = 20;
    const frightened = game.ghosts.ghostSpeed(ghost);
    game.challenges.leave();
    game.powerUntil = 0;
    const normal = game.ghosts.ghostSpeed(ghost);
    game.powerUntil = 20;
    assert.ok(Math.abs(fast - normal * 1.2) < 1e-9);
    assert.equal(game.ghosts.ghostSpeed(ghost), frightened);
  },
);
check(
  "yetenek bütçesi başarılı aktivasyonları sayar; tampon ve geçersiz denemeler sayılmaz",
  () => {
    start("limitedSkills");
    const limit = game.challenges.current.abilityLimit;
    Object.assign(game.player.entity, {
      col: 10,
      row: 17,
      progress: 0,
      dir: "left",
      next: "left",
    });
    game.maze.grid[17][9] = 0;
    game.abilities.useJump();
    assert.equal(game.challenges.skillsUsed, 0);
    game.player.entity.progress = 6;
    game.abilities.useJump();
    assert.ok(game.abilities.pendingJumpUntil > 0);
    assert.equal(game.challenges.skillsUsed, 0);
    game.player.entity.progress = 0;
    game.maze.grid[17][9] = 1;
    game.maze.grid[17][8] = 0;
    assert.ok(game.abilities.attemptJump());
    assert.equal(game.challenges.skillsUsed, 1);
    game.abilities.useJump();
    assert.equal(game.challenges.skillsUsed, 1);
    game.abilities.jump = null;
    game.abilities.useBoost();
    assert.equal(game.challenges.skillsUsed, 2);
    game.abilities.useBoost();
    assert.equal(game.challenges.skillsUsed, 2);
    for (let i = 2; i < limit; i++) {
      game.abilities.boostReadyAt = 0;
      game.abilities.useBoost();
    }
    assert.equal(game.challenges.skillsUsed, limit);
    game.abilities.boostReadyAt = 0;
    const until = game.abilities.boostUntil;
    game.abilities.useBoost();
    game.abilities.useMagnet();
    game.abilities.useShield();
    game.abilities.useJump();
    assert.equal(game.challenges.skillsUsed, limit);
    assert.equal(game.abilities.boostUntil, until);
    assert.equal(game.abilities.magnetUntil, 0);
    assert.equal(game.abilities.shieldUntil, 0);
    game.ui.updateHUD();
    assert.equal(element("q-button").disabled, true);
    assert.equal(element("e-button").disabled, true);
    assert.match(
      element("challenge-hud-progress").textContent,
      /0 yetenek hakkı/,
    );
    game.challenges.start(definitions.limitedSkills);
    assert.equal(game.challenges.skillsUsed, 0);
    for (const [difficulty, uses] of [
      ["easy", 8],
      ["normal", 6],
      ["hard", 4],
    ])
      assert.equal(
        generateChallenge(definitions.limitedSkills.seed, difficulty)
          .abilityLimit,
        uses,
      );
  },
);
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
function clearPellets() {
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if ([2, 3].includes(game.maze.grid[y][x])) game.maze.collectPellet(x, y);
}
check("hayalet avı hedefi eksikse son yem başarısızlık getirir", () => {
  start("ghostHunt");
  clearPellets();
  assert.equal(game.state, "gameover");
  assert.equal(game.challenges.result.reason, "huntIncomplete");
  assert.equal(game.maze.phase, "maze");
  assert.notEqual(game.maze.grid[LIFE_PELLET.row][LIFE_PELLET.col], 4);
  assert.match(
    element("overlay-description").textContent,
    new RegExp("0/" + game.challenges.current.ghostTarget),
  );
});
check(
  "gerçek hayalet çarpışmaları av hedefini ilerletir ve tamamlamaya izin verir",
  () => {
    start("ghostHunt");
    game.gameTime = 3;
    game.powerUntil = 30;
    const target = game.challenges.current.ghostTarget;
    for (let i = 0; i < target; i++) {
      game.ghosts.entities = [collidingGhost()];
      game.checkCollisions();
      assert.equal(game.challenges.ghostsCaught, i + 1);
      assert.equal(game.state, "cutscene");
      game.cutscenes.finishCutscene();
    }
    assert.equal(game.score, target * 200);
    assert.match(
      game.challenges.progressText(),
      new RegExp(target + "/" + target),
    );
    game.ghosts.entities = [];
    clearPellets();
    assert.equal(game.maze.phase, "bonus");
    Object.assign(game.player.entity, {
      col: LIFE_PELLET.col,
      row: LIFE_PELLET.row,
      progress: 0,
    });
    game.maze.collectLifePellet();
    assert.equal(game.state, "victory");
    assert.equal(game.challenges.result.won, true);
    game.challenges.start(definitions.ghostHunt);
    assert.equal(game.challenges.ghostsCaught, 0);
  },
);
check(
  "barışçıl koşu korkmuş hayalet temasında puan ve sahne vermeden biter",
  () => {
    start("pacifist");
    game.gameTime = 3;
    game.powerUntil = 20;
    game.ghosts.entities = [collidingGhost()];
    game.checkCollisions();
    assert.equal(game.state, "gameover");
    assert.equal(game.challenges.result.reason, "pacifist");
    assert.equal(game.score, 0);
    assert.equal(game.cutscenes.current, null);
    assert.equal(game.challenges.ghostsCaught, 0);
    start("pacifist");
    game.gameTime = 3;
    game.powerUntil = 0;
    game.invulnerableUntil = 0;
    game.ghosts.entities = [collidingGhost()];
    game.checkCollisions();
    assert.equal(game.lives, 2);
    assert.equal(game.state, "dying");
    assert.equal(game.challenges.result, null);
    game.challenges.menu();
  },
);
check("challenge metinleri iki dilde ve ana menü seçiminde çalışır", () => {
  for (const key of Object.keys(sandbox.test.TRANSLATIONS.tr).filter((k) =>
    k.startsWith("challenge."),
  ))
    assert.ok(sandbox.test.TRANSLATIONS.en[key], key);
  game.challengeMenu.chooseMode("challenge");
  assert.equal(
    element("main-action").firstElementChild.textContent,
    "Challenge üret",
  );
  game.mainAction();
  assert.equal(game.challengeMenu.dialog.open, true);
  game.challengeMenu.dialog.close();
  game.challengeMenu.chooseMode("campaign");
  game.mainAction();
  assert.equal(game.levels.dialog.open, true);
  game.levels.dialog.close();
});
console.log(`${checks} challenge checks passed (450 generated maps).`);
