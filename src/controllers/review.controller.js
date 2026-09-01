const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const env = require("../config/env");
const { recalcScholarshipRating } = require("../services/review.service");

async function createReview(req, res) {
  const { comment, rating, scholarShip_id, reviewer_postDate } = req.body;
  const email = req.decoded.email;
  const sid = String(scholarShip_id || "").trim();
  if (!sid) return res.status(400).json({ message: "scholarShip_id is required" });

  const { scholership, reviews, apply } = getCollections();
  let scholarship;
  try { scholarship = await scholership.findOne({ _id: new ObjectId(sid) }); } catch { return res.status(400).json({ message: "Invalid scholarship id" }); }
  if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });

  const numRating = Number(rating);
  if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) return res.status(400).json({ message: "rating must be 1-5" });
  const cleanComment = String(comment || "").trim();
  if (cleanComment.length < 5 || cleanComment.length > 500) return res.status(400).json({ message: "comment must be 5-500 characters" });

  const acceptedApply = await apply.findOne({ email, scholarship_id: sid, applicationStatus: "accepted" });
  if (!acceptedApply) return res.status(403).json({ message: "You can only review after your application is accepted by moderator" });

  const existing = await reviews.findOne({ reviewer_email: email, scholarShip_id: sid });
  if (existing) return res.status(409).json({ message: "You have already reviewed this scholarship. You can edit your existing review." });

  const now = new Date();
  const autoApproved = env.REVIEW_AUTO_APPROVE;
  const doc = {
    comment: cleanComment,
    rating: numRating,
    scholarShip_id: sid,
    reviewer_email: email,
    reviewer_id: req.authUser?._id || null,
    reviewer_name: req.authUser?.name || req.authUser?.displayName || email,
    reviewer_photo: req.authUser?.photoURL || req.body.reviewer_photo || null,
    reviewer_postDate: reviewer_postDate || now.toISOString().slice(0, 10),
    status: autoApproved ? "approved" : "pending",
    isVerified: true,
    appliedApplicationId: acceptedApply._id,
    createdAt: now,
    updatedAt: now,
    moderatedBy: autoApproved ? "system:auto-approve" : null,
    moderatedAt: autoApproved ? now : null,
    moderationReason: null,
    isEdited: false,
    history: [],
  };
  try {
    const result = await reviews.insertOne(doc);
    if (autoApproved) await recalcScholarshipRating(sid);
    res.status(201).json({ message: autoApproved ? "Review submitted and approved" : "Review submitted and pending moderation", data: result });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "You have already reviewed this scholarship" });
    throw error;
  }
}

async function listReviews(req, res) {
  const { email: queryEmail, status, scholarShip_id, q, page = "1", limit = "50" } = req.query;
  const role = req.authUser?.role;
  const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
  let query = {};
  if (queryEmail) {
    if (queryEmail !== req.decoded.email && !isStaff) return res.status(403).json({ message: "forbidden: can only view own reviews" });
    query.reviewer_email = queryEmail;
  } else if (!isStaff) {
    query.reviewer_email = req.decoded.email;
  }
  if (status) {
    const allowed = ["pending", "approved", "rejected", "hidden", "removed"];
    if (!allowed.includes(String(status))) return res.status(400).json({ message: "invalid status" });
    if (!isStaff && String(status) !== "approved" && queryEmail !== req.decoded.email) query.status = "approved";
    else query.status = String(status);
  }
  if (scholarShip_id) query.scholarShip_id = String(scholarShip_id);
  if (q) query.comment = { $regex: String(q).slice(0, 100), $options: "i" };
  const pg = Math.max(1, parseInt(String(page), 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const skip = (pg - 1) * lim;
  const { reviews, scholership } = getCollections();
  const reviewResult = await reviews.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).toArray();
  const validIds = [];
  for (const item of reviewResult) { try { validIds.push(new ObjectId(item.scholarShip_id)); } catch {} }
  const reviewDetails = validIds.length ? await scholership.find({ _id: { $in: validIds } }).toArray() : [];
  const detailById = new Map(reviewDetails.map((d) => [String(d._id), d]));
  const combineResult = reviewResult.map((r) => ({ ...r, scholership_details: detailById.get(String(r.scholarShip_id)) || null }));
  res.status(200).json({ message: "All review get successfully", data: combineResult });
}

async function getReviewsByScholarship(req, res) {
  const id = req.params.id;
  const query = { scholarShip_id: String(id), status: "approved" };
  const { reviews, scholership } = getCollections();
  const reviewResult = await reviews.find(query).sort({ createdAt: -1 }).toArray();
  const validIds = [];
  for (const item of reviewResult) { try { validIds.push(new ObjectId(item.scholarShip_id)); } catch {} }
  const reviewDetails = validIds.length ? await scholership.find({ _id: { $in: validIds } }).toArray() : [];
  const detailById = new Map(reviewDetails.map((d) => [String(d._id), d]));
  const combineResult = reviewResult.map((r) => ({ ...r, scholership_details: detailById.get(String(r.scholarShip_id)) || null }));
  res.status(200).json({ message: "All review get successfully", data: combineResult });
}

async function deleteReview(req, res) {
  const oid = new ObjectId(req.params.id);
  const { reason, note, hard } = req.body || {};
  const { reviews, reviewHistory } = getCollections();
  const review = await reviews.findOne({ _id: oid });
  if (!review) return res.status(404).json({ message: "Review not found" });
  const role = req.authUser?.role;
  const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
  const isOwner = review.reviewer_email === req.decoded.email;
  if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden: not owner nor moderator" });
  if (hard === true || hard === "true") {
    if (role !== "superadmin") return res.status(403).json({ message: "hard delete superadmin only" });
    const result = await reviews.deleteOne({ _id: oid });
    await recalcScholarshipRating(review.scholarShip_id);
    return res.status(200).json({ message: "review hard deleted", data: result });
  }
  const now = new Date();
  const removedReason = String(reason || "No reason").slice(0, 300);
  const removedNote = note ? String(note).slice(0, 800) : null;
  const prevStatus = review.status;
  await reviewHistory.insertOne({
    reviewId: String(review._id),
    scholarshipId: review.scholarShip_id,
    action: "removed",
    from: prevStatus,
    to: "removed",
    by: req.decoded.email,
    byRole: role,
    at: now,
    reason: removedReason,
    note: removedNote,
    snapshot: { rating: review.rating, comment: review.comment, reviewer_email: review.reviewer_email },
  });
  const result = await reviews.updateOne(
    { _id: oid },
    { $set: { status: "removed", removedBy: req.decoded.email, removedAt: now, removedReason, removedNote, previousStatus: prevStatus, updatedAt: now, history: [...(review.history || []), { action: "removed", from: prevStatus, to: "removed", by: req.decoded.email, at: now, reason: removedReason }] } }
  );
  await recalcScholarshipRating(review.scholarShip_id);
  res.status(200).json({ message: "review removed (soft) with history", data: result });
}

async function patchReview(req, res) {
  const oid = new ObjectId(req.params.id);
  const { comment, rating } = req.body;
  const { reviews } = getCollections();
  const review = await reviews.findOne({ _id: oid });
  if (!review) return res.status(404).json({ message: "Review not found" });
  const role = req.authUser?.role;
  const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
  const isOwner = review.reviewer_email === req.decoded.email;
  if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden" });
  const updates = {};
  if (comment !== undefined) {
    const clean = String(comment).trim();
    if (clean.length < 5 || clean.length > 500) return res.status(400).json({ message: "comment 5-500 chars" });
    updates.comment = clean;
  }
  if (rating !== undefined) {
    const nr = Number(rating);
    if (!Number.isFinite(nr) || nr < 1 || nr > 5) return res.status(400).json({ message: "rating 1-5" });
    updates.rating = nr;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "nothing to update" });
  updates.updatedAt = new Date();
  updates.isEdited = true;
  if (isOwner) { updates.status = "pending"; updates.moderatedBy = null; updates.moderatedAt = null; }
  const result = await reviews.updateOne({ _id: oid }, { $set: updates });
  await recalcScholarshipRating(review.scholarShip_id);
  res.status(200).json({ message: "review updated", data: result });
}

async function moderateReview(req, res) {
  const oid = new ObjectId(req.params.id);
  const { status, reason, note } = req.body;
  if (!["approved", "rejected", "hidden", "pending", "removed"].includes(String(status))) return res.status(400).json({ message: "status must be approved|rejected|hidden|pending|removed" });
  const { reviews, reviewHistory } = getCollections();
  const review = await reviews.findOne({ _id: oid });
  if (!review) return res.status(404).json({ message: "Review not found" });
  const now = new Date();
  const prevStatus = review.status;
  const update = {
    status: String(status),
    moderatedBy: req.decoded.email,
    moderatedAt: now,
    moderationReason: reason ? String(reason).slice(0, 300) : null,
    removedReason: String(status) === "removed" ? (reason ? String(reason).slice(0, 300) : "No reason") : null,
    removedNote: note ? String(note).slice(0, 800) : null,
    updatedAt: now,
  };
  if (String(status) === "removed") { update.removedBy = req.decoded.email; update.removedAt = now; update.previousStatus = prevStatus; }
  await reviewHistory.insertOne({
    reviewId: String(review._id),
    scholarshipId: review.scholarShip_id,
    action: String(status),
    from: prevStatus,
    to: String(status),
    by: req.decoded.email,
    byRole: req.authUser?.role,
    at: now,
    reason: reason ? String(reason).slice(0, 300) : null,
    note: note ? String(note).slice(0, 800) : null,
    snapshot: { rating: review.rating, comment: review.comment },
  });
  const result = await reviews.updateOne({ _id: oid }, { $set: update, $push: { history: { action: String(status), from: prevStatus, to: String(status), by: req.decoded.email, at: now, reason: reason || null } } });
  await recalcScholarshipRating(review.scholarShip_id);
  res.status(200).json({ message: "review moderated", data: result });
}

async function getReviewHistory(req, res) {
  const { reviewHistory } = getCollections();
  const data = await reviewHistory.find({ reviewId: String(req.params.id) }).sort({ at: -1 }).toArray();
  res.json({ data });
}

async function getRemovedReviews(req, res) {
  const { reviews } = getCollections();
  const data = await reviews.find({ status: "removed" }).sort({ removedAt: -1 }).limit(100).toArray();
  res.json({ data });
}

async function getReviewStats(req, res) {
  const { reviews } = getCollections();
  const [total, pending, approved, rejected, hidden, removed] = await Promise.all([
    reviews.countDocuments(),
    reviews.countDocuments({ status: "pending" }),
    reviews.countDocuments({ status: "approved" }),
    reviews.countDocuments({ status: "rejected" }),
    reviews.countDocuments({ status: "hidden" }),
    reviews.countDocuments({ status: "removed" }),
  ]);
  res.json({ total, pending, approved, rejected, hidden, removed });
}

module.exports = { createReview, listReviews, getReviewsByScholarship, deleteReview, patchReview, moderateReview, getReviewHistory, getRemovedReviews, getReviewStats };
