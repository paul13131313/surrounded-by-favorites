/* ========================================
   コラージュ合成 — 密集レイアウト (Canvas API)
   「好きなものに囲まれている」= ぎゅっと中央に密集
   ======================================== */

// roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
}

const SIZE = 1080;
const CX = SIZE / 2;
const CY = SIZE / 2;

/* ─── 背景 ─── */
function drawBackground(ctx) {
  const palettes = [
    ['#FFF8F0', '#FFEEE5', '#FFF5F0'],
    ['#F0F5FF', '#E8ECFF', '#F5F0FF'],
    ['#FFFFF0', '#FFF5E5', '#FFF8EE'],
    ['#F5FFF0', '#EEFFF0', '#F8FFF5'],
  ];
  const pal = palettes[Math.floor(Math.random() * palettes.length)];
  const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, SIZE * 0.75);
  grad.addColorStop(0, pal[0]);
  grad.addColorStop(0.6, pal[1]);
  grad.addColorStop(1, pal[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

/* ─── 密集レイアウト生成 ─── */
function generateLayout(personH) {
  const baseRadius = Math.max(personH * 0.42, 220);

  const positions = [];
  for (let i = 0; i < 8; i++) {
    const baseAngle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const angleJitter = (Math.random() - 0.5) * 0.35;
    const angle = baseAngle + angleJitter;

    const radiusJitter = (Math.random() - 0.5) * 80;
    const r = baseRadius + radiusJitter;

    const sizes = [240, 200, 260, 180, 250, 210, 230, 195];
    const size = sizes[i] + (Math.random() - 0.5) * 30;

    const rotation = (Math.random() - 0.5) * 0.5;

    positions.push({
      x: CX + Math.cos(angle) * r,
      y: CY + Math.sin(angle) * r,
      size,
      rotation,
      zIndex: i,
    });
  }

  return positions;
}

/* ─── イラスト1枚描画（切り抜きステッカー風） ─── */
function drawIllust(ctx, img, layout, label) {
  if (!img) return;
  const { x, y, size, rotation } = layout;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // 軽いドロップシャドウ
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  ctx.drawImage(img, -size / 2, -size / 2, size, size);

  // シャドウリセット
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ラベル（小さく控えめに）
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `bold ${Math.round(size * 0.08)}px 'Zen Maru Gothic', sans-serif`;
  ctx.textAlign = 'center';
  const textW = ctx.measureText(label).width + 12;
  ctx.beginPath();
  ctx.roundRect(-textW / 2, size / 2 - 8, textW, 18, 9);
  ctx.fill();

  ctx.fillStyle = '#4a3728';
  ctx.font = `bold ${Math.round(size * 0.08)}px 'Zen Maru Gothic', sans-serif`;
  ctx.fillText(label, 0, size / 2 + 5);

  ctx.restore();
}

/* ─── 人物描画（セグメンテーション済み＝背景透明） ─── */
function drawPerson(ctx, personCanvas) {
  const maxH = 450;
  const ratio = personCanvas.width / personCanvas.height;
  let drawH = Math.min(maxH, personCanvas.height);
  let drawW = drawH * ratio;

  if (drawW > 400) {
    drawW = 400;
    drawH = drawW / ratio;
  }

  ctx.save();

  // ドロップシャドウ（人物が浮いて見える効果）
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;

  ctx.drawImage(
    personCanvas,
    CX - drawW / 2, CY - drawH / 2,
    drawW, drawH
  );
  ctx.restore();

  return { drawW, drawH };
}

/* ─── タイトル ─── */
function drawTitle(ctx) {
  const y = SIZE - 45;
  ctx.save();
  ctx.font = "bold 24px 'Zen Maru Gothic', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  const tw = ctx.measureText('好きなものに囲まれたい').width + 40;
  ctx.beginPath();
  ctx.roundRect(CX - tw / 2, y - 16, tw, 32, 16);
  ctx.fill();

  ctx.fillStyle = '#d4537a';
  ctx.fillText('好きなものに囲まれたい', CX, y);
  ctx.restore();
}

/* ─── メイン合成 ─── */
function compose(canvas, personCanvas, illustImages, items) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // 1. 背景
  drawBackground(ctx);

  // 2. 人物の高さを先に計算してレイアウトに使う
  const ratio = personCanvas.width / personCanvas.height;
  let personH = Math.min(450, personCanvas.height);
  let personW = personH * ratio;
  if (personW > 400) { personW = 400; personH = personW / ratio; }

  // 3. 密集レイアウト生成
  const layout = generateLayout(personH);

  // 4. 後ろのイラスト（0〜3番）
  for (let i = 0; i < 4; i++) {
    drawIllust(ctx, illustImages[i], layout[i], items[i]);
  }

  // 5. 人物（中央・主役）
  drawPerson(ctx, personCanvas);

  // 6. 前面のイラスト（4〜7番）— 人物の前にかぶさる
  for (let i = 4; i < 8; i++) {
    drawIllust(ctx, illustImages[i], layout[i], items[i]);
  }

  // 7. タイトル
  drawTitle(ctx);

  return canvas;
}

const CollageComposer = { compose };
export default CollageComposer;

window.CollageComposer = CollageComposer;
