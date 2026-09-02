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
  };

  await ensureIndexes();

  return { db, collections, client };
}

async function ensureIndexes() {
  const { reviews, scholership, saved, inquiries, reviewHistory } = collections;

  try {
    await reviews.createIndex({ reviewer_email: 1, scholarShip_id: 1 }, { unique: true, background: true });
    await reviews.createIndex({ scholarShip_id: 1, status: 1 }, { background: true });
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
