// Prints a new Web Push key pair (VAPID) to the terminal. Nothing is written to a file: copy the two values into the environment settings (Vercel) yourself.
import { createRequire } from "node:module";
const webpush = createRequire(import.meta.url)("web-push");
const k = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=mailto:you@example.com   # an address of yours, or your https site`);
