const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { validateQuestionPayload, buildQuestionDoc } = require("../utils/question.validator");
const { buildQuestionFilter, buildQuestionSort, normalizeQuestionPatch } = require("../services/question.service");
const { parsePagination } = require("../utils/pagination");

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

  const answersList = await answers.find({ questionId: oid }).sort({ accepted: -1, voteScore: -1, createdAt: 1 }).toArray();
  const acceptedAnswer = answersList.find((a) => a.accepted) || null;

  res.json({ message: "question fetched", data: { ...question, answers: answersList, acceptedAnswer } });
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

module.exports = { createQuestion, listQuestions, getQuestionById, patchQuestion, deleteQuestion };
