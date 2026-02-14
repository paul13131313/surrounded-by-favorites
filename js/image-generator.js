/* ========================================
   Pollinations.ai イラスト生成 + 背景除去
   ======================================== */

const ImageGenerator = (() => {
  const TIMEOUT_MS = 45000;

  function buildUrl(item) {
    const prompt = encodeURIComponent(
      `cute kawaii illustration of ${item}, flat design, pastel colors, solid white background, sticker style, no text, simple, cheerful, centered, single object`
    );
    return `https://gen.pollinations.ai/image/${prompt}?model=flux&nologo=true&nofeed=true`;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => {
        img.src = '';
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('load failed'));
      };
      img.src = url;
    });
  }

  /**
   * 四隅からのflood fill方式で白背景を透過にする
   * イラスト内部のパステル色は保護される
   */
  function removeWhiteBackground(img) {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const w = size, h = size;

    // visited配列
    const visited = new Uint8Array(w * h);
    // 透過対象配列
    const toRemove = new Uint8Array(w * h);

    // 背景色判定：明るくて彩度が低い
    function isBgLike(idx) {
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      return brightness > 220 && saturation < 50;
    }

    // BFS flood fill（四隅から）
    function floodFill(startX, startY) {
      const queue = [[startX, startY]];
      const startIdx = (startY * w + startX) * 4;
      if (!isBgLike(startIdx)) return;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        const pos = cy * w + cx;
        if (visited[pos]) continue;
        visited[pos] = 1;

        const idx = pos * 4;
        if (!isBgLike(idx)) continue;

        toRemove[pos] = 1;

        // 4方向
        if (cx > 0) queue.push([cx - 1, cy]);
        if (cx < w - 1) queue.push([cx + 1, cy]);
        if (cy > 0) queue.push([cx, cy - 1]);
        if (cy < h - 1) queue.push([cx, cy + 1]);
      }
    }

    // 四隅からflood fill
    floodFill(0, 0);
    floodFill(w - 1, 0);
    floodFill(0, h - 1);
    floodFill(w - 1, h - 1);
    // 四辺の中央からも
    floodFill(Math.floor(w / 2), 0);
    floodFill(Math.floor(w / 2), h - 1);
    floodFill(0, Math.floor(h / 2));
    floodFill(w - 1, Math.floor(h / 2));

    // 透過適用（エッジにソフトアルファ）
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pos = y * w + x;
        if (toRemove[pos]) {
          // エッジ付近をチェック（非除去ピクセルとの距離）
          let minDist = 999;
          const checkR = 3;
          for (let dy = -checkR; dy <= checkR; dy++) {
            for (let dx = -checkR; dx <= checkR; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const npos = ny * w + nx;
                if (!toRemove[npos]) {
                  const d = Math.sqrt(dx * dx + dy * dy);
                  if (d < minDist) minDist = d;
                }
              }
            }
          }
          const idx = pos * 4;
          if (minDist <= checkR) {
            // エッジ付近：ソフトアルファ
            data[idx + 3] = Math.round(255 * (1 - minDist / (checkR + 1)));
          } else {
            data[idx + 3] = 0;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const resultImg = new Image();
    resultImg.src = canvas.toDataURL('image/png');
    return new Promise(resolve => {
      resultImg.onload = () => resolve(resultImg);
    });
  }

  function createFallbackImage(item) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const colors = [
      '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA',
      '#E8BAFF', '#FFDFBA', '#C9BAFF', '#BAFFEE'
    ];
    const bg = colors[Math.floor(Math.random() * colors.length)];

    // パステル色の円形ブロブ
    ctx.save();
    ctx.beginPath();
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.fillStyle = '#4a3728';
    ctx.font = "bold 52px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item, 256, 256);

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    return new Promise(resolve => { img.onload = () => resolve(img); });
  }

  async function generateOne(item, onProgress) {
    if (onProgress) onProgress('loading');
    try {
      const url = buildUrl(item);
      const img = await loadImage(url);
      const cut = await removeWhiteBackground(img);
      if (onProgress) onProgress('done');
      return cut;
    } catch (e) {
      try {
        // リトライ
        const url2 = buildUrl(item);
        const img = await loadImage(url2);
        const cut = await removeWhiteBackground(img);
        if (onProgress) onProgress('done');
        return cut;
      } catch (e2) {
        if (onProgress) onProgress('error');
        return createFallbackImage(item);
      }
    }
  }

  async function generateAll(items, onItemProgress) {
    const results = await Promise.all(
      items.map((item, i) =>
        generateOne(item, (status) => {
          if (onItemProgress) onItemProgress(i, status);
        })
      )
    );
    return results;
  }

  return { generateAll, generateOne, createFallbackImage };
})();
