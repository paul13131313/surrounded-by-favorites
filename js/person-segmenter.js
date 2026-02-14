/* ========================================
   人物セグメンテーション (MediaPipe Selfie Segmenter)
   ピクセルレベルで人物を切り抜き、背景を完全除去する
   ======================================== */

import { ImageSegmenter, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm';

let imageSegmenter = null;

async function initSegmenter() {
  if (imageSegmenter) return;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      delegate: 'GPU'
    },
    outputCategoryMask: true,
    outputConfidenceMask: true,
    runningMode: 'IMAGE'
  });
}

/**
 * 写真から人物だけを切り抜く（背景完全除去）
 * @param {HTMLImageElement} sourceImage - 元画像
 * @returns {HTMLCanvasElement} - 背景透明の人物画像
 */
async function segmentPerson(sourceImage) {
  if (!imageSegmenter) await initSegmenter();

  // 処理用Canvasに元画像を描画
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sourceImage.naturalWidth || sourceImage.width;
  tempCanvas.height = sourceImage.naturalHeight || sourceImage.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(sourceImage, 0, 0);

  // セグメンテーション実行
  const result = imageSegmenter.segment(tempCanvas);

  // 信頼度マスクを取得（各ピクセルが人物である確率 0.0〜1.0）
  const confidenceMask = result.confidenceMasks[0];
  const maskData = confidenceMask.getAsFloat32Array();

  // 元画像のピクセルデータを取得
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const pixels = imageData.data;

  // 信頼度マスクを使って背景を透明にする
  for (let i = 0; i < maskData.length; i++) {
    const confidence = maskData[i];
    // alpha値を信頼度に応じて設定（境界がなめらかになる）
    pixels[i * 4 + 3] = Math.round(confidence * 255);
  }

  tempCtx.putImageData(imageData, 0, 0);

  // リソース解放
  confidenceMask.close();

  return tempCanvas;
}

/**
 * 不透明ピクセルのバウンディングボックスを計算
 */
function findPersonBounds(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  let minX = canvas.width, minY = canvas.height;
  let maxX = 0, maxY = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 30) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * セグメント済みの人物画像をきれいにクロップ
 * 人物部分だけを切り出し、適度な余白をつけて返す
 * @param {HTMLCanvasElement} segmentedCanvas - 背景透明の人物画像
 * @returns {HTMLCanvasElement} - クロップ済みのCanvas
 */
function cropPerson(segmentedCanvas) {
  const bounds = findPersonBounds(segmentedCanvas);

  // 人物が見つからなかった場合はそのまま返す
  if (bounds.width <= 0 || bounds.height <= 0) {
    return segmentedCanvas;
  }

  // 余白を少し追加（10%）
  const margin = Math.max(bounds.width, bounds.height) * 0.1;
  const cropX = Math.max(0, bounds.x - margin);
  const cropY = Math.max(0, bounds.y - margin);
  const cropW = Math.min(segmentedCanvas.width - cropX, bounds.width + margin * 2);
  const cropH = Math.min(segmentedCanvas.height - cropY, bounds.height + margin * 2);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = cropW;
  outputCanvas.height = cropH;
  const ctx = outputCanvas.getContext('2d');
  ctx.drawImage(
    segmentedCanvas,
    cropX, cropY, cropW, cropH,
    0, 0, cropW, cropH
  );

  return outputCanvas;
}

/**
 * プレビュー用：切り抜いた人物を表示
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

/**
 * メイン処理：画像から人物を検出し切り抜く
 * @param {HTMLImageElement} imageElement - 元画像
 * @returns {object|null} - { segmentedCanvas, croppedCanvas, bounds } or null
 */
async function detect(imageElement) {
  try {
    const segmented = await segmentPerson(imageElement);
    const bounds = findPersonBounds(segmented);

    // 人物が画像の5%以下なら検出失敗とする
    const imageArea = segmented.width * segmented.height;
    const personArea = bounds.width * bounds.height;
    if (personArea / imageArea < 0.05) {
      return null;
    }

    const cropped = cropPerson(segmented);

    return {
      segmentedCanvas: segmented,
      croppedCanvas: cropped,
      bounds: bounds
    };
  } catch (e) {
    console.error('[PersonSegmenter] Error:', e);
    throw e;
  }
}

const PersonSegmenter = { detect, drawPreview, segmentPerson, cropPerson, findPersonBounds };
export default PersonSegmenter;

// グローバルにも公開（非モジュールからのアクセス用）
window.PersonSegmenter = PersonSegmenter;
