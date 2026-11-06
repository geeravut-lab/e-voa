"use client";

// Looks at the face photo inside the browser (a small face detector, files served from /face, nothing is uploaded): is there exactly one face, is it big enough,
// roughly centred, upright and facing the camera. Advice only: the traveler can always keep the photo. Light, sharpness and background are checked on the server.
export type FaceWarning = "none" | "many" | "small" | "big" | "off" | "tilt" | "turned";
type Box = { x: number; y: number; width: number; height: number };
type Pt = { x: number; y: number };

/** The judgement, kept separate from the detector so it can be tested on its own. Sizes are relative to the picture. */
export function judgeFace(img: { width: number; height: number }, faces: { box: Box; leftEye?: Pt; rightEye?: Pt; nose?: Pt }[]): FaceWarning[] {
  if (faces.length === 0) return ["none"];
  if (faces.length > 1) return ["many"];
  const { box, leftEye, rightEye, nose } = faces[0];
  const out: FaceWarning[] = [];
  const h = box.height / img.height;
  if (h < 0.3) out.push("small"); else if (h > 0.85) out.push("big");
  const cx = (box.x + box.width / 2) / img.width, cy = (box.y + box.height / 2) / img.height;
  if (Math.abs(cx - 0.5) > 0.18 || cy < 0.2 || cy > 0.65) out.push("off");
  if (leftEye && rightEye) {
    const angle = Math.abs((Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI);
    if (angle > 10) out.push("tilt");
    if (nose) { const mid = (leftEye.x + rightEye.x) / 2, eyes = Math.max(Math.abs(rightEye.x - leftEye.x), 1); if (Math.abs(nose.x - mid) / eyes > 0.3) out.push("turned"); }
  }
  return out;
}

type FaceApi = {
  nets: { tinyFaceDetector: { loadFromUri: (u: string) => Promise<void> }; faceLandmark68TinyNet: { loadFromUri: (u: string) => Promise<void> } };
  TinyFaceDetectorOptions: new (o: { inputSize: number; scoreThreshold: number }) => unknown;
  detectAllFaces: (img: HTMLImageElement, o: unknown) => { withFaceLandmarks: (tiny: boolean) => Promise<{ detection: { box: Box }; landmarks: { getLeftEye: () => Pt[]; getRightEye: () => Pt[]; getNose: () => Pt[] } }[]> };
};
let loading: Promise<FaceApi> | null = null;
function load(): Promise<FaceApi> {
  loading ??= new Promise<FaceApi>((resolve, reject) => {
    const s = document.createElement("script"); s.src = "/face/face-api.js"; s.async = true;
    s.onload = async () => { try { const api = (window as unknown as { faceapi: FaceApi }).faceapi; await api.nets.tinyFaceDetector.loadFromUri("/face/model"); await api.nets.faceLandmark68TinyNet.loadFromUri("/face/model"); resolve(api); } catch (e) { reject(e); } };
    s.onerror = () => reject(new Error("face detector could not be loaded"));
    document.head.appendChild(s);
  }).catch((e) => { loading = null; throw e; });
  return loading;
}

const mean = (pts: Pt[]) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** Returns the warnings, or null when the detector could not run (then nothing is said: advice must never be a guess). */
export async function checkFace(file: File): Promise<FaceWarning[] | null> {
  const url = URL.createObjectURL(file);
  try {
    const api = await load();
    const img = new Image(); img.src = url; await img.decode();
    const found = await api.detectAllFaces(img, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })).withFaceLandmarks(true);
    return judgeFace({ width: img.naturalWidth, height: img.naturalHeight }, found.map((f) => ({ box: f.detection.box, leftEye: mean(f.landmarks.getLeftEye()), rightEye: mean(f.landmarks.getRightEye()), nose: mean(f.landmarks.getNose()) })));
  } catch (e) { console.error("[face]", (e as Error).message); return null; }
  finally { URL.revokeObjectURL(url); }
}
