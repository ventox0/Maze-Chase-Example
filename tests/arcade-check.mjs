import assert from "node:assert/strict";
import { sandbox, stored, element, motion } from "./helpers/game-harness.mjs";
import { Game } from "../src/core/Game.js";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../src/ui/SettingsMenu.js";
import { SOUND_CUES } from "../src/data/audio.js";
import { TRANSLATIONS } from "../src/i18n/messages.js";
import { PlayerAnimation } from "../src/rendering/PlayerAnimation.js";
import { CUTSCENE_DURATION, IMPACT_PHASE } from "../src/rendering/animation.js";
const game = sandbox.game;
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS " + name);
}
function reset() {
  motion.matches = false;
  game.settings.values = { ...DEFAULT_SETTINGS };
  game.settings.apply();
  game.settings.dialog.close();
  game.shop.dialog.close();
  game.levels.dialog.close();
  game.startGame();
  game.arcade.finishTransition();
}
check("eski ve bozuk tercihler güvenli varsayılanlarla yüklenir", () => {
  stored.set(SETTINGS_KEY, "{bad");
  game.settings.load();
  assert.deepEqual(game.settings.values, DEFAULT_SETTINGS);
  assert.deepEqual(
    game.settings.normalize({
      sound: "yes",
      volume: Infinity,
      shake: false,
      secret: true,
    }),
    { ...DEFAULT_SETTINGS, shake: false },
  );
  assert.equal(game.settings.normalize({ volume: 4 }).volume, 1);
});
check("tercihler yeniden açılışta kalıcı ve oyun kaydından bağımsızdır", () => {
  game.settings.update("volume", 0.35);
  game.settings.update("shake", false);
  const rebooted = new Game();
  rebooted.start();
  assert.equal(rebooted.settings.values.volume, 0.35);
  assert.equal(rebooted.settings.values.shake, false);
  assert.equal(rebooted.audio.enabled, false);
  assert.equal(rebooted.settings.values.transitions, true);
});
check("kapalı depolama tercihi uygular ve kayıt hatasını bildirir", () => {
  const original = sandbox.localStorage.setItem;
  sandbox.localStorage.setItem = () => {
    throw new Error("blocked");
  };
  try {
    game.settings.update("volume", 0.45);
    assert.equal(game.settings.values.volume, 0.45);
    assert.equal(game.settings.feedbackKey, "settings.unsaved");
  } finally {
    sandbox.localStorage.setItem = original;
  }
});
check("bölüm girişi dünya, güç süresi, yem ve hayaletleri dondurur", () => {
  reset();
  game.startGame(12);
  assert.equal(game.state, "transition");
  assert.equal(game.saves.canSave(), false);
  game.powerUntil = 10;
  const before = JSON.stringify([
    game.player.entity,
    game.ghosts.entities,
    game.maze.grid,
  ]);
  game.update(0.4);
  assert.equal(game.gameTime, 0);
  assert.equal(game.powerUntil, 10);
  assert.equal(
    JSON.stringify([game.player.entity, game.ghosts.entities, game.maze.grid]),
    before,
  );
  game.update(0.75);
  assert.equal(game.state, "playing");
  assert.equal(game.gameTime, 0);
  assert.equal(game.arcade.transition, null);
});
check("giriş duraklatılır, aynı noktadan sürer ve atlanabilir", () => {
  reset();
  game.startGame();
  game.update(0.2);
  game.togglePause();
  game.update(5);
  assert.equal(game.arcade.transition.elapsed, 0.2);
  game.resumeGameplay();
  assert.equal(game.state, "transition");
  game.arcade.finishTransition();
  assert.equal(game.state, "playing");
});
check(
  "giriş kapalıysa doğrudan başlar; sonraki bölümde de tercih korunur",
  () => {
    reset();
    game.settings.update("transitions", false);
    game.startGame(4);
    assert.equal(game.state, "playing");
    game.nextLevel();
    assert.equal(game.state, "playing");
  },
);
check(
  "ayarları açma kapama aktif oyun ve önceden duraklatılmış oyun için doğrudur",
  () => {
    reset();
    game.settings.open();
    assert.equal(game.state, "paused");
    assert.equal(game.saves.canSave(), false);
    game.update(3);
    assert.equal(game.gameTime, 0);
    game.mainAction();
    game.togglePause();
    assert.equal(game.state, "paused");
    game.settings.close();
    assert.equal(game.state, "playing");
    game.togglePause();
    game.settings.open();
    game.settings.close();
    assert.equal(game.state, "paused");
  },
);
check(
  "ayarlar açıkken bölüm girişini kapatmak dünyayı erkenden başlatmaz",
  () => {
    reset();
    game.startGame();
    game.settings.open();
    game.settings.update("transitions", false);
    assert.equal(game.state, "paused");
    assert.equal(game.arcade.transition, null);
    game.settings.close();
    assert.equal(game.state, "playing");
  },
);
check("ara sahne ayarlarda bekler ve kapanınca ara sahneye döner", () => {
  reset();
  game.cutscenes.beginCutscene(game.ghosts.entities[0]);
  game.settings.open();
  const elapsed = game.cutscenes.current.elapsed;
  game.update(2);
  assert.equal(game.cutscenes.current.elapsed, elapsed);
  game.settings.close();
  assert.equal(game.state, "cutscene");
  game.cutscenes.finishCutscene();
});
check("sistem ve oyun tercihi azaltılmış hareketi uygular", () => {
  reset();
  motion.matches = true;
  game.settings.apply();
  assert.equal(game.settings.effectsAllowed("shake"), false);
  assert.equal(game.settings.effectsAllowed("particles"), false);
  game.startGame();
  assert.equal(game.arcade.transition.duration, 0.5);
  game.arcade.finishTransition();
  game.cutscenes.beginCutscene(game.ghosts.entities[0]);
  assert.equal(game.cutscenes.current.duration, 0.65);
  motion.matches = false;
  game.settings.update("reducedMotion", true);
  assert.equal(game.settings.reduced, true);
  game.cutscenes.finishCutscene();
});
check(
  "canlı azaltılmış hareket değişikliği mevcut sahneyi güvenli kısaltır",
  () => {
    reset();
    game.cutscenes.beginCutscene(game.ghosts.entities[0]);
    game.update(0.2);
    game.settings.open();
    game.settings.update("reducedMotion", true);
    assert.equal(game.cutscenes.current.duration, 0.65);
    assert.ok(
      Math.abs(
        game.cutscenes.current.elapsed - (0.2 / CUTSCENE_DURATION) * 0.65,
      ) < 1e-10,
    );
    assert.equal(game.saves.validate(game.saves.capture()), true);
    game.settings.close();
    game.cutscenes.finishCutscene();
  },
);
check("sarsıntı kapanır; parçacıklar kapanınca yeni parçacık üretilmez", () => {
  reset();
  game.arcade.impact("hurt");
  assert.notDeepEqual(game.arcade.offset(), { x: 0, y: 0 });
  game.settings.update("shake", false);
  assert.deepEqual(game.arcade.offset(), { x: 0, y: 0 });
  game.effects.burst(0, 0, "#fff");
  assert.ok(game.effects.particles.length > 0);
  game.settings.update("particles", false);
  game.effects.burst(0, 0, "#fff");
  assert.equal(game.effects.particles.length, 0);
});
check(
  "kombo gerçek hayalet temasından sayılır; her hayalet hâlâ +200 verir",
  () => {
    reset();
    game.powerUntil = 10;
    for (let i = 0; i < 2; i++) {
      Object.assign(game.ghosts.entities[i], {
        col: 10,
        row: 17,
        progress: 0,
        moving: false,
        releaseAt: 0,
      });
      game.checkCollisions();
      assert.equal(game.state, "cutscene");
      game.cutscenes.finishCutscene();
    }
    assert.equal(game.arcade.combo, 2);
    assert.equal(game.score, 400);
    game.ui.updateHUD();
    assert.equal(element("combo-count").textContent, "2 VURUŞ · KOMBO");
    assert.equal(element("combo-points").textContent, "+400 toplam");
  },
);
check("kombo kayıtla korunur, eski kayıtlar sıfır kombo ile açılır", () => {
  const record = game.saves.capture();
  assert.equal(record.data.combo, 2);
  assert.equal(game.saves.write("manual", record), true);
  game.arcade.combo = 0;
  assert.equal(game.saves.resume("manual"), true);
  assert.equal(game.arcade.combo, 2);
  delete record.data.combo;
  assert.equal(game.saves.validate(record), true);
  game.saves.slots.manual = record;
  game.saves.resume("manual");
  assert.equal(game.arcade.combo, 0);
  record.data.combo = -1;
  assert.equal(game.saves.validate(record), false);
});
check("yeni güç yemi, güç bitişi, yeni oyun ve bölüm komboyu sıfırlar", () => {
  reset();
  game.arcade.combo = 2;
  game.maze.collectPellet(1, 1);
  assert.equal(game.arcade.combo, 0);
  game.arcade.combo = 2;
  game.powerUntil = 0;
  game.arcade.update(0.01);
  assert.equal(game.arcade.combo, 0);
  game.arcade.combo = 2;
  game.startGame();
  assert.equal(game.arcade.combo, 0);
});
check("sahne etkileri ve kombo menüde süre tüketmez", () => {
  reset();
  game.powerUntil = 10;
  game.arcade.combo = 2;
  game.arcade.impact("ghost");
  game.togglePause();
  game.update(3);
  assert.equal(game.arcade.hit.life, 0.32);
  assert.equal(game.arcade.combo, 2);
});
check("yeni arayüz metinleri iki dilde eksiksizdir", () => {
  for (const [key, value] of Object.entries(TRANSLATIONS.tr).filter(
    ([key]) => key.startsWith("settings.") || key.startsWith("arcade."),
  )) {
    assert.ok(value);
    assert.ok(TRANSLATIONS.en[key], key);
  }
  game.i18n.setLanguage("en");
  game.arcade.combo = 2;
  game.ui.updateHUD();
  assert.equal(element("combo-count").textContent, "2 HITS · COMBO");
  game.i18n.setLanguage("tr");
});
check("Web Audio olmadan ses açılabilir ve oyun bozulmaz", () => {
  reset();
  game.settings.update("sound", true);
  game.audio.play("power");
  assert.equal(game.audio.context, null);
});
check(
  "sesler zamanlanır, ana seviye uygulanır, mute bekleyen sesleri keser",
  () => {
    const scheduled = [],
      masterValues = [];
    let stopCalls = 0;
    class FakeAudio {
      state = "running";
      currentTime = 1;
      destination = {};
      createGain() {
        return {
          connect() {},
          disconnect() {},
          gain: {
            setTargetAtTime(v) {
              masterValues.push(v);
            },
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
        };
      }
      createOscillator() {
        return {
          frequency: { setValueAtTime() {} },
          connect() {},
          disconnect() {},
          start(t) {
            scheduled.push(t);
          },
          stop() {
            stopCalls++;
          },
        };
      }
    }
    sandbox.window.AudioContext = FakeAudio;
    try {
      game.audio.resumeAudio();
      game.audio.play("power");
      assert.equal(scheduled.length, SOUND_CUES.power.length);
      assert.ok(scheduled[2] > scheduled[0]);
      assert.ok(masterValues.includes(game.settings.values.volume));
      const before = scheduled.length;
      game.settings.update("volume", 0);
      game.audio.play("power");
      assert.equal(scheduled.length, before);
      game.settings.update("sound", false);
      assert.equal(game.audio.voices.size, 0);
      assert.ok(stopCalls > before);
      assert.equal(masterValues.at(-1), 0);
    } finally {
      delete sandbox.window.AudioContext;
      game.audio.context = null;
      game.audio.master = null;
    }
  },
);
check(
  "can kaybı seriyi sıfırlar; game over kamerada kalıcı sarsıntı bırakmaz",
  () => {
    reset();
    game.lives = 1;
    game.arcade.combo = 2;
    game.powerUntil = 0;
    game.invulnerableUntil = 0;
    Object.assign(game.ghosts.entities[0], {
      col: 10,
      row: 17,
      progress: 0,
      moving: false,
      releaseAt: 0,
    });
    game.checkCollisions();
    assert.equal(game.state, "gameover");
    assert.equal(game.arcade.combo, 0);
    assert.deepEqual(game.arcade.offset(), { x: 0, y: 0 });
    assert.equal(game.arcade.hit, null);
  },
);
check(
  "yürüyüş mesafeye bağlıdır; kare hızları aynı uzun döngüyü üretir",
  () => {
    const entity = { moving: true, dir: "right" };
    const simulate = (steps) => {
      const animation = new PlayerAnimation();
      animation.update(0, { x: 0, y: 0 }, entity, null);
      for (let i = 1; i <= steps; i++)
        animation.update(
          0.6 / steps,
          { x: (i / steps) * 66.96, y: 0 },
          entity,
          null,
        );
      return animation;
    };
    const slow = simulate(30),
      fast = simulate(120);
    for (const key of ["phase", "weight", "clock"])
      assert.ok(Math.abs(slow[key] - fast[key]) < 1e-10);
    assert.ok(slow.phase > 6.2 && slow.phase < Math.PI * 2);
  },
);
check(
  "durma yumuşaktır; zıplama, reset ve azaltılmış hareket pozu güvenlidir",
  () => {
    const animation = new PlayerAnimation(),
      position = { x: 24, y: 24 };
    animation.update(0.5, position, { moving: true, dir: "up" }, null);
    const before = animation.weight;
    animation.update(1 / 120, position, { moving: false, dir: "right" }, null);
    assert.ok(animation.weight > 0 && animation.weight < before);
    const phase = animation.phase;
    animation.update(0.2, { x: 72, y: 24 }, { moving: true, dir: "right" }, {});
    assert.equal(animation.phase, phase);
    assert.deepEqual(animation.pose(true), {
      bob: 0,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      mouth: 0.22,
    });
    animation.reset();
    assert.equal(animation.weight, 0);
    assert.equal(animation.phase, 0);
  },
);
check(
  "üç uzun sahnede hazırlık, darbe ve toparlanma pozları kesintisizdir",
  () => {
    reset();
    for (const ghost of game.ghosts.entities) {
      game.cutscenes.beginCutscene(ghost);
      const scene = game.cutscenes.current;
      assert.equal(scene.duration, 2.4);
      for (const boundary of [
        0.08,
        0.22,
        0.24,
        0.3,
        0.34,
        0.42,
        IMPACT_PHASE,
        0.49,
        0.64,
        0.7,
        0.75,
        0.86,
        0.9,
        0.92,
      ]) {
        scene.elapsed = (boundary - 1e-5) * scene.duration;
        const before = game.cutscenes.pose();
        scene.elapsed = (boundary + 1e-5) * scene.duration;
        const after = game.cutscenes.pose();
        for (const key of Object.keys(before)) {
          assert.ok(Number.isFinite(after[key]));
          assert.ok(
            Math.abs(before[key] - after[key]) < 0.1,
            key + " pose jump",
          );
        }
      }
      scene.elapsed = 0;
      assert.equal(game.cutscenes.pose().fade, 0);
      scene.elapsed = scene.duration;
      const ending = game.cutscenes.pose();
      assert.equal(ending.fade, 0);
      assert.equal(ending.action, 0);
      assert.equal(ending.hx, 175);
      game.cutscenes.finishCutscene();
    }
  },
);
check(
  "yeni ve eski sahne kayıtları yüklenir; darbe sesi sadece bir kez çalar",
  () => {
    reset();
    game.cutscenes.beginCutscene(game.ghosts.entities[0]);
    const audio = game.audio.play;
    let impacts = 0;
    game.audio.play = (name) => {
      if (name === "impact") impacts++;
    };
    try {
      game.update(CUTSCENE_DURATION * IMPACT_PHASE - 0.001);
      assert.equal(impacts, 0);
      game.update(0.002);
      assert.equal(impacts, 1);
      const saved = game.saves.capture();
      assert.equal(game.saves.validate(saved), true);
      for (const duration of [1.3, 2.4]) {
        const legacy = structuredClone(saved);
        legacy.data.cutscene.duration = duration;
        legacy.data.cutscene.elapsed = 0.5;
        assert.equal(game.saves.validate(legacy), true);
      }
      game.update(0.2);
      assert.equal(impacts, 1);
    } finally {
      game.audio.play = audio;
      game.cutscenes.finishCutscene();
    }
  },
);
console.log(`${checks} arcade checks passed.`);
