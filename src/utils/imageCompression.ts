export interface CompressedTicketImage {
  id: string;
  name: string;
  dataUrl: string;
  sizeBytes: number;
  uploadedAt: string;
}

const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024; // 15 MB raw upload cap
const MAX_DIMENSION_PX = 1200;
const TARGET_MAX_DATAURL_CHARS = 220_000; // ~165 KB binary per image so 3 images stay well under Firestore 1 MiB doc limit

export function isSafeImageSrc(src?: string): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  if (/^https:\/\/[^\s"'<>]+$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export async function compressTicketImageFile(file: File): Promise<CompressedTicketImage> {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" is not a supported image file.`);
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 15 MB upload limit.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Unable to read image "${file.name}".`));
      el.src = objectUrl;
    });

    const naturalW = img.naturalWidth || img.width || 1;
    const naturalH = img.naturalHeight || img.height || 1;

    let scale = Math.min(1, MAX_DIMENSION_PX / Math.max(naturalW, naturalH));
    let dataUrl = '';

    // Try progressive quality & scale passes until safely below Firestore budget
    const qualitySteps = [0.78, 0.66, 0.54, 0.42];
    for (let pass = 0; pass < 2 && (!dataUrl || dataUrl.length > TARGET_MAX_DATAURL_CHARS); pass++) {
      const targetW = Math.max(1, Math.round(naturalW * scale));
      const targetH = Math.max(1, Math.round(naturalH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser canvas is unavailable for image processing.');
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      for (const quality of qualitySteps) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= TARGET_MAX_DATAURL_CHARS) break;
      }

      if (dataUrl.length > TARGET_MAX_DATAURL_CHARS) {
        scale = scale * 0.72;
      }
    }

    if (!isSafeImageSrc(dataUrl)) {
      throw new Error(`Processed image "${file.name}" could not be encoded safely.`);
    }

    const base64Part = dataUrl.split(',')[1] || '';
    const approxBytes = Math.round((base64Part.length * 3) / 4);

    return {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: (file.name || 'ticket-photo.jpg').slice(0, 100),
      dataUrl,
      sizeBytes: approxBytes,
      uploadedAt: new Date().toISOString(),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
