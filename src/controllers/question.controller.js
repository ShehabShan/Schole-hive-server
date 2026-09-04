const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { validateQuestionPayload, buildQuestionDoc } = require("../utils/question.validator");
const { validateCommentPayload, buildCommentDoc } = require("../utils/comment.validator");
const { buildQuestionFilter, buildQuestionSort, normalizeQuestionPatch } = require("../services/question.service");
const { parsePagination } = require("../utils/pagination");
const { POINTS, applyReputation } = require("../utils/reputation");
const { createNotification } = require("../services/notification.service");

async function createQuestion(req, res) {
  const { valid, errors, data } = validateQuestionPayload(req.body || {});
  if (!valid) return res.status(400).json({ message: "validation failed", errors });
  const author = req.authUser || { email: req.decoded?.email, role: "user" };
  // ensure author email from token
  if (!author.email && req.decoded?.email) author.email = req.decoded.email;
  const doc = buildQuestionDoc({ payload: data, author });
  const { questions } = getCollections();
  const result = await questions.insertOne(doc);
  const inserted = await questions.findOne({ _id: result.insertedId });
  res.status(201).json({ message: "Question created", data: inserted });
}

async function listQuestions(req, res) {
  const { questions } = getCollections();
  const filter = buildQuestionFilter(req.query || {});
  const hasQ = Boolean(String(req.query.q || req.query.search || "").trim());
  const sort = buildQuestionSort(req.query.sort, hasQ);
  const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 12, maxLimit: 50 });
  const total = await questions.countDocuments(filter);
  const data = await questions.find(filter).sort(sort).skip(skip).limit(limit).toArray();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.json({ message: "questions fetched", data, total, page, totalPages });
}

async function getQuestionById(req, res) {
  const id = req.params.id;
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    return res.status(400).json({ message: "invalid id" });
  }
  const { questions, answers } = getCollections();
  const question = await questions.findOne({ _id: oid });
  if (!question) return res.status(404).json({ message: "Question not found" });

  // increment viewCount fire-and-forget
  try {
    await questions.updateOne({ _id: oid }, { $inc: { viewCount: 1 } });
    question.viewCount = (question.viewCount || 0) + 1;
  } catch {}

  const { page: ansPage, limit: ansLimit, skip: ansSkip } = parsePagination(req.query, { page: 1, limit: 20, maxLimit: 50 });
  const ansTotal = await answers.countDocuments({ questionId: oid });
  const answersList = await answers.find({ questionId: oid }).sort({ accepted: -1, voteScore: -1, createdAt: 1 }).skip(ansSkip).limit(ansLimit).toArray();
  const acceptedAnswer = answersList.find((a) => a.accepted) || null;

  res.json({ message: "question fetched", data: { ...question, answers: answersList, acceptedAnswer, ansTotal, ansPage, ansTotalPages: Math.max(1, Math.ceil(ansTotal / ansLimit)) } });
}

async function patchQuestion(req, res) {
  const id = req.params.id;
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    return res.status(400).json({ message: "invalid id" });
  }
  const { questions } = getCollections();
  const existing = await questions.findOne({ _id: oid });
  if (!existing) return res.status(404).json({ message: "Question not found" });

  const auth = req.authUser;
  const isOwner = String(existing.authorEmail || "").toLowerCase() === String(auth?.email || "").toLowerCase();
  const isStaff = ["admin", "superadmin", "modaretor"].includes(auth?.role);
  if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden: owner or staff only" });

  const patch = normalizeQuestionPatch(req.body || {});
  // handle context merging — if patch.context present, merge with existing
  let updateDoc = { ...patch };
  if (patch.context) {
    const mergedCtx = { ...(existing.context || {}), ...patch.context };
    updateDoc.context = mergedCtx;
  }
  // validate category if changed
  if (updateDoc.category && !updateDoc.category) delete updateDoc.category;
  if (updateDoc.tags && (updateDoc.tags.length < 1 || updateDoc.tags.length > 5)) {
    return res.status(400).json({ message: "tags must be 1..5" });
  }
  if (updateDoc.title && updateDoc.title.length < 10) return res.status(400).json({ message: "title must be at least 10 characters" });
  if (updateDoc.body && updateDoc.body.length < 20) return res.status(400).json({ message: "body must be at least 20 characters" });

  const result = await questions.updateOne({ _id: oid }, { $set: updateDoc });
  const updated = await questions.findOne({ _id: oid });
  res.json({ message: "Question updated", data: updated, result });
}

async function deleteQuestion(req, res) {
  const id = req.params.id;
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    return res.status(400).json({ message: "invalid id" });
  }
  const { questions, answers } = getCollections();
  const existing = await questions.findOne({ _id: oid });
  if (!existing) return res.status(404).json({ message: "Question not found" });

  const auth = req.authUser;
  const isOwner = String(existing.authorEmail || "").toLowerCase() === String(auth?.email || "").toLowerCase();
  const isStaff = ["admin", "superadmin", "modaretor"].includes(auth?.role);
  if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden: owner or staff only" });

  const result = await questions.deleteOne({ _id: oid });
  // cascade delete answers (preserve permanence? spec says pages are permanent but delete is allowed for owner/staff)
  try {
    await answers.deleteMany({ questionId: oid });
  } catch {}
  res.json({ message: "Question deleted", data: result });
}

async function upvoteQuestion(req, res) {
  const id = req.params.id;
  let oid;
  try { oid = new ObjectId(id); } catch { return res.status(400).json({ message: "invalid id" }); }
  const { questions, users } = getCollections();
  const question = await questions.findOne({ _id: oid });
  if (!question) return res.status(404).json({ message: "Question not found" });
  const voterEmail = String(req.authUser?.email || req.decoded?.email || "").toLowerCase();
  if (!voterEmail) return res.status(401).json({ message: "unauthorized" });
  if (String(question.authorEmail||"").toLowerCase()===voterEmail) return res.status(400).json({ message: "cannot vote own question" });
  const upvoters = Array.isArray(question.upvoterIds) ? question.upvoterIds.map(String) : [];
  const downvoters = Array.isArray(question.downvoterIds) ? question.downvoterIds.map(String) : [];
  if (upvoters.includes(voterEmail) || downvoters.includes(voterEmail)) return res.status(409).json({ message: "already voted" });
  await questions.updateOne({ _id: oid }, { $inc: { voteScore: 1 }, $push: { upvoterIds: voterEmail }, $set: { updatedAt: new Date() } });
  const recipient = await users.findOne({ email: String(question.authorEmail).toLowerCase() });
  if (recipient) {
    await applyReputation(getCollections(), {
      userId: recipient._id,
      userEmail: recipient.email,
      type: "questionUpvote",
      points: POINTS.questionUpvote,
      relatedQuestionId: oid,
      relatedAnswerId: null,
    });
  }
  const updated = await questions.findOne({ _id: oid });
  const repUser = recipient ? await users.findOne({ _id: recipient._id }) : null;
  res.json({ message: "upvoted", data: updated, reputation: repUser?.reputation });
}

async function downvoteQuestion(req, res) {
  const id = req.params.id;
  let oid;
  try { oid = new ObjectId(id); } catch { return res.status(400).json({ message: "invalid id" }); }
  const { questions } = getCollections();
  const question = await questions.findOne({ _id: oid });
  if (!question) return res.status(404).json({ message: "Question not found" });
  const voter = req.authUser;
  const voterRep = typeof voter?.reputation === "number" ? voter.reputation : 0;
  if (voterRep < 125) return res.status(403).json({ message: "125 rep required to downvote" });
  const voterEmail = String(voter?.email || req.decoded?.email || "").toLowerCase();
  if (!voterEmail) return res.status(401).json({ message: "unauthorized" });
  if (String(question.authorEmail||"").toLowerCase()===voterEmail) return res.status(400).json({ message: "cannot vote own question" });
  const upvoters = Array.isArray(question.upvoterIds) ? question.upvoterIds.map(String) : [];
  const downvoters = Array.isArray(question.downvoterIds) ? question.downvoterIds.map(String) : [];
  if (upvoters.includes(voterEmail) || downvoters.includes(voterEmail)) return res.status(409).json({ message: "already voted" });
  await questions.updateOne({ _id: oid }, { $inc: { voteScore: -1 }, $push: { downvoterIds: voterEmail }, $set: { updatedAt: new Date() } });
  const updated = await questions.findOne({ _id: oid });
  res.json({ message: "downvoted", data: updated });
}

async function createQuestionComment(req, res) {
  const id = req.params.id;
  let qOid;
  try { qOid = new ObjectId(id); } catch { return res.status(400).json({ message: "invalid question id" }); }
  const { questions, questionComments } = getCollections();
  const question = await questions.findOne({ _id: qOid });
  if (!question) return res.status(404).json({ message: "Question not found" });
  const { valid, errors, data } = validateCommentPayload(req.body || {});
  if (!valid) return res.status(400).json({ message: "validation failed", errors });
  let parentAuthorEmail = null;
  if (data.parentCommentId) {
    const parent = await questionComments.findOne({ _id: new ObjectId(data.parentCommentId), questionId: qOid });
    if (!parent) return res.status(404).json({ message: "Parent comment not found" });
    parentAuthorEmail = parent.authorEmail || null;
  }
  const author = req.authUser || { email: req.decoded?.email, role: "user" };
  if (!author.email && req.decoded?.email) author.email = req.decoded.email;
  const doc = buildCommentDoc({ payload: data, questionId: qOid, author });
  if (author._id) doc.authorId = author._id;
  const result = await questionComments.insertOne(doc);
  const inserted = await questionComments.findOne({ _id: result.insertedId });

  // notify the asker about the new comment (and the parent-comment author on replies)
  await createNotification({
    recipientEmail: question.authorEmail,
    type: "question_comment",
    actorEmail: author.email,
    payload: { questionId: String(qOid), commentId: String(inserted._id), questionTitle: question.title },
  });
  if (data.parentCommentId && parentAuthorEmail) {
    await createNotification({
      recipientEmail: parentAuthorEmail,
      type: "comment_reply",
      actorEmail: author.email,
      payload: { questionId: String(qOid), commentId: String(inserted._id), questionTitle: question.title },
    });
  }

  res.status(201).json({ message: "Comment created", data: inserted });
}

async function listQuestionComments(req, res) {
  const id = req.params.id;
  let qOid;
  try { qOid = new ObjectId(id); } catch { return res.status(400).json({ message: "invalid question id" }); }
  const { questions, questionComments } = getCollections();
  const question = await questions.findOne({ _id: qOid });
  if (!question) return res.status(404).json({ message: "Question not found" });
  const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 20, maxLimit: 50 });
  const total = await questionComments.countDocuments({ questionId: qOid });
  const data = await questionComments.find({ questionId: qOid }).sort({ createdAt: 1 }).skip(skip).limit(limit).toArray();
  res.json({ message: "comments fetched", data, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

module.exports = { createQuestion, listQuestions, getQuestionById, patchQuestion, deleteQuestion, upvoteQuestion, downvoteQuestion, createQuestionComment, listQuestionComments };
