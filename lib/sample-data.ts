/**
 * The practice photos behind "Run sample". They are real photographs of test
 * backups, read by the same scanner as the person's own photo.
 */
export interface Sample {
  /** Shown as the input's name. */
  name: string;
  /** Under the site root. */
  path: string;
}

/** A handwritten twelve-word test phrase. */
export const WORD_SAMPLE: Sample = { name: 'sample-recovery-page.jpg', path: '/samples/recovery-words.jpg' };

/** Two shares of one test backup: any two rebuild it. */
export const SHARE_SAMPLES: Sample[] = [
  { name: 'sample-penlock-share-2.jpg', path: '/samples/penlock-share-2.jpg' },
  { name: 'sample-penlock-share-3.jpg', path: '/samples/penlock-share-3.jpg' },
];
