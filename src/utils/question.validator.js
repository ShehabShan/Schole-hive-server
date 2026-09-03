const { QUESTION_CATEGORIES, QUESTION_TAGS, QUESTION_LANGUAGES, STUDY_LEVELS } = require("../constants/qa.constants");

function validateQuestionPayload(payload) {
  const errors = [];
  const data = { ...payload };

  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    errors.push("title is required");
  } else if (data.title.trim().length < 10) {
    errors.push("title must be at least 10 characters");
  } else if (data.title.trim().length > 300) {
    errors.push("title must be at most 300 characters");
  }

  if (!data.body || typeof data.body !== "string" || !data.body.trim()) {
    errors.push("body is required");
  } else if (data.body.trim().length < 20) {
    errors.push("body must be at least 20 characters");
  }

  if (!data.category || !QUESTION_CATEGORIES.includes(data.category)) {
    errors.push(`category must be one of: ${QUESTION_CATEGORIES.join(", ")}`);
  }

  if (!Array.isArray(data.tags) || data.tags.length < 1 || data.tags.length > 5) {
    errors.push("tags must be an array of 1..5 items");
  } else {
    const invalid = data.tags.filter((t) => typeof t !== "string" || !t.trim());
    if (invalid.length) errors.push("tags must be non-empty strings");
    // normalize to slug form (lowercase, trimmed)
    data.tags = data.tags.map((t) => String(t).trim().toLowerCase());
    // optional: warn if not in controlled vocab — V1 allows free-form, so no hard block
  }

  if (data.language && !QUESTION_LANGUAGES.includes(String(data.language).toLowerCase())) {
    errors.push(`language must be one of: ${QUESTION_LANGUAGES.join(", ")}`);
  }

  // context is optional but strongly prompted — validate subfields if provided
  if (data.context) {
    if (typeof data.context !== "object") errors.push("context must be an object");
    else {
      const ctx = data.context;
      if (ctx.studyLevel && !STUDY_LEVELS.includes(String(ctx.studyLevel).toLowerCase())) {
        errors.push(`context.studyLevel must be one of: ${STUDY_LEVELS.join(", ")}`);
      }
      // destinationCountry/homeCountry/fieldOfStudy are free-form strings in V1 — just check type if present
      for (const k of ["destinationCountry", "homeCountry", "fieldOfStudy"]) {
        if (ctx[k] != null && typeof ctx[k] !== "string") errors.push(`context.${k} must be a string`);
      }
    }
  }

  return { valid: errors.length === 0, errors, data };
}

function buildQuestionDoc({ payload, author }) {
  const now = new Date();
  const normalized = {
    title: String(payload.title).trim(),
    body: String(payload.body).trim(),
    category: payload.category,
    tags: payload.tags.map((t) => String(t).trim().toLowerCase()),
    context: {
      destinationCountry: payload.context?.destinationCountry ? String(payload.context.destinationCountry).trim() : null,
      homeCountry: payload.context?.homeCountry ? String(payload.context.homeCountry).trim() : null,
      studyLevel: payload.context?.studyLevel ? String(payload.context.studyLevel).trim().toLowerCase() : null,
      fieldOfStudy: payload.context?.fieldOfStudy ? String(payload.context.fieldOfStudy).trim() : null,
    },
    language: payload.language ? String(payload.language).toLowerCase() : "english",
    authorId: author?.userId || author?._id || null,
    authorEmail: author?.email || null,
    authorRole: author?.role || "user",
    createdAt: now,
    updatedAt: now,
    acceptedAnswerId: null,
    voteScore: 0,
    viewCount: 0,
    upvoterIds: [],
  };
  return normalized;
}

module.exports = { validateQuestionPayload, buildQuestionDoc, QUESTION_CATEGORIES, QUESTION_TAGS, QUESTION_LANGUAGES };
