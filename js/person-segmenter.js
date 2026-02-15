/**
 * person-segmenter.js
 * MediaPipe Selfie Segmenter を使って人物を背景から分離する
 */

import { ImageSegmenter, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm';

let segmenter = null;

async function initSegmenter() {
  if (segmenter) return;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      delegate: 'GPU',
    },
    outputCategoryMask: false,
    outputConfidenceMask: true,
    runningMode: 'IMAGE',
  });
}

/**
 * 人物を切り抜いて円形ポートレートを返す
 * @param {HTMLImageElement} photo - アップロードされた写真
 * @returns {Promise<HTMLCanvasElement>} - 円形の人物画像（背景透明）
 */
async function createPortrait(photo) {
  if (!segmenter) await initSegmenter();

  // --- 処理用Canvasに写真を描画 ---
  const srcCanvas = document.createElement('canvas');
  const maxDim = 1024;
  let w = photo.naturalWidth || photo.width;
  let h = photo.naturalHeight || photo.height;
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(photo, 0, 0, w, h);

  // --- セグメンテーション実行 ---
  const result = segmenter.segment(srcCanvas);
  const mask = result.confidenceMasks[0].getAsFloat32Array();

  // --- 背景を透明にする ---
  const imageData = srcCtx.getImageData(0, 0, w, h);
  const px = imageData.data;
  for (let i = 0; i < mask.length; i++) {
    px[i * 4 + 3] = Math.round(mask[i] * 255); // alpha = 信頼度
  }
  srcCtx.putImageData(imageData, 0, 0);

  // リソース解放
  result.confidenceMasks[0].close();

  // --- 人物領域のバウンディングボックス ---
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 30) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bw = maxX - minX;
  const bh = maxY - minY;

  // 人物が見つからない場合
  if (bw <= 0 || bh <= 0) {
    return null;
  }

  // 人物が画像の5%以下なら検出失敗とする
  const imageArea = w * h;
  const personArea = bw * bh;
  if (personArea / imageArea < 0.05) {
    return null;
  }

  // --- 顔を中心に正方形クロップ ---
  const faceCX = minX + bw / 2;
  const faceCY = minY + bh * 0.28; // 顔は上寄り
  const cropSize = Math.max(bw, bh * 0.65) * 1.15;

  // --- 円形ポートレートを生成 ---
  const outSize = 600;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outSize;
  outCanvas.height = outSize;
  const outCtx = outCanvas.getContext('2d');

  outCtx.beginPath();
  outCtx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
  outCtx.clip();

  outCtx.drawImage(
    srcCanvas,
    faceCX - cropSize / 2, faceCY - cropSize / 2, cropSize, cropSize,
    0, 0, outSize, outSize
  );

  return outCanvas;
}

/**
 * プレビュー用：ポートレートを表示
 */
function drawPreview(targetCanvas, portraitCanvas, displaySize = 200) {
  targetCanvas.width = displaySize;
  targetCanvas.height = displaySize;
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, displaySize, displaySize);
  ctx.drawImage(portraitCanvas, 0, 0, displaySize, displaySize);
}

const PersonSegmenter = { createPortrait, drawPreview };
export default PersonSegmenter;

window.PersonSegmenter = PersonSegmenter;
