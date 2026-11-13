// Fixed public service endpoints only. No credentials or application messages are sent.
const dns = require("node:dns/promises");
const tls = require("node:tls");

async function probe(host, port, maxVersion) {
  const result = { host, port, maxVersion: maxVersion || "default", tcp: false, tls: false };
  const started = Date.now();
  try { result.dns = await dns.lookup(host, { all: true }); }
  catch (error) { return { ...result, error: error.code, elapsedMs: Date.now() - started }; }
  return new Promise(resolve => {
    let settled = false;
    const socket = tls.connect({ host, port, servername: host, family: 4, ...(maxVersion ? { maxVersion } : {}) });
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ ...result, elapsedMs: Date.now() - started });
    };
    const timer = setTimeout(() => { result.error = "PROBE_TIMEOUT"; done(); }, 7000);
    socket.on("connect", () => { result.tcp = true; result.tcpMs = Date.now() - started; });
    socket.on("secureConnect", () => {
      result.tls = true;
      result.protocol = socket.getProtocol();
      result.authorized = socket.authorized;
      done();
    });
    socket.on("error", error => { result.error = error.code || error.name; done(); });
  });
}

exports.checkNetwork = async function checkNetwork() {
  return {
    proxyVariablesPresent: ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"].filter(name => Boolean(process.env[name])),
    tlsBundleConfigured: Boolean(process.env.NODE_EXTRA_CA_CERTS),
    probes: await Promise.all([
      probe("ngw.devices.sberbank.ru", 9443),
      probe("ngw.devices.sberbank.ru", 9443, "TLSv1.2"),
      probe("api.giga.chat", 443),
      probe("ai.api.cloud.yandex.net", 443)
    ])
  };
};
