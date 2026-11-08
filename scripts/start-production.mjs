import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const server = new URL("../.next/standalone/server.js", import.meta.url);
try { await access(fileURLToPath(server)); }
catch { console.error("Сначала выполните npm run build."); process.exit(1); }
process.env.HOSTNAME = process.argv.includes("--local") ? "127.0.0.1" : "0.0.0.0";
process.env.PORT ||= "3000";
process.env.NODE_ENV = "production";
await import(server.href);
