#!/usr/bin/env bash
# Builds bitcoin-vision for the browser into public/vision/:
#   public/vision/pkg/     the WebAssembly module and its JS glue
#   public/vision/models/  the ONNX models and their text files (~25 MB)
#
# Needs: git, cargo with the wasm32-unknown-unknown target, and
#        wasm-bindgen-cli at the same version as wasm/Cargo.toml pins.
set -euo pipefail

UPSTREAM_URL="https://github.com/penlock-io/bitcoin-vision.git"
UPSTREAM_REV="219cc1381f42d8fde5703fdc3f24993ea0bd47a2"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UP="$ROOT/wasm/upstream"
OUT="$ROOT/public/vision"

# 1. Upstream at the pinned commit, with our patches.
if [ ! -d "$UP/.git" ]; then
  git init -q "$UP"
  git -C "$UP" remote add origin "$UPSTREAM_URL"
fi
if [ "$(git -C "$UP" rev-parse -q --verify HEAD 2>/dev/null || true)" != "$UPSTREAM_REV" ]; then
  echo "› fetching penlock-io/bitcoin-vision@${UPSTREAM_REV:0:7}"
  git -C "$UP" fetch -q --depth 1 origin "$UPSTREAM_REV"
  git -C "$UP" checkout -q --force "$UPSTREAM_REV"
fi
git -C "$UP" reset -q --hard "$UPSTREAM_REV"
for p in "$ROOT"/wasm/patches/*.patch; do
  echo "› applying $(basename "$p")"
  git -C "$UP" apply "$p"
done

# 2. Compile. simd128 lets tract use its WebAssembly SIMD kernels
#    (every current browser supports it).
echo "› compiling to WebAssembly (first build takes a few minutes)"
RUSTFLAGS="-C target-feature=+simd128" \
  cargo build --release --target wasm32-unknown-unknown \
  --manifest-path "$ROOT/wasm/Cargo.toml"

# 3. JS bindings, as an ES module a Web Worker can import.
rm -rf "$OUT/pkg"
wasm-bindgen --target web --no-typescript --remove-name-section --remove-producers-section --out-dir "$OUT/pkg" \
  "$ROOT/wasm/target/wasm32-unknown-unknown/release/bitcoin_vision_wasm.wasm"

# Optional: shrink with binaryen's wasm-opt if it is installed.
if command -v wasm-opt >/dev/null 2>&1; then
  echo "› wasm-opt"
  wasm-opt -O3 --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int \
    --enable-sign-ext --enable-mutable-globals \
    "$OUT/pkg/bitcoin_vision_wasm_bg.wasm" -o "$OUT/pkg/bitcoin_vision_wasm_bg.wasm"
fi

# A browser must never pair this build's JS glue with another build's cached
# .wasm: their import names differ and the module will not start. The page
# reads this id and loads the worker, the glue and the cache under it.
shasum -a 256 "$OUT/pkg/bitcoin_vision_wasm_bg.wasm" "$OUT/pkg/bitcoin_vision_wasm.js" | shasum -a 256 | cut -c1-12 > "$OUT/pkg/build-id.txt"

# 4. Models.
mkdir -p "$OUT/models"
cp "$UP"/words/models/{word-detector.onnx,word-reference.onnx,word-reference.calibration,text-recogniser.onnx,text-recogniser.dict.txt} "$OUT/models/"
cp "$UP"/penlock-scan/models/cell-reference.onnx "$OUT/models/"
cp "$UP"/words/models/{NOTICE,LICENSE-APACHE} "$OUT/models/"

echo "✓ built:"
ls -lh "$OUT/pkg" "$OUT/models" | grep -v '^total'
