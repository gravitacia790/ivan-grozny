// Curated publication hosts, not a guarantee that every page is historically correct.
export const trustedDomains = [
  "prlib.ru", "rusneb.ru", "rsl.ru", "nlr.ru", "runivers.ru",
  "rusarchives.ru", "archives.gov.ru", "rgada.info", "historyrussia.org",
  "hist.msu.ru", "history.spbu.ru", "pushkinskijdom.ru", "lib.pushkinskijdom.ru",
  "iriran.ru", "spbiiran.ru", "kreml.ru", "shm.ru", "bigenc.ru",
  "vostlit.info", "drevlit.ru", "drevne.ru"
] as const;

// Two independently filtered searches prevent one catalogue from dominating retrieval.
export const researchDomainGroups = [
  trustedDomains.filter(domain => ["bigenc.ru", "hist.msu.ru", "history.spbu.ru", "pushkinskijdom.ru", "lib.pushkinskijdom.ru", "iriran.ru", "spbiiran.ru", "vostlit.info", "drevlit.ru", "drevne.ru"].includes(domain)),
  trustedDomains.filter(domain => !["bigenc.ru", "hist.msu.ru", "history.spbu.ru", "pushkinskijdom.ru", "lib.pushkinskijdom.ru", "iriran.ru", "spbiiran.ru", "vostlit.info", "drevlit.ru", "drevne.ru"].includes(domain))
];

export type SourceReference = { id: string; title: string; url: string };
export function trustedUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1500) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (!trustedDomains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}
export function safeReferences(value: unknown): SourceReference[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap(source => {
    const url = trustedUrl(source?.url);
    return url && typeof source?.id === "string" && /^web-[1-9][0-9]?$/.test(source.id) && typeof source?.title === "string" && source.title.trim() && source.title.length <= 300
      ? [{ id: source.id, title: source.title.trim(), url }] : [];
  });
}
