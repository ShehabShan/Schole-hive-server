function parsePagination(query, defaults = { page: 1, limit: 12, maxLimit: 50 }) {
  const page = Math.max(1, parseInt(String(query.page || defaults.page), 10) || defaults.page);
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(String(query.limit || defaults.limit), 10) || defaults.limit)
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { parsePagination };
