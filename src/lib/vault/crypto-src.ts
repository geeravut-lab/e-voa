// The encryption of the offline vault, as JavaScript SOURCE TEXT that is placed inside the vault page (the page must work with no network and no app code).
// The same text is run by the unit tests in Node (which has the same WebCrypto), so what the phone runs is what was tested.
// A passcode is stretched with PBKDF2-SHA-256 (250,000 rounds, random 16-byte salt) into an AES-256-GCM key; every record gets its own random 12-byte IV.
// This protects a lost or borrowed phone from casual opening. It is not a bank vault: a short passcode can be guessed by someone who copies the phone's storage.
export const VAULT_CRYPTO_SRC = `
var VaultCrypto = (function () {
  var enc = new TextEncoder(), dec = new TextDecoder(), ITER = 250000;
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  async function deriveKey(pass, salt, iter) {
    var base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter || ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function seal(key, bytes) { var iv = rand(12); var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, bytes); return { iv: iv, ct: new Uint8Array(ct) }; }
  async function open(key, iv, ct) { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct)); }
  async function sealJson(key, obj) { return seal(key, enc.encode(JSON.stringify(obj))); }
  async function openJson(key, iv, ct) { return JSON.parse(dec.decode(await open(key, iv, ct))); }
  return { ITER: ITER, rand: rand, deriveKey: deriveKey, seal: seal, open: open, sealJson: sealJson, openJson: openJson };
})();
`;
