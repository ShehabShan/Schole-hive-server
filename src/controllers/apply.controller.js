const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

function canAccessApplication(req, doc, scholarship) {
  const role = req.authUser?.role;
  if (role === "admin" || role === "superadmin" || role === "modaretor") return true;
  if (String(doc?.email || "").toLowerCase() === String(req.decoded?.email || "").toLowerCase()) return true;
  if (role === "institution" && req.authUser?.status === "approved" && scholarship) {
    return String(scholarship?.createdBy || "").toLowerCase() === String(req.authUser.email).toLowerCase();
  }
  return false;
}

async function findApplyScholarship(doc) {
  const sid = doc?.scholarship_id || doc?.scholarshipId;
  if (!sid) return null;
  try {
    const { scholership } = getCollections();
    return await scholership.findOne({ _id: new ObjectId(sid) });
  } catch { return null; }
}

async function createApply(req, res) {
  if (req.authUser?.role !== "user") return res.status(403).json({ message: "forbidden: only students can apply" });
  const { apply } = getCollections();
  const result = await apply.insertOne(req.body);
  res.status(201).json({ message: "apply data added successfully", data: result });
}

async function getApply(req, res) {
  const email = String(req.query.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ message: "email query required" });
  const isStaff = ["admin", "superadmin", "modaretor"].includes(req.authUser?.role);
  if (email !== String(req.decoded.email).toLowerCase() && !isStaff) return res.status(403).json({ message: "forbidden: can only view own applications" });
  const { apply } = getCollections();
  const result = await apply.find({ email }).sort({ postDate: -1 }).toArray();
  res.status(200).json({ message: "apply data added successfully", data: result });
}

async function getAllApply(req, res) {
  const role = req.authUser?.role;
  const { apply, scholership } = getCollections();
  let filter = {};
  if (["admin", "superadmin", "modaretor"].includes(role)) filter = {};
  else if (role === "institution" && req.authUser?.status === "approved") {
    const owned = await scholership.find({ createdBy: req.decoded.email }).project({ _id: 1 }).toArray();
    const ids = owned.map((s) => String(s._id));
    filter = ids.length ? { scholarship_id: { $in: ids } } : { scholarship_id: "__none__" };
  } else filter = { email: req.decoded.email };
  const result = await apply.find(filter).sort({ postDate: -1 }).toArray();
  res.status(200).json({ message: "apply data added successfully", data: result });
}

async function getSingleApply(req, res) {
  const { apply } = getCollections();
  const result = await apply.findOne({ _id: new ObjectId(req.params.id) });
  if (!result) return res.status(404).json({ message: "application not found" });
  const scholarship = await findApplyScholarship(result);
  if (!canAccessApplication(req, result, scholarship)) return res.status(403).json({ message: "forbidden" });
  res.status(200).json({ message: "apply data added successfully", data: result });
}

async function cancelApply(req, res) {
  const { apply } = getCollections();
  const doc = await apply.findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ message: "application not found" });
  const scholarship = await findApplyScholarship(doc);
  if (!canAccessApplication(req, doc, scholarship)) return res.status(403).json({ message: "forbidden" });
  const result = await apply.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { applicationStatus: "rejected" } });
  res.status(201).json({ message: "apply data added successfully", data: result });
}

async function acceptApply(req, res) {
  const { apply } = getCollections();
  const doc = await apply.findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ message: "application not found" });
  const role = req.authUser?.role;
  const isStaff = ["admin", "superadmin", "modaretor"].includes(role);
  const isOwnInstitution = role === "institution" && req.authUser?.status === "approved" && canAccessApplication(req, doc, await findApplyScholarship(doc));
  if (!isStaff && !isOwnInstitution) return res.status(403).json({ message: "forbidden" });
  const result = await apply.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { applicationStatus: "accepted" } });
  res.status(201).json({ message: "apply data added successfully", data: result });
}

module.exports = { createApply, getApply, getAllApply, getSingleApply, cancelApply, acceptApply };
