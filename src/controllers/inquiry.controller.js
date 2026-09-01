const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function createInquiry(req, res) {
  const { scholarshipId, name, email, question } = req.body;
  const sid = String(scholarshipId || "").trim();
  if (!sid) return res.status(400).json({ message: "scholarshipId required" });
  try { new ObjectId(sid); } catch { return res.status(400).json({ message: "invalid scholarshipId" }); }
  const cleanName = String(name || "").trim().slice(0, 80);
  const cleanEmail = String(email || "").trim().toLowerCase().slice(0, 120);
  const cleanQ = String(question || "").trim();
  if (cleanQ.length < 10 || cleanQ.length > 1000) return res.status(400).json({ message: "question 10-1000 chars" });
  if (!cleanEmail.includes("@")) return res.status(400).json({ message: "valid email required" });
  const { inquiries } = getCollections();
  const doc = { scholarshipId: sid, name: cleanName || "Anonymous", email: cleanEmail, question: cleanQ, createdAt: new Date(), status: "open" };
  const result = await inquiries.insertOne(doc);
  res.status(201).json({ message: "Inquiry sent", data: result });
}

async function listInquiries(req, res) {
  const { inquiries } = getCollections();
  const { scholarshipId } = req.query;
  const filter = {};
  if (scholarshipId) filter.scholarshipId = String(scholarshipId);
  const data = await inquiries.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data });
}

module.exports = { createInquiry, listInquiries };
