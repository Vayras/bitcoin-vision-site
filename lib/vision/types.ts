/**
 * Shapes shared by the demo UI and the real bitcoin-vision model.
 *
 * The raw scanner output types mirror wasm/src/lib.rs (serialised with camelCase).
 */

/** One word as the demo shows it, from the sample page or from the real model. */
export interface WordRead {
  /** Exactly what was read off the paper, e.g. "absert". */
  ocr: string;
  /** The scanner's pick: the word to show, also when `accepted` is false. */
  selected: string;
  /** The pick first, then the other list words, likeliest first, each with
   * the scanner's chance (0–1) that it is the word written. */
  candidates: { word: string; confidence: number }[];
  /** False when the scanner asks the person to confirm this word. */
  accepted: boolean;
  /** Object URL of the crop the model read (real scans only). */
  cropUrl?: string;
  /** Where the word is in the photo, clockwise from top left (real scans only). */
  quad?: Point[];
}

/* ---------- raw output of the WebAssembly scanners ---------- */

export type Point = [number, number];

export interface ScannedWord {
  quad: [Point, Point, Point, Point];
  selected: string | null;
  /** The chance `selected` is right. */
  confidence: number;
  /** The scanner asks the person to confirm `selected`. */
  check: boolean;
  /** Other words to offer, likeliest first, never `selected`. */
  alternatives: { word: string; confidence: number }[];
  raw: string | null;
  stray: boolean;
  number: number | null;
}

export interface PageScan {
  layout: 'sheet' | 'page';
  width: number;
  height: number;
  words: ScannedWord[];
  columns: number[];
  rows: number[];
  numbered: number[];
  columnsPass: boolean;
  rowsPass: boolean;
  numberedPass: boolean;
  initialOrder: 'numbers' | 'rows' | 'columns';
  orderRequiresReview: boolean;
  orderBasis: string;
  numbering: 'none' | 'held' | 'inconsistent';
}

export interface ShareCell {
  symbol: string | null;
  probability: number | null;
  unread: boolean;
  top: { symbol: string; probability: number }[];
}

export interface ShareScan {
  /** Handle for recover(); valid while the page is open. */
  id: number;
  kind: 'seed' | 'share' | 'unknown';
  /** 1–3 for a share strip. */
  index: number | null;
  quad: [Point, Point, Point, Point];
  /** Twelve rows of six cells. */
  rows: ShareCell[][];
}

export type ScanPhase = 'loading' | 'reading';
