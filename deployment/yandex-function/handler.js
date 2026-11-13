// Yandex HTTPS event adapter. All chat behavior stays in the existing route.
const api = require("./route.js");

exports.handler = async function handler(event) {
  // HTTP requests always have httpMethod; diagnostics require a direct Cloud API invocation.
  if (event?.diagnostic === "gigachat-access" && Object.keys(event).length === 1) {
    return require("./check-access.js").checkAccess();
  }
  const method = String(event?.httpMethod || "").toUpperCase();
  if (!["GET", "POST", "OPTIONS"].includes(method)) {
    return { statusCode: 405, headers: { Allow: "GET, POST, OPTIONS" }, body: "", isBase64Encoded: false };
  }
  let request;
  try {
    const headers = new Headers(event.headers || {});
    if (!headers.has("host")) headers.set("host", "functions.yandexcloud.net");
    const body = method === "POST"
      ? Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8")
      : undefined;
    request = new Request("https://functions.yandexcloud.net/api/chat", { method, headers, body });
  } catch {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Не удалось прочитать запрос." }), isBase64Encoded: false };
  }
  const response = await api[method](request);
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
    isBase64Encoded: false,
  };
};
