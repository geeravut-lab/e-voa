// Copies the passport-reading engine (Tesseract OCR, runs inside the traveler's browser) from node_modules into public/ocr,
// so nothing is loaded from a third-party CDN and the photo never leaves the phone. Runs before `dev` and `build`; public/ocr is not committed.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "ocr");
const pkg = (name) => path.dirname(require.resolve(`${name}/package.json`));
try {
  mkdirSync(path.join(out, "core"), { recursive: true }); mkdirSync(path.join(out, "lang"), { recursive: true });
  cpSync(path.join(pkg("tesseract.js"), "dist", "worker.min.js"), path.join(out, "worker.min.js"));
  for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]) cpSync(path.join(pkg("tesseract.js-core"), f), path.join(out, "core", f));
  cpSync(path.join(pkg("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"), path.join(out, "lang", "eng.traineddata.gz"));
  console.log("ocr assets ready in public/ocr");
} catch (e) {
  console.warn("ocr assets could not be copied (passport photo reading will be unavailable):", e.message);
  if (!existsSync(out)) process.exitCode = 0;
}
