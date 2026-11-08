import { cp, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, ".next/standalone");
await access(join(output, "server.js"));
await cp(join(root, "public"), join(output, "public"), { recursive: true });
await cp(join(root, ".next/static"), join(output, ".next/static"), { recursive: true });
await cp(join(root, "content"), join(output, "content"), { recursive: true });
console.log("Standalone package prepared: application, public assets and teacher materials.");
