// Q&A Forum V1 reputation helpers — Task 2 (used in Tasks 4 & 10)
// Points table spec 2.1 + Q6/Q7 resolved
const POINTS = {
  answerUpvote: 10,
  questionUpvote: 2,
  accepted: 15,
  sourceLink: 3,
  firstAnswerNewTag: 5,
};

const DAILY_CAP = 50; // Q6 resolved: 50/day for new/low-trust accounts

/**
 * Create a reputationEvents doc shape.
 * @param {Object} p - { userId, type, points, relatedQuestionId, relatedAnswerId }
 */
function buildReputationEvent({ userId, type, points, relatedQuestionId = null, relatedAnswerId = null }) {
  return {
    userId, // will be anonymized on account deletion, not deleted
    type, // 'upvote' | 'accept' | 'sourceLink' | 'firstAnswerNewTag' etc.
    points,
    relatedQuestionId,
    relatedAnswerId,
    createdAt: new Date(),
  };
}

/**
 * Daily cap check — sum points for userId today, return remaining.
 * Caller should enforce cap before applying points.
 */
async function getTodayReputationSum(collections, userId) {
  const { reputationEvents } = collections;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const agg = await reputationEvents
    .aggregate([
      { $match: { userId, createdAt: { $gte: start } } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ])
    .toArray();
  return agg[0]?.total || 0;
}

async function applyReputation(collections, { userId, userEmail, type, points, relatedQuestionId, relatedAnswerId }) {
  const { users, reputationEvents } = collections;
  const todaySum = await getTodayReputationSum(collections, userId);
  const remaining = Math.max(0, DAILY_CAP - todaySum);
  const toApply = Math.min(points, remaining);
  if (toApply <= 0) return { applied: 0, capped: true, remaining: 0 };

  // denormalized write-through
  const filter = userId ? { _id: userId } : { email: String(userEmail).toLowerCase() };
  // if userId is ObjectId, use _id; else email
  if (userId) {
    const { ObjectId } = require("mongodb");
    try {
      const oid = typeof userId === "string" ? new ObjectId(userId) : userId;
      await users.updateOne({ _id: oid }, { $inc: { reputation: toApply } });
    } catch {
      if (userEmail) await users.updateOne({ email: String(userEmail).toLowerCase() }, { $inc: { reputation: toApply } });
    }
  } else if (userEmail) {
    await users.updateOne({ email: String(userEmail).toLowerCase() }, { $inc: { reputation: toApply } });
  }

  await reputationEvents.insertOne(
    buildReputationEvent({ userId, type, points: toApply, relatedQuestionId, relatedAnswerId })
  );
  return { applied: toApply, capped: toApply < points, remaining: remaining - toApply };
}

module.exports = { POINTS, DAILY_CAP, buildReputationEvent, getTodayReputationSum, applyReputation };
