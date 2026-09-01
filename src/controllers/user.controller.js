const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const env = require("../config/env");

// POST /users
async function createUser(req, res) {
  const incoming = req.body;
  if (!incoming?.email) return res.status(400).json({ message: "email required" });
  const query = { email: String(incoming.email).toLowerCase().trim() };
  const { users } = getCollections();

  const existingUser = await users.findOne(query);
  if (existingUser) {
    const syncSet = {};
    if (incoming.photoURL && !existingUser.photoURL) syncSet.photoURL = incoming.photoURL;
    if (String(incoming.accountType || "student").toLowerCase() === "institution") {
      for (const f of ["orgName", "orgType", "orgCountry", "orgWebsite", "orgDescription"]) {
        if (incoming[f] && !existingUser[f]) syncSet[f] = String(incoming[f]).slice(0, 2000);
      }
      if (existingUser.role === "institution" && !existingUser.status) syncSet.status = "pending";
    }
    if (!existingUser.status && existingUser.role === "superadmin") syncSet.status = "active";
    if (existingUser.role === "institution" && !existingUser.status) syncSet.status = "pending";
    if (Object.keys(syncSet).length > 0) {
      syncSet.updatedAt = new Date();
      await users.updateOne(query, { $set: syncSet });
    }
    return res.send({ message: "user already exist", data: { insertedId: null } });
  }

  const accountType = String(incoming.accountType || "student").toLowerCase();
  const isInstitution = accountType === "institution";

  const user = {
    name: String(incoming.name || "").trim() || null,
    email: String(incoming.email).toLowerCase().trim(),
    role: isInstitution ? "institution" : "user",
    status: isInstitution ? "pending" : "active",
    photoURL: incoming.photoURL || null,
    phone: incoming.phone || null,
    bio: incoming.bio || null,
    city: incoming.city || null,
    country: incoming.country || null,
    skills: Array.isArray(incoming.skills) ? incoming.skills.slice(0, 20) : [],
    coverPhoto: incoming.coverPhoto || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (isInstitution) {
    user.orgName = String(incoming.orgName || "").trim().slice(0, 120) || null;
    user.orgType = ["university", "college", "school"].includes(String(incoming.orgType || "").toLowerCase())
      ? String(incoming.orgType).toLowerCase()
      : "university";
    user.orgCountry = String(incoming.orgCountry || "").trim().slice(0, 80) || null;
    user.orgWebsite = String(incoming.orgWebsite || "").trim().slice(0, 300) || null;
    user.orgDescription = String(incoming.orgDescription || "").trim().slice(0, 2000) || null;
    user.statusNote = null;
    user.reviewedAt = null;
    user.reviewedBy = null;
  }

  if (env.ADMIN_EMAILS.includes(user.email)) {
    user.role = "superadmin";
    user.status = "active";
  }
  if (!["user", "modaretor", "admin", "superadmin", "institution"].includes(user.role)) user.role = "user";

  const result = await users.insertOne(user);
  res.status(201).json({ message: "User Added successfully", data: result });
}

async function getAllUsers(req, res) {
  const role = req.authUser?.role;
  if (role !== "admin" && role !== "superadmin" && role !== "modaretor") return res.status(403).json({ message: "forbidden: admin only" });
  const { users } = getCollections();
  const result = await users.find().toArray();
  res.status(200).json({ message: "User get successfully", data: result });
}

async function checkAdmin(req, res) {
  const email = req.params.email;
  if (email !== req.decoded.email) return res.status(403).send({ message: "forbidden access" });
  const { users } = getCollections();
  const user = await users.findOne({ email });
  res.send({ isAdmin: user?.role === "admin" || user?.role === "superadmin" });
}

async function checkSuperAdmin(req, res) {
  const email = req.params.email;
  if (email !== req.decoded.email) return res.status(403).send({ message: "forbidden access" });
  const { users } = getCollections();
  const user = await users.findOne({ email });
  res.send({ isSuperAdmin: user?.role === "superadmin" });
}

async function checkModaretor(req, res) {
  const email = req.params.email;
  if (email !== req.decoded.email) return res.status(403).send({ message: "forbidden access" });
  const { users } = getCollections();
  const user = await users.findOne({ email });
  res.send({ isModaretor: user?.role === "modaretor" });
}

async function checkUser(req, res) {
  const email = req.params.email;
  if (email !== req.decoded.email) return res.status(403).send({ message: "forbidden access" });
  const { users } = getCollections();
  const user = await users.findOne({ email });
  res.send({ isUser: user?.role === "user" });
}

async function getUserByEmail(req, res) {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: "email query required" });
  const role = req.authUser?.role;
  const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
  if (String(email).toLowerCase() !== String(req.decoded.email).toLowerCase() && !isStaff)
    return res.status(403).json({ message: "forbidden: can only view own profile" });
  const { users } = getCollections();
  const result = await users.findOne({ email: String(email).toLowerCase().trim() });
  res.status(200).json({ message: "user fetched successfully", data: result });
}

async function getPublicUser(req, res) {
  const email = String(req.params.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) return res.status(400).json({ message: "valid email required" });
  const { users } = getCollections();
  const u = await users.findOne({ email });
  if (!u) return res.status(404).json({ message: "user not found" });
  const pub = {
    _id: u._id,
    name: u.name,
    email: u.email,
    photoURL: u.photoURL,
    coverPhoto: u.coverPhoto,
    city: u.city,
    country: u.country,
    bio: u.bio,
    skills: u.skills,
    role: u.role,
    status: u.status,
    orgName: u.orgName,
    orgType: u.orgType,
    orgCountry: u.orgCountry,
    orgWebsite: u.orgWebsite,
    orgDescription: u.orgDescription,
    createdAt: u.createdAt,
  };
  res.json({ message: "public profile", data: pub });
}

async function getMe(req, res) {
  const { users } = getCollections();
  const me = await users.findOne({ email: req.decoded.email });
  res.status(200).json({ message: "me fetched", data: me });
}

async function patchMe(req, res) {
  const allowed = ["name", "photoURL", "phone", "bio", "city", "country", "skills", "coverPhoto", "orgName", "orgType", "orgCountry", "orgWebsite", "orgDescription"];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  if (updates.name !== undefined) {
    const n = String(updates.name).trim();
    if (n.length < 2 || n.length > 80) return res.status(400).json({ message: "name 2-80 chars" });
    updates.name = n;
  }
  if (updates.photoURL !== undefined && updates.photoURL) {
    if (String(updates.photoURL).trim().length > 2000) return res.status(400).json({ message: "photoURL too long" });
    updates.photoURL = String(updates.photoURL).trim();
  }
  if (updates.coverPhoto !== undefined && updates.coverPhoto) {
    if (String(updates.coverPhoto).trim().length > 2000) return res.status(400).json({ message: "coverPhoto too long" });
    updates.coverPhoto = String(updates.coverPhoto).trim();
  }
  if (updates.phone !== undefined && updates.phone) updates.phone = String(updates.phone).trim().slice(0, 30);
  if (updates.bio !== undefined && updates.bio) {
    const b = String(updates.bio).trim();
    if (b.length > 600) return res.status(400).json({ message: "bio max 600 chars" });
    updates.bio = b;
  }
  if (updates.city !== undefined) updates.city = String(updates.city).trim().slice(0, 80) || null;
  if (updates.country !== undefined) updates.country = String(updates.country).trim().slice(0, 80) || null;
  if (updates.skills !== undefined) {
    if (!Array.isArray(updates.skills)) return res.status(400).json({ message: "skills must be array" });
    updates.skills = updates.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  }
  if (updates.orgName !== undefined) updates.orgName = String(updates.orgName).trim().slice(0, 120) || null;
  if (updates.orgType !== undefined) {
    updates.orgType = ["university", "college", "school"].includes(String(updates.orgType).toLowerCase())
      ? String(updates.orgType).toLowerCase()
      : "university";
  }
  if (updates.orgCountry !== undefined) updates.orgCountry = String(updates.orgCountry).trim().slice(0, 80) || null;
  if (updates.orgWebsite !== undefined) updates.orgWebsite = String(updates.orgWebsite).trim().slice(0, 300) || null;
  if (updates.orgDescription !== undefined) updates.orgDescription = String(updates.orgDescription).trim().slice(0, 2000) || null;
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "nothing to update" });
  updates.updatedAt = new Date();
  const { users } = getCollections();
  const result = await users.updateOne({ email: req.decoded.email }, { $set: updates });
  const updated = await users.findOne({ email: req.decoded.email });
  res.status(200).json({ message: "profile updated", data: result, user: updated });
}

async function patchRole(req, res) {
  const id = req.params.id;
  const role = req.params.role; // admin | modaretor | user
  const { users } = getCollections();
  const result = await users.updateOne({ _id: new ObjectId(id) }, { $set: { role } });
  res.status(201).json({ message: "Admin added successfully", data: result });
}

async function deleteUser(req, res) {
  const { users } = getCollections();
  const result = await users.deleteOne({ _id: new ObjectId(req.params.id) });
  res.status(201).json({ message: "user deleted successfully", data: result });
}

async function checkInstitution(req, res) {
  const email = String(req.params.email || "").toLowerCase().trim();
  if (email !== String(req.decoded.email).toLowerCase() && req.authUser?.role !== "superadmin")
    return res.status(403).send({ message: "forbidden access" });
  const { users } = getCollections();
  const user = await users.findOne({ email });
  res.send({ isInstitution: user?.role === "institution", role: user?.role || null, status: user?.status || null, email });
}

async function getInstitutions(req, res) {
  const status = String(req.query.status || "pending");
  const filter = { role: "institution" };
  if (status !== "all") filter.status = status;
  const { users } = getCollections();
  const data = await users.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
  res.json({ message: "institutions fetched", data });
}

async function getPendingInstitutions(req, res) {
  const { users } = getCollections();
  const data = await users.find({ role: "institution", status: "pending" }).sort({ createdAt: -1 }).limit(200).toArray();
  res.json({ message: "pending institutions", data });
}

async function patchInstitutionStatus(req, res) {
  const oid = new ObjectId(req.params.id);
  const { status: newStatus, reason } = req.body;
  if (!["approved", "rejected", "pending"].includes(String(newStatus))) return res.status(400).json({ message: "status must be approved|rejected|pending" });
  const { users } = getCollections();
  const target = await users.findOne({ _id: oid, role: "institution" });
  if (!target) return res.status(404).json({ message: "institution not found" });
  const set = {
    status: String(newStatus),
    statusNote: reason ? String(reason).slice(0, 500) : null,
    reviewedAt: new Date(),
    reviewedBy: req.decoded.email,
    updatedAt: new Date(),
  };
  if (String(newStatus) === "approved") set.approvedAt = new Date();
  if (String(newStatus) === "rejected") set.rejectedAt = new Date();
  const result = await users.updateOne({ _id: oid }, { $set: set });
  const updated = await users.findOne({ _id: oid });
  res.json({ message: "institution status updated", data: result, user: updated });
}

module.exports = {
  createUser,
  getAllUsers,
  checkAdmin,
  checkSuperAdmin,
  checkModaretor,
  checkUser,
  getUserByEmail,
  getPublicUser,
  getMe,
  patchMe,
  patchRole,
  deleteUser,
  checkInstitution,
  getInstitutions,
  getPendingInstitutions,
  patchInstitutionStatus,
};
