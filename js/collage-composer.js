/* ========================================
   コラージュ合成 — 美術的コラージュ (Canvas API)
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

const CollageComposer = (() => {
  const SIZE = 1080;

  /* ─── 背景：紙テクスチャ風 ─── */
  function drawBackground(ctx) {
    // ベースグラデーション
    const palettes = [
      ['#FFF8F0', '#FFE8E0', '#FFF0F5'],
      ['#F0F5FF', '#E8E0F5', '#FFF0F8'],
      ['#FFFFF0', '#FFF0E0', '#FFF5EE'],
      ['#F0FFF5', '#E8F5F0', '#F5FFF8'],
    ];
    const pal = palettes[Math.floor(Math.random() * palettes.length)];
    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(0.5, pal[1]);
    grad.addColorStop(1, pal[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 紙テクスチャ（細かいノイズ）
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * SIZE;
      const y = Math.random() * SIZE;
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // 水彩にじみ風の大きなブロブ
    const blobColors = ['#FFD6E0', '#D6E8FF', '#E0FFD6', '#FFF0D6', '#E8D6FF'];
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.random() * 0.06;
      const bx = Math.random() * SIZE;
      const by = Math.random() * SIZE;
      const br = 150 + Math.random() * 200;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, blobColors[Math.floor(Math.random() * blobColors.length)]);
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      ctx.restore();
    }
  }

  /* ─── マスキングテープの描画 ─── */
  function drawMaskingTape(ctx, x, y, angle, length) {
    const tapeColors = [
      'rgba(255,200,200,0.55)', 'rgba(200,230,255,0.55)',
      'rgba(255,240,180,0.55)', 'rgba(200,255,210,0.55)',
      'rgba(230,210,255,0.55)', 'rgba(255,220,200,0.55)',
    ];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = tapeColors[Math.floor(Math.random() * tapeColors.length)];
    const w = length || (40 + Math.random() * 30);
    const h = 10 + Math.random() * 6;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // テープのストライプ
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (let sx = -w / 2; sx < w / 2; sx += 5) {
      ctx.beginPath();
      ctx.moveTo(sx, -h / 2);
      ctx.lineTo(sx + 3, h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ─── 切り抜きイラストの配置レイアウト生成 ─── */
  function generateLayout() {
    // 8つの配置位置：中央の顔を避けながら有機的にばらまく
    // 画面を大まかにゾーンに分け、各ゾーン内でランダムにずらす
    const zones = [
      { cx: 190, cy: 160 },   // 左上
      { cx: 540, cy: 120 },   // 上中央
      { cx: 880, cy: 170 },   // 右上
      { cx: 130, cy: 520 },   // 左中
      { cx: 920, cy: 500 },   // 右中
      { cx: 170, cy: 840 },   // 左下
      { cx: 540, cy: 900 },   // 下中央
      { cx: 870, cy: 860 },   // 右下
    ];

    return zones.map((z, i) => {
      const jitterX = (Math.random() - 0.5) * 100;
      const jitterY = (Math.random() - 0.5) * 80;
      const rotation = (Math.random() - 0.5) * 0.4; // ±約12度
      // サイズに変化をつける（大小混在がコラージュらしい）
      const sizeVariants = [220, 200, 250, 190, 240, 210, 230, 195];
      const size = sizeVariants[i] + (Math.random() - 0.5) * 40;

      return {
        x: z.cx + jitterX,
        y: z.cy + jitterY,
        size,
        rotation,
        zIndex: Math.random(), // 描画順ランダム化
      };
    });
  }

  /* ─── 不定形切り抜きマスク（ハサミで切ったような輪郭） ─── */
  function applyTornMask(ctx, x, y, w, h) {
    ctx.beginPath();
    const steps = 40;
    const wobble = 6;
    // 上辺
    for (let i = 0; i <= steps; i++) {
      const px = x + (w * i) / steps;
      const py = y + (Math.random() - 0.5) * wobble;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    // 右辺
    for (let i = 0; i <= steps; i++) {
      const px = x + w + (Math.random() - 0.5) * wobble;
      const py = y + (h * i) / steps;
      ctx.lineTo(px, py);
    }
    // 下辺
    for (let i = steps; i >= 0; i--) {
      const px = x + (w * i) / steps;
      const py = y + h + (Math.random() - 0.5) * wobble;
      ctx.lineTo(px, py);
    }
    // 左辺
    for (let i = steps; i >= 0; i--) {
      const px = x + (Math.random() - 0.5) * wobble;
      const py = y + (h * i) / steps;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /* ─── イラスト1枚の描画 ─── */
  function drawIllustration(ctx, img, layout, label) {
    const { x, y, size, rotation } = layout;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // ドロップシャドウ
    ctx.shadowColor = 'rgba(60,30,10,0.18)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    // 白いカード台紙（不定形エッジ）
    ctx.fillStyle = '#ffffffee';
    const pad = 12;
    applyTornMask(ctx, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2 + 28);
    ctx.fill();

    // シャドウをリセット
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 画像を描画
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }

    // アイテム名ラベル（手書き風に下部に）
    ctx.fillStyle = '#5a3e28';
    ctx.font = `bold ${Math.round(size * 0.09)}px 'Zen Maru Gothic', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, size / 2 + 14);

    ctx.restore();

    // マスキングテープを確率で貼る
    if (Math.random() > 0.35) {
      const tx = x + (Math.random() - 0.5) * size * 0.4;
      const ty = y - size / 2 - 6 + (Math.random() - 0.5) * 10;
      drawMaskingTape(ctx, tx, ty, rotation + (Math.random() - 0.5) * 0.5, 45 + Math.random() * 25);
    }
  }

  /* ─── 顔写真（コラージュの主役） ─── */
  function drawFace(ctx, faceCanvas) {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const radius = 150;

    ctx.save();

    // 軽い回転（少しだけ傾ける）
    const faceRotation = (Math.random() - 0.5) * 0.08;
    ctx.translate(cx, cy);
    ctx.rotate(faceRotation);

    // シャドウ
    ctx.shadowColor = 'rgba(40,20,5,0.25)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;

    // 白い縁取り（ポラロイド風の太い白枠）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
    ctx.fill();

    // シャドウリセット
    ctx.shadowColor = 'transparent';

    // 顔画像（円形クリップ）
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(faceCanvas, -radius, -radius, radius * 2, radius * 2);

    ctx.restore();

    // マスキングテープを顔の上に
    drawMaskingTape(ctx, cx - 40 + Math.random() * 80, cy - radius - 8, (Math.random() - 0.5) * 0.6, 55);
  }

  /* ─── タイトルテキスト ─── */
  function drawTitle(ctx) {
    const y = SIZE - 48;
    ctx.save();

    ctx.font = "bold 26px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 半透明の帯
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const tw = ctx.measureText('好きなものに囲まれたい').width + 48;
    ctx.beginPath();
    ctx.roundRect(SIZE / 2 - tw / 2, y - 18, tw, 36, 18);
    ctx.fill();

    ctx.fillStyle = '#d4537a';
    ctx.fillText('好きなものに囲まれたい', SIZE / 2, y);
    ctx.restore();
  }

  /* ─── 装飾パーツ（星・ハート・点線など） ─── */
  function drawDecorations(ctx) {
    const decos = ['✦', '♡', '✿', '◦', '·', '♪', '☆'];
    ctx.save();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) {
      ctx.globalAlpha = 0.15 + Math.random() * 0.15;
      ctx.fillStyle = ['#f2789f', '#8ec5d6', '#ffc857', '#c9a0dc', '#a8d8a8'][Math.floor(Math.random() * 5)];
      const sz = 12 + Math.random() * 14;
      ctx.font = `${sz}px sans-serif`;
      ctx.fillText(
        decos[Math.floor(Math.random() * decos.length)],
        Math.random() * SIZE,
        Math.random() * SIZE
      );
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ─── メイン合成 ─── */
  function compose(canvas, faceCanvas, illustImages, items) {
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // 1. 背景
    drawBackground(ctx);

    // 2. 装飾パーツ（背面）
    drawDecorations(ctx);

    // 3. レイアウト生成＆描画順ソート
    const layout = generateLayout();
    const drawOrder = layout
      .map((l, i) => ({ ...l, index: i }))
      .sort((a, b) => a.zIndex - b.zIndex);

    // 4. 顔より後ろのイラスト（zIndex < 0.5）
    drawOrder
      .filter(l => l.zIndex < 0.5)
      .forEach(l => {
        drawIllustration(ctx, illustImages[l.index], l, items[l.index]);
      });

    // 5. 顔写真（中央・主役）
    drawFace(ctx, faceCanvas);

    // 6. 顔より前のイラスト（zIndex >= 0.5）
    drawOrder
      .filter(l => l.zIndex >= 0.5)
      .forEach(l => {
        drawIllustration(ctx, illustImages[l.index], l, items[l.index]);
      });

    // 7. タイトル
    drawTitle(ctx);

    return canvas;
  }

  return { compose };
})();
