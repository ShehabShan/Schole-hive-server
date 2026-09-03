const { isValidObjectId } = require("./objectId");

function isValidUrl(str) {
  if (!str) return true; // optional
  try {
    const u = new URL(String(str));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateAnswerPayload(payload) {
  const errors = [];
  const data = { ...payload };

  if (!data.body || typeof data.body !== "string" || !data.body.trim()) {
    errors.push("body is required");
  } else if (data.body.trim().length < 20) {
    errors.push("body must be at least 20 characters");
  } else if (data.body.trim().length > 10000) {
    errors.push("body must be at most 10000 characters");
  }

  if (data.sourceLink != null && String(data.sourceLink).trim() !== "") {
    if (!isValidUrl(data.sourceLink)) errors.push("sourceLink must be a valid http(s) URL");
    else data.sourceLink = String(data.sourceLink).trim();
  } else {
    data.sourceLink = null;
  }

  if (data.questionId != null && !isValidObjectId(String(data.questionId))) {
    errors.push("questionId must be a valid ObjectId");
  }

  return { valid: errors.length === 0, errors, data };
}

function buildAnswerDoc({ payload, questionId, author }) {
  const now = new Date();
  return {
    questionId: questionId, // ObjectId expected, caller converts
    body: String(payload.body).trim(),
    sourceLink: payload.sourceLink ? String(payload.sourceLink).trim() : null,
    authorId: author?.userId || author?._id || null,
    authorEmail: author?.email || null,
    authorRole: author?.role || "user",
    authorIsVerified: Boolean(author?.isVerified),
    createdAt: now,
    updatedAt: now,
    voteScore: 0,
    upvoterIds: [],
    downvoterIds: [],
    accepted: false,
    downvoteReasons: [],
  };
}

module.exports = { validateAnswerPayload, buildAnswerDoc, isValidUrl };
