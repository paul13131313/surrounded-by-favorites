/**
 * image-generator.js
 * Pollinations.ai からイラストを取得する
 *
 * fetch+blob方式を使う（CORS問題の完全回避）
 */

function buildPrompt(item) {
  return `cute kawaii illustration of ${item}, flat design, pastel colors, white background, sticker style, no text, simple and cheerful, digital art`;
}

function buildUrl(item) {
  const prompt = encodeURIComponent(buildPrompt(item));
  const seed = Math.floor(Math.random() * 100000);
  return `https://gen.pollinations.ai/image/${prompt}?model=flux&nologo=true&nofeed=true&seed=${seed}`;
}

/**
 * 1枚のイラストを読み込む（fetch + blob URL方式）
 * この方式ならCORS問題が起きない
 */
function loadSingleImage(item) {
  return new Promise((resolve, reject) => {
    const url = buildUrl(item);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    fetch(url, { signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Image decode failed'));
        };
        img.src = objectUrl;
      })
      .catch(err => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

/**
 * 1枚のイラストをリトライ付きで読み込む
 */
async function loadImageWithRetry(item, maxRetries = 2) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[${attempt + 1}/${maxRetries}] Loading: ${item}`);
      const img = await loadSingleImage(item);
      console.log(`Loaded: ${item}`);
      return img;
    } catch (err) {
      console.warn(`Failed (attempt ${attempt + 1}): ${item}`, err.message);
      if (attempt === maxRetries - 1) {
        console.warn(`Fallback for: ${item}`);
        return createFallbackImage(item);
      }
      // リトライ前に少し待つ
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * 8枚すべてを並列読み込み
 * @param {string[]} items - 8つのアイテム名
 * @param {function} onProgress - 進捗コールバック (index, status) => void
 * @returns {HTMLImageElement[]} - 8枚の画像配列
 */
async function loadAllIllustrations(items, onProgress) {
  const promises = items.map(async (item, index) => {
    if (onProgress) onProgress(index, 'loading');
    const img = await loadImageWithRetry(item);
    if (onProgress) onProgress(index, 'done');
    return img;
  });
  return Promise.all(promises);
}

/**
 * フォールバック画像（Pollinations失敗時）
 */
function createFallbackImage(item) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const palettes = [
    { bg: '#FFE5E5', fg: '#D4636F' },
    { bg: '#E5F0FF', fg: '#5B8FD4' },
    { bg: '#FFF3E0', fg: '#D4955B' },
    { bg: '#E8F5E9', fg: '#5BAD6D' },
    { bg: '#F3E5F5', fg: '#A35BB5' },
    { bg: '#FFF8E1', fg: '#C9A83E' },
    { bg: '#E0F7FA', fg: '#4BA3B5' },
    { bg: '#FCE4EC', fg: '#C95B83' },
  ];
  const p = palettes[Math.floor(Math.random() * palettes.length)];

  // 角丸背景
  const r = 40;
  ctx.fillStyle = p.bg;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size); ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath(); ctx.fill();

  // ドット装飾
  ctx.fillStyle = p.fg + '20';
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 25 + 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // テキスト
  ctx.fillStyle = p.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 48;
  ctx.font = `bold ${fontSize}px "Zen Maru Gothic", sans-serif`;
  while (ctx.measureText(item).width > size - 60 && fontSize > 20) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px "Zen Maru Gothic", sans-serif`;
  }
  ctx.fillText(item, size / 2, size / 2);

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

const ImageGenerator = { loadAllIllustrations, loadImageWithRetry, createFallbackImage };
export default ImageGenerator;

window.ImageGenerator = ImageGenerator;
