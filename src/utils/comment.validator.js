const { ObjectId } = require("mongodb");

function validateCommentPayload(payload) {
  const errors = [];
  const data = { ...payload };
  if (!data.body || typeof data.body !== "string" || !data.body.trim()) {
    errors.push("body is required");
  } else if (data.body.trim().length < 1) {
    errors.push("body must be at least 1 character");
  } else if (data.body.trim().length > 500) {
    errors.push("body must be at most 500 characters");
  } else {
    data.body = String(data.body).trim();
  }
  if (data.parentCommentId) {
    try { new ObjectId(String(data.parentCommentId)); data.parentCommentId = String(data.parentCommentId); }
    catch { errors.push("parentCommentId invalid"); }
  } else {
    data.parentCommentId = null;
  }
  return { valid: errors.length === 0, errors, data };
}

function buildCommentDoc({ payload, questionId, author }) {
  const now = new Date();
  return {
    questionId,
    parentCommentId: payload.parentCommentId ? new ObjectId(payload.parentCommentId) : null,
    body: payload.body,
    authorId: author?._id || author?.userId || null,
    authorEmail: author?.email || null,
    authorRole: author?.role || "user",
    authorIsVerified: Boolean(author?.isVerified),
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { validateCommentPayload, buildCommentDoc };
