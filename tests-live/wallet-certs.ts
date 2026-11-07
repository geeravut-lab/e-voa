// Throw-away certificates for testing Apple Wallet code without an Apple account: a stand-in "WWDR" authority, a signer certificate issued by it,
// and a self-signed server certificate for a local push server. Made with the openssl command line; nothing here is ever used outside tests.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function makeTestCerts() {
  const d = mkdtempSync(join(tmpdir(), "wallet-certs-")), f = (n: string) => join(d, n), run = (...a: string[]) => execFileSync("openssl", a, { stdio: "pipe" });
  try {
    run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", f("ca.key"), "-out", f("ca.pem"), "-subj", "/CN=Test WWDR", "-days", "2");
    run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", f("sig.key"), "-out", f("sig.csr"), "-subj", "/CN=Pass Type ID: pass.test.evoa/OU=ABCDE12345");
    run("x509", "-req", "-in", f("sig.csr"), "-CA", f("ca.pem"), "-CAkey", f("ca.key"), "-CAcreateserial", "-out", f("sig.pem"), "-days", "2");
    writeFileSync(f("san.cnf"), "subjectAltName=IP:127.0.0.1,DNS:localhost");
    run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", f("srv.key"), "-out", f("srv.pem"), "-subj", "/CN=localhost", "-days", "2", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost");
    const r = (n: string) => readFileSync(f(n), "utf8");
    return { wwdr: r("ca.pem"), signerCert: r("sig.pem"), signerKey: r("sig.key"), serverCert: r("srv.pem"), serverKey: r("srv.key") };
  } finally { rmSync(d, { recursive: true, force: true }); }
}

/** Reads the files inside a zip (a .pkpass) without extra libraries: stored or deflated entries only. */
export function readZip(buf: Buffer): Map<string, Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const out = new Map<string, Buffer>();
  let eocd = buf.length - 22; while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip");
  let p = buf.readUInt32LE(eocd + 16); const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen), lh = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), raw = buf.subarray(lh, lh + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw)); p += 46 + nlen + elen + clen;
  }
  return out;
}
