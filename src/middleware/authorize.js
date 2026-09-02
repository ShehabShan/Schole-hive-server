const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function verifyAdmin(req, res, next) {
  const role = req.authUser?.role;
  if (role !== "admin" && role !== "superadmin") return res.status(403).send({ message: "forbidden access" });
  next();
}

async function verifyModaretor(req, res, next) {
  const role = req.authUser?.role;
  if (role !== "modaretor" && role !== "admin" && role !== "superadmin") return res.status(403).send({ message: "forbidden access" });
  next();
}

async function verifySuperAdmin(req, res, next) {
  if (req.authUser?.role !== "superadmin") return res.status(403).send({ message: "forbidden access" });
  next();
}

async function verifyInstitution(req, res, next) {
  const u = req.authUser;
  if (u?.role !== "institution" || u?.status !== "approved") return res.status(403).send({ message: "forbidden: approved institution only" });
  next();
}

async function verifyScholarshipEditor(req, res, next) {
  const u = req.authUser;
  if (u?.role === "superadmin") return next();
  if (u?.role === "institution" && u?.status === "approved") return next();
  return res.status(403).send({ message: "forbidden: superadmin or approved institution only" });
}

async function verifyScholarshipOwner(req, res, next) {
  const u = req.authUser;
  if (u?.role === "superadmin") return next();
  if (u?.role !== "institution" || u?.status !== "approved") return res.status(403).send({ message: "forbidden: superadmin or owning institution only" });
  try {
    const { scholership } = getCollections();
    const sch = await scholership.findOne({ _id: new ObjectId(req.params.id) });
    if (!sch) return res.status(404).json({ message: "Scholarship not found" });
    if (String(sch.createdBy || "").toLowerCase() !== String(u.email).toLowerCase()) return res.status(403).send({ message: "forbidden: you can only modify your own scholarship" });
  } catch {
    return res.status(400).json({ message: "invalid scholarship id" });
  }
  next();
}

async function verifyScholarshipOwnerEdit(req, res, next) {
  const u = req.authUser;
  // Only owner can edit — even superadmin cannot edit institution posts (per requirement)
  if (!u?.email) return res.status(401).send({ message: "unauthorized" });
  try {
    const { scholership } = getCollections();
    const sch = await scholership.findOne({ _id: new ObjectId(req.params.id) });
    if (!sch) return res.status(404).json({ message: "Scholarship not found" });
    if (String(sch.createdBy || "").toLowerCase() !== String(u.email).toLowerCase()) return res.status(403).send({ message: "forbidden: only owner can edit" });
  } catch {
    return res.status(400).json({ message: "invalid scholarship id" });
  }
  next();
}

async function verifyScholarshipOwnerDelete(req, res, next) {
  const u = req.authUser;
  // Owner can delete own, superadmin can delete any institution post
  if (u?.role === "superadmin") return next();
  if (u?.role !== "institution" || u?.status !== "approved") return res.status(403).send({ message: "forbidden: owner or superadmin only" });
  try {
    const { scholership } = getCollections();
    const sch = await scholership.findOne({ _id: new ObjectId(req.params.id) });
    if (!sch) return res.status(404).json({ message: "Scholarship not found" });
    if (String(sch.createdBy || "").toLowerCase() !== String(u.email).toLowerCase()) return res.status(403).send({ message: "forbidden: you can only delete your own scholarship" });
  } catch {
    return res.status(400).json({ message: "invalid scholarship id" });
  }
  next();
}

async function verifyOwnerModifiable(req, res, next) {
  try {
    const { users } = getCollections();
    const target = await users.findOne({ _id: new ObjectId(req.params.id) });
    if (target?.role === "superadmin") return res.status(403).send({ message: "the owner role cannot be modified" });
    next();
  } catch (e) {
    return res.status(400).json({ message: "invalid id" });
  }
}

module.exports = {
  verifyAdmin,
  verifyModaretor,
  verifySuperAdmin,
  verifyInstitution,
  verifyScholarshipEditor,
  verifyScholarshipOwner,
  verifyScholarshipOwnerEdit,
  verifyScholarshipOwnerDelete,
  verifyOwnerModifiable,
};
