/**
 * WordPress REST calls use a dedicated Undici Agent with DNS-over-HTTPS fallback.
 * Vercel/serverless sometimes returns getaddrinfo ENOTFOUND for hostnames that resolve
 * fine in public DNS; resolving A records via DoH fixes uploads without changing Site URL.
 */
import dns from "node:dns";
import Undici, { Agent, fetch as undiciFetch, interceptors } from "undici";
import type { Agent as AgentType } from "undici";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

function dnsDohFallbackEnabled(): boolean {
  return (process.env.WORDPRESS_DNS_DOH_FALLBACK ?? "true").trim().toLowerCase() !== "false";
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

async function resolveIPv4ViaDoh(hostname: string): Promise<string | null> {
  const urls = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
  ];
  for (const url of urls) {
    try {
      const res = await globalThis.fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        Status?: number;
        Answer?: Array<{ type: number; data: string }>;
      };
      if (json.Status !== undefined && json.Status !== 0) continue;
      const a = json.Answer?.find((x) => x.type === 1);
      const data = a?.data?.trim();
      if (data && IPV4.test(data)) return data;
    } catch {
      /* try next provider */
    }
  }
  return null;
}

type DnsOpts = {
  dualStack?: boolean;
  affinity?: number | null;
};

/**
 * Undici DNS interceptor calls this with (origin, opts, cb) — see lib/interceptor/dns.js.
 * Package typings describe a different signature; runtime matches this implementation.
 */
function wordpressDnsLookup(
  origin: URL,
  opts: DnsOpts,
  cb: (
    err: NodeJS.ErrnoException | null,
    addresses: Array<{ address: string; family: 4 | 6; ttl: number }> | null
  ) => void
): void {
  const hostname = origin.hostname;
  const dualStack = opts.dualStack !== false;
  const affinity = opts.affinity;

  dns.lookup(
    hostname,
    {
      all: true,
      family: dualStack ? 0 : affinity ?? 4,
      order: "ipv4first",
    } as dns.LookupAllOptions,
    (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        const mapped = addresses.map((a) => ({
          address: a.address,
          family: a.family as 4 | 6,
          ttl: 60_000,
        }));
        return cb(null, mapped);
      }
      const primary = err as NodeJS.ErrnoException | undefined;
      if (!dnsDohFallbackEnabled() || primary?.code !== "ENOTFOUND") {
        return cb(primary ?? new Error("DNS lookup failed"), null);
      }
      resolveIPv4ViaDoh(hostname)
        .then((ip) => {
          if (!ip) return cb(primary, null);
          cb(null, [{ address: ip, family: 4, ttl: 60_000 }]);
        })
        .catch(() => cb(primary, null));
    }
  );
}

let wpAgent: AgentType | undefined;

export function getWpFetchDispatcher(): AgentType {
  if (!wpAgent) {
    wpAgent = new Agent({
      maxRedirections: 5,
      interceptors: {
        Agent: [
          Undici.createRedirectInterceptor({ maxRedirections: 5 }),
          interceptors.dns({
            dualStack: true,
            lookup: wordpressDnsLookup as never,
          }),
        ],
      },
    } as unknown as ConstructorParameters<typeof Agent>[0]);
  }
  return wpAgent;
}

export function wpFetch(...args: Parameters<typeof undiciFetch>): ReturnType<typeof undiciFetch> {
  const [input, init] = args;
  return undiciFetch(input, {
    ...init,
    dispatcher: getWpFetchDispatcher(),
  });
}
