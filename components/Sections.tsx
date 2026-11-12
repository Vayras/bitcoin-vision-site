import Link from 'next/link';
import { GITHUB, INTEGRATION_GUIDE, PENLOCK } from '@/lib/links';

const SPECS: [string, string][] = [
  ['BIP39 models', '24.7 MB'],
  ['Penlock model', '1.6 MB'],
  ['Network', 'None'],
  ['Reads', 'BIP39 words · Penlock shares'],
  ['Library', 'Rust'],
  ['License', 'MIT / Apache-2.0'],
];

export function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero-copy">
        <p className="kicker">[ Open source · On-device vision model ]</p>
        <h1 className="h1">
          Scan a handwritten seed backup<br />
          <span style={{ color: 'var(--dim)' }}>without it leaving the device.</span>
        </h1>
        <p className="lead">
          bitcoin-vision is a Rust library with a few small vision models. Give it a photo of a BIP39 recovery phrase or
          a Penlock share, and it tells you what it read, how sure it is about each word, and what else each word
          might be.
        </p>
        <div className="hero-ctas">
          <a href="#demo" className="btn btn--ink">Try the demo</a>
          <Link href={INTEGRATION_GUIDE} className="btn btn--line">Integration guide →</Link>
        </div>
      </div>
      <dl className="specs card">
        {SPECS.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </section>
  );
}

// Sizes are the .onnx files in the upstream repo, in decimal MB.
const MODELS = [
  ['word-detector.onnx', 'BIP39', 'Finds where each word is written on the page', 'A box around each word', '4.7 MB'],
  ['text-recogniser.onnx', 'BIP39', 'Reads the letters as written, even when they don’t spell a seed word', 'The text it saw, e.g. “absert”', '7.7 MB'],
  ['word-reference.onnx', 'BIP39', 'Compares each word with all 2048 seed words', 'Each seed word’s chance of being the right one', '12.3 MB'],
  ['cell-reference.onnx', 'Penlock', 'Reads each of the 72 handwritten symbols on a share', 'Each of the 29 symbols’ chance of being the right one', '1.6 MB'],
];

export function ModelCard() {
  return (
    <section id="model" className="sec" aria-labelledby="model-h">
      <p className="kicker">02 · Models</p>
      <div className="sec-head">
        <h2 id="model-h" className="h2">The models and what they do</h2>
        <p>
          These are small models trained for this task, not a general-purpose AI, and they run on the device. Reading a
          BIP39 phrase uses the first three. Reading a Penlock share only needs the last one.
        </p>
      </div>
      <div role="table" aria-label="Models" className="card mtable">
        <div role="row" className="mrow is-head">
          <span role="columnheader">Model file</span><span role="columnheader">Used for</span>
          <span role="columnheader">What it does</span><span role="columnheader">What it returns</span>
          <span role="columnheader">Size</span>
        </div>
        {MODELS.map(([file, pipe, job, out, size]) => (
          <div role="row" className="mrow" key={file}>
            <span role="cell" className="m-file">{file}</span>
            <span role="cell"><span className="m-pipe">{pipe}</span></span>
            <span role="cell" className="m-job">{job}</span>
            <span role="cell">{out}</span>
            <span role="cell" className="m-size">{size}</span>
          </div>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><b>24.7 <small>MB</small></b><p>of models to read a BIP39 phrase</p></div>
        <div className="stat"><b>1.6 <small>MB</small></b><p>of models to read a Penlock share</p></div>
        <div className="stat"><b>0</b><p>network requests while scanning</p></div>
        <div className="stat"><b>2048</b><p>seed words each handwritten word is compared with</p></div>
      </div>
    </section>
  );
}

const PIPES: { tag: string; title: string; steps: [string, string][] }[] = [
  {
    tag: 'PIPELINE A · BIP39',
    title: 'Recovery phrase',
    steps: [
      ['Find the words.', 'The page is straightened and each word gets a box drawn around it.'],
      ['Read the letters.', 'The recogniser reads what was actually written, spelling mistakes included.'],
      ['Match against the wordlist.', 'Each word is compared with all 2048 BIP39 words.'],
      ['Check the checksum.', 'The last word of a phrase carries a checksum, which catches most misreads.'],
      ['Ask the user.', 'Words the scanner isn’t sure about are shown to the user with the closest alternatives.'],
    ],
  },
  {
    tag: 'PIPELINE B · PENLOCK',
    title: 'Penlock share',
    steps: [
      ['Find the share.', 'The share is located in the photo and split into its 72 boxes.'],
      ['Read the symbols.', 'Each box is compared with the 29 symbols Penlock uses.'],
      ['Check each row.', 'Every row has its own error check, so most misreads are caught here.'],
      ['Combine shares.', 'Any 2 of the 3 shares are enough to rebuild the 12 words.'],
      ['Ask the user.', 'If a symbol is smudged, the user can correct it by hand.'],
    ],
  },
];

export function HowItReads() {
  return (
    <section className="sec" aria-labelledby="how-h">
      <p className="kicker">03 · How it reads</p>
      <h2 id="how-h" className="h2" style={{ marginBottom: 28 }}>From photo to words</h2>
      <div className="two">
        {PIPES.map((p) => (
          <article key={p.tag} className="card pipe">
            <p className="pipe-tag">{p.tag}</p>
            <h3>{p.title}</h3>
            <ol className="steps">
              {p.steps.map(([t, d], i) => (
                <li key={t}>
                  <span className="n">0{i + 1}</span>
                  <span><b>{t}</b> <span className="muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Hardware() {
  return (
    <section id="hardware" className="sec hw" aria-labelledby="hw-h">
      <div className="hw-copy">
        <p className="kicker">05 · In a hardware wallet</p>
        <h2 id="hw-h" className="h2">Tested on the Passport Prime simulator</h2>
        <p className="lead">
          A Penlock app for Passport Prime, built at a hackathon, uses bitcoin-vision to read shares. It has only run on
          the Passport Prime simulator so far, not on a real device. Reading Penlock shares needs just the 1.6 MB
          model, and the library never touches the network, so it fits well on a signing device.
        </p>
        <div className="facts">
          <div><p>STORAGE</p><p>1.6 MB for Penlock, 24.7 MB for BIP39</p></div>
          <div><p>NETWORK</p><p>Not used</p></div>
          <div><p>UPDATES</p><p>Shipped in signed firmware</p></div>
          <div><p>UX</p><p>User checks the result before revealing it</p></div>
        </div>
      </div>
      <div className="hw-art" aria-hidden="true">
        <div className="device">
          <div className="device-screen">
            <p className="mono">PENLOCK · SHARE 1</p>
            <div className="device-read">KQ7 RMX</div>
            <p>✓ 12 of 12 rows read</p>
            <p className="mono">SIMULATOR · OFFLINE</p>
          </div>
          <div className="device-keys"><span /><span /></div>
        </div>
      </div>
    </section>
  );
}

export function Limits() {
  return (
    <section className="sec" aria-labelledby="lim-h">
      <p className="kicker">06 · Limits</p>
      <h2 id="lim-h" className="h2" style={{ marginBottom: 28 }}>It’s still a prototype</h2>
      <div className="two">
        <div className="card limit">
          <p className="kicker" style={{ letterSpacing: 0, marginBottom: 12 }}>WHAT IT CAN’T DO YET</p>
          <ul>
            <li>It only reads English seed words</li>
            <li>Faint writing, low-contrast photos and unusual page layouts lead to misreads</li>
            <li>About 1 in 16 wrong 12-word phrases still passes the checksum</li>
            <li>It isn’t published on crates.io yet</li>
          </ul>
        </div>
        <div className="card limit">
          <p className="kicker" style={{ letterSpacing: 0, marginBottom: 12 }}>WHAT INTEGRATORS MUST DO</p>
          <ul>
            <li>Ask the user to confirm every word the scanner isn’t sure about</li>
            <li>Keep photos and results in memory, never on disk</li>
            <li>Keep the words hidden until the user taps Reveal, and wipe them on Forget</li>
            <li>Remind Penlock users to keep their shares in separate places</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <b>bitcoin-vision</b>
      <span>MIT / Apache-2.0</span>
      <a href={GITHUB}>GitHub ↗</a>
      <a href={PENLOCK}>Penlock ↗</a>
      <Link href={INTEGRATION_GUIDE}>Integration guide</Link>
    </footer>
  );
}
