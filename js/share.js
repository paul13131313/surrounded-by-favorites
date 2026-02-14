/* ========================================
   ダウンロード & SNSシェア
   ======================================== */

function downloadPNG(canvas) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'surrounded-by-favorites.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

async function share(canvas) {
  if (!navigator.canShare) {
    downloadPNG(canvas);
    return;
  }
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'surrounded-by-favorites.png', { type: 'image/png' });
    const shareData = {
      title: '好きなものに囲まれたい',
      text: '好きなもの8つに囲まれた、わたしのコラージュ!',
      files: [file],
    };
    if (navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      downloadPNG(canvas);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      downloadPNG(canvas);
    }
  }
}

const Share = { downloadPNG, share };
export default Share;

window.Share = Share;
