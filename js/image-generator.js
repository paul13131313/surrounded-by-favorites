/* ========================================
   Pollinations.ai イラスト生成 + 背景除去
   ======================================== */

const ImageGenerator = (() => {
  const TIMEOUT_MS = 40000;

  function buildUrl(item) {
    const prompt = encodeURIComponent(
      `cute kawaii illustration of ${item}, flat design, pastel colors, solid white background, sticker style, no text, simple, cheerful, centered, single object`
    );
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&seed=${seed}`;
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
   * 白背景を透過にする（ステッカー切り抜き風）
   * 白〜薄グレー領域をアルファ0にし、エッジをソフトに
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
    const threshold = 235;
    const softRange = 20;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      if (brightness > threshold && saturation < 40) {
        data[i + 3] = 0;
      } else if (brightness > (threshold - softRange) && saturation < 60) {
        const factor = (threshold - brightness) / softRange;
        data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, factor)));
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

    // 透過背景のカード
    const colors = [
      '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA',
      '#E8BAFF', '#FFDFBA', '#C9BAFF', '#BAFFEE'
    ];
    const bg = colors[Math.floor(Math.random() * colors.length)];

    // 不定形ブロブを描画
    ctx.save();
    ctx.translate(256, 256);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const r = 180 + Math.sin(a * 3) * 30 + Math.cos(a * 5) * 20;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.85;
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
