const { MongoClient, ServerApiVersion } = require("mongodb");
const env = require("./env");

let client = null;
let db = null;
let collections = {};

function getUri() {
  const uri = env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URI or DB_USER/DB_PASS must be set");
  return uri;
}

async function connect() {
  if (db) return { db, collections, client };

  const uri = getUri();
  client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
  await client.connect();
  db = client.db("schoolHive");

  collections = {
    scholership: db.collection("scholership"),
    reviews: db.collection("reviews"),
    users: db.collection("users"),
    apply: db.collection("apply"),
    saved: db.collection("saved"),
    inquiries: db.collection("inquiries"),
    reviewHistory: db.collection("review_history"),
    institutionStudents: db.collection("institution_students"),
    follows: db.collection("follows"),
    questions: db.collection("questions"),
    answers: db.collection("answers"),
    questionComments: db.collection("question_comments"),
    reputationEvents: db.collection("reputationEvents"),
    verifyRequests: db.collection("verifyRequests"),
    notifications: db.collection("notifications"),
  };

  await ensureIndexes();

  return { db, collections, client };
}

async function ensureIndexes() {
  const { reviews, scholership, saved, inquiries, reviewHistory, users, apply, institutionStudents, follows, questions, answers, questionComments, reputationEvents, verifyRequests, notifications } = collections;

  try {
    await notifications.createIndex({ recipientEmail: 1, createdAt: -1 }, { background: true });
    await notifications.createIndex({ recipientEmail: 1, read: 1, createdAt: -1 }, { background: true });
  } catch (e) {
    console.log("notification index warning", e.message);
  }

  try {
    await reviews.createIndex({ reviewer_email: 1, scholarShip_id: 1 }, { unique: true, background: true });
    await reviews.createIndex({ reviewer_email: 1 }, { background: true });
    await reviews.createIndex({ scholarShip_id: 1, status: 1 }, { background: true });
    await reviews.createIndex({ scholarShip_id: 1, status: 1, createdAt: -1 }, { background: true });
    await reviews.createIndex({ status: 1, createdAt: -1 }, { background: true });
  } catch (e) {
    console.log("review index warning", e.message);
  }

  try {
    await scholership.createIndex({ status: 1 }, { background: true });
    await scholership.createIndex({ country: 1, scholarshipCategory: 1, degree: 1 }, { background: true });
    await scholership.createIndex({ subjectName: 1 }, { background: true });
    await scholership.createIndex({ applicationDeadline: 1 }, { background: true });
    await scholership.createIndex({ rating: -1 }, { background: true });
    await scholership.createIndex({ applicationFees: 1 }, { background: true });
    await scholership.createIndex({ city: 1 }, { background: true });
    await scholership.createIndex({ tags: 1 }, { background: true });
    await scholership.createIndex({ postDate: -1 }, { background: true });
    await scholership.createIndex({ status: 1, rating: -1 }, { background: true });
    await scholership.createIndex({ status: 1, applicationFees: 1 }, { background: true });
    await scholership.createIndex(
      { universityName: "text", scholarshipDescription: "text", subjectName: "text", scholarshipCategory: "text" },
      { background: true, name: "scholarship_text_idx" }
    );
    await saved.createIndex({ userEmail: 1, scholarshipId: 1 }, { unique: true, background: true });
    await saved.createIndex({ userEmail: 1, savedAt: -1 }, { background: true });
    await inquiries.createIndex({ scholarshipId: 1, createdAt: -1 }, { background: true });
    await inquiries.createIndex({ email: 1 }, { background: true });
    await reviewHistory.createIndex({ reviewId: 1, at: -1 }, { background: true });
    await reviewHistory.createIndex({ scholarshipId: 1 }, { background: true });
  } catch (e) {
    console.log("scholarship/saved index warning", e.message);
  }

  try {
    await users.createIndex({ email: 1 }, { unique: true, background: true });
    await users.createIndex({ role: 1 }, { background: true });
    await users.createIndex({ role: 1, status: 1 }, { background: true });
    await users.createIndex({ createdAt: -1 }, { background: true });
    await scholership.createIndex({ createdBy: 1 }, { background: true });
    await apply.createIndex({ email: 1 }, { background: true });
    await apply.createIndex({ scholarship_id: 1 }, { background: true });
    await apply.createIndex({ email: 1, applicationStatus: 1 }, { background: true });
    await apply.createIndex({ email: 1, postDate: -1 }, { background: true });
    await apply.createIndex({ scholarship_id: 1, postDate: -1 }, { background: true });
    await institutionStudents.createIndex({ institutionEmail: 1, studentEmail: 1 }, { unique: true, background: true });
    await institutionStudents.createIndex({ institutionEmail: 1, createdAt: -1 }, { background: true });
    await follows.createIndex({ followerEmail: 1, followingEmail: 1 }, { unique: true, background: true });
    await follows.createIndex({ followingEmail: 1 }, { background: true });
    await follows.createIndex({ followerEmail: 1 }, { background: true });
  } catch (e) {
    console.log("user/apply/follow index warning", e.message);
  }

  // Q&A Forum V1 — Task 1: questions collection indexes
  try {
    await questions.createIndex({ category: 1 }, { background: true });
    await questions.createIndex({ tags: 1 }, { background: true });
    await questions.createIndex({ "context.destinationCountry": 1 }, { background: true });
    await questions.createIndex({ "context.homeCountry": 1 }, { background: true });
    await questions.createIndex({ "context.studyLevel": 1 }, { background: true });
    await questions.createIndex({ authorEmail: 1, createdAt: -1 }, { background: true });
    await questions.createIndex({ createdAt: -1 }, { background: true });
    await questions.createIndex({ acceptedAnswerId: 1 }, { background: true, sparse: true });
    await questions.createIndex(
      { title: "text", body: "text", tags: "text" },
      { background: true, name: "questions_text_idx" }
    );
  } catch (e) {
    console.log("questions index warning", e.message);
  }

  // backfill denormalized answerCount for pre-existing questions (idempotent)
  // NOTE: must live in its own try — the text index above throws under
  // apiStrict:true, which would skip anything after it in the same block.
  try {
    const counts = await answers.aggregate([{ $group: { _id: "$questionId", n: { $sum: 1 } } }]).toArray();
    if (counts.length) {
      const ops = counts.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { answerCount: c.n } } } }));
      await questions.bulkWrite(ops, { ordered: false });
    }
    await questions.updateMany({ answerCount: { $exists: false } }, { $set: { answerCount: 0 } });
  } catch (e) {
    console.log("answerCount backfill warning", e.message);
  }

  // Q&A Forum V1 — Task 2: answers + reputationEvents indexes
  try {
    await answers.createIndex({ questionId: 1, createdAt: 1 }, { background: true });
    await answers.createIndex({ questionId: 1, accepted: 1 }, { background: true });
    await answers.createIndex({ questionId: 1, accepted: -1, voteScore: -1, createdAt: 1 }, { background: true });
    await answers.createIndex({ authorEmail: 1, createdAt: -1 }, { background: true });
    await answers.createIndex({ createdAt: -1 }, { background: true });

    await reputationEvents.createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await reputationEvents.createIndex({ type: 1 }, { background: true });
    await reputationEvents.createIndex({ relatedQuestionId: 1 }, { background: true, sparse: true });
    await reputationEvents.createIndex({ relatedAnswerId: 1 }, { background: true, sparse: true });

    // backfill defaults for existing users (no data loss) — lightweight
    await users.updateMany({ reputation: { $exists: false } }, { $set: { reputation: 0 } });
    await users.updateMany({ isVerified: { $exists: false } }, { $set: { isVerified: false } });
    await users.createIndex({ reputation: -1 }, { background: true });
    await users.createIndex({ isVerified: 1 }, { background: true, sparse: true });
  } catch (e) {
    console.log("answers/reputationEvents index warning", e.message);
  }

  // Q&A Forum V1 — Task 11: verifyRequests indexes
  try {
    await verifyRequests.createIndex({ email: 1, createdAt: -1 }, { background: true });
    await verifyRequests.createIndex({ status: 1, createdAt: -1 }, { background: true });
    await verifyRequests.createIndex({ userId: 1 }, { background: true, sparse: true });
  } catch (e) {
    console.log("verifyRequests index warning", e.message);
  }

  // Question-level inline comments (card polish pass)
  try {
    const { questionComments } = collections;
    await questionComments.createIndex({ questionId: 1, createdAt: 1 }, { background: true });
    await questionComments.createIndex({ questionId: 1, parentCommentId: 1 }, { background: true });
    await questionComments.createIndex({ authorEmail: 1, createdAt: -1 }, { background: true });
  } catch (e) {
    console.log("questionComments index warning", e.message);
  }
}

function getCollections() {
  if (!collections.users) throw new Error("DB not connected. Call connect() first.");
  return collections;
}

function getDb() {
  if (!db) throw new Error("DB not connected. Call connect() first.");
  return db;
}

function getClient() {
  return client;
}

module.exports = { connect, getCollections, getDb, getClient };
