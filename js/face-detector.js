/* ========================================
   顔検出 & 円形切り抜き (face-api.js)
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
    const size = Math.max(box.width, box.height);
    const padding = size * 0.2;
    const cropSize = size + padding * 2;

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    let x = cx - cropSize / 2;
    let y = cy - cropSize / 2;

    x = Math.max(0, Math.min(x, resized.width - cropSize));
    y = Math.max(0, Math.min(y, resized.height - cropSize));
    const finalSize = Math.min(cropSize, resized.width - x, resized.height - y);

    return { canvas: resized, x, y, size: finalSize };
  }

  function drawCircularCrop(targetCanvas, sourceCanvas, crop, displaySize = 200) {
    targetCanvas.width = displaySize;
    targetCanvas.height = displaySize;
    const ctx = targetCanvas.getContext('2d');

    ctx.clearRect(0, 0, displaySize, displaySize);
    ctx.save();
    ctx.beginPath();
    ctx.arc(displaySize / 2, displaySize / 2, displaySize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      sourceCanvas,
      crop.x, crop.y, crop.size, crop.size,
      0, 0, displaySize, displaySize
    );
    ctx.restore();
  }

  function getCroppedFaceCanvas(sourceCanvas, crop, outputSize = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      sourceCanvas,
      crop.x, crop.y, crop.size, crop.size,
      0, 0, outputSize, outputSize
    );
    return canvas;
  }

  return { detect, drawCircularCrop, getCroppedFaceCanvas };
})();
