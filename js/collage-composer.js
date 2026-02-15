/**
 * collage-composer.js
 * 1080x1080pxのコラージュ画像を合成する
 *
 * テキスト描画はこのファイル内でのみ行う
 * 他のファイルからテキスト描画を呼ばないこと
 */

// ===== 定数 =====
const CANVAS_SIZE = 1080;
const CENTER_X = CANVAS_SIZE / 2;       // 540
const CENTER_Y = CANVAS_SIZE / 2 - 40;  // 500（タイトル分やや上）
const FACE_RADIUS = 140;                // 顔の半径（直径280px）
const ORBIT_RADIUS = 330;               // イラスト配置の円周半径
const ILLUST_SIZE = 170;                // 各イラストの表示サイズ
const START_ANGLE = -Math.PI / 2;       // 12時方向から開始

// 暖色系グラデーション候補
const GRADIENTS = [
  { from: '#FFF5F5', to: '#FFE8E0' },
  { from: '#FFF8F0', to: '#FFE5F0' },
  { from: '#FFF5E6', to: '#FFE8F5' },
  { from: '#FFF0F5', to: '#F0E8FF' },
  { from: '#FFFFF0', to: '#FFE8E8' },
];

/**
 * メイン合成関数
 * @param {HTMLCanvasElement} targetCanvas - 描画先Canvas（DOM上のもの）
 * @param {HTMLCanvasElement|HTMLImageElement} faceImage - 切り抜き済み顔画像
 * @param {HTMLImageElement[]} illustrations - 8枚のイラスト
 * @param {string[]} items - 8つのアイテム名
 */
function compose(targetCanvas, faceImage, illustrations, items) {
  targetCanvas.width = CANVAS_SIZE;
  targetCanvas.height = CANVAS_SIZE;
  const ctx = targetCanvas.getContext('2d');

  // ===== 1. 背景 =====
  const grad = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  gradient.addColorStop(0, grad.from);
  gradient.addColorStop(1, grad.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // ===== 2. イラスト8枚＋アイテム名テキスト =====
  for (let i = 0; i < 8; i++) {
    const angle = START_ANGLE + (i * Math.PI * 2) / 8;
    const ix = CENTER_X + Math.cos(angle) * ORBIT_RADIUS;
    const iy = CENTER_Y + Math.sin(angle) * ORBIT_RADIUS;

    // --- イラスト描画（角丸＋影）---
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    const half = ILLUST_SIZE / 2;
    const rr = 16; // 角丸半径
    const lx = ix - half;
    const ly = iy - half;

    // 角丸パスを作成
    ctx.beginPath();
    ctx.moveTo(lx + rr, ly);
    ctx.lineTo(lx + ILLUST_SIZE - rr, ly);
    ctx.quadraticCurveTo(lx + ILLUST_SIZE, ly, lx + ILLUST_SIZE, ly + rr);
    ctx.lineTo(lx + ILLUST_SIZE, ly + ILLUST_SIZE - rr);
    ctx.quadraticCurveTo(lx + ILLUST_SIZE, ly + ILLUST_SIZE, lx + ILLUST_SIZE - rr, ly + ILLUST_SIZE);
    ctx.lineTo(lx + rr, ly + ILLUST_SIZE);
    ctx.quadraticCurveTo(lx, ly + ILLUST_SIZE, lx, ly + ILLUST_SIZE - rr);
    ctx.lineTo(lx, ly + rr);
    ctx.quadraticCurveTo(lx, ly, lx + rr, ly);
    ctx.closePath();

    ctx.clip();
    if (illustrations[i]) {
      ctx.drawImage(illustrations[i], lx, ly, ILLUST_SIZE, ILLUST_SIZE);
    }
    ctx.restore();

    // --- アイテム名テキスト（ここで1回だけ描画）---
    ctx.save();
    ctx.font = '600 15px "Zen Maru Gothic", sans-serif';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(items[i], ix, iy + half + 6);
    ctx.restore();
  }

  // ===== 3. 顔画像（イラストの上に配置）=====
  ctx.save();

  // 白縁＋影
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, FACE_RADIUS + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // 顔画像を円形クリップ
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, FACE_RADIUS, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    faceImage,
    CENTER_X - FACE_RADIUS,
    CENTER_Y - FACE_RADIUS,
    FACE_RADIUS * 2,
    FACE_RADIUS * 2
  );
  ctx.restore();

  // ===== 4. タイトルテキスト（1回だけ）=====
  ctx.save();
  ctx.font = '700 26px "Zen Maru Gothic", sans-serif';
  ctx.fillStyle = '#E07070';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('好きなものに囲まれたい', CENTER_X, CANVAS_SIZE - 35);
  ctx.restore();

  return targetCanvas;
}

const CollageComposer = { compose };
export default CollageComposer;

window.CollageComposer = CollageComposer;
