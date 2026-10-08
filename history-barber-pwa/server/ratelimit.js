// Fixed-window, in-memory rate limiter keyed by client IP. Enough for a single
// shop server; behind a reverse proxy set TRUST_PROXY so req.ip is the client.

export function rateLimit({ windowMs, max, now = Date.now }) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const t = now();
    for (const [key, entry] of hits) if (entry.reset <= t) hits.delete(key);
  }, windowMs);
  sweep.unref();

  return function limiter(req, res, next) {
    const t = now();
    const key = req.ip ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.reset <= t) {
      entry = { count: 0, reset: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.reset - t) / 1000)));
      return res.status(429).json({ error: "rate_limited", message: "Troppe richieste. Riprova tra qualche minuto." });
    }
    next();
  };
}
