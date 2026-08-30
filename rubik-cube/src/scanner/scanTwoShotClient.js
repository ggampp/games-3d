import { reconstructFromTwoShotReadings } from './twoShotReconstructor.js';
import { EXAMPLE_TWO_SHOT_READINGS } from './exampleTwoShotReadings.js';

export async function fetchVisionStatus() {
  try {
    const res = await fetch('/api/scan-status');
    if (!res.ok) return { vision: false };
    return await res.json();
  } catch {
    return { vision: false };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
    img.src = src;
  });
}

export async function imageSourceToDataUrl(src, maxSize = 1280) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export async function analyzeTwoShotPhotos(image1Src, image2Src, { allowExampleFixture = false } = {}) {
  const status = await fetchVisionStatus();

  if (status.vision) {
    const [image1, image2] = await Promise.all([
      imageSourceToDataUrl(image1Src),
      imageSourceToDataUrl(image2Src)
    ]);
    const res = await fetch('/api/scan-two-shots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image1, image2 })
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error || 'Falha ao analisar as fotos.');
    }
    const result = reconstructFromTwoShotReadings(payload.readings);
    result.source = 'vision';
    result.provider = payload.provider || status.provider || 'openrouter';
    result.model = payload.model || status.model || '';
    return result;
  }

  if (allowExampleFixture) {
    const result = reconstructFromTwoShotReadings(EXAMPLE_TWO_SHOT_READINGS);
    result.source = 'example-fixture';
    result.warnings = [
      'Modo Exemplo (sem chave de API ativa). Para fotos novas, configure OPENROUTER_API_KEY no .env.',
      ...(result.warnings || [])
    ];
    return result;
  }

  throw new Error(
    'Para analisar fotos novas com IA, defina OPENROUTER_API_KEY no arquivo .env.'
  );
}
