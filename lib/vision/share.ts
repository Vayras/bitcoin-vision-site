'use client';

import type { Point, ShareScan, WordRead } from './types';

/**
 * Opt-in training samples. Nothing here runs unless the person presses
 * "Share this sample"; scanning itself never touches the network.
 *
 * The upload goes to upload-worker/ (a Cloudflare Worker in front of a
 * private R2 bucket). Without NEXT_PUBLIC_SAMPLE_UPLOAD_URL the prompt is
 * not shown at all.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_SAMPLE_UPLOAD_URL ?? '';
export const sharingEnabled = ENDPOINT !== '';

const MAX_SIDE = 4096;

/**
 * Redraws the photo upright as a fresh JPEG. Drawing to a canvas drops all
 * EXIF metadata (GPS location, device, time), so none of it is uploaded.
 */
async function cleanJpeg(photo: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 }), width, height };
}

const scaleQuad = (q: Point[] | undefined, k: number) => q?.map(([x, y]) => [Math.round(x * k * 10) / 10, Math.round(y * k * 10) / 10]);

export type SampleLabels =
  | {
      pipeline: 'bip39';
      /** Pixel size the word boxes are measured in (the scanned photo). */
      scannedSize: { w: number; h: number };
      words: WordRead[];
      picks: Record<number, string>;
      checksumValid: boolean | null;
    }
  | {
      pipeline: 'penlock';
      scannedSize: { w: number; h: number } | null;
      strips: ShareScan[];
      /** Whether these rows, with another share, rebuilt a phrase that passes the checksum. */
      rebuiltWithAnotherShare: boolean;
    };

/** Uploads one consented sample; resolves to its id. */
export async function shareSample(photo: Blob, labels: SampleLabels): Promise<string> {
  if (!sharingEnabled) throw new Error('Sharing isn’t set up on this site.');
  const { blob, width, height } = await cleanJpeg(photo);
  const k = labels.scannedSize ? width / labels.scannedSize.w : 1;

  const common = {
    version: 1,
    pipeline: labels.pipeline,
    consent: { training: true, practiceOnly: true, at: new Date().toISOString() },
    image: { width, height },
  };
  const meta =
    labels.pipeline === 'bip39'
      ? {
          ...common,
          checksumValid: labels.checksumValid,
          words: labels.words.map((w, i) => ({
            index: i + 1,
            /** What the text recogniser read off the paper. */
            ocr: w.ocr,
            /** The word the model chose. */
            model: w.selected,
            accepted: w.accepted,
            /** The person's explicit choice, when they made one. */
            picked: labels.picks[i] ?? null,
            /** Best label: the person's choice, else the model's word they left as it was. */
            label: labels.picks[i] || w.selected,
            /** The pick, then the alternatives, each with the scanner's chance. */
            candidates: w.candidates.map((c) => [c.word, c.confidence]),
            quad: scaleQuad(w.quad, k),
          })),
        }
      : {
          ...common,
          rebuiltWithAnotherShare: labels.rebuiltWithAnotherShare,
          strips: labels.strips.map((s) => ({
            share: s.index,
            quad: scaleQuad(s.quad, k),
            rows: s.rows.map((row) => row.map((c) => ({ symbol: c.symbol, p: c.probability, unread: c.unread }))),
          })),
        };

  const body = new FormData();
  body.append('photo', blob, 'sample.jpg');
  body.append('meta', JSON.stringify(meta));
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', body });
  } catch {
    throw new Error('Couldn’t reach the sample server. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? `The sample server answered ${res.status}.`);
  return data.id;
}
