/* ========================================
   メインアプリロジック・状態管理
   テキスト描画はcollage-composer.js内のみで行う
   ======================================== */

import PersonSegmenter from './person-segmenter.js';
import ImageGenerator from './image-generator.js';
import CollageComposer from './collage-composer.js';
import Share from './share.js';

(() => {
  // 状態
  let portraitCanvas = null;   // 円形ポートレート（背景透明）
  const favorites = new Array(8).fill('');

  // DOM
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const facePreview = document.getElementById('facePreview');
  const faceCanvasEl = document.getElementById('faceCanvas');
  const faceMessage = document.getElementById('faceMessage');
  const btnUseFace = document.getElementById('btnUseFace');
  const btnRetake = document.getElementById('btnRetake');
  const inputCount = document.getElementById('inputCount');
  const btnGenerate = document.getElementById('btnGenerate');
  const progressArea = document.getElementById('progressArea');
  const progressText = document.getElementById('progressText');
  const progressItems = document.getElementById('progressItems');
  const previewArea = document.getElementById('previewArea');
  const collageCanvas = document.getElementById('collageCanvas');
  const btnDownload = document.getElementById('btnDownload');
  const btnShare = document.getElementById('btnShare');
  const btnRetry = document.getElementById('btnRetry');
  const favoriteInputs = document.querySelectorAll('.favorite-input');

  // === STEP 1: 写真アップロード ===
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      showFaceError('JPEG、PNG画像をお使いください');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => detectPerson(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function detectPerson(img) {
    facePreview.hidden = false;
    btnUseFace.hidden = true;
    btnRetake.hidden = true;
    faceMessage.className = 'face-message';
    faceMessage.textContent = '人物を検出しています...';

    try {
      const portrait = await PersonSegmenter.createPortrait(img);
      if (!portrait) {
        showFaceError('人物が見つかりませんでした。人物がはっきり写った写真をお使いください');
        return;
      }

      portraitCanvas = portrait;
      PersonSegmenter.drawPreview(faceCanvasEl, portraitCanvas);
      faceMessage.textContent = 'きれいに切り抜けました!';
      btnUseFace.hidden = false;
      btnRetake.hidden = false;
    } catch (e) {
      console.error('[App] Detection error:', e);
      showFaceError('画像処理中にエラーが発生しました。ページを再読み込みしてお試しください');
    }
  }

  function showFaceError(msg) {
    facePreview.hidden = false;
    faceMessage.className = 'face-message error';
    faceMessage.textContent = msg;
    btnUseFace.hidden = true;
    btnRetake.hidden = false;
    const ctx = faceCanvasEl.getContext('2d');
    faceCanvasEl.width = 200;
    faceCanvasEl.height = 200;
    ctx.clearRect(0, 0, 200, 200);
  }

  btnUseFace.addEventListener('click', () => {
    activateStep(2);
    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  btnRetake.addEventListener('click', () => {
    portraitCanvas = null;
    facePreview.hidden = true;
    fileInput.value = '';
  });

  // === STEP 2: 好きなもの入力 ===
  favoriteInputs.forEach((input) => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.index);
      favorites[idx] = input.value.trim();
      updateInputCount();
    });
  });

  function updateInputCount() {
    const count = favorites.filter(f => f.length > 0).length;
    inputCount.textContent = count;
    btnGenerate.disabled = count < 8;
  }

  // === STEP 3: 生成 ===
  btnGenerate.addEventListener('click', startGeneration);

  async function startGeneration() {
    activateStep(3);
    step3.scrollIntoView({ behavior: 'smooth', block: 'start' });

    progressArea.hidden = false;
    previewArea.hidden = true;

    // 進捗アイテム生成
    progressItems.innerHTML = '';
    favorites.forEach((item, i) => {
      const el = document.createElement('span');
      el.className = 'progress-item';
      el.textContent = item;
      el.id = `progress-${i}`;
      progressItems.appendChild(el);
    });

    progressText.textContent = 'イラストを生成しています...';

    // イラスト8枚を並列読み込み（fetch+blob方式）
    const images = await ImageGenerator.loadAllIllustrations(favorites, (i, status) => {
      const el = document.getElementById(`progress-${i}`);
      if (!el) return;
      el.className = `progress-item ${status}`;
      if (status === 'loading') {
        progressText.textContent = `${favorites[i]} を描いています...`;
      }
    });

    progressText.textContent = 'コラージュを合成しています...';
    await new Promise(r => setTimeout(r, 300));

    // コラージュ合成（テキスト描画はcomposeCollage内のみ）
    CollageComposer.compose(collageCanvas, portraitCanvas, images, favorites);

    progressArea.hidden = true;
    previewArea.hidden = false;
  }

  // === シェア・ダウンロード ===
  btnDownload.addEventListener('click', () => Share.downloadPNG(collageCanvas));
  btnShare.addEventListener('click', () => Share.share(collageCanvas));

  btnRetry.addEventListener('click', () => {
    activateStep(2);
    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    progressArea.hidden = true;
    previewArea.hidden = true;
  });

  // === ステップ管理 ===
  function activateStep(num) {
    [step1, step2, step3].forEach((s, i) => {
      s.classList.toggle('step--active', i < num);
    });
  }
})();
