const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { parsePagination } = require("../utils/pagination");

async function listMine(req, res) {
  const email = String(req.decoded.email || "").trim().toLowerCase();
  const { notifications } = getCollections();
  const filter = { recipientEmail: email };
  const { page, limit, skip } = parsePagination(req.query, { page: 1, limit: 15, maxLimit: 50 });
  const [total, unreadCount, data] = await Promise.all([
    notifications.countDocuments(filter),
    notifications.countDocuments({ ...filter, read: false }),
    notifications.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  res.status(200).json({ message: "notifications fetched", data, total, unreadCount, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

async function markRead(req, res) {
  const email = String(req.decoded.email || "").trim().toLowerCase();
  let oid;
  try { oid = new ObjectId(req.params.id); } catch { return res.status(400).json({ message: "invalid notification id" }); }
  const { notifications } = getCollections();
  const result = await notifications.updateOne({ _id: oid, recipientEmail: email }, { $set: { read: true } });
  if (result.matchedCount === 0) return res.status(404).json({ message: "notification not found for this user" });
  res.status(200).json({ message: "marked read", data: result });
}

async function markAllRead(req, res) {
  const email = String(req.decoded.email || "").trim().toLowerCase();
  const { notifications } = getCollections();
  const result = await notifications.updateMany({ recipientEmail: email, read: false }, { $set: { read: true } });
  res.status(200).json({ message: "all marked read", data: result });
}

module.exports = { listMine, markRead, markAllRead };
