/* ========================================
   顔検出 & 人物シルエット切り抜き (face-api.js)
   ======================================== */

const FaceDetector = (() => {
  let modelsLoaded = false;

  async function loadModels() {
    if (modelsLoaded) return;
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  }

  function resizeImage(img, maxSize = 2048) {
    const canvas = document.createElement('canvas');
    let { width, height } = img;
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  }

  async function detect(imageElement) {
    await loadModels();
    const resized = resizeImage(imageElement);
    const detection = await faceapi.detectSingleFace(
      resized,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );
    if (!detection) return null;

    const box = detection.box;
    // 顔の位置から人物全体の領域を推定
    const faceW = box.width;
    const faceH = box.height;
    const faceCx = box.x + faceW / 2;
    const faceCy = box.y + faceH / 2;

    // 人物領域：顔の幅の5倍、高さの7倍（四隅に背景が十分入るように広めにクロップ）
    const personW = faceW * 5;
    const personH = faceH * 7;
    let cropX = faceCx - personW / 2;
    let cropY = faceCy - faceH * 1.5; // 顔の上に余裕
    let cropW = personW;
    let cropH = personH;

    // 画像内に収める
    cropX = Math.max(0, cropX);
    cropY = Math.max(0, cropY);
    cropW = Math.min(cropW, resized.width - cropX);
    cropH = Math.min(cropH, resized.height - cropY);

    return {
      canvas: resized,
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
      faceBox: box
    };
  }

  /**
   * 人物のシルエットを切り抜き（背景除去）
   * 外周ボーダーストリップから背景色をサンプリングし、flood fillで背景を透過にする
   */
  function removeBackground(sourceCanvas, crop) {
    const outputW = 512;
    const outputH = Math.round(512 * (crop.height / crop.width));

    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      sourceCanvas,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, outputW, outputH
    );

    const imageData = ctx.getImageData(0, 0, outputW, outputH);
    const data = imageData.data;
    const w = outputW, h = outputH;

    // 外周ボーダーストリップ（5px幅）からピクセルをサンプリングして最頻背景色を推定
    const borderWidth = 5;
    const colorBuckets = {};

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 外周5pxのみ
        if (x >= borderWidth && x < w - borderWidth && y >= borderWidth && y < h - borderWidth) continue;
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        // 8刻みでバケット化（色のノイズを吸収）
        const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
        colorBuckets[key] = (colorBuckets[key] || 0) + 1;
      }
    }

    // 最頻色を背景色とする
    let maxCount = 0;
    let bgKey = '255,255,255';
    for (const key in colorBuckets) {
      if (colorBuckets[key] > maxCount) {
        maxCount = colorBuckets[key];
        bgKey = key;
      }
    }
    const [bgR, bgG, bgB] = bgKey.split(',').map(Number);

    // 背景色との類似度判定
    function isBgColor(idx) {
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const diff = Math.sqrt(
        (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
      );
      return diff < 55;
    }

    const visited = new Uint8Array(w * h);
    const toRemove = new Uint8Array(w * h);

    // BFS flood fill（インデックスベース）
    function floodFill(startX, startY) {
      const startIdx = (startY * w + startX) * 4;
      if (!isBgColor(startIdx)) return;

      const queue = [startX, startY];
      let head = 0;

      while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const pos = cy * w + cx;
        if (visited[pos]) continue;
        visited[pos] = 1;

        const idx = pos * 4;
        if (!isBgColor(idx)) continue;

        toRemove[pos] = 1;

        if (cx > 0) { queue.push(cx - 1, cy); }
        if (cx < w - 1) { queue.push(cx + 1, cy); }
        if (cy > 0) { queue.push(cx, cy - 1); }
        if (cy < h - 1) { queue.push(cx, cy + 1); }
      }
    }

    // 四隅 + 四辺中央からflood fill
    floodFill(0, 0);
    floodFill(w - 1, 0);
    floodFill(0, h - 1);
    floodFill(w - 1, h - 1);
    floodFill(Math.floor(w / 2), 0);
    floodFill(Math.floor(w / 2), h - 1);
    floodFill(0, Math.floor(h / 2));
    floodFill(w - 1, Math.floor(h / 2));

    // エッジソフトアルファ
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pos = y * w + x;
        if (toRemove[pos]) {
          let minDist = 999;
          const checkR = 4;
          for (let dy = -checkR; dy <= checkR; dy++) {
            for (let dx = -checkR; dx <= checkR; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                if (!toRemove[ny * w + nx]) {
                  const d = Math.sqrt(dx * dx + dy * dy);
                  if (d < minDist) minDist = d;
                }
              }
            }
          }
          const idx = pos * 4;
          if (minDist <= checkR) {
            data[idx + 3] = Math.round(255 * (1 - minDist / (checkR + 1)));
          } else {
            data[idx + 3] = 0;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * プレビュー用：切り抜いた人物をそのまま表示
   */
  function drawPreview(targetCanvas, cutoutCanvas, displayWidth = 200) {
    const ratio = cutoutCanvas.height / cutoutCanvas.width;
    const displayHeight = Math.round(displayWidth * ratio);
    targetCanvas.width = displayWidth;
    targetCanvas.height = displayHeight;
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(cutoutCanvas, 0, 0, displayWidth, displayHeight);
  }

  // 後方互換
  function drawCircularCrop(targetCanvas, sourceCanvas, crop, displaySize = 200) {
    const cutout = removeBackground(sourceCanvas, crop);
    drawPreview(targetCanvas, cutout, displaySize);
  }

  function getCroppedFaceCanvas(sourceCanvas, crop, outputSize = 512) {
    return removeBackground(sourceCanvas, crop);
  }

  return { detect, drawCircularCrop, drawPreview, removeBackground, getCroppedFaceCanvas };
})();
