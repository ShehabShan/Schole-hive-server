const store = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) if (now - v.start > 60 * 1000) store.delete(k);
}, 60 * 1000).unref();

function rateLimit({ windowMs = 60 * 1000, max = 20 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const entry = store.get(ip) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count += 1;
    store.set(ip, entry);
    if (entry.count > max) return res.status(429).json({ message: "Too many requests, try again later" });
    next();
  };
}

const authRateLimit = rateLimit({ windowMs: 60 * 1000, max: 20 });
const globalRateLimit = rateLimit({ windowMs: 60 * 1000, max: 100 });

module.exports = { rateLimit, authRateLimit, globalRateLimit };
