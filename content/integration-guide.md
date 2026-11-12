## Overview

bitcoin-vision turns a photo of a handwritten Bitcoin backup into structured, checkable data, entirely offline. It is a Rust library for wallet makers and app developers: you hand it an image, and it hands back what it read, how sure it is, and what it would ask the user to confirm.

It reads two kinds of backup:

| Backup | What is on the paper | What you get back |
| --- | --- | --- |
| BIP39 recovery phrase | 12 or more handwritten English seed words | Each word's position, crop, OCR text, probabilities over all 2048 words, and whether the phrase passes its checksum |
| Penlock share | A worksheet strip of 12 rows × 6 symbols | A probability over the 29 Penlock symbols for every cell, ready for Penlock's per-word check and 2-of-3 recombination |

The crates make no network calls, do not log, and never contact a wallet. Your app owns the photo, the result and their deletion.

Who this guide is for:

- **Hardware wallet makers** adding camera-based backup entry, as in the Penlock app prototype for Passport Prime, tested on the simulator.
- **Mobile wallet developers** who want a scan step instead of typing 12 words.
- **Penlock tool builders** who need shares read back from paper.

## Architecture

Every scan follows one of two pipelines, both ending in the same place: the user reviews what was read before anything is used.

<!-- pipelines -->

The BIP39 pipeline uses three models: it boxes each word, reads its letters, then scores the crop against all 2048 seed words. The Penlock pipeline uses one 29-way cell classifier and leaves the checks and recombination to the `penlock` crate.

## Quickstart

You can scan the included example photo with the bundled models and no setup beyond a Rust toolchain.

1. Clone [penlock-io/bitcoin-vision](https://github.com/penlock-io/bitcoin-vision).
2. Run the example scan:

```bash
cargo run --release -p bitcoin-vision-words --features bundled-models --example scan -- \
  words/examples/photos/handwritten.png new-output-directory
```

3. Open `new-output-directory`. It holds an overlay of what was found, previews, the crop of every word, and `result.json` with the full read. Replace the photo path to scan your own image.

Useful checks while integrating:

```bash
cargo test --locked --workspace --all-features                                    # full test suite
cargo test --locked -p bitcoin-vision-words --features bundled-models --example scan  # BIP39 example as a test
cargo test --locked -p penlock-scan --features bundled-models,print --example scan    # Penlock example as a test
cargo check --locked --no-default-features                                        # build without bundled models
cargo doc --locked --no-deps --features bundled-models                            # local API reference
```

The crate is marked `publish = false`, so depend on it by git path or a vendored copy, pinned to a commit.

## Library API

One `Scanner`, built once, scans any number of photos: load models at startup, then call `scan` per image.

```rust
use bitcoin_vision::words::{ScanOptions, Scanner};

// Bundled models (feature `bundled-models`, about 24.7 MB)
let scanner = Scanner::bundled()?; // load once, reuse

let photo = std::fs::read("handwritten-words.jpg")?;
let document = scanner.scan(&photo, ScanOptions::default())?.document();

for &index in &document.ordered_observations {
    let word = &document.observations[index];
    // one handwritten word, in reading order: word.selected, word.quad, word.candidates
}
```

This follows the README example; check `cargo doc` for exact types and error handling. `bitcoin_vision::penlock` is the Penlock scanner, built the same way.

On devices where models ship separately from firmware, load them yourself with `Scanner::new(ModelBytes { .. })`. It takes five artifacts:

| Artifact | Role |
| --- | --- |
| Detector (`word-detector.onnx`) | Finds each handwritten word on the page |
| Recogniser (`text-recogniser.onnx`) | Reads the letters in each word crop |
| Dictionary | The recogniser's character set |
| Classifier (`word-reference.onnx`) | Scores the crop against all 2048 BIP39 words |
| Calibration | Turns classifier scores into honest probabilities |

What each word observation gives you:

- **Polygon** of the word on the original photo, for drawing boxes.
- **Crop** exactly as the models saw it, for showing the user.
- **OCR text**, the raw letter-by-letter read.
- **Probabilities over all 2048 words**, so you can show the top alternatives.
- **The branch chosen**, which tells you how the final word was decided.

The document also reports **whether the phrase passes its BIP39 checksum**. Treat a pass as a good sign, not proof: roughly 1 in 16 wrong 12-word phrases still pass.

## Penlock shares

The Penlock pipeline reads a cut worksheet strip, one symbol at a time, and hands Penlock's own arithmetic everything it needs to rebuild the seed from any 2 of 3 shares.

[Penlock](https://groups.google.com/g/bitcoindev/c/8LkdxVc_nI0) splits a BIP39 seed into three paper shares with a printable paper tool. Each share is 12 rows of 6 symbols from a 29-symbol alphabet. Each row carries its own check symbols, so a single wrong symbol in a word is caught.

How the read works:

1. Find the strip in the photo and straighten it.
2. Cut it into one image per symbol: 72 cells.
3. Classify each cell with `cell-reference.onnx`, a 29-way classifier. Every cell gets a probability over all 29 symbols, not just a best guess.
4. Run the per-row check. A row that fails points at its least certain cell; show the user that cell's top candidates.
5. After two shares are read and confirmed, pass them to the `penlock` crate to recombine.

Where the code lives:

| Crate | Job |
| --- | --- |
| `penlock-scan` | Photo to symbols (`bitcoin_vision::penlock` in the root crate) |
| `penlock` | Penlock arithmetic: checks and 2-of-3 recombination |

Both are crates in the repository's root workspace, beside `bitcoin-vision-words`.

Tell users to keep the three shares in separate places. Two shares stored together are as good as the seed itself.

## Hardware wallet integration

bitcoin-vision fits inside a signing device because it is small and fully offline: reading Penlock shares needs one 1.6 MB model, reading BIP39 phrases needs three models totalling 24.7 MB, and nothing leaves the device. A Penlock app for Passport Prime uses it to read shares; so far it has run only on the Passport Prime simulator, not on real hardware.

What to plan for:

| Area | What to decide |
| --- | --- |
| Storage | 1.6 MB of ONNX models for Penlock only (`cell-reference.onnx`), 24.7 MB for BIP39 (`word-detector.onnx` 4.7 MB, `text-recogniser.onnx` 7.7 MB, `word-reference.onnx` 12.3 MB). Ship them in the app bundle, or load them with `Scanner::new(ModelBytes { .. })` from a separate signed blob. |
| Memory | Keep one `Scanner` alive per session instead of reloading models per photo. Measure peak use on your target hardware. |
| Compute | Measure scan time on your hardware and show progress while it runs. |
| Camera | Ask for the whole page or strip, flat and evenly lit. Low contrast and odd layouts are the main causes of misreads. |
| Model updates | Treat models as firmware: sign them, pin their hashes, and update them only through your normal firmware path. |
| Licensing | Keep the Apache-2.0 notice for the bundled Paddle/RapidOCR models in your device's open-source notices. |

A build without bundled models is supported (`--no-default-features`), so firmware can carry the code and fetch nothing at runtime while models arrive with the app package.

The Passport Prime integration is the Penlock app, built at a hackathon by a team of three and tested only on the simulator. Before shipping, measure storage, memory and scan time on a real device.

## Mobile integration

The repository's `example-android-app` is the reference for phones: it reads Penlock strips and BIP39 pages through the camera, with the Rust crates compiled into the app.

1. Start from `example-android-app`. Its `rust/` workspace holds `bitcoin-vision-mobile`, the UniFFI bridge from Kotlin to both scanners.
2. Build it with `./gradlew :app:assembleDebug`: Gradle compiles the Rust code for Android, generates the Kotlin bindings and copies in the models.
3. Keep camera frames in memory. Do not write them to the gallery, cache or crash reports.
4. Follow the review flow in the next section before showing or using any result.

The example app is a full mainnet wallet: never import a real seed just to try it. The README includes emulator recordings of both flows; use them as the UX baseline. iOS has no example yet: the same Rust crates are the starting point.

## UX requirements

Never turn a scan straight into a wallet: every integration should run the same five steps, and let the user stop at any of them.

1. **Frame.** Show a live guide for the page or strip. Say up front: practice words for demos, a real backup only on a trusted offline device.
2. **Read.** Show progress through the stages: find, read, match, check.
3. **Review.** List every word or row. Mark low-confidence ones and ask the user to pick from the top candidates, showing the crop beside them. Never auto-pick a near tie such as abuse or amuse.
4. **Confirm.** Show whether the checksum or the Penlock row checks pass, and ask the user to compare with their paper anyway.
5. **Reveal and forget.** Keep words hidden until the user taps Reveal. One Forget action wipes the photo, crops and result.

For each word, keep its evidence one tap away: the crop, the OCR text and the top three candidates with their probabilities. That is what lets a user trust or correct the read.

## Security checklist

The photo, the crops and the JSON result can each contain the full secret, so your app must treat all three like the seed itself.

- [ ] No network permission in the scanning component, and no analytics or crash reporting that could capture images or results.
- [ ] Frames, crops and results held in memory only; nothing written to disk, gallery, clipboard or logs.
- [ ] One Forget action wipes the photo, crops and result, and runs automatically when the user leaves the flow.
- [ ] Words hidden until the user taps Reveal; no copy button on hardware wallets.
- [ ] Every low-confidence word or row confirmed by the user before use.
- [ ] Users told that a passing checksum is not proof, and asked to compare with their paper.
- [ ] Penlock users told to keep the three shares in separate places.
- [ ] Models signed and their hashes pinned; updated only through your firmware or app release path.
- [ ] Dependencies pinned to a commit, with the lockfile reviewed before release.
- [ ] Demos and marketing use practice words only, never a real backup.

## Limits and licensing

bitcoin-vision is an early, open-source prototype: plan your UX around its limits rather than hiding them.

- English BIP39 words only.
- Poor contrast, ambiguous letters and unusual page layouts cause misreads.
- A passing checksum does not prove a correct read.
- The crate is not published to crates.io (`publish = false`).

| Part | License |
| --- | --- |
| Project code and project-authored models | MIT or Apache-2.0, your choice |
| Paddle / RapidOCR models | Apache-2.0 only; keep their license and attribution when redistributing |

## Sources

- [penlock-io/bitcoin-vision README](https://github.com/penlock-io/bitcoin-vision)
- [Announcing Penlock v1 (bitcoindev)](https://groups.google.com/g/bitcoindev/c/8LkdxVc_nI0)
