const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const env = require("../config/env");

function computeCompleteness(u) {
  if (!u) return 0;
  let score = 0;
  if (u.photoURL) score += 10;
  if (u.coverPhoto) score += 10;
  if (u.bio && String(u.bio).trim().length >= 20) score += 10;
  else if (u.bio) score += 5;
  if (u.phone) score += 5;
  if (u.city || u.country) score += 5;
  if (Array.isArray(u.skills) && u.skills.length > 0) score += 10;
  if (u.headline) score += 5;
  if (u.socials && Object.values(u.socials).some(Boolean)) score += 8;
  if (Array.isArray(u.education) && u.education.length > 0) score += 12;
  else if (Array.isArray(u.languages) && u.languages.length > 0) score += 5;
  if (Array.isArray(u.experience) && u.experience.length > 0) score += 10;
  if (Array.isArray(u.certifications) && u.certifications.length > 0) score += 5;
  if (Array.isArray(u.interests) && u.interests.length > 0) score += 5;
  if (Array.isArray(u.gallery) && u.gallery.length > 0) score += 5;
  // institution boost
  if (u.role === "institution") {
    if (u.orgName) score += 5;
    if (u.orgDescription && String(u.orgDescription).length > 50) score += 5;
    if (u.orgWebsite) score += 3;
    if (Array.isArray(u.orgDepartments) && u.orgDepartments.length > 0) score += 5;
  }
  return Math.min(100, score);
}

function toArrayLimit(arr, limit) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean).slice(0, limit);
}

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
    reputation: 0,
    isVerified: false,
    photoURL: incoming.photoURL || null,
    phone: incoming.phone || null,
    bio: incoming.bio || null,
    city: incoming.city || null,
    country: incoming.country || null,
    skills: Array.isArray(incoming.skills) ? incoming.skills.slice(0, 20) : [],
    coverPhoto: incoming.coverPhoto || null,
    headline: String(incoming.headline || "").trim().slice(0, 120) || null,
    socials: incoming.socials && typeof incoming.socials === "object" ? {
      linkedin: String(incoming.socials.linkedin || "").trim().slice(0, 300) || null,
      twitter: String(incoming.socials.twitter || "").trim().slice(0, 300) || null,
      github: String(incoming.socials.github || "").trim().slice(0, 300) || null,
      website: String(incoming.socials.website || "").trim().slice(0, 300) || null,
    } : { linkedin: null, twitter: null, github: null, website: null },
    languages: Array.isArray(incoming.languages) ? incoming.languages.slice(0, 8).map(l => ({
      name: String(l.name || "").trim().slice(0, 40),
      level: ["native","fluent","intermediate","basic"].includes(String(l.level).toLowerCase()) ? String(l.level).toLowerCase() : "intermediate",
    })).filter(l=>l.name) : [],
    interests: toArrayLimit(incoming.interests, 12),
    education: Array.isArray(incoming.education) ? incoming.education.slice(0,5).map(e=>({
      school: String(e.school||"").trim().slice(0,120),
      degree: String(e.degree||"").trim().slice(0,80),
      field: String(e.field||"").trim().slice(0,80),
      startYear: e.startYear ? Number(e.startYear) : null,
      endYear: e.endYear ? Number(e.endYear) : null,
      grade: String(e.grade||"").trim().slice(0,40) || null,
      description: String(e.description||"").trim().slice(0,400) || null,
      logoUrl: String(e.logoUrl||"").trim().slice(0,500) || null,
    })).filter(e=>e.school) : [],
    experience: Array.isArray(incoming.experience) ? incoming.experience.slice(0,6).map(e=>({
      title: String(e.title||"").trim().slice(0,120),
      org: String(e.org||"").trim().slice(0,120),
      location: String(e.location||"").trim().slice(0,80) || null,
      startDate: e.startDate ? String(e.startDate).slice(0,20) : null,
      endDate: e.endDate ? String(e.endDate).slice(0,20) : null,
      current: Boolean(e.current),
      description: String(e.description||"").trim().slice(0,500) || null,
    })).filter(e=>e.title && e.org) : [],
    certifications: Array.isArray(incoming.certifications) ? incoming.certifications.slice(0,8).map(c=>({
      name: String(c.name||"").trim().slice(0,120),
      issuer: String(c.issuer||"").trim().slice(0,120),
      issueDate: c.issueDate ? String(c.issueDate).slice(0,20) : null,
      url: String(c.url||"").trim().slice(0,500) || null,
      credentialId: String(c.credentialId||"").trim().slice(0,100) || null,
    })).filter(c=>c.name) : [],
    achievements: Array.isArray(incoming.achievements) ? incoming.achievements.slice(0,10).map(a=>({
      title: String(a.title||"").trim().slice(0,120),
      date: a.date ? String(a.date).slice(0,20) : null,
      description: String(a.description||"").trim().slice(0,400) || null,
      url: String(a.url||"").trim().slice(0,500) || null,
    })).filter(a=>a.title) : [],
    gallery: toArrayLimit(incoming.gallery, 6).map(s=>s.slice(0,500)),
    videoIntro: String(incoming.videoIntro||"").trim().slice(0,500) || null,
    preferences: {
      visibility: ["public","connections","private"].includes(String(incoming.preferences?.visibility)) ? incoming.preferences.visibility : "public",
      showStatsOnPublic: incoming.preferences?.showStatsOnPublic !== false,
      showScheduledOnProfile: Boolean(incoming.preferences?.showScheduledOnProfile),
      emailNotifications: incoming.preferences?.emailNotifications !== false,
    },
    followersCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  user.completeness = computeCompleteness(user);

  if (isInstitution) {
    user.orgName = String(incoming.orgName || "").trim().slice(0, 120) || null;
    user.orgType = ["university", "college", "school"].includes(String(incoming.orgType || "").toLowerCase())
      ? String(incoming.orgType).toLowerCase()
      : "university";
    user.orgCountry = String(incoming.orgCountry || "").trim().slice(0, 80) || null;
    user.orgWebsite = String(incoming.orgWebsite || "").trim().slice(0, 300) || null;
    user.orgDescription = String(incoming.orgDescription || "").trim().slice(0, 2000) || null;
    user.orgFounded = incoming.orgFounded ? Number(incoming.orgFounded) : null;
    user.orgAccreditation = String(incoming.orgAccreditation || "").trim().slice(0, 120) || null;
    user.orgStudentCount = incoming.orgStudentCount ? Number(incoming.orgStudentCount) : null;
    user.orgFacultyCount = incoming.orgFacultyCount ? Number(incoming.orgFacultyCount) : null;
    user.orgDepartments = toArrayLimit(incoming.orgDepartments, 20);
    user.orgPrograms = Array.isArray(incoming.orgPrograms) ? incoming.orgPrograms.slice(0,20).map(p=>({
      name: String(p.name||"").trim().slice(0,120),
      level: String(p.level||"").trim().slice(0,40) || null,
      duration: String(p.duration||"").trim().slice(0,40) || null,
      seats: p.seats ? Number(p.seats) : null,
    })).filter(p=>p.name) : [];
    user.orgGallery = toArrayLimit(incoming.orgGallery, 6).map(s=>s.slice(0,500));
    user.orgVideoUrl = String(incoming.orgVideoUrl||"").trim().slice(0,500) || null;
    user.orgBrochureUrl = String(incoming.orgBrochureUrl||"").trim().slice(0,500) || null;
    user.orgMapUrl = String(incoming.orgMapUrl||"").trim().slice(0,500) || null;
    user.orgHighlights = toArrayLimit(incoming.orgHighlights, 10);
    user.statusNote = null;
    user.reviewedAt = null;
    user.reviewedBy = null;
    user.verified = false;
    // recompute with institution fields
    user.completeness = computeCompleteness(user);
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
  const q = String(req.query.q || "").trim();
  const filterRole = String(req.query.role || "").trim().toLowerCase();
  const filterStatus = String(req.query.status || "").trim().toLowerCase();
  const orgType = String(req.query.orgType || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const sort = String(req.query.sort || "newest");
  const filter = {};
  if (filterRole && ["user","modaretor","admin","superadmin","institution"].includes(filterRole)) filter.role = filterRole;
  if (filterStatus && ["active","pending","approved","rejected"].includes(filterStatus)) filter.status = filterStatus;
  if (orgType && ["university","college","school"].includes(orgType)) filter.orgType = orgType;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { orgName: { $regex: q, $options: "i" } },
      { city: { $regex: q, $options: "i" } },
    ];
  }
  let sortObj = { createdAt: -1 };
  if (sort === "name") sortObj = { name: 1 };
  if (sort === "oldest") sortObj = { createdAt: 1 };
  const total = await users.countDocuments(filter);
  const data = await users.find(filter).sort(sortObj).skip((page-1)*limit).limit(limit).toArray();
  res.status(200).json({ message: "User get successfully", data, total, page, totalPages: Math.ceil(total/limit) });
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

function pickPublic(u) {
  if (!u) return null;
  return {
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
    reputation: typeof u.reputation === "number" ? u.reputation : 0,
    isVerified: Boolean(u.isVerified),
    headline: u.headline,
    socials: u.socials,
    languages: u.languages,
    interests: u.interests,
    education: u.education,
    experience: u.experience,
    certifications: u.certifications,
    achievements: u.achievements,
    gallery: u.gallery,
    videoIntro: u.videoIntro,
    preferences: u.preferences,
    completeness: u.completeness,
    followersCount: u.followersCount || 0,
    followingCount: u.followingCount || 0,
    orgName: u.orgName,
    orgType: u.orgType,
    orgCountry: u.orgCountry,
    orgWebsite: u.orgWebsite,
    orgDescription: u.orgDescription,
    orgFounded: u.orgFounded,
    orgAccreditation: u.orgAccreditation,
    orgStudentCount: u.orgStudentCount,
    orgFacultyCount: u.orgFacultyCount,
    orgDepartments: u.orgDepartments,
    orgPrograms: u.orgPrograms,
    orgGallery: u.orgGallery,
    orgVideoUrl: u.orgVideoUrl,
    orgBrochureUrl: u.orgBrochureUrl,
    orgMapUrl: u.orgMapUrl,
    orgHighlights: u.orgHighlights,
    verified: u.verified,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

async function getPublicUser(req, res) {
  const email = String(req.params.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) return res.status(400).json({ message: "valid email required" });
  const { users } = getCollections();
  const u = await users.findOne({ email });
  if (!u) return res.status(404).json({ message: "user not found" });
  // respect visibility
  if (u.preferences?.visibility === "private") {
    // still return minimal
    return res.json({ message: "public profile", data: { _id: u._id, name: u.name, photoURL: u.photoURL, role: u.role, headline: u.headline, verified: u.verified, createdAt: u.createdAt } });
  }
  res.json({ message: "public profile", data: pickPublic(u) });
}

async function getMe(req, res) {
  const { users } = getCollections();
  const me = await users.findOne({ email: req.decoded.email });
  res.status(200).json({ message: "me fetched", data: me });
}

async function getMeStats(req, res) {
  const email = String(req.decoded.email).toLowerCase();
  const { users, apply, reviews, saved, scholership, follows } = getCollections();
  const me = await users.findOne({ email });
  if (!me) return res.status(404).json({ message: "user not found" });
  const isInstitution = me.role === "institution";
  let applications = 0, reviewsCount = 0, savedCount = 0, scholarshipsCreated = 0, pendingReviews = 0, studentsCount = 0;
  let avgRating = null;
  try {
    if (!isInstitution) {
      applications = await apply.countDocuments({ email });
      reviewsCount = await reviews.countDocuments({ reviewer_email: email });
      savedCount = await saved.countDocuments({ userEmail: email });
    } else {
      scholarshipsCreated = await scholership.countDocuments({ createdBy: email });
      // count applications to my scholarships
      const myIds = await scholership.find({ createdBy: email }, { projection: { _id: 1 } }).toArray();
      // apply uses scholarship_id string, need string ids
      if (myIds.length) {
        const ids = myIds.map(d=>String(d._id));
        applications = await apply.countDocuments({ scholarship_id: { $in: ids } });
      }
      const { institutionStudents } = getCollections();
      studentsCount = await institutionStudents.countDocuments({ institutionEmail: email });
    }
    // avg rating for reviews received? approximate via scholership rating if institution else reviews avg
    if (reviewsCount > 0) {
      const agg = await reviews.aggregate([{ $match: { reviewer_email: email } }, { $group: { _id: null, avg: { $avg: "$rating" } } }]).toArray();
      if (agg[0]) avgRating = Number(agg[0].avg.toFixed(1));
    }
    // follower counts
    const followers = await follows.countDocuments({ followingEmail: email });
    const following = await follows.countDocuments({ followerEmail: email });
    const completeness = typeof me.completeness === "number" ? me.completeness : computeCompleteness(me);
    res.json({ message: "stats fetched", data: { applications, reviews: reviewsCount, saved: savedCount, scholarshipsCreated, avgRating, studentsCount, followers, following, completeness, role: me.role } });
  } catch (e) {
    res.status(500).json({ message: "stats error", error: e.message });
  }
}

async function getPublicStats(req, res) {
  const email = String(req.params.email || "").toLowerCase().trim();
  if (!email.includes("@")) return res.status(400).json({ message: "valid email required" });
  const { users, apply, reviews, saved, scholership, follows } = getCollections();
  const u = await users.findOne({ email });
  if (!u) return res.status(404).json({ message: "user not found" });
  const isInstitution = u.role === "institution";
  let applications = 0, reviewsCount = 0, savedCount = 0, scholarshipsCreated = 0, studentsCount = 0;
  let avgRating = null;
  try {
    if (!isInstitution) {
      applications = await apply.countDocuments({ email });
      reviewsCount = await reviews.countDocuments({ reviewer_email: email, status: "approved" });
      if (u.preferences?.showStatsOnPublic === false) savedCount = 0; else savedCount = await saved.countDocuments({ userEmail: email });
    } else {
      scholarshipsCreated = await scholership.countDocuments({ createdBy: email, status: { $ne: "draft" } });
      const myIds = await scholership.find({ createdBy: email }, { projection: { _id: 1 } }).toArray();
      if (myIds.length) {
        const ids = myIds.map(d=>String(d._id));
        applications = await apply.countDocuments({ scholarship_id: { $in: ids } });
      }
      try { const { institutionStudents } = getCollections(); studentsCount = await institutionStudents.countDocuments({ institutionEmail: email }); } catch {}
    }
    if (reviewsCount) {
      const agg = await reviews.aggregate([{ $match: { reviewer_email: email, status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" } } }]).toArray();
      if (agg[0]) avgRating = Number(agg[0].avg.toFixed(1));
    }
    const followers = await follows.countDocuments({ followingEmail: email });
    const following = await follows.countDocuments({ followerEmail: email });
    res.json({ message: "public stats", data: { applications, reviews: reviewsCount, saved: savedCount, scholarshipsCreated, avgRating, studentsCount, followers, following, completeness: u.completeness || computeCompleteness(u) } });
  } catch (e) {
    res.status(500).json({ message: "stats error", error: e.message });
  }
}

async function getPortal(req, res) {
  const email = String(req.decoded.email).toLowerCase();
  const { users, apply, reviews, saved, scholership } = getCollections();
  const me = await users.findOne({ email });
  if (!me) return res.status(404).json({ message: "user not found" });
  const isInstitution = me.role === "institution";
  let recentApplications = [], recentReviews = [], savedDocs = [], scholarships = [];
  try {
    if (!isInstitution) {
      recentApplications = await apply.find({ email }).sort({ appliedAt: -1, _id: -1 }).limit(4).toArray();
      recentReviews = await reviews.find({ reviewer_email: email }).sort({ createdAt: -1 }).limit(3).toArray();
      savedDocs = await saved.find({ userEmail: email }).sort({ savedAt: -1 }).limit(4).toArray();
    } else {
      scholarships = await scholership.find({ createdBy: email }).sort({ createdAt: -1 }).limit(6).toArray();
      // recent applications to my scholarships
      const ids = scholarships.map(s=>String(s._id));
      if (ids.length) recentApplications = await apply.find({ scholarship_id: { $in: ids } }).sort({ _id: -1 }).limit(4).toArray();
    }
    // compute stats via getMeStats logic inline
    const statsRes = await (async()=> {
      let applications = 0, reviewsCount=0, savedCount=0, scholarshipsCreated=0;
      if (!isInstitution) {
        applications = await apply.countDocuments({ email });
        reviewsCount = await reviews.countDocuments({ reviewer_email: email });
        savedCount = await saved.countDocuments({ userEmail: email });
      } else {
        scholarshipsCreated = await scholership.countDocuments({ createdBy: email });
        const myIds = await scholership.find({ createdBy: email }, { projection: { _id: 1 } }).toArray();
        if (myIds.length) applications = await apply.countDocuments({ scholarship_id: { $in: myIds.map(d=>String(d._id)) } });
      }
      return { applications, reviews: reviewsCount, saved: savedCount, scholarshipsCreated };
    })();
    res.json({ message: "portal fetched", data: { me, stats: statsRes, recentApplications, recentReviews, savedDocs, scholarships } });
  } catch (e) {
    res.status(500).json({ message: "portal error", error: e.message });
  }
}

async function patchMe(req, res) {
  const allowed = ["name", "photoURL", "phone", "bio", "city", "country", "skills", "coverPhoto", "orgName", "orgType", "orgCountry", "orgWebsite", "orgDescription","headline","socials","languages","interests","education","experience","certifications","achievements","gallery","videoIntro","preferences","orgFounded","orgAccreditation","orgStudentCount","orgFacultyCount","orgDepartments","orgPrograms","orgGallery","orgVideoUrl","orgBrochureUrl","orgMapUrl","orgHighlights"];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  if (updates.name !== undefined) {
    const n = String(updates.name).trim();
    if (n.length < 2 || n.length > 80) return res.status(400).json({ message: "name 2-80 chars" });
    updates.name = n;
  }
  if (updates.headline !== undefined) {
    updates.headline = String(updates.headline).trim().slice(0, 120) || null;
  }
  if (updates.photoURL !== undefined && updates.photoURL) {
    if (String(updates.photoURL).trim().length > 2000) return res.status(400).json({ message: "photoURL too long" });
    updates.photoURL = String(updates.photoURL).trim();
  }
  if (updates.coverPhoto !== undefined && updates.coverPhoto) {
    if (String(updates.coverPhoto).trim().length > 2000) return res.status(400).json({ message: "coverPhoto too long" });
    updates.coverPhoto = String(updates.coverPhoto).trim();
  }
  if (updates.videoIntro !== undefined) updates.videoIntro = String(updates.videoIntro).trim().slice(0, 500) || null;
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
  if (updates.socials !== undefined) {
    if (typeof updates.socials !== "object" || Array.isArray(updates.socials)) return res.status(400).json({ message: "socials must be object" });
    const s = updates.socials;
    updates.socials = {
      linkedin: s.linkedin ? String(s.linkedin).trim().slice(0,300) : null,
      twitter: s.twitter ? String(s.twitter).trim().slice(0,300) : null,
      github: s.github ? String(s.github).trim().slice(0,300) : null,
      website: s.website ? String(s.website).trim().slice(0,300) : null,
    };
  }
  if (updates.languages !== undefined) {
    if (!Array.isArray(updates.languages)) return res.status(400).json({ message: "languages must be array" });
    updates.languages = updates.languages.slice(0,8).map(l=>({
      name: String(l.name||"").trim().slice(0,40),
      level: ["native","fluent","intermediate","basic"].includes(String(l.level||"").toLowerCase()) ? String(l.level).toLowerCase() : "intermediate",
    })).filter(l=>l.name);
  }
  if (updates.interests !== undefined) {
    if (!Array.isArray(updates.interests)) return res.status(400).json({ message: "interests must be array" });
    updates.interests = updates.interests.map(s=>String(s).trim()).filter(Boolean).slice(0,12);
  }
  if (updates.education !== undefined) {
    if (!Array.isArray(updates.education)) return res.status(400).json({ message: "education must be array" });
    updates.education = updates.education.slice(0,5).map(e=>({
      school: String(e.school||"").trim().slice(0,120),
      degree: String(e.degree||"").trim().slice(0,80),
      field: String(e.field||"").trim().slice(0,80),
      startYear: e.startYear ? Number(e.startYear) : null,
      endYear: e.endYear ? Number(e.endYear) : null,
      grade: String(e.grade||"").trim().slice(0,40) || null,
      description: String(e.description||"").trim().slice(0,400) || null,
      logoUrl: String(e.logoUrl||"").trim().slice(0,500) || null,
    })).filter(e=>e.school);
  }
  if (updates.experience !== undefined) {
    if (!Array.isArray(updates.experience)) return res.status(400).json({ message: "experience must be array" });
    updates.experience = updates.experience.slice(0,6).map(e=>({
      title: String(e.title||"").trim().slice(0,120),
      org: String(e.org||"").trim().slice(0,120),
      location: String(e.location||"").trim().slice(0,80) || null,
      startDate: e.startDate ? String(e.startDate).slice(0,20) : null,
      endDate: e.endDate ? String(e.endDate).slice(0,20) : null,
      current: Boolean(e.current),
      description: String(e.description||"").trim().slice(0,500) || null,
    })).filter(e=>e.title && e.org);
  }
  if (updates.certifications !== undefined) {
    if (!Array.isArray(updates.certifications)) return res.status(400).json({ message: "certifications must be array" });
    updates.certifications = updates.certifications.slice(0,8).map(c=>({
      name: String(c.name||"").trim().slice(0,120),
      issuer: String(c.issuer||"").trim().slice(0,120),
      issueDate: c.issueDate ? String(c.issueDate).slice(0,20) : null,
      url: String(c.url||"").trim().slice(0,500) || null,
      credentialId: String(c.credentialId||"").trim().slice(0,100) || null,
    })).filter(c=>c.name);
  }
  if (updates.achievements !== undefined) {
    if (!Array.isArray(updates.achievements)) return res.status(400).json({ message: "achievements must be array" });
    updates.achievements = updates.achievements.slice(0,10).map(a=>({
      title: String(a.title||"").trim().slice(0,120),
      date: a.date ? String(a.date).slice(0,20) : null,
      description: String(a.description||"").trim().slice(0,400) || null,
      url: String(a.url||"").trim().slice(0,500) || null,
    })).filter(a=>a.title);
  }
  if (updates.gallery !== undefined) {
    if (!Array.isArray(updates.gallery)) return res.status(400).json({ message: "gallery must be array" });
    updates.gallery = updates.gallery.map(s=>String(s).trim()).filter(Boolean).slice(0,6).map(s=>s.slice(0,500));
  }
  if (updates.preferences !== undefined) {
    if (typeof updates.preferences !== "object" || Array.isArray(updates.preferences)) return res.status(400).json({ message: "preferences must be object" });
    const p = updates.preferences;
    const cur = {};
    if (p.visibility !== undefined) {
      if (!["public","connections","private"].includes(String(p.visibility))) return res.status(400).json({ message: "visibility invalid" });
      cur.visibility = String(p.visibility);
    }
    if (p.showStatsOnPublic !== undefined) cur.showStatsOnPublic = Boolean(p.showStatsOnPublic);
    if (p.showScheduledOnProfile !== undefined) cur.showScheduledOnProfile = Boolean(p.showScheduledOnProfile);
    if (p.emailNotifications !== undefined) cur.emailNotifications = Boolean(p.emailNotifications);
    // merge with existing preferences instead of replace
    const { users: ucol } = getCollections();
    const existing = await ucol.findOne({ email: req.decoded.email });
    updates.preferences = { ...(existing?.preferences || { visibility:"public", showStatsOnPublic:true, showScheduledOnProfile:false, emailNotifications:true }), ...cur };
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
  if (updates.orgFounded !== undefined) updates.orgFounded = updates.orgFounded ? Number(updates.orgFounded) : null;
  if (updates.orgAccreditation !== undefined) updates.orgAccreditation = String(updates.orgAccreditation).trim().slice(0,120) || null;
  if (updates.orgStudentCount !== undefined) updates.orgStudentCount = updates.orgStudentCount ? Number(updates.orgStudentCount) : null;
  if (updates.orgFacultyCount !== undefined) updates.orgFacultyCount = updates.orgFacultyCount ? Number(updates.orgFacultyCount) : null;
  if (updates.orgDepartments !== undefined) {
    if (!Array.isArray(updates.orgDepartments)) return res.status(400).json({ message: "orgDepartments must be array" });
    updates.orgDepartments = updates.orgDepartments.map(s=>String(s).trim()).filter(Boolean).slice(0,20);
  }
  if (updates.orgPrograms !== undefined) {
    if (!Array.isArray(updates.orgPrograms)) return res.status(400).json({ message: "orgPrograms must be array" });
    updates.orgPrograms = updates.orgPrograms.slice(0,20).map(p=>({
      name: String(p.name||"").trim().slice(0,120),
      level: String(p.level||"").trim().slice(0,40) || null,
      duration: String(p.duration||"").trim().slice(0,40) || null,
      seats: p.seats ? Number(p.seats) : null,
    })).filter(p=>p.name);
  }
  if (updates.orgGallery !== undefined) {
    if (!Array.isArray(updates.orgGallery)) return res.status(400).json({ message: "orgGallery must be array" });
    updates.orgGallery = updates.orgGallery.map(s=>String(s).trim()).filter(Boolean).slice(0,6).map(s=>s.slice(0,500));
  }
  if (updates.orgVideoUrl !== undefined) updates.orgVideoUrl = String(updates.orgVideoUrl).trim().slice(0,500) || null;
  if (updates.orgBrochureUrl !== undefined) updates.orgBrochureUrl = String(updates.orgBrochureUrl).trim().slice(0,500) || null;
  if (updates.orgMapUrl !== undefined) updates.orgMapUrl = String(updates.orgMapUrl).trim().slice(0,500) || null;
  if (updates.orgHighlights !== undefined) {
    if (!Array.isArray(updates.orgHighlights)) return res.status(400).json({ message: "orgHighlights must be array" });
    updates.orgHighlights = updates.orgHighlights.map(s=>String(s).trim()).filter(Boolean).slice(0,10);
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "nothing to update" });
  updates.updatedAt = new Date();
  const { users } = getCollections();
  const current = await users.findOne({ email: req.decoded.email });
  const mergedForScore = { ...current, ...updates };
  updates.completeness = computeCompleteness(mergedForScore);
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
  const { users, reputationEvents, questions, answers } = getCollections();
  const oid = new ObjectId(req.params.id);
  const userDoc = await users.findOne({ _id: oid }, { projection: { email: 1 } });
  const result = await users.deleteOne({ _id: oid });
  // permanence principle: anonymize reputationEvents instead of deleting — preserve history
  try {
    await reputationEvents.updateMany({ userId: oid }, { $set: { userId: null, anonymized: true } });
    if (userDoc?.email) {
      await reputationEvents.updateMany({ userId: userDoc.email }, { $set: { userId: null, anonymized: true } });
      // keep question/answer history but anonymize author reference
      await questions.updateMany({ authorId: oid }, { $set: { authorId: null, anonymized: true } });
      await answers.updateMany({ authorId: oid }, { $set: { authorId: null, anonymized: true } });
    }
  } catch (_) {}
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
  if (String(newStatus) === "approved") { set.approvedAt = new Date(); set.verified = true; }
  if (String(newStatus) === "rejected") { set.rejectedAt = new Date(); set.verified = false; }
  const result = await users.updateOne({ _id: oid }, { $set: set });
  const updated = await users.findOne({ _id: oid });
  res.json({ message: "institution status updated", data: result, user: updated });
}

// Follow system
async function toggleFollow(req, res) {
  const targetEmail = String(req.params.email || "").toLowerCase().trim();
  if (!targetEmail.includes("@")) return res.status(400).json({ message: "valid email required" });
  const followerEmail = String(req.decoded.email).toLowerCase();
  if (targetEmail === followerEmail) return res.status(400).json({ message: "cannot follow yourself" });
  const { follows, users } = getCollections();
  const target = await users.findOne({ email: targetEmail });
  if (!target) return res.status(404).json({ message: "user not found" });
  const existing = await follows.findOne({ followerEmail, followingEmail: targetEmail });
  if (existing) {
    await follows.deleteOne({ _id: existing._id });
    await users.updateOne({ email: followerEmail }, { $inc: { followingCount: -1 } });
    await users.updateOne({ email: targetEmail }, { $inc: { followersCount: -1 } });
    // prevent negative
    await users.updateOne({ email: followerEmail, followingCount: { $lt: 0 } }, { $set: { followingCount: 0 } });
    await users.updateOne({ email: targetEmail, followersCount: { $lt: 0 } }, { $set: { followersCount: 0 } });
    return res.json({ message: "unfollowed", following: false });
  }
  await follows.insertOne({ followerEmail, followingEmail: targetEmail, createdAt: new Date() });
  await users.updateOne({ email: followerEmail }, { $inc: { followingCount: 1 } });
  await users.updateOne({ email: targetEmail }, { $inc: { followersCount: 1 } });
  res.json({ message: "followed", following: true });
}

async function getFollowers(req, res) {
  const email = String(req.params.email || "").toLowerCase().trim();
  if (!email.includes("@")) return res.status(400).json({ message: "valid email required" });
  const { follows } = getCollections();
  const followers = await follows.find({ followingEmail: email }).sort({ createdAt: -1 }).limit(100).toArray();
  const following = await follows.find({ followerEmail: email }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ message: "follow data", data: { followers, following, followersCount: followers.length, followingCount: following.length } });
}

async function checkFollow(req, res) {
  const targetEmail = String(req.params.email || "").toLowerCase().trim();
  const followerEmail = String(req.decoded.email).toLowerCase();
  const { follows } = getCollections();
  const existing = await follows.findOne({ followerEmail, followingEmail: targetEmail });
  res.json({ following: Boolean(existing) });
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
  getMeStats,
  getPublicStats,
  getPortal,
  patchMe,
  patchRole,
  deleteUser,
  checkInstitution,
  getInstitutions,
  getPendingInstitutions,
  patchInstitutionStatus,
  toggleFollow,
  getFollowers,
  checkFollow,
};
