# bitcoin-vision site

Next.js (static export) + React + TypeScript, with the real
[bitcoin-vision](https://github.com/penlock-io/bitcoin-vision) model running **in the visitor’s browser**
as WebAssembly. No server: it deploys to GitHub Pages as plain files, and photos never leave the device.

## Run it locally

```bash
npm install
npm run build:vision   # once: Rust → WebAssembly + models into public/vision/ (needs the tools below)
npm run dev            # http://localhost:3000
```

`build:vision` needs Rust with the WebAssembly target and the matching wasm-bindgen CLI:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.130 --locked
```

## Deploy to GitHub Pages

Push to `main` on GitHub, then **Settings › Pages › Source: GitHub Actions**.
`.github/workflows/deploy.yml` builds the model and the site and publishes `out/`.
The base path (`/<repo>/`) is set automatically.

## How the model gets into the page

| Piece | What it is |
| --- | --- |
| `scripts/build-vision.sh` | Fetches penlock-io/bitcoin-vision at a pinned commit into `wasm/upstream/`, applies `wasm/patches/`, compiles `wasm/` to WebAssembly, copies the ONNX models to `public/vision/models/` |
| `wasm/patches/0001-web-time-instant.patch` | The one upstream change: `std::time::Instant` panics in browser WebAssembly, so the OCR model build uses `web-time` |
| `wasm/src/lib.rs` | The JS-facing API: `WordScanner` (`scan`, and `crop` for a word’s picture), `ShareScanner`, `recoverShares`, `checksumPasses`, `listWords` |
| `public/vision/worker.js` | Web Worker that loads the model (cached in Cache Storage after the first visit) and scans off the main thread |
| `lib/vision/client.ts` | Promise API the React app uses: `scanWords`, `scanShares`, `recoverShares`, `checksumPasses` |
| `content/integration-guide.md` | The integration guide, served at `/docs/` (edit the Markdown; the page rebuilds from it) |
| `components/playground/` | The Playground: the real model on the sample photos in `public/samples/` (Run sample) and on “Use your own practice photo” |

## Opt-in training samples

After a real scan, the Playground asks once per photo whether it may be shared for training. Sharing
needs a ticked “practice words, not a real backup”, and for BIP39 every flagged word confirmed first, so
the labels are right. The photo is redrawn without EXIF and sent with its labels to `upload-worker/`
(a Cloudflare Worker + private R2 bucket); see `upload-worker/README.md` to deploy it. The prompt only
appears when `NEXT_PUBLIC_SAMPLE_UPLOAD_URL` is set (the `SAMPLE_UPLOAD_URL` repo variable in CI).

The page design is the “Model site” board (light and dark). Colours are tokens at the top of
`app/globals.css`; light is the default; the header toggle switches to dark (saved per browser).

To move to a newer upstream commit, change `UPSTREAM_REV` in `scripts/build-vision.sh` and re-run it. The
script writes a build id beside the `.wasm`; the page loads the worker, the JS glue and the browser cache
under that id, so returning visitors get the new build with nothing to bump by hand.

Sizes: ~21 MB `.wasm` (~5.5 MB gzipped) + ~25 MB models, downloaded only when someone scans.
A 16 MP photo reads in about 3–8 s, single-threaded.

`static-prototype/` is the earlier plain-HTML version, kept for reference.
