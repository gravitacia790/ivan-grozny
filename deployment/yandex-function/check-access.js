// Direct Cloud API diagnostic event; OAuth/models do not generate text.
const { randomUUID } = require("node:crypto");
const { gigachatFetch } = require("./gigachat.js");
exports.checkAccess = async function checkAccess() {
  const result = { configured: Boolean(process.env.GIGACHAT_CREDENTIALS), tlsBundleConfigured: Boolean(process.env.NODE_EXTRA_CA_CERTS), transport: process.env.GIGACHAT_TRANSPORT || "fetch" };
  if (!result.configured) return result;
  let stage = "oauth";
  const started = Date.now();
  try {
    const response = await gigachatFetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${process.env.GIGACHAT_CREDENTIALS}`, RqUID: randomUUID(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ scope: process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS" }).toString()
    });
    result.oauthStatus = response.status;
    if (!response.ok) return result;
    const data = await response.json();
    stage = "models";
    const models = await gigachatFetch("https://api.giga.chat/v1/models", {
      headers: { Authorization: `Bearer ${data.access_token}` }, signal: AbortSignal.timeout(15000)
    });
    result.modelsStatus = models.status;
    if (models.ok) result.selectedModelAvailable = (await models.json()).data?.some(model => model.id === (process.env.GIGACHAT_MODEL || "GigaChat-3-Ultra")) || false;
  } catch (error) {
    result.failure = { stage, name: error.name, code: error.cause?.code || error.code || "unknown" };
  } finally {
    result.elapsedMs = Date.now() - started;
  }
  return result;
};
