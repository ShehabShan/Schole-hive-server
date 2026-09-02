const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { buildScholarshipFilter, buildScholarshipSort, normalizeScholarshipDoc, normalizeScholarshipPatch } = require("../services/scholarship.service");

async function listScholarships(req, res) {
  const { scholership } = getCollections();
  // lazy publish: auto-publish due scheduled
  try {
    await scholership.updateMany({ status: "scheduled", publishAt: { $lte: new Date() } }, { $set: { status: "published", publishAt: null, postDate: new Date().toISOString().slice(0, 10), updatedAt: new Date() } });
  } catch {}
  // handle scheduled visibility on public profile if institution allows
  if (req.query.createdBy || req.query.creatorEmail || req.query.profileEmail) {
    const email = String(req.query.createdBy || req.query.creatorEmail || req.query.profileEmail).toLowerCase();
    try {
      const { users } = getCollections();
      const inst = await users.findOne({ email, role: "institution", showScheduledOnProfile: true });
      if (inst && !req.query.status) {
        // allow scheduled to be visible for this profile — remove draft/scheduled filter for this creator
        // we will handle via separate fetch for scheduled, so keep default filter but client can request status=scheduled
      }
    } catch {}
  }
  const hasPaging = req.query.page !== undefined || req.query.limit !== undefined;
  const filter = buildScholarshipFilter(req.query);
  const sort = buildScholarshipSort(req.query.sort);
  const total = await scholership.countDocuments(filter);
  if (!hasPaging) {
    const data = await scholership.find(filter).sort(sort).toArray();
    return res.status(200).json({ message: "allScholarship fetching successfull", data, total, page: 1, totalPages: 1 });
  }
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "12"), 10) || 12));
  const skip = (page - 1) * limit;
  const data = await scholership.find(filter).sort(sort).skip(skip).limit(limit).toArray();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.status(200).json({ message: "allScholarship fetching successfull", data, total, page, totalPages });
}

async function getScholarshipById(req, res) {
  const id = req.params.id;
  if (id === "stats") return getStats(req, res);
  const { scholership } = getCollections();
  const result = await scholership.findOne({ _id: new ObjectId(id) });
  if (result) {
    if (!Array.isArray(result.gallery) || result.gallery.length === 0) result.gallery = [result.universityImage].filter(Boolean);
    if (!Array.isArray(result.documents)) result.documents = [];
    if (!Array.isArray(result.requirements)) result.requirements = [];
    if (!Array.isArray(result.faqs)) result.faqs = [];
    if (!Array.isArray(result.highlights)) result.highlights = [];
  }
  res.status(200).json({ message: "allScholarship fetching successfull", data: result });
}

async function createScholarship(req, res) {
  const doc = normalizeScholarshipDoc({ ...req.body });
  const auth = req.authUser || {};
  doc.createdBy = auth.email || null;
  doc.createdByRole = auth.role || null;
  const { scholership } = getCollections();
  const result = await scholership.insertOne(doc);
  res.status(201).json({ message: "Scholarship added successfully", data: result });
}

async function deleteScholarship(req, res) {
  const { scholership } = getCollections();
  const result = await scholership.deleteOne({ _id: new ObjectId(req.params.id) });
  res.status(200).json({ message: "Scholarship delete successfully", data: result });
}

async function patchScholarship(req, res) {
  const body = normalizeScholarshipPatch(req.body);
  const { scholership } = getCollections();
  const result = await scholership.updateOne({ _id: new ObjectId(req.params.id) }, { $set: body });
  if (result.matchedCount === 0) return res.status(404).json({ message: "Scholarship not found" });
  res.status(200).json({ message: "Scholarship updated successfully", data: result });
}

async function getStats(req, res) {
  const { scholership, reviews, apply } = getCollections();
  const totalScholarships = await scholership.countDocuments();
  const totalReviews = await reviews.countDocuments();
  const pendingReviews = await reviews.countDocuments({ status: "pending" });
  const totalApplications = await apply.countDocuments();
  const agg = await scholership.aggregate([{ $group: { _id: null, totalStipend: { $sum: { $toDouble: { $ifNull: ["$stipend", 0] } } }, avgFees: { $avg: { $toDouble: { $ifNull: ["$applicationFees", 0] } } } } }]).toArray();
  const totalStipend = agg[0]?.totalStipend || 0;
  const avgFees = agg[0]?.avgFees || 0;
  const byCategory = await scholership.aggregate([{ $group: { _id: "$scholarshipCategory", count: { $sum: 1 } } }]).toArray();
  const byCountry = await scholership.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } }, $sort: { count: -1 }, $limit: 6 }]).toArray();
  res.json({ totalScholarships, totalReviews, pendingReviews, totalApplications, totalStipend, avgFees, byCategory, byCountry });
}

module.exports = { listScholarships, getScholarshipById, createScholarship, deleteScholarship, patchScholarship, getStats };
