const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function createVerifyRequest(req, res){
  const { credentialUrl, credentialType, note } = req.body || {};
  if(!credentialUrl || !String(credentialUrl).trim()) return res.status(400).json({ message: "credentialUrl required" });
  const email = String(req.decoded?.email || req.authUser?.email || "").toLowerCase();
  if(!email) return res.status(401).json({ message: "unauthorized" });
  const { verifyRequests } = getCollections();
  const doc = {
    userId: req.authUser?._id || null,
    email,
    credentialUrl: String(credentialUrl).trim().slice(0, 1000),
    credentialType: String(credentialType||"").trim().slice(0, 80) || "student_id",
    note: String(note||"").trim().slice(0, 1000) || null,
    status: "pending",
    rejectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await verifyRequests.insertOne(doc);
  const inserted = await verifyRequests.findOne({ _id: result.insertedId });
  res.status(201).json({ message: "verify request created", data: inserted });
}

async function getMyVerifyRequests(req, res){
  const email = String(req.decoded?.email || "").toLowerCase();
  const { verifyRequests } = getCollections();
  const data = await verifyRequests.find({ email }).sort({ createdAt: -1 }).limit(50).toArray();
  res.json({ message: "my verify requests", data });
}

async function getAllVerifyRequests(req, res){
  const status = String(req.query.status || "").toLowerCase();
  const filter = {};
  if(status && ["pending","approved","rejected"].includes(status)) filter.status = status;
  const { verifyRequests } = getCollections();
  const data = await verifyRequests.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  res.json({ message: "verify requests", data });
}

async function patchVerifyRequest(req, res){
  const id = req.params.id;
  let oid; try{ oid=new ObjectId(id); } catch{ return res.status(400).json({ message:"invalid id"}); }
  const { status, rejectReason } = req.body || {};
  const s = String(status||"").toLowerCase();
  if(!["approved","rejected","pending"].includes(s)) return res.status(400).json({ message:"status must be approved|rejected|pending"});
  const { verifyRequests, users } = getCollections();
  const existing = await verifyRequests.findOne({ _id: oid });
  if(!existing) return res.status(404).json({ message:"not found"});
  const update = { status: s, updatedAt: new Date(), reviewedAt: new Date(), reviewedBy: String(req.decoded?.email||"") };
  if(s==="rejected") update.rejectReason = String(rejectReason||"").slice(0,500) || null;
  else update.rejectReason = null;
  await verifyRequests.updateOne({ _id: oid }, { $set: update });
  if(s==="approved"){
    await users.updateOne({ email: existing.email }, { $set: { isVerified: true, updatedAt: new Date() } });
  } else if(s==="rejected"){
    // keep isVerified false unless already true? Do not auto-unverify; keep as is
  }
  const updated = await verifyRequests.findOne({ _id: oid });
  res.json({ message:"verify request updated", data: updated });
}

module.exports = { createVerifyRequest, getMyVerifyRequests, getAllVerifyRequests, patchVerifyRequest };
