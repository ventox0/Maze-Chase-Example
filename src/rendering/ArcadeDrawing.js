import { TILE, DIRS, LIFE_PELLET } from "../data/config.js";
import { JUMP_DURATION, MAGNET_RADIUS } from "../data/abilities.js";

// Tek oyunculu ve LAN aynı çizimleri kullanır; bu modül DOM veya oyun durumu tutmaz.
export function buildWallLayer(
  grid,
  style,
  createCanvas = () => document.createElement("canvas"),
) {
  const rows = grid.length,
    cols = grid[0].length;
  const layer = createCanvas();
  layer.width = cols * TILE * 2;
  layer.height = rows * TILE * 2;
  const c = layer.getContext("2d");
  c.scale(2, 2);
  c.fillStyle = "#0d1025";
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === 1) c.fillRect(x * TILE, y * TILE, TILE, TILE);
  c.strokeStyle = style.color;
  c.lineWidth = 1.5;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.shadowColor = style.glow;
  c.shadowBlur = 7;
  c.beginPath();
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== 1) continue;
      const left = x * TILE + 3,
        right = (x + 1) * TILE - 3,
        top = y * TILE + 3,
        bottom = (y + 1) * TILE - 3;
      const exposed = (dx, dy) =>
        y + dy < 0 ||
        y + dy >= rows ||
        x + dx < 0 ||
        x + dx >= cols ||
        grid[y + dy][x + dx] !== 1;
      const t = exposed(0, -1),
        b = exposed(0, 1),
        l = exposed(-1, 0),
        r = exposed(1, 0),
        radius = 4;
      if (t) {
        c.moveTo(l ? left + radius : x * TILE, top);
        c.lineTo(r ? right - radius : (x + 1) * TILE, top);
      }
      if (b) {
        c.moveTo(l ? left + radius : x * TILE, bottom);
        c.lineTo(r ? right - radius : (x + 1) * TILE, bottom);
      }
      if (l) {
        c.moveTo(left, t ? top + radius : y * TILE);
        c.lineTo(left, b ? bottom - radius : (y + 1) * TILE);
      }
      if (r) {
        c.moveTo(right, t ? top + radius : y * TILE);
        c.lineTo(right, b ? bottom - radius : (y + 1) * TILE);
      }
      if (t && l) {
        c.moveTo(left, top + radius);
        c.quadraticCurveTo(left, top, left + radius, top);
      }
      if (t && r) {
        c.moveTo(right - radius, top);
        c.quadraticCurveTo(right, top, right, top + radius);
      }
      if (b && l) {
        c.moveTo(left, bottom - radius);
        c.quadraticCurveTo(left, bottom, left + radius, bottom);
      }
      if (b && r) {
        c.moveTo(right - radius, bottom);
        c.quadraticCurveTo(right, bottom, right, bottom - radius);
      }
    }
  c.stroke();
  return layer;
}

export function drawPlayer(ctx, p, pose, image, dir, jump, alpha = 1) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (jump) {
    const scale =
      1 + Math.sin(Math.min(1, jump.elapsed / JUMP_DURATION) * Math.PI) * 0.25;
    ctx.scale(scale, scale);
  }
  ctx.globalAlpha = alpha;
  if (image && image.complete && image.naturalWidth > 0) {
    // Poz fiziğin merkezinde kalır; kostüm ve başlık tek model olarak salınır.
    if (dir === "left") ctx.scale(-1, 1);
    ctx.rotate(pose.angle);
    ctx.scale(pose.scaleX, pose.scaleY);
    const size = TILE * 1.18;
    ctx.drawImage(image, -size / 2, -size / 2 + pose.bob, size, size);
    ctx.restore();
    return;
  }
  // Yükleme tamamlanana kadar klasik animasyon kullanılır.
  ctx.rotate(DIRS[dir].angle);
  ctx.scale(pose.scaleX, pose.scaleY);
  ctx.fillStyle = "#ffe15b";
  ctx.shadowColor = "#ffe15b";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, TILE * 0.39, pose.mouth, Math.PI * 2 - pose.mouth);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#161424";
  ctx.beginPath();
  ctx.arc(1, -5, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGhostEffects(
  ctx,
  ghost,
  p,
  time,
  enabled,
  phase,
  sprinting,
  hop,
) {
  if (!enabled) return;
  ctx.save();
  ctx.lineWidth = 1.2;
  if (ghost.id === "moss" && phase >= 3 && phase < 7) {
    ctx.strokeStyle = phase < 4 ? "#69e44855" : "#69e448b0";
    ctx.fillStyle = phase < 4 ? "#69e44808" : "#69e44818";
    ctx.setLineDash(phase < 4 ? [3, 5] : []);
    ctx.beginPath();
    ctx.arc(p.x, p.y, TILE * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (ghost.id === "rush" && phase >= 6 && phase < 8.4) {
    ctx.strokeStyle = "#d49aff";
    ctx.setLineDash(sprinting ? [] : [2, 3]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
    ctx.stroke();
    if (sprinting) {
      const d = DIRS[ghost.dir];
      ctx.strokeStyle = "#d49aff70";
      ctx.beginPath();
      ctx.moveTo(p.x - d.x * 25, p.y - d.y * 25);
      ctx.lineTo(p.x - d.x * 10, p.y - d.y * 10);
      ctx.stroke();
    }
  }
  if (hop) {
    ctx.strokeStyle = "#c7d2eab0";
    ctx.fillStyle = "#c7d2ea12";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(hop.to.x, hop.to.y, 13 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hop.from.x, hop.from.y);
    ctx.lineTo(hop.to.x, hop.to.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGhost(
  ctx,
  ghost,
  p,
  sprite,
  time,
  frightened,
  blink,
  respawning,
) {
  const color = frightened ? (blink ? "#e5e9ff" : "#7186f8") : ghost.color;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (respawning) ctx.globalAlpha = 0.45;
  if (!frightened && sprite) {
    const height = TILE * 1.5,
      width = (height * sprite.width) / sprite.height;
    ctx.drawImage(
      sprite,
      -width / 2,
      -height / 2 + Math.sin(time * 5 + ghost.index) * 0.7,
      width,
      height,
    );
    ctx.restore();
    return;
  }
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const r = 9,
    wave = Math.sin(time * 9 + ghost.index) * 1.5;
  ctx.beginPath();
  ctx.moveTo(-r, 9);
  ctx.lineTo(-r, 0);
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.lineTo(r, 9);
  ctx.lineTo(5, 6 + wave);
  ctx.lineTo(1, 9);
  ctx.lineTo(-3, 6 - wave);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  if (frightened) {
    ctx.fillStyle = blink ? "#5265c8" : "white";
    ctx.fillRect(-4, -1, 2, 2);
    ctx.fillRect(3, -1, 2, 2);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(-3, 3);
    ctx.lineTo(-1, 5);
    ctx.lineTo(1, 3);
    ctx.lineTo(3, 5);
    ctx.lineTo(5, 3);
    ctx.stroke();
  } else {
    const d = DIRS[ghost.dir];
    for (const x of [-4, 4]) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(x, -1, 3, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#171934";
      ctx.beginPath();
      ctx.arc(x + d.x * 1.2, -1 + d.y * 1.4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawPellets(ctx, grid, time) {
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];
      if (cell !== 2 && cell !== 3) continue;
      const power = cell === 3,
        r = power ? 5 + Math.sin(time * 4) * 0.9 : 2;
      ctx.fillStyle = power ? "#ffe15b" : "#e4cbaa";
      ctx.shadowColor = "#ffe15b";
      ctx.shadowBlur = power ? 13 : 0;
      ctx.beginPath();
      ctx.arc((x + 0.5) * TILE, (y + 0.5) * TILE, r, 0, Math.PI * 2);
      ctx.fill();
      if (power) {
        ctx.strokeStyle = "#ffe15b35";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc((x + 0.5) * TILE, (y + 0.5) * TILE, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  ctx.shadowBlur = 0;
}

export function drawAbilities(ctx, p, dir, abilities, time) {
  if (abilities.magnet) {
    ctx.save();
    ctx.strokeStyle = "#65dcca80";
    ctx.fillStyle = "#65dcca0b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, MAGNET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#65dcca40";
    ctx.beginPath();
    ctx.arc(p.x, p.y, (time * 35) % MAGNET_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (abilities.jump) {
    ctx.save();
    ctx.strokeStyle = "#a28bff66";
    ctx.lineWidth = 3;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(abilities.jump.from.x, abilities.jump.from.y);
    ctx.quadraticCurveTo(
      (abilities.jump.from.x + abilities.jump.to.x) / 2,
      (abilities.jump.from.y + abilities.jump.to.y) / 2 - TILE * 1.3,
      abilities.jump.to.x,
      abilities.jump.to.y,
    );
    ctx.stroke();
    ctx.restore();
  }
  if (abilities.boost) {
    const d = DIRS[dir];
    ctx.save();
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.3 / i;
      ctx.fillStyle = "#ffa563";
      ctx.beginPath();
      ctx.arc(p.x - d.x * i * 7, p.y - d.y * i * 7, 7 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (abilities.shield) {
    ctx.save();
    ctx.strokeStyle = "#81c9ff";
    ctx.fillStyle = "#81c9ff18";
    ctx.shadowColor = "#81c9ff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 + Math.sin(time * 8), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function drawLifePellet(
  ctx,
  time,
  label,
  reward,
  location = LIFE_PELLET,
) {
  const x = (location.col + 0.5) * TILE,
    y = (location.row + 0.5) * TILE,
    pulse = Math.sin(time * 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#80e8b280";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 15 + pulse * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.scale(1 + pulse * 0.08, 1 + pulse * 0.08);
  ctx.fillStyle = "#80e8b2";
  ctx.shadowColor = "#80e8b2";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-16, -2, -6, -13, 0, -6);
  ctx.bezierCurveTo(6, -13, 16, -2, 0, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a2f5d4";
  ctx.font = "bold 7px ui-monospace,monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, 0, 27);
  ctx.font = "6px ui-monospace,monospace";
  ctx.fillText(reward, 0, 36);
  ctx.restore();
}
