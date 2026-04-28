import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const alpineSource = resolve(root, "node_modules/alpinejs/dist/cdn.min.js");
const alpineTarget = resolve(root, "assets/vendor/alpinejs/cdn.min.js");

await mkdir(dirname(alpineTarget), { recursive: true });
await copyFile(alpineSource, alpineTarget);

console.log("Synced Alpine.js to assets/vendor/alpinejs/cdn.min.js");
