import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const { handler } = createRequire(import.meta.url)("../.yandex-function/handler.js");
process.env.AI_PROVIDER = "yandex";
process.env.YANDEX_FOLDER_ID = "test-folder";
process.env.CHAT_ALLOWED_ORIGINS = "https://gravitacia790.github.io";
delete process.env.YANDEX_API_KEY;
globalThis.fetch = async () => { throw new Error("Network calls are forbidden in transport checks"); };
const headers = { origin: "https://gravitacia790.github.io", host: "functions.yandexcloud.net", "content-type": "application/json" };
const status = await handler({ httpMethod: "GET", headers });
assert.equal(status.statusCode, 200);
assert.equal(JSON.parse(status.body).configured, false);
assert.equal(status.headers["access-control-allow-origin"], headers.origin);
const preflight = await handler({ httpMethod: "OPTIONS", headers });
assert.equal(preflight.statusCode, 204);
assert.equal(preflight.body, "");
assert.equal((await handler({ httpMethod: "GET", headers: { ...headers, origin: "https://other.example" } })).statusCode, 403);
assert.equal((await handler({ httpMethod: "DELETE", headers })).statusCode, 405);
process.env.YANDEX_API_KEY = "synthetic-key-never-sent";
const body = JSON.stringify({ session: randomUUID(), messages: [{ role: "user", content: "Покажи источники" }] });
const plain = await handler({ httpMethod: "POST", headers, body, isBase64Encoded: false });
const encoded = await handler({ httpMethod: "POST", headers, body: Buffer.from(body).toString("base64"), isBase64Encoded: true });
assert.equal(plain.statusCode, 200);
assert.equal(encoded.statusCode, 200);
assert.deepEqual(JSON.parse(encoded.body), JSON.parse(plain.body));
assert.ok(JSON.parse(encoded.body).answer);
assert.equal((await handler({ httpMethod: "POST", headers, body: "{broken" })).statusCode, 400);
process.env.GIGACHAT_CREDENTIALS = "synthetic-giga-key";
const tlsFailure = Object.assign(new TypeError("fetch failed"), { cause: { code: "SELF_SIGNED_CERT_IN_CHAIN" } });
globalThis.fetch = async () => { throw tlsFailure; };
const diagnostic = await handler({ diagnostic: "gigachat-access" });
assert.equal(diagnostic.failure.stage, "oauth");
assert.equal(diagnostic.failure.code, "SELF_SIGNED_CERT_IN_CHAIN");
assert.ok(!JSON.stringify(diagnostic).includes(process.env.GIGACHAT_CREDENTIALS));
// Public HTTP input cannot select the direct Cloud API diagnostic route.
assert.equal((await handler({ httpMethod: "GET", headers, diagnostic: "gigachat-access" })).statusCode, 200);
let accessCalls = 0;
globalThis.fetch = async () => ++accessCalls === 1
  ? Response.json({ access_token: "synthetic-token" })
  : Response.json({ data: [{ id: "GigaChat-3-Ultra" }] });
const access = await handler({ diagnostic: "gigachat-access" });
assert.equal(access.oauthStatus, 200);
assert.equal(access.modelsStatus, 200);
assert.equal(access.selectedModelAvailable, true);
assert.equal(accessCalls, 2);
console.log("Yandex HTTPS transport checks passed: status, CORS, preflight, method rejection, UTF-8/base64 requests, invalid JSON; no model calls.");
