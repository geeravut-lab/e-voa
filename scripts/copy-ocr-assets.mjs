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
  // face detector for the photo check (also runs in the browser, files served from /face)
  const face = pkg("@vladmandic/face-api"), fout = path.join(root, "public", "face", "model");
  mkdirSync(fout, { recursive: true });
  cpSync(path.join(face, "dist", "face-api.js"), path.join(root, "public", "face", "face-api.js"));
  for (const f of ["tiny_face_detector_model-weights_manifest.json", "tiny_face_detector_model.bin", "face_landmark_68_tiny_model-weights_manifest.json", "face_landmark_68_tiny_model.bin"]) cpSync(path.join(face, "model", f), path.join(fout, f));
  console.log("face assets ready in public/face");
} catch (e) {
  console.warn("ocr assets could not be copied (passport photo reading will be unavailable):", e.message);
  if (!existsSync(out)) process.exitCode = 0;
}
