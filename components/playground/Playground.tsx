'use client';

import type { ReactNode } from 'react';
import { rowUnsure } from '@/lib/vision/client';
import { sharingEnabled } from '@/lib/vision/share';
import { removalRequest } from '@/lib/links';
import type { Point, WordRead } from '@/lib/vision/types';
import { finalWords, isFlagged, latestShare, nextSample, sampleUrl, unsureCount, usePlayground, type PgActions, type PgState } from './usePlayground';

type P = { s: PgState; a: PgActions };

const VALID_LENGTHS = [12, 15, 18, 21, 24];

const Short = ({ long, short }: { long: string; short: string }) => (
  <><span className="seg-long">{long}</span><span className="seg-short">{short}</span></>
);

function FileButton({ a, className, children, label }: { a: PgActions; className: string; children: ReactNode; label: string }) {
  return (
    <label className={className}>
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) a.scanPhoto(f); e.target.value = ''; }}
      />
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------- input */

const pts = (q: Point[]) => q.map(([x, y]) => `${x},${y}`).join(' ');

function Viewer({ s, a }: P) {
  const strip = s.mode === 'pen' ? latestShare(s) : undefined;
  return (
    <div className="viewer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="viewer-photo"
        src={s.photo ?? sampleUrl(nextSample(s))}
        alt={s.source === 'photo' ? 'Your practice photo' : 'The sample practice photo'}
        onLoad={(e) => s.photo && a.photoLoaded(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
      />
      {s.status === 'done' && s.photoSize && (
        <svg className="viewer-boxes" viewBox={`0 0 ${s.photoSize.w} ${s.photoSize.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {s.mode === 'bip' && s.words.map((w, i) => w.quad && (
            <polygon
              key={i}
              points={pts(w.quad)}
              fill="none"
              stroke={isFlagged(s, i) ? '#E5A84B' : '#5BC891'}
              strokeWidth="2.5"
              strokeDasharray={isFlagged(s, i) ? '6 4' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {strip && (
            <polygon points={pts([0, 1, 3, 2].map((k) => strip.quad[k]))} fill="none" stroke="#5BC891" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      )}
      {s.status === 'running' && <div className="scanline is-sweep" />}
    </div>
  );
}

/* ---------------------------------------------------------------- output */

/** A chance as a whole percent, never rounded up to a certainty it isn't. */
const percent = (p: number) => (p >= 0.995 && p < 1 ? 99 : Math.round(100 * p));

const Conf = ({ pct, warn }: { pct: number | null; warn?: boolean }) => (
  <span role="cell" className="c-conf">
    <span className="track"><span className={warn ? 'is-warn' : undefined} style={{ width: `${pct ?? 0}%` }} /></span>
    <span className="pct">{pct === null ? '—' : `${pct}%`}</span>
  </span>
);

function WordTable({ s, a }: P) {
  const mask = (t: string) => (s.mask ? '•'.repeat(Math.min(8, t.length)) : t);

  const why = (w: WordRead) => (w.accepted
    ? 'The likeliest of all 2048 seed words, likeliest first. Pick another if it misread you:'
    : `It read “${w.ocr || '?'}” and picked “${mask(w.selected)}”, but isn’t sure. Confirm it or pick what you wrote, likeliest first:`);

  return (
    <div role="table" aria-label="Words read" className="wt">
      <div role="row" className="wt-head">
        <span role="columnheader">#</span>
        <span role="columnheader"><Short long="Handwriting" short="Written" /></span>
        <span role="columnheader">Read as</span>
        <span role="columnheader" className="h-conf">Chance it’s right</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Status</span>
      </div>
      {s.words.map((w, i) => {
        const pick = s.picks[i];
        const flagged = isFlagged(s, i);
        const open = s.open === i;
        const shown = pick || w.selected;
        const chance = w.candidates.find((c) => c.word === shown)?.confidence;
        return (
          <div role="row" key={i} className={`wt-item${flagged ? ' is-flag' : ''}`}>
            <button
              type="button"
              className="wt-btn"
              onClick={() => a.toggleRow(i)}
              aria-expanded={open}
              aria-label={`Word ${i + 1}${flagged ? ', check this word' : ', show how it was read'}`}
            >
              <span role="cell" className="c-n">{i + 1}</span>
              <span role="cell" className="c-hand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.cropUrl ? <img src={w.cropUrl} alt={`Handwriting read as “${w.ocr}”`} /> : w.ocr}
              </span>
              <span role="cell" className="c-word">{mask(shown)}</span>
              <Conf pct={chance === undefined ? null : percent(chance)} warn={flagged} />
              <span role="cell" className="c-status">
                {flagged
                  ? <span className="chip chip--warn">Check</span>
                  : pick
                    ? <span className="chip chip--fixed"><Short long="You picked" short="Picked" /></span>
                    : <span className="chip">Sure</span>}
              </span>
            </button>
            {open && (
              <div className="wt-detail">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.cropUrl && <img className="crop-big" src={w.cropUrl} alt={`The crop the model read as “${w.ocr}”`} />}
                <p>{why(w)}</p>
                <div className="opts">
                  {w.candidates.map(({ word, confidence }) => (
                    <button
                      key={word}
                      type="button"
                      className="opt"
                      aria-pressed={pick === word}
                      onClick={() => a.pickWord(i, word)}
                    >
                      <b>{mask(word)}</b><small>{percent(confidence)}%</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Each row of the strip as read, and the rebuilt words once two shares are in. */
function PenTable({ s }: { s: PgState }) {
  const share = latestShare(s);
  if (!share) return null;
  return (
    <>
      <div role="table" aria-label={`Penlock share ${share.index} rows read`} className="wt is-pen">
        <div role="row" className="wt-head">
          <span role="columnheader">Row</span><span role="columnheader">Symbols</span>
          <span role="columnheader" className="h-conf">Lowest cell confidence</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>Read</span>
        </div>
        {share.rows.map((row, r) => {
          const unsure = rowUnsure(row);
          const low = Math.round(Math.min(...row.map((c) => (c.unread ? 0 : c.probability ?? 0))) * 100);
          return (
            <div role="row" key={r} className={`wt-item${unsure ? ' is-flag' : ''}`}>
              <div className="wt-btn">
                <span role="cell" className="c-n">{r + 1}</span>
                <span role="cell" className="c-glyphs">{s.mask ? '••••••' : row.map((c) => (c.unread ? '?' : c.symbol)).join('')}</span>
                <Conf pct={low} warn={unsure} />
                <span role="cell" className="c-status">
                  {unsure ? <span className="chip chip--warn">Unsure</span> : <span className="chip">Clear</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {s.recovered && (
        <div className="rebuilt">
          <p>Rebuilt from shares {s.penReads.slice(-2).map((r) => r.index).join(' + ')}</p>
          <ol>
            {s.recovered.map((w, i) => <li key={i}><span>{i + 1}</span>{s.mask ? '••••••' : w}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}

/** Scanner output as JSON: field for field what the library returned. */
function print(value: unknown, masked: boolean): string {
  const hide = (t: string) => '•'.repeat(Math.min(8, t.length));
  const text = JSON.stringify(
    value,
    (key, v) => {
      if (masked && typeof v === 'string' && ['word', 'selected', 'raw', 'symbol'].includes(key)) return hide(v);
      return v;
    },
    2,
  );
  // Points and candidates read better on one line each.
  return text
    .replace(/\[\s+(-?[\d.e+-]+),\s+(-?[\d.e+-]+)\s+\]/g, '[$1, $2]')
    .replace(/\{\s+("(?:word|symbol)": "[^"]*"),\s+("probability": [\d.e+-]+)\s+\}/g, '{ $1, $2 }');
}

function json(s: PgState): string {
  if (s.mode === 'bip') return s.page ? print(s.page, s.mask) : '{}';
  const share = latestShare(s);
  if (!share) return '{}';
  // `id` is this page's handle for the share, not part of the scan.
  const { id: _handle, ...scan } = share;
  return print(scan, s.mask);
}

/** Whether the words as shown form a valid phrase: the one result a person must not miss. */
function Checksum({ s }: { s: PgState }) {
  const count = s.words.length;
  const unsure = unsureCount(s);
  let state: 'pass' | 'fail' | 'wait' = 'wait';
  let title = 'Checking the checksum…';
  let note = '';
  if (!VALID_LENGTHS.includes(count)) {
    state = 'fail';
    title = '✗ Not a complete phrase';
    note = `Found ${count} word${count === 1 ? '' : 's'}; a phrase has 12, 15, 18, 21 or 24, so there is no checksum to pass.`;
  } else if (s.checksum) {
    state = 'pass';
    title = '✓ Checksum passes';
    note = 'These words form a valid phrase. A good sign, not proof: about 1 wrong 12-word phrase in 16 also passes.';
  } else if (s.checksum === false) {
    state = 'fail';
    title = '✗ Checksum fails';
    note = 'These words do not form a valid phrase. At least one is wrong or out of order.';
  }
  if (unsure && state !== 'wait') note += ` ${unsure} word${unsure > 1 ? 's are' : ' is'} still unsure.`;
  return (
    <div className={`checksum is-${state}`} role="status">
      <div className="checksum-head">
        <strong>{title}</strong>
        {note && <span>{note}</span>}
      </div>
      <ol className="phrase" aria-label="The phrase as read">
        {finalWords(s).map((w, i) => (
          <li key={i} className={isFlagged(s, i) ? 'is-unsure' : undefined}>
            <span>{i + 1}</span>{s.mask ? '•'.repeat(Math.min(8, w.length)) : w}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Verdict({ s, a }: P) {
  let text = '';
  let note = '';
  let ok = true;
  let extra: ReactNode = null;

  if (s.mode === 'bip') {
    const unsure = unsureCount(s);
    if (unsure) {
      ok = false;
      text = `${unsure} word${unsure > 1 ? 's' : ''} to confirm`;
      note = 'Open the flagged rows and confirm the word or pick what you wrote.';
    } else {
      text = 'Every word settled';
      note = 'Compare each word with your paper.';
    }
  } else {
    const share = latestShare(s);
    if (s.error) {
      ok = false;
      text = s.recovered ? 'Couldn’t rebuild' : 'Couldn’t read that photo';
      note = s.error;
    } else if (s.recovered) {
      text = '✓ Rebuilt from 2 of 3 shares';
      note = `Compare these ${s.recovered.length} words with the phrase you split.`;
    } else if (s.penReads.length === 1) {
      text = `✓ Share ${share?.index} read`;
      note = 'Any second share rebuilds the backup.';
    } else {
      text = 'Rebuilding…';
    }
    if (!s.recovered) {
      extra = s.source === 'sample'
        ? <button type="button" className="small-btn small-btn--ink" onClick={a.run}>Read the second sample share</button>
        : <FileButton a={a} className="small-btn small-btn--ink file-btn" label="Photo of another Penlock share">Read another share</FileButton>;
    }
  }

  return (
    <div className="verdict-bar">
      <span className={`verdict${ok ? '' : ' is-warn'}`}>{text}</span>
      <span className="verdict-note">{note}</span>
      {extra}
      <button type="button" className="small-btn" aria-pressed={s.mask} onClick={a.toggleMask}>{s.mask ? 'Show words' : 'Hide words'}</button>
      <button type="button" className="small-btn" onClick={a.forget}>Forget</button>
    </div>
  );
}

/** Asked once per photo after a real scan: may we keep this to train the model? */
function ShareConsent({ s, a }: P) {
  const bip = s.mode === 'bip';
  const { share } = s;
  if (share.status === 'sent') {
    return (
      <div className="consent" role="status">
        <p className="consent-done">✓ Thank you. This sample was shared for training.</p>
        <p className="consent-fine">
          Sample ID <code>{share.id}</code>. Changed your mind?{' '}
          <a href={removalRequest(share.id ?? '')} target="_blank" rel="noreferrer">Ask us to remove it</a>. Forget
          clears this page; it doesn’t delete a shared sample.
        </p>
      </div>
    );
  }
  const unsure = bip ? unsureCount(s) : 0;
  const sending = share.status === 'sending';
  const canSend = share.practice && !unsure && !sending;
  return (
    <div className="consent" role="region" aria-labelledby="consent-h">
      <h3 id="consent-h">Help train the model?</h3>
      <p className="consent-copy">
        Share this photo {bip ? 'and the words you confirmed' : 'and the symbols it read'} so future versions read
        handwriting like yours. It’s sent once, only if you say yes, to private storage for the bitcoin-vision team.
        Location and camera details are removed from the photo first.
      </p>
      <label className="consent-check">
        <input type="checkbox" checked={share.practice} disabled={sending} onChange={(e) => a.setPractice(e.target.checked)} />
        <span>These are practice words, <strong>not a real backup</strong>.</span>
      </label>
      {unsure > 0 && (
        <p className="consent-fine">Confirm the {unsure} flagged word{unsure > 1 ? 's' : ''} above first, so the labels are right.</p>
      )}
      {share.error && <p className="consent-error" role="alert">{share.error}</p>}
      <div className="consent-actions">
        <button type="button" className="small-btn small-btn--ink" disabled={!canSend} onClick={a.sendSample}>
          {sending ? 'Sharing…' : share.status === 'error' ? 'Try again' : 'Share this sample'}
        </button>
        <button type="button" className="small-btn" disabled={sending} onClick={a.declineSample}>No thanks</button>
      </div>
    </div>
  );
}

function Output({ s, a }: P) {
  const bip = s.mode === 'bip';

  if (s.status === 'idle') {
    return (
      <div className="out-empty">
        <strong>Nothing read yet.</strong>
        <p>Read this practice {bip ? 'page' : 'share'} with the real models, in this tab.</p>
        <button type="button" className="run out-empty-run" onClick={a.run}>Run sample ▸</button>
        <p>Or use your own practice photo.</p>
      </div>
    );
  }
  if (s.status === 'error') {
    return (
      <div className="out-empty is-error" role="alert">
        <strong>Couldn’t read that photo.</strong>
        <p style={{ maxWidth: 420 }}>{s.error}</p>
      </div>
    );
  }
  if (s.status === 'running') {
    const text = s.phase === 'loading'
      ? 'Loading the models into this tab (about 30 MB, only once)…'
      : bip ? 'Finding and reading each word…' : 'Finding the strip and reading its 72 cells…';
    return (
      <div className="out-running">
        <p style={{ fontSize: 17, fontWeight: 500 }}>{text}</p>
        <div className="progress is-indeterminate"><div /></div>
        <p className="mono" style={{ fontSize: 12, color: 'var(--dim)' }}>on-device · no network</p>
      </div>
    );
  }
  if (s.tab === 'json') {
    return (
      <>
        <pre className="json">{json(s)}</pre>
        <p className="json-note">What the scanner returned for this photo. Each word’s <code>quad</code> is its four corners in the photo.</p>
      </>
    );
  }
  return bip ? <WordTable s={s} a={a} /> : <PenTable s={s} />;
}

/* ---------------------------------------------------------------- the section */

export default function Playground() {
  const { s, actions: a } = usePlayground();
  const bip = s.mode === 'bip';
  const running = s.status === 'running';
  const done = s.status === 'done';

  const names = bip ? ['Find', 'Read', 'Match', 'Check'] : ['Find strip', 'Read cells', 'Match', 'Row checks'];
  const secondShare = !bip && done && s.source === 'sample' && s.penReads.length === 1;
  const runLabel = running ? 'Running…' : secondShare ? 'Read second share ▸' : 'Run sample ▸';
  const inputName = s.photo ? s.photoName : nextSample(s).name;

  return (
    <section id="demo" className="sec" aria-labelledby="demo-h">
      <p className="kicker">01 · Playground</p>
      <div className="sec-head">
        <h2 id="demo-h" className="h2">Run it on a practice backup.</h2>
        <p>
          Press Run sample to read a photo of a practice backup, or use your own practice photo. Either way the real
          models run right here in your browser, and the photo stays on your device unless you choose to share it.
        </p>
      </div>

      <div className="pg">
        <div className="pg-bar">
          <div role="group" aria-label="Backup type" className="seg">
            <button type="button" aria-pressed={bip} onClick={() => a.setMode('bip')}><Short long="Recovery words" short="Words" /></button>
            <button type="button" aria-pressed={!bip} onClick={() => a.setMode('pen')}><Short long="Penlock share" short="Penlock" /></button>
          </div>
          <ol aria-label="Pipeline stages" className="pills">
            {names.map((n, i) => {
              const failed = done && bip && i === 3 && !s.checksum;
              return <li key={n} className={`pill${failed ? ' is-bad' : done ? ' is-done' : running ? ' is-now' : ''}`}>{(failed ? '✗ ' : done ? '✓ ' : '') + n}</li>;
            })}
          </ol>
          {s.status !== 'idle' && <button type="button" className="run" onClick={a.run} disabled={running}>{runLabel}</button>}
        </div>

        <div className="pg-body">
          <div className="pg-input">
            <p className="pg-input-name">INPUT · {inputName}</p>
            <Viewer s={s} a={a} />
            <FileButton a={a} className="upload" label="Use your own practice photo">Use your own practice photo</FileButton>
            <p className="fine">Practice words only. Never photograph a real backup on a connected device.</p>
          </div>

          <div className="pg-out">
            <div role="tablist" aria-label="Output view" className="tabs">
              <button type="button" role="tab" className="tab" aria-selected={s.tab === 'words'} onClick={() => a.setTab('words')}>{bip ? 'Words' : 'Rows'}</button>
              <button type="button" role="tab" className="tab" aria-selected={s.tab === 'json'} onClick={() => a.setTab('json')}>JSON</button>
            </div>
            <div className="out" aria-live="polite">
              <Output s={s} a={a} />
            </div>
            {done && bip && <Checksum s={s} />}
            {done && <Verdict s={s} a={a} />}
            {done && s.source === 'photo' && sharingEnabled && s.share.status !== 'declined' && <ShareConsent s={s} a={a} />}
          </div>
        </div>
      </div>
    </section>
  );
}
