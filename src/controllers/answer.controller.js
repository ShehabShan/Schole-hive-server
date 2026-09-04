const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { validateAnswerPayload, buildAnswerDoc } = require("../utils/answer.validator");
const { POINTS, applyReputation } = require("../utils/reputation");
const { parsePagination } = require("../utils/pagination");

async function listAnswersByAuthor(req, res) {
  const raw = String(req.query.authorEmail || req.query.email || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return res.status(400).json({ message: "authorEmail query required (email)" });
  const { questions, answers } = getCollections();
  const filter = { authorEmail: raw };
  const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 12, maxLimit: 50 });
  const total = await answers.countDocuments(filter);
  const data = await answers.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
  // attach question title for snippet header
  const qIds = [...new Set(data.map((a) => String(a.questionId)).filter(Boolean))].map((id) => { try { return new ObjectId(id); } catch { return null; } }).filter(Boolean);
  let qMap = {};
  if (qIds.length) {
    const qs = await questions.find({ _id: { $in: qIds } }, { projection: { title: 1 } }).toArray();
    qMap = Object.fromEntries(qs.map((q) => [String(q._id), q.title]));
  }
  const enriched = data.map((a) => ({ ...a, questionTitle: qMap[String(a.questionId)] || null }));
  res.json({ message: "answers fetched", data: enriched, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

async function createAnswer(req, res) {
  const qid = req.params.id;
  let qOid;
  try { qOid = new ObjectId(qid); } catch { return res.status(400).json({ message: "invalid question id" }); }
  const { questions, answers, users, reputationEvents } = getCollections();
  const question = await questions.findOne({ _id: qOid });
  if (!question) return res.status(404).json({ message: "Question not found" });

  const { valid, errors, data } = validateAnswerPayload({ ...req.body, questionId: qid });
  if (!valid) return res.status(400).json({ message: "validation failed", errors });

  const author = req.authUser || { email: req.decoded?.email, role: "user" };
  if (!author.email && req.decoded?.email) author.email = req.decoded.email;
  // Q1 resolved: open to all auth roles, no gate

  const doc = buildAnswerDoc({ payload: data, questionId: qOid, author });
  // ensure authorId is ObjectId if available from authUser._id
  if (author._id) doc.authorId = author._id;

  const result = await answers.insertOne(doc);
  const inserted = await answers.findOne({ _id: result.insertedId });

  // keep denormalized answerCount in sync for browse cards
  try {
    await questions.updateOne({ _id: qOid }, { $inc: { answerCount: 1 }, $set: { updatedAt: new Date() } });
  } catch {}

  // Q7 resolved: sourceLink +3 immediate (if provided)
  if (inserted.sourceLink) {
    const recipient = await users.findOne({ email: String(author.email).toLowerCase() });
    if (recipient) {
      await applyReputation(getCollections(), {
        userId: recipient._id,
        userEmail: recipient.email,
        type: "sourceLink",
        points: POINTS.sourceLink,
        relatedQuestionId: qOid,
        relatedAnswerId: inserted._id,
      });
    }
  }

  // first answer under new tag +5 one-time: check if question has a tag that hasn't had an answer before
  // simple heuristic: if this is the first answer for this question and question has tags, award +5
  // more precise would need tag-level tracking; for V1 we check first answer count for this question
  const answerCountForQ = await answers.countDocuments({ questionId: qOid });
  if (answerCountForQ === 1 && Array.isArray(question.tags) && question.tags.length) {
    // if any tag appears for first time globally (no other question with same tag has an answer), award
    // check if any other answer exists with overlapping tag via questions collection
    // simplified: award +5 once per question's first answer if tag is in controlled vocab
    // we keep it simple: award +5 for first answer of a question that introduces a tag not yet used in any answered question
    // querying all questions with same tag that have at least one answer is heavy; for V1 award only if we can detect new tag via count
    // We'll do: if tag count in questions collection for this tag is 1 (only this question has it), then award
    const tagToCheck = question.tags[0];
    const qWithTag = await questions.countDocuments({ tags: tagToCheck });
    if (qWithTag === 1) {
      const recipient = await users.findOne({ email: String(author.email).toLowerCase() });
      if (recipient) {
        await applyReputation(getCollections(), {
          userId: recipient._id,
          userEmail: recipient.email,
          type: "firstAnswerNewTag",
          points: POINTS.firstAnswerNewTag,
          relatedQuestionId: qOid,
          relatedAnswerId: inserted._id,
        });
      }
    }
  }

  res.status(201).json({ message: "Answer created", data: inserted });
}

async function acceptAnswer(req, res) {
  const qid = req.params.id;
  let qOid;
  try { qOid = new ObjectId(qid); } catch { return res.status(400).json({ message: "invalid question id" }); }
  const { answerId } = req.body || {};
  if (!answerId) return res.status(400).json({ message: "answerId required" });
  let aOid;
  try { aOid = new ObjectId(answerId); } catch { return res.status(400).json({ message: "invalid answerId" }); }

  const { questions, answers, users } = getCollections();
  const question = await questions.findOne({ _id: qOid });
  if (!question) return res.status(404).json({ message: "Question not found" });

  const authEmail = String(req.authUser?.email || req.decoded?.email || "").toLowerCase();
  if (String(question.authorEmail || "").toLowerCase() !== authEmail) {
    return res.status(403).json({ message: "forbidden: only asker can accept" });
  }

  const answer = await answers.findOne({ _id: aOid, questionId: qOid });
  if (!answer) return res.status(404).json({ message: "Answer not found for this question" });
  if (answer.accepted) return res.status(400).json({ message: "Answer already accepted" });
  if (question.acceptedAnswerId) return res.status(400).json({ message: "Question already has an accepted answer" });

  await answers.updateMany({ questionId: qOid }, { $set: { accepted: false } });
  await answers.updateOne({ _id: aOid }, { $set: { accepted: true, updatedAt: new Date() } });
  await questions.updateOne({ _id: qOid }, { $set: { acceptedAnswerId: aOid, updatedAt: new Date() } });

  // award +15 to answerer
  const recipient = await users.findOne({ email: String(answer.authorEmail).toLowerCase() });
  if (recipient) {
    await applyReputation(getCollections(), {
      userId: recipient._id,
      userEmail: recipient.email,
      type: "accept",
      points: POINTS.accepted,
      relatedQuestionId: qOid,
      relatedAnswerId: aOid,
    });
  }

  const updatedQ = await questions.findOne({ _id: qOid });
  const updatedA = await answers.findOne({ _id: aOid });
  res.json({ message: "Answer accepted", data: { question: updatedQ, answer: updatedA } });
}

async function upvoteAnswer(req, res) {
  const aid = req.params.id;
  let aOid;
  try { aOid = new ObjectId(aid); } catch { return res.status(400).json({ message: "invalid answer id" }); }
  const { answers, users, questions } = getCollections();
  const answer = await answers.findOne({ _id: aOid });
  if (!answer) return res.status(404).json({ message: "Answer not found" });

  const voterEmail = String(req.authUser?.email || req.decoded?.email || "").toLowerCase();
  if (!voterEmail) return res.status(401).json({ message: "unauthorized" });
  if (String(answer.authorEmail || "").toLowerCase() === voterEmail) {
    return res.status(400).json({ message: "cannot vote own answer" });
  }
  const upvoters = Array.isArray(answer.upvoterIds) ? answer.upvoterIds.map(String) : [];
  if (upvoters.includes(voterEmail) || (answer.downvoterIds || []).map(String).includes(voterEmail)) {
    return res.status(409).json({ message: "already voted" });
  }

  await answers.updateOne({ _id: aOid }, { $inc: { voteScore: 1 }, $push: { upvoterIds: voterEmail }, $set: { updatedAt: new Date() } });

  // reputation: answer author +10
  const recipient = await users.findOne({ email: String(answer.authorEmail).toLowerCase() });
  if (recipient) {
    await applyReputation(getCollections(), {
      userId: recipient._id,
      userEmail: recipient.email,
      type: "upvote",
      points: POINTS.answerUpvote,
      relatedQuestionId: answer.questionId,
      relatedAnswerId: aOid,
    });
  }
  // also question upvote +2 if voter is upvoting via answer? spec says question upvote +2 but no separate endpoint; for V1 we only award answer upvote.
  // If needed, could also inc question voteScore but spec separates.

  const updated = await answers.findOne({ _id: aOid });
  const repUser = recipient ? await users.findOne({ _id: recipient._id }) : null;
  res.json({ message: "upvoted", data: updated, reputation: repUser?.reputation });
}

async function downvoteAnswer(req, res) {
  const aid = req.params.id;
  let aOid;
  try { aOid = new ObjectId(aid); } catch { return res.status(400).json({ message: "invalid answer id" }); }
  const { reason } = req.body || {};
  const validReasons = ["outdated", "unsourced", "off-topic", "incorrect"];
  if (!reason || !validReasons.includes(String(reason))) {
    return res.status(400).json({ message: `reason required: one of ${validReasons.join(", ")}` });
  }
  const voter = req.authUser;
  const voterRep = typeof voter?.reputation === "number" ? voter.reputation : 0;
  if (voterRep < 125) {
    return res.status(403).json({ message: "125 rep required to downvote" });
  }

  const { answers } = getCollections();
  const answer = await answers.findOne({ _id: aOid });
  if (!answer) return res.status(404).json({ message: "Answer not found" });
  const voterEmail = String(voter?.email || req.decoded?.email || "").toLowerCase();
  if (String(answer.authorEmail || "").toLowerCase() === voterEmail) {
    return res.status(400).json({ message: "cannot vote own answer" });
  }
  const already = [...(answer.upvoterIds||[]), ...(answer.downvoterIds||[])].map(String).includes(voterEmail);
  if (already) return res.status(409).json({ message: "already voted" });

  await answers.updateOne(
    { _id: aOid },
    {
      $inc: { voteScore: -1 },
      $push: { downvoterIds: voterEmail, downvoteReasons: String(reason) },
      $set: { updatedAt: new Date() },
    }
  );
  const updated = await answers.findOne({ _id: aOid });
  res.json({ message: "downvoted", data: updated });
}

module.exports = { createAnswer, acceptAnswer, upvoteAnswer, downvoteAnswer, listAnswersByAuthor };
