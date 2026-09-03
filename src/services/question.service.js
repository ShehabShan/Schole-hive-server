const { QUESTION_CATEGORIES } = require("../constants/qa.constants");

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuestionFilter(q) {
  const filter = {};

  const category = String(q.category || "").trim().toLowerCase();
  if (category) {
    // accept both slug and label — normalize to slug
    filter.category = category;
  }

  const tag = String(q.tag || q.tags || "").trim().toLowerCase();
  if (tag) filter.tags = tag;

  const dest = String(q.destinationCountry || q.destination || "").trim();
  if (dest) filter["context.destinationCountry"] = { $regex: `^${escapeRegex(dest)}$`, $options: "i" };

  const home = String(q.homeCountry || q.home || "").trim();
  if (home) filter["context.homeCountry"] = { $regex: `^${escapeRegex(home)}$`, $options: "i" };

  const level = String(q.studyLevel || q.level || "").trim().toLowerCase();
  if (level) filter["context.studyLevel"] = level;

  const rawQ = String(q.q || q.search || "").trim();
  if (rawQ) {
    const rx = { $regex: escapeRegex(rawQ.slice(0, 100)), $options: "i" };
    // do not override existing filter keys — combine via $and if needed
    const textOr = [{ title: rx }, { body: rx }, { tags: rx }];
    if (Object.keys(filter).length) {
      // wrap existing filter + text search in $and
      const and = [{ ...filter }, { $or: textOr }];
      return { $and: and };
    }
    filter.$or = textOr;
  }

  return filter;
}

function buildQuestionSort(sort, hasQ) {
  const s = String(sort || "").toLowerCase();
  if (s === "votes" || s === "votes-desc") return { voteScore: -1, createdAt: -1 };
  if (s === "votes-asc") return { voteScore: 1, createdAt: -1 };
  if (s === "views") return { viewCount: -1, createdAt: -1 };
  if (s === "oldest") return { createdAt: 1 };
  if (s === "relevance" && hasQ) return { voteScore: -1, viewCount: -1, createdAt: -1 };
  // default newest
  return { createdAt: -1, _id: -1 };
}

function normalizeQuestionPatch(body) {
  const b = { ...body };
  delete b._id;
  delete b.authorId;
  delete b.authorEmail;
  delete b.authorRole;
  delete b.voteScore;
  delete b.viewCount;
  delete b.acceptedAnswerId;
  delete b.createdAt;
  // allow mutable fields only
  const out = {};
  if (b.title !== undefined) out.title = String(b.title).trim().slice(0, 300);
  if (b.body !== undefined) out.body = String(b.body).trim().slice(0, 10000);
  if (b.category !== undefined) {
    const cat = String(b.category).trim().toLowerCase();
    if (QUESTION_CATEGORIES.includes(cat)) out.category = cat;
  }
  if (b.tags !== undefined && Array.isArray(b.tags)) out.tags = b.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 5);
  if (b.context !== undefined && typeof b.context === "object" && b.context) {
    const ctx = {};
    if (b.context.destinationCountry !== undefined) ctx.destinationCountry = b.context.destinationCountry ? String(b.context.destinationCountry).trim().slice(0, 80) : null;
    if (b.context.homeCountry !== undefined) ctx.homeCountry = b.context.homeCountry ? String(b.context.homeCountry).trim().slice(0, 80) : null;
    if (b.context.studyLevel !== undefined) ctx.studyLevel = b.context.studyLevel ? String(b.context.studyLevel).trim().toLowerCase().slice(0, 40) : null;
    if (b.context.fieldOfStudy !== undefined) ctx.fieldOfStudy = b.context.fieldOfStudy ? String(b.context.fieldOfStudy).trim().slice(0, 80) : null;
    // merge with existing will be done in controller via $set with dot notation
    out.context = ctx;
  }
  if (b.language !== undefined) out.language = String(b.language).trim().toLowerCase().slice(0, 20);
  out.updatedAt = new Date();
  return out;
}

module.exports = { buildQuestionFilter, buildQuestionSort, normalizeQuestionPatch };
