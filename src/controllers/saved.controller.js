const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function toggleSave(req, res) {
  const { scholarshipId, scholarship_id } = req.body;
  const sid = String(scholarshipId || scholarship_id || "").trim();
  if (!sid) return res.status(400).json({ message: "scholarshipId required" });
  try { new ObjectId(sid); } catch { return res.status(400).json({ message: "invalid scholarshipId" }); }
  const { scholership, saved } = getCollections();
  const exists = await scholership.findOne({ _id: new ObjectId(sid) });
  if (!exists) return res.status(404).json({ message: "Scholarship not found" });
  const userEmail = req.decoded.email;
  const existing = await saved.findOne({ userEmail, scholarshipId: sid });
  if (existing) {
    await saved.deleteOne({ _id: existing._id });
    return res.json({ saved: false, message: "Removed from saved" });
  }
  await saved.insertOne({ userEmail, scholarshipId: sid, savedAt: new Date() });
  res.status(201).json({ saved: true, message: "Saved" });
}

async function getSaved(req, res) {
  const email = String(req.query.email || req.decoded.email).toLowerCase().trim();
  const role = req.authUser?.role;
  const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
  if (email !== String(req.decoded.email).toLowerCase() && !isStaff) return res.status(403).json({ message: "forbidden" });
  const { parsePagination } = require("../utils/pagination");
  const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 20, maxLimit: 50 });
  const { saved, scholership } = getCollections();
  const filter = { userEmail: email };
  const total = await saved.countDocuments(filter);
  const docs = await saved.find(filter).sort({ savedAt: -1 }).skip(skip).limit(limit).toArray();
  const ids = [];
  for (const d of docs) { try { ids.push(new ObjectId(d.scholarshipId)); } catch {} }
  const scholarships = ids.length ? await scholership.find({ _id: { $in: ids } }).toArray() : [];
  const byId = new Map(scholarships.map((s) => [String(s._id), s]));
  const data = docs.map((d) => ({ ...d, scholarship: byId.get(String(d.scholarshipId)) || null }));
  res.json({ message: "saved fetched", data, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

async function deleteSaved(req, res) {
  const sid = String(req.params.id).trim();
  const { saved } = getCollections();
  const doc = await saved.findOne({ userEmail: req.decoded.email, scholarshipId: sid });
  if (!doc) return res.status(404).json({ message: "Not saved" });
  await saved.deleteOne({ _id: doc._id });
  res.json({ message: "Removed from saved" });
}

async function checkSaved(req, res) {
  const sid = String(req.params.id).trim();
  const { saved } = getCollections();
  const doc = await saved.findOne({ userEmail: req.decoded.email, scholarshipId: sid });
  res.json({ saved: !!doc });
}

module.exports = { toggleSave, getSaved, deleteSaved, checkSaved };
