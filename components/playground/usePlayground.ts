'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SHARE_SAMPLES, WORD_SAMPLE, type Sample } from '@/lib/sample-data';
import { checksumPasses, pageToWords, recoverShares, scanShares, scanWords } from '@/lib/vision/client';
import { shareSample } from '@/lib/vision/share';
import type { PageScan, ScanPhase, ShareScan, WordRead } from '@/lib/vision/types';

export type Mode = 'bip' | 'pen';
export type Status = 'idle' | 'running' | 'done' | 'error';

/** The training-sample question for the current photo. Asked once per photo. */
export interface ShareAsk {
  status: 'ask' | 'sending' | 'sent' | 'declined' | 'error';
  /** The person ticked "these are practice words, not a real backup". */
  practice: boolean;
  id: string | null;
  error: string | null;
}
const ASK: ShareAsk = { status: 'ask', practice: false, id: null, error: null };

export interface PgState {
  mode: Mode;
  status: Status;
  /** What a running scan is doing. */
  phase: ScanPhase | null;
  /** Whose photo is being read: the site's practice sample, or the person's own. */
  source: 'sample' | 'photo';
  photo: string | null;
  photoName: string;
  /** Pixel size the boxes are drawn against. */
  photoSize: { w: number; h: number } | null;
  words: WordRead[];
  /** The scanner's output for the photo, as returned. */
  page: PageScan | null;
  /** The person's choice for a word, by index. */
  picks: Record<number, string>;
  open: number;
  tab: 'words' | 'json';
  mask: boolean;
  error: string | null;
  /** Whether the words as shown pass the BIP39 checksum; null while checking. */
  checksum: boolean | null;
  /** Penlock shares read so far, one per share number. */
  penReads: ShareScan[];
  recovered: string[] | null;
  /** Strips found in the current photo (a sample covers only this photo). */
  photoStrips: ShareScan[];
  share: ShareAsk;
}

const IDLE: Omit<PgState, 'mode'> = {
  status: 'idle', phase: null, source: 'sample', photo: null, photoName: '', photoSize: null,
  words: [], page: null, picks: {}, open: -1, tab: 'words', mask: false, error: null, checksum: null,
  penReads: [], recovered: null, photoStrips: [], share: ASK,
};

export const isFlagged = (s: PgState, i: number) => !s.words[i].accepted && !s.picks[i];
export const unsureCount = (s: PgState) => s.words.filter((_, i) => isFlagged(s, i)).length;
export const finalWords = (s: PgState) => s.words.map((w, i) => s.picks[i] || w.selected);
export const latestShare = (s: PgState) => s.penReads[s.penReads.length - 1];

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const sampleUrl = (sample: Sample) => `${BASE}${sample.path}`;

/** The sample "Run sample" reads next: the page, or the share not yet read. */
export function nextSample(s: PgState): Sample {
  if (s.mode === 'bip') return WORD_SAMPLE;
  const read = s.source === 'sample' ? s.penReads.length : 0;
  return SHARE_SAMPLES[read % SHARE_SAMPLES.length];
}

const LOCATE_ERROR = 'I couldn’t find a Penlock strip. Fit the whole strip, with its black corner squares, flat and in focus.';

export function usePlayground() {
  const [s, setS] = useState<PgState>({ mode: 'bip', ...IDLE });
  /** Bumped on every new run or reset, so a late result from an old scan is dropped. */
  const token = useRef(0);
  /** The person's original file, kept in memory only, for an opt-in share. */
  const photoFile = useRef<File | null>(null);

  const patch = useCallback((p: Partial<PgState>) => setS((prev) => ({ ...prev, ...p })), []);

  /** Free the photo and crop images of a read. */
  const release = (st: PgState) => {
    if (st.photo) URL.revokeObjectURL(st.photo);
    st.words.forEach((w) => w.cropUrl && URL.revokeObjectURL(w.cropUrl));
  };

  const reset = (extra: Partial<PgState> = {}) => {
    token.current++;
    photoFile.current = null;
    release(s);
    setS((p) => ({ ...p, ...IDLE, ...extra }));
  };

  /** The scanner on one photo: the site's sample or the person's own. */
  const scan = async (file: File, source: PgState['source']) => {
    const mine = ++token.current;
    const current = () => token.current === mine;
    const pen = s.mode === 'pen';
    const keep = pen && s.source === source ? s.penReads : [];
    // Only the person's own photo can be offered for training.
    photoFile.current = source === 'photo' ? file : null;
    if (s.photo) URL.revokeObjectURL(s.photo);
    s.words.forEach((w) => w.cropUrl && URL.revokeObjectURL(w.cropUrl));
    patch({
      source, photo: URL.createObjectURL(file), photoName: file.name || 'your-photo', photoSize: null,
      status: 'running', phase: 'reading', error: null, open: -1, picks: {}, checksum: null, tab: 'words',
      words: [], page: null, penReads: keep, recovered: null, photoStrips: [], share: ASK,
    });
    const onPhase = (phase: ScanPhase) => { if (current()) patch({ phase }); };

    try {
      if (!pen) {
        const page = await scanWords(file, onPhase);
        if (!current()) return;
        const words = await pageToWords(page);
        if (!current()) {
          words.forEach((w) => w.cropUrl && URL.revokeObjectURL(w.cropUrl));
          return;
        }
        if (!words.length) throw new Error('I couldn’t find handwritten words. Try a closer, well-lit photo with the whole page in view.');
        patch({ words, page, photoSize: { w: page.width, h: page.height }, status: 'done', phase: null, open: words.findIndex((w) => !w.accepted) });
        return;
      }

      const found = await scanShares(file, onPhase);
      if (!current()) return;
      const strips = found.filter((f) => f.kind === 'share' && f.index);
      if (!strips.length) {
        throw new Error(found.length ? 'That’s the seed strip. Show me a share strip (1, 2 or 3).' : LOCATE_ERROR);
      }
      const byIndex = new Map(keep.map((r) => [r.index, r]));
      strips.forEach((r) => byIndex.set(r.index, r));
      const penReads = [...byIndex.values()];
      patch({ penReads, photoStrips: strips, status: 'done', phase: null });
      if (penReads.length >= 2) {
        const [a, b] = penReads.slice(-2);
        try {
          const recovered = await recoverShares(a.id, b.id);
          if (current()) patch({ recovered });
        } catch (e) {
          if (current()) patch({ error: (e as Error).message });
        }
      }
    } catch (e) {
      if (!current()) return;
      let error = (e as Error).message;
      if (pen && error.startsWith('scan:')) error = LOCATE_ERROR;
      patch({ status: keep.length ? 'done' : 'error', phase: null, error });
    }
  };

  const runSample = async () => {
    if (s.status === 'running') return;
    const sample = nextSample(s);
    const mine = ++token.current;
    try {
      const response = await fetch(sampleUrl(sample));
      if (!response.ok) throw new Error(`The sample photo did not load (${response.status}).`);
      const blob = await response.blob();
      if (token.current === mine) await scan(new File([blob], sample.name, { type: blob.type }), 'sample');
    } catch (e) {
      if (token.current === mine) patch({ status: 'error', phase: null, error: (e as Error).message });
    }
  };

  // Every word has a pick, sure or not, so the phrase as shown can always be checked.
  useEffect(() => {
    if (s.mode !== 'bip' || s.status !== 'done') return;
    let alive = true;
    checksumPasses(finalWords(s)).then((ok) => { if (alive) patch({ checksum: ok }); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.mode, s.status, s.words, s.picks, patch]);

  /** Upload the current photo and its labels, only after the person said yes. */
  const sendSample = async () => {
    const file = photoFile.current;
    if (!file || !s.share.practice || s.share.status === 'sending' || s.share.status === 'sent') return;
    if (s.mode === 'bip' && unsureCount(s) > 0) return;
    const mine = token.current;
    patch({ share: { ...s.share, status: 'sending', error: null } });
    try {
      const id = await shareSample(
        file,
        s.mode === 'bip'
          ? { pipeline: 'bip39', scannedSize: s.photoSize ?? { w: 1, h: 1 }, words: s.words, picks: s.picks, checksumValid: s.checksum }
          : { pipeline: 'penlock', scannedSize: s.photoSize, strips: s.photoStrips, rebuiltWithAnotherShare: !!s.recovered },
      );
      if (token.current === mine) setS((p) => ({ ...p, share: { ...p.share, status: 'sent', id } }));
    } catch (e) {
      if (token.current === mine) setS((p) => ({ ...p, share: { ...p.share, status: 'error', error: (e as Error).message } }));
    }
  };

  const actions = {
    setMode: (mode: Mode) => { if (mode !== s.mode) reset({ mode }); },
    run: runSample,
    scanPhoto: (file: File) => scan(file, 'photo'),
    forget: () => reset(),
    toggleRow: (i: number) => patch({ open: s.open === i ? -1 : i }),
    pickWord: (i: number, word: string) => setS((p) => ({ ...p, picks: { ...p.picks, [i]: word }, open: -1 })),
    setTab: (tab: PgState['tab']) => patch({ tab }),
    toggleMask: () => setS((p) => ({ ...p, mask: !p.mask })),
    setPractice: (practice: boolean) => setS((p) => ({ ...p, share: { ...p.share, practice } })),
    declineSample: () => setS((p) => ({ ...p, share: { ...p.share, status: 'declined' } })),
    sendSample,
    photoLoaded: (w: number, h: number) => setS((p) => (p.photoSize ? p : { ...p, photoSize: { w, h } })),
  };

  return { s, actions };
}

export type PgActions = ReturnType<typeof usePlayground>['actions'];
