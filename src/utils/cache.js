const cache = new Map();

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { cache.delete(key); return null; }
  return entry.value;
}
function set(key, value, ttlMs = 60 * 1000) {
  cache.set(key, { value, expiry: Date.now() + ttlMs });
  if (cache.size > 200) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}
function middleware(ttlMs = 60 * 1000) {
  return (req, res, next) => {
    if (req.method !== "GET") return next();
    const key = `${req.path}?${JSON.stringify(req.query)}`;
    const hit = get(key);
    if (hit) {
      res.setHeader("X-Cache", "HIT");
      return res.json(hit);
    }
    const origJson = res.json.bind(res);
    res.json = (body) => {
      set(key, body, ttlMs);
      res.setHeader("X-Cache", "MISS");
      return origJson(body);
    };
    next();
  };
}
module.exports = { get, set, middleware };
