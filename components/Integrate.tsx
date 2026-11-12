'use client';

import Link from 'next/link';
import { useState } from 'react';
import { INTEGRATION_GUIDE } from '@/lib/links';

const CODE = {
  rust: `use bitcoin_vision::words::{ScanOptions, Scanner};

// feature "bundled-models" embeds the ~24.7 MB of models
let scanner = Scanner::bundled()?; // load once, reuse

let photo = std::fs::read("practice-page.jpg")?;
let document = scanner.scan(&photo, ScanOptions::default())?.document();

for &i in &document.ordered_observations {
    let word = &document.observations[i];
    // word.selected, word.quad, word.candidates
}`,
  browser: `// What this page does: the scanners compiled to
// WebAssembly, running in a Web Worker. No server.
const worker = new Worker('/vision/worker.js', { type: 'module' });

worker.onmessage = ({ data }) => {
  if (data.result) console.log(data.result.words);
  // each word: quad, cropPng, raw, ranked, accepted
};
worker.postMessage({
  id: 1, type: 'scanWords', photo: await file.arrayBuffer(),
});`,
  cli: `git clone https://github.com/penlock-io/bitcoin-vision
cd bitcoin-vision

# read a photo of a handwritten phrase
cargo run --release -p bitcoin-vision-words \\
  --features bundled-models --example scan -- photo.jpg out/

# out/ gets result.json, an overlay, previews and crops`,
  android: `cd example-android-app
./gradlew :app:assembleDebug

# builds rust/bitcoin-vision-mobile, generates Kotlin
# bindings with UniFFI and copies the models in
# APK: app/build/outputs/apk/debug/app-debug.apk

# It is a mainnet wallet: never import a real seed to try it`,
};
type Tab = keyof typeof CODE;
const TABS: [Tab, string][] = [['rust', 'Rust'], ['browser', 'Browser'], ['cli', 'Quickstart'], ['android', 'Android']];

const TARGETS = [
  ['Hardware wallets', 'The models ship with the firmware and the scan happens on the device. A Penlock app has run it on the Passport Prime simulator.'],
  ['Mobile wallets', 'The user takes one photo and checks the result instead of typing 12 words. There’s an Android example to start from.'],
  ['Penlock tools', 'Read a paper share back without typing 72 symbols by hand, then combine any 2 of the 3 shares.'],
];

export default function Integrate() {
  const [tab, setTab] = useState<Tab>('rust');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(CODE[tab]); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <section id="integrate" className="sec" aria-labelledby="int-h">
      <p className="kicker">04 · Integrate</p>
      <div className="sec-head">
        <h2 id="int-h" className="h2">Using the library</h2>
        <p>Create a Scanner once and call scan for each photo. For every word you get where it is in the photo, a cropped image of it, the text that was read and the ranked seed words it could be. You also get whether the checksum passed.</p>
      </div>
      <div className="int">
        <div className="int-code">
          <div className="int-tools">
            <div role="tablist" aria-label="Code example" className="code-tabs">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  className="code-tab"
                  aria-selected={tab === key}
                  aria-controls="code-panel"
                  onClick={() => { setTab(key); setCopied(false); }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <pre id="code-panel" role="tabpanel" className="code">{CODE[tab]}</pre>
        </div>
        <ul className="targets">
          {TARGETS.map(([t, d]) => (
            <li key={t}><p style={{ fontWeight: 500 }}>{t}</p><p>{d}</p></li>
          ))}
          <li className="is-cta"><Link href={INTEGRATION_GUIDE} className="btn btn--ink">Read the integration guide →</Link></li>
        </ul>
      </div>
    </section>
  );
}
