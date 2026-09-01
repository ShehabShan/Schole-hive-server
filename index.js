const express = require("express");
const cors = require("cors");
var jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://scholarhive-913e4.web.app",
      "https://scholarhive-913e4.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorize access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "unauthorize access" });
    }

    req.decoded = decoded;
    next();
  });
};

const uri =
  process.env.MONGO_URI ||
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d6z2i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("schoolHive");
    const scholershipCollection = database.collection("scholership");
    const reviewsCollection = database.collection("reviews");
    const usersCollection = database.collection("users");
    const applyCollection = database.collection("apply");
    const savedCollection = database.collection("saved");
    const inquiriesCollection = database.collection("inquiries");
    const reviewHistoryCollection = database.collection("review_history");

    // review indexes: 1 per (user, scholarship) + filter by scholarship+status
    try {
      await reviewsCollection.createIndex({ reviewer_email: 1, scholarShip_id: 1 }, { unique: true, background: true });
      await reviewsCollection.createIndex({ scholarShip_id: 1, status: 1 }, { background: true });
      await reviewsCollection.createIndex({ status: 1, createdAt: -1 }, { background: true });
    } catch (e) {
      console.log("index creation warning", e.message);
    }
    try {
      await scholershipCollection.createIndex({ country: 1, scholarshipCategory: 1, degree: 1 }, { background: true });
      await scholershipCollection.createIndex({ subjectName: 1 }, { background: true });
      await scholershipCollection.createIndex({ applicationDeadline: 1 }, { background: true });
      await scholershipCollection.createIndex({ rating: -1 }, { background: true });
      await scholershipCollection.createIndex({ applicationFees: 1 }, { background: true });
      await scholershipCollection.createIndex(
        { universityName: "text", scholarshipDescription: "text", subjectName: "text", scholarshipCategory: "text" },
        { background: true, name: "scholarship_text_idx" }
      );
      await savedCollection.createIndex({ userEmail: 1, scholarshipId: 1 }, { unique: true, background: true });
      await savedCollection.createIndex({ userEmail: 1, savedAt: -1 }, { background: true });
      await inquiriesCollection.createIndex({ scholarshipId: 1, createdAt: -1 }, { background: true });
      await inquiriesCollection.createIndex({ email: 1 }, { background: true });
      await reviewHistoryCollection.createIndex({ reviewId: 1, at: -1 }, { background: true });
      await reviewHistoryCollection.createIndex({ scholarshipId: 1 }, { background: true });
    } catch (e) {
      console.log("scholarship/saved index warning", e.message);
    }

    const recalcScholarshipRating = async (scholarShip_id) => {
      try {
        if (!scholarShip_id) return;
        const sid = String(scholarShip_id);
        const approved = await reviewsCollection.find({ scholarShip_id: sid, status: "approved" }).toArray();
        if (approved.length === 0) {
          await scholershipCollection.updateOne({ _id: new ObjectId(sid) }, { $set: { rating: 0, reviewsCount: 0 } });
          return;
        }
        const sum = approved.reduce((a, r) => a + (Number(r.rating) || 0), 0);
        const avg = Math.round((sum / approved.length) * 10) / 10;
        await scholershipCollection.updateOne({ _id: new ObjectId(sid) }, { $set: { rating: avg, reviewsCount: approved.length } });
      } catch (err) {
        console.log("recalc rating error", err.message);
      }
    };

    const loadAuthUser = async (req, res, next) => {
      try {
        req.authUser = await usersCollection.findOne({
          email: req.decoded.email,
        });
        next();
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    };

    const verifyAdmin = async (req, res, next) => {
      const role = req.authUser?.role;
      const isAdmin = role === "admin" || role === "superadmin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyModaretor = async (req, res, next) => {
      const role = req.authUser?.role;
      const isMod = role === "modaretor" || role === "admin" || role === "superadmin";
      if (!isMod) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifySuperAdmin = async (req, res, next) => {
      if (req.authUser?.role !== "superadmin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyOwnerModifiable = async (req, res, next) => {
      const target = await usersCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      if (target?.role === "superadmin") {
        return res
          .status(403)
          .send({ message: "the owner role cannot be modified" });
      }
      next();
    };

    const REVIEW_AUTO_APPROVE = process.env.REVIEW_AUTO_APPROVE !== "false";

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const JwtToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });

      res
        .cookie("token", JwtToken, {
          httpOnly: true,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          secure: process.env.NODE_ENV === "production",
        })
        .send({ success: true, token: JwtToken });
    });

    app.post("/clear-jwt", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          secure: process.env.NODE_ENV === "production",
        })
        .send({ success: true });
    });

    // user collection

    app.post("/users", async (req, res) => {
      const incoming = req.body;
      if (!incoming?.email) return res.status(400).json({ message: "email required" });
      const query = { email: String(incoming.email).toLowerCase().trim() };

      try {
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
          // sync photoURL if provided and missing
          if (incoming.photoURL && !existingUser.photoURL) {
            await usersCollection.updateOne(query, { $set: { photoURL: incoming.photoURL, updatedAt: new Date() } });
          }
          return res.send({ message: "user already exist", data: { insertedId: null } });
        }

        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean);

        const user = {
          name: String(incoming.name || "").trim() || null,
          email: String(incoming.email).toLowerCase().trim(),
          role: incoming.role || "user",
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

        if (adminEmails.includes(user.email)) {
          user.role = "superadmin";
        }
        if (!["user", "modaretor", "admin", "superadmin"].includes(user.role)) user.role = "user";

        const result = await usersCollection.insertOne(user);
        res
          .status(201)
          .json({ message: "User Added successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/users", verifyToken, loadAuthUser, async (req, res) => {
      const role = req.authUser?.role;
      const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
      if (!isStaff) return res.status(403).json({ message: "forbidden: admin only" });
      try {
        const result = await usersCollection.find().toArray();
        res.status(200).json({
          message: "User get successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // admin permission

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin" || user?.role === "superadmin";
      }
      res.send({ isAdmin });
    });

    // super admin (owner) permission

    app.get("/users/superAdmin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isSuperAdmin = false;
      if (user) {
        isSuperAdmin = user?.role === "superadmin";
      }
      res.send({ isSuperAdmin });
    });

    // modaretor permission

    app.get("/users/modaretor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isModaretor = false;
      if (user) {
        isModaretor = user?.role === "modaretor";
      }
      res.send({ isModaretor });
    });

    // user permission

    app.get("/users/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isUser = false;
      if (user) {
        isUser = user?.role === "user";
      }
      res.send({ isUser });
    });

    app.get("/user", verifyToken, loadAuthUser, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).json({ message: "email query required" });
      const role = req.authUser?.role;
      const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
      if (String(email).toLowerCase() !== String(req.decoded.email).toLowerCase() && !isStaff) {
        return res.status(403).json({ message: "forbidden: can only view own profile" });
      }
      const query = { email: String(email).toLowerCase().trim() };
      try {
        const result = await usersCollection.findOne(query);
        res.status(200).json({ message: "user fetched successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // public profile: GET /users/public/:email — safe fields only, no auth
    app.get("/users/public/:email", async (req, res) => {
      const email = String(req.params.email || "").toLowerCase().trim();
      if (!email || !email.includes("@")) return res.status(400).json({ message: "valid email required" });
      try {
        const u = await usersCollection.findOne({ email });
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
          createdAt: u.createdAt,
        };
        res.json({ message: "public profile", data: pub });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // self profile: GET /users/me
    app.get("/users/me", verifyToken, loadAuthUser, async (req, res) => {
      try {
        const me = await usersCollection.findOne({ email: req.decoded.email });
        res.status(200).json({ message: "me fetched", data: me });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // self profile update: PATCH /users/me (whitelisted fields only, role not allowed)
    app.patch("/users/me", verifyToken, loadAuthUser, async (req, res) => {
      const allowed = ["name", "photoURL", "phone", "bio", "city", "country", "skills", "coverPhoto"];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.name !== undefined) {
        const n = String(updates.name).trim();
        if (n.length < 2 || n.length > 80) return res.status(400).json({ message: "name 2-80 chars" });
        updates.name = n;
      }
      if (updates.photoURL !== undefined && updates.photoURL) {
        const u = String(updates.photoURL).trim();
        if (u.length > 2000) return res.status(400).json({ message: "photoURL too long" });
        updates.photoURL = u;
      }
      if (updates.coverPhoto !== undefined && updates.coverPhoto) {
        const u = String(updates.coverPhoto).trim();
        if (u.length > 2000) return res.status(400).json({ message: "coverPhoto too long" });
        updates.coverPhoto = u;
      }
      if (updates.phone !== undefined && updates.phone) {
        const p = String(updates.phone).trim().slice(0, 30);
        updates.phone = p;
      }
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
      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "nothing to update" });
      updates.updatedAt = new Date();
      try {
        const result = await usersCollection.updateOne({ email: req.decoded.email }, { $set: updates });
        const updated = await usersCollection.findOne({ email: req.decoded.email });
        res.status(200).json({ message: "profile updated", data: result, user: updated });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      loadAuthUser,
      verifyAdmin,
      verifyOwnerModifiable,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        try {
          const updatedDoc = {
            $set: {
              role: "admin",
            },
          };

          const result = await usersCollection.updateOne(filter, updatedDoc);

          res.status(201).json({
            message: "Admin added successfully",
            data: result,
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    app.patch(
      "/users/modaretor/:id",
      verifyToken,
      loadAuthUser,
      verifyAdmin,
      verifyOwnerModifiable,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        try {
          const updatedDoc = {
            $set: {
              role: "modaretor",
            },
          };

          const result = await usersCollection.updateOne(filter, updatedDoc);

          res.status(201).json({
            message: "Admin added successfully",
            data: result,
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    app.patch(
      "/users/user/:id",
      verifyToken,
      loadAuthUser,
      verifyAdmin,
      verifyOwnerModifiable,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        try {
          const updatedDoc = {
            $set: {
              role: "user",
            },
          };

          const result = await usersCollection.updateOne(filter, updatedDoc);

          res.status(201).json({
            message: "Admin added successfully",
            data: result,
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    app.delete(
      "/users/:id",
      verifyToken,
      loadAuthUser,
      verifyAdmin,
      verifyOwnerModifiable,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        try {
          const result = await usersCollection.deleteOne(query);
          res.status(201).json({
          message: "user deleted successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // scholership collection — faceted, paginated, secured, saved + stats

    // helpers
    const buildScholarshipFilter = (q) => {
      const filter = {};
      const rawQ = String(q.q || q.search || "").trim();
      if (rawQ) {
        // use regex OR across key text fields (fallback if text index not ready)
        const rx = { $regex: rawQ.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        filter.$or = [
          { universityName: rx },
          { scholarshipCategory: rx },
          { subjectName: rx },
          { scholarshipDescription: rx },
          { country: rx },
          { city: rx },
          { degree: rx },
        ];
      }
      const cat = String(q.category || q.scholarshipCategory || "").trim();
      if (cat) filter.scholarshipCategory = cat;
      const subject = String(q.subject || q.subjectName || "").trim();
      if (subject) filter.subjectName = subject;
      const degree = String(q.degree || "").trim();
      if (degree) filter.degree = degree;
      const country = String(q.country || "").trim();
      if (country) filter.country = { $regex: `^${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
      const city = String(q.city || "").trim();
      if (city) filter.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
      const maxFees = q.maxFees !== undefined && q.maxFees !== "" ? Number(q.maxFees) : NaN;
      if (Number.isFinite(maxFees)) filter.applicationFees = { $lte: maxFees };
      const deadlineAfter = String(q.deadlineAfter || "").trim();
      if (deadlineAfter) filter.applicationDeadline = { $gte: deadlineAfter };
      // allow legacy ?country=UK etc. already handled; also support tags filter
      const tag = String(q.tag || "").trim();
      if (tag) filter.tags = tag;
      return filter;
    };

    const buildScholarshipSort = (sort) => {
      const s = String(sort || "newest").toLowerCase();
      if (s === "rating" || s === "recommended") return { rating: -1, reviewsCount: -1 };
      if (s === "deadline" || s === "deadline-asc") return { applicationDeadline: 1 };
      if (s === "fees-asc" || s === "fees" || s === "price-asc") return { applicationFees: 1 };
      if (s === "fees-desc" || s === "price-desc") return { applicationFees: -1 };
      if (s === "newest") return { postDate: -1, _id: -1 };
      if (s === "oldest") return { postDate: 1 };
      return { postDate: -1, _id: -1 };
    };

    const handleListScholarships = async (req, res) => {
      try {
        const hasPaging = req.query.page !== undefined || req.query.limit !== undefined;
        // filter + sort
        const filter = buildScholarshipFilter(req.query);
        const sort = buildScholarshipSort(req.query.sort);
        const total = await scholershipCollection.countDocuments(filter);
        if (!hasPaging) {
          // backward compat: return all (old clients expect full array)
          const data = await scholershipCollection.find(filter).sort(sort).toArray();
          return res.status(200).json({ message: "allScholarship fetching successfull", data, total, page: 1, totalPages: 1 });
        }
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "12"), 10) || 12));
        const skip = (page - 1) * limit;
        const data = await scholershipCollection.find(filter).sort(sort).skip(skip).limit(limit).toArray();
        const totalPages = Math.max(1, Math.ceil(total / limit));
        res.status(200).json({ message: "allScholarship fetching successfull", data, total, page, totalPages });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };

    const handleGetScholarshipById = async (req, res) => {
      const id = req.params.id;
      if (id === "stats") return handleScholarshipStats(req, res);
      try {
        const result = await scholershipCollection.findOne({ _id: new ObjectId(id) });
        if (result) {
          // backfill gallery for old docs
          if (!Array.isArray(result.gallery) || result.gallery.length === 0) {
            result.gallery = [result.universityImage].filter(Boolean);
          }
          if (!Array.isArray(result.documents)) result.documents = [];
          if (!Array.isArray(result.requirements)) result.requirements = [];
          if (!Array.isArray(result.faqs)) result.faqs = [];
          if (!Array.isArray(result.highlights)) result.highlights = [];
        }
        res.status(200).json({ message: "allScholarship fetching successfull", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };

    const handleCreateScholarship = async (req, res) => {
      const doc = req.body;
      // normalize new optional fields with defaults
      if (!Array.isArray(doc.eligibility)) doc.eligibility = doc.eligibility ? [String(doc.eligibility)] : [];
      if (!Array.isArray(doc.benefits)) doc.benefits = doc.benefits ? [String(doc.benefits)] : [];
      if (!Array.isArray(doc.tags)) doc.tags = doc.tags ? [String(doc.tags)] : [];
      if (!Array.isArray(doc.gallery)) doc.gallery = doc.gallery ? (Array.isArray(doc.gallery) ? doc.gallery : [String(doc.gallery)]) : [];
      if (!Array.isArray(doc.documents)) doc.documents = doc.documents ? [String(doc.documents)] : [];
      if (!Array.isArray(doc.requirements)) doc.requirements = doc.requirements ? [String(doc.requirements)] : [];
      if (!Array.isArray(doc.faqs)) doc.faqs = [];
      else doc.faqs = doc.faqs.slice(0, 10).map((f) => ({ q: String(f.q || f.question || "").slice(0, 200), a: String(f.a || f.answer || "").slice(0, 800) })).filter((f) => f.q && f.a);
      if (!Array.isArray(doc.highlights)) doc.highlights = doc.highlights ? [String(doc.highlights)] : [];
      if (doc.videoUrl) doc.videoUrl = String(doc.videoUrl).trim().slice(0, 500) || null;
      if (doc.videoPoster) doc.videoPoster = String(doc.videoPoster).trim().slice(0, 500) || null;
      if (doc.brochureUrl) doc.brochureUrl = String(doc.brochureUrl).trim().slice(0, 500) || null;
      if (doc.mapUrl) doc.mapUrl = String(doc.mapUrl).trim().slice(0, 500) || null;
      // ensure gallery contains at least universityImage
      if (doc.gallery.length === 0 && doc.universityImage) doc.gallery = [doc.universityImage];
      doc.gallery = doc.gallery.map((u) => String(u).trim()).filter(Boolean).slice(0, 8);
      if (!doc.currency) doc.currency = "USD";
      if (!doc.duration) doc.duration = doc.duration || null;
      if (doc.applicationFees !== undefined) doc.applicationFees = Number(doc.applicationFees);
      if (doc.serviceCharge !== undefined) doc.serviceCharge = Number(doc.serviceCharge);
      if (doc.stipend !== undefined && doc.stipend !== "") doc.stipend = Number(doc.stipend);
      if (doc.rating === undefined) doc.rating = 0;
      if (doc.reviewsCount === undefined) doc.reviewsCount = 0;
      if (!doc.postDate) doc.postDate = new Date().toISOString().slice(0, 10);
      try {
        const result = await scholershipCollection.insertOne(doc);
        res.status(201).json({ message: "Scholarship added successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };

    const handleDeleteScholarship = async (req, res) => {
      try {
        const result = await scholershipCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.status(200).json({ message: "Scholarship delete successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };

    const handlePatchScholarship = async (req, res) => {
      const id = req.params.id;
      const body = { ...req.body };
      delete body._id;
      delete body.subjectName2;
      if (body.applicationFees !== undefined) body.applicationFees = Number(body.applicationFees);
      if (body.serviceCharge !== undefined) body.serviceCharge = Number(body.serviceCharge);
      if (body.stipend !== undefined && body.stipend !== "") body.stipend = Number(body.stipend);
      if (Array.isArray(body.eligibility)) body.eligibility = body.eligibility.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
      if (Array.isArray(body.benefits)) body.benefits = body.benefits.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
      if (Array.isArray(body.tags)) body.tags = body.tags.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
      if (Array.isArray(body.gallery)) body.gallery = body.gallery.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
      if (Array.isArray(body.documents)) body.documents = body.documents.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
      if (Array.isArray(body.requirements)) body.requirements = body.requirements.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
      if (Array.isArray(body.highlights)) body.highlights = body.highlights.map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
      if (Array.isArray(body.faqs)) body.faqs = body.faqs.slice(0, 10).map((f) => ({ q: String(f.q || f.question || "").slice(0, 200), a: String(f.a || f.answer || "").slice(0, 800) })).filter((f) => f.q && f.a);
      if (body.videoUrl !== undefined) body.videoUrl = body.videoUrl ? String(body.videoUrl).trim().slice(0, 500) : null;
      if (body.videoPoster !== undefined) body.videoPoster = body.videoPoster ? String(body.videoPoster).trim().slice(0, 500) : null;
      if (body.brochureUrl !== undefined) body.brochureUrl = body.brochureUrl ? String(body.brochureUrl).trim().slice(0, 500) : null;
      if (body.mapUrl !== undefined) body.mapUrl = body.mapUrl ? String(body.mapUrl).trim().slice(0, 500) : null;
      try {
        const result = await scholershipCollection.updateOne({ _id: new ObjectId(id) }, { $set: body });
        if (result.matchedCount === 0) return res.status(404).json({ message: "Scholarship not found" });
        res.status(200).json({ message: "Scholarship updated successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };

    const handleScholarshipStats = async (req, res) => {
      try {
        const totalScholarships = await scholershipCollection.countDocuments();
        const totalReviews = await reviewsCollection.countDocuments();
        const pendingReviews = await reviewsCollection.countDocuments({ status: "pending" });
        const totalApplications = await applyCollection.countDocuments();
        const agg = await scholershipCollection.aggregate([{ $group: { _id: null, totalStipend: { $sum: { $toDouble: { $ifNull: ["$stipend", 0] } } }, avgFees: { $avg: { $toDouble: { $ifNull: ["$applicationFees", 0] } } } } }]).toArray();
        const totalStipend = agg[0]?.totalStipend || 0;
        const avgFees = agg[0]?.avgFees || 0;
        const byCategory = await scholershipCollection.aggregate([{ $group: { _id: "$scholarshipCategory", count: { $sum: 1 } } }]).toArray();
        const byCountry = await scholershipCollection.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } }, $sort: { count: -1 }, $limit: 6 }]).toArray();
        res.json({ totalScholarships, totalReviews, pendingReviews, totalApplications, totalStipend, avgFees, byCategory, byCountry });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };

    // list — primary + aliases, public (filtered/paginated)
    app.get("/allScholership", handleListScholarships);
    app.get("/allScholarships", handleListScholarships);
    app.get("/scholarships", handleListScholarships);
    app.get("/api/scholarships", handleListScholarships);

    // stats — public (before :id)
    app.get("/allScholership/stats", handleScholarshipStats);
    app.get("/allScholarships/stats", handleScholarshipStats);
    app.get("/scholarships/stats", handleScholarshipStats);

    // single — public (must be after /stats)
    app.get("/allScholership/:id", handleGetScholarshipById);
    app.get("/allScholarships/:id", handleGetScholarshipById);
    app.get("/scholarships/:id", handleGetScholarshipById);

    // create / update / delete — secured (moderator+)
    app.post("/allScholership", verifyToken, loadAuthUser, verifyModaretor, handleCreateScholarship);
    app.post("/allScholarships", verifyToken, loadAuthUser, verifyModaretor, handleCreateScholarship);
    app.post("/scholarships", verifyToken, loadAuthUser, verifyModaretor, handleCreateScholarship);

    app.delete("/allScholership/:id", verifyToken, loadAuthUser, verifyModaretor, handleDeleteScholarship);
    app.delete("/allScholarships/:id", verifyToken, loadAuthUser, verifyModaretor, handleDeleteScholarship);
    app.delete("/scholarships/:id", verifyToken, loadAuthUser, verifyModaretor, handleDeleteScholarship);

    app.patch("/allScholership/:id", verifyToken, loadAuthUser, verifyModaretor, handlePatchScholarship);
    app.patch("/allScholarships/:id", verifyToken, loadAuthUser, verifyModaretor, handlePatchScholarship);
    app.patch("/scholarships/:id", verifyToken, loadAuthUser, verifyModaretor, handlePatchScholarship);

    // saved / wishlist — userEmail + scholarshipId unique
    app.post("/saved", verifyToken, loadAuthUser, async (req, res) => {
      const { scholarshipId, scholarship_id } = req.body;
      const sid = String(scholarshipId || scholarship_id || "").trim();
      if (!sid) return res.status(400).json({ message: "scholarshipId required" });
      try {
        new ObjectId(sid);
      } catch {
        return res.status(400).json({ message: "invalid scholarshipId" });
      }
      const exists = await scholershipCollection.findOne({ _id: new ObjectId(sid) });
      if (!exists) return res.status(404).json({ message: "Scholarship not found" });
      const userEmail = req.decoded.email;
      const existing = await savedCollection.findOne({ userEmail, scholarshipId: sid });
      if (existing) {
        await savedCollection.deleteOne({ _id: existing._id });
        return res.json({ saved: false, message: "Removed from saved" });
      }
      await savedCollection.insertOne({ userEmail, scholarshipId: sid, savedAt: new Date() });
      res.status(201).json({ saved: true, message: "Saved" });
    });

    app.get("/saved", verifyToken, loadAuthUser, async (req, res) => {
      const email = String(req.query.email || req.decoded.email).toLowerCase().trim();
      const role = req.authUser?.role;
      const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
      if (email !== String(req.decoded.email).toLowerCase() && !isStaff) return res.status(403).json({ message: "forbidden" });
      try {
        const docs = await savedCollection.find({ userEmail: email }).sort({ savedAt: -1 }).toArray();
        const ids = [];
        for (const d of docs) { try { ids.push(new ObjectId(d.scholarshipId)); } catch {} }
        const scholarships = ids.length ? await scholershipCollection.find({ _id: { $in: ids } }).toArray() : [];
        const byId = new Map(scholarships.map((s) => [String(s._id), s]));
        const data = docs.map((d) => ({ ...d, scholarship: byId.get(String(d.scholarshipId)) || null }));
        res.json({ message: "saved fetched", data });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete("/saved/:id", verifyToken, loadAuthUser, async (req, res) => {
      const sid = String(req.params.id).trim();
      const userEmail = req.decoded.email;
      try {
        const doc = await savedCollection.findOne({ userEmail, scholarshipId: sid });
        if (!doc) return res.status(404).json({ message: "Not saved" });
        await savedCollection.deleteOne({ _id: doc._id });
        res.json({ message: "Removed from saved" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    app.get("/saved/check/:id", verifyToken, async (req, res) => {
      const sid = String(req.params.id).trim();
      const doc = await savedCollection.findOne({ userEmail: req.decoded.email, scholarshipId: sid });
      res.json({ saved: !!doc });
    });

    // inquiries — Ask a question on scholarship detail
    app.post("/inquiries", async (req, res) => {
      const { scholarshipId, name, email, question } = req.body;
      const sid = String(scholarshipId || "").trim();
      if (!sid) return res.status(400).json({ message: "scholarshipId required" });
      try { new ObjectId(sid); } catch { return res.status(400).json({ message: "invalid scholarshipId" }); }
      const cleanName = String(name || "").trim().slice(0, 80);
      const cleanEmail = String(email || "").trim().toLowerCase().slice(0, 120);
      const cleanQ = String(question || "").trim();
      if (cleanQ.length < 10 || cleanQ.length > 1000) return res.status(400).json({ message: "question 10-1000 chars" });
      if (!cleanEmail.includes("@")) return res.status(400).json({ message: "valid email required" });
      try {
        const doc = { scholarshipId: sid, name: cleanName || "Anonymous", email: cleanEmail, question: cleanQ, createdAt: new Date(), status: "open" };
        const result = await inquiriesCollection.insertOne(doc);
        res.status(201).json({ message: "Inquiry sent", data: result });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.get("/inquiries", verifyToken, loadAuthUser, verifyModaretor, async (req, res) => {
      try {
        const { scholarshipId } = req.query;
        const filter = {};
        if (scholarshipId) filter.scholarshipId = String(scholarshipId);
        const data = await inquiriesCollection.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
        res.json({ data });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post("/addReviews", verifyToken, loadAuthUser, async (req, res) => {
      try {
        const { comment, rating, scholarShip_id, reviewer_postDate } = req.body;
        const email = req.decoded.email;
        // validation
        const sid = String(scholarShip_id || "").trim();
        if (!sid) return res.status(400).json({ message: "scholarShip_id is required" });
        let scholarship;
        try {
          scholarship = await scholershipCollection.findOne({ _id: new ObjectId(sid) });
        } catch {
          return res.status(400).json({ message: "Invalid scholarship id" });
        }
        if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });

        const numRating = Number(rating);
        if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
          return res.status(400).json({ message: "rating must be 1-5" });
        }
        const cleanComment = String(comment || "").trim();
        if (cleanComment.length < 5 || cleanComment.length > 500) {
          return res.status(400).json({ message: "comment must be 5-500 characters" });
        }
        // verified-applicant gate: must have accepted application for this scholarship
        const acceptedApply = await applyCollection.findOne({
          email: email,
          scholarship_id: sid,
          applicationStatus: "accepted",
        });
        if (!acceptedApply) {
          return res.status(403).json({ message: "You can only review after your application is accepted by moderator" });
        }
        // 1 per (user, scholarship)
        const existing = await reviewsCollection.findOne({ reviewer_email: email, scholarShip_id: sid });
        if (existing) {
          return res.status(409).json({ message: "You have already reviewed this scholarship. You can edit your existing review." });
        }
        const now = new Date();
        const autoApproved = REVIEW_AUTO_APPROVE;
        const doc = {
          comment: cleanComment,
          rating: numRating,
          scholarShip_id: sid,
          reviewer_email: email,
          reviewer_id: req.authUser?._id || null,
          reviewer_name: req.authUser?.name || req.authUser?.displayName || email,
          reviewer_photo: req.authUser?.photoURL || req.body.reviewer_photo || null,
          reviewer_postDate: reviewer_postDate || now.toISOString().slice(0, 10),
          status: autoApproved ? "approved" : "pending",
          isVerified: true,
          appliedApplicationId: acceptedApply._id,
          createdAt: now,
          updatedAt: now,
          moderatedBy: autoApproved ? "system:auto-approve" : null,
          moderatedAt: autoApproved ? now : null,
          moderationReason: null,
          isEdited: false,
          history: [],
        };
        const result = await reviewsCollection.insertOne(doc);
        if (autoApproved) await recalcScholarshipRating(sid);
        res.status(201).json({ message: autoApproved ? "Review submitted and approved" : "Review submitted and pending moderation", data: result });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ message: "You have already reviewed this scholarship" });
        }
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allReviews", verifyToken, loadAuthUser, async (req, res) => {
      try {
        const { email: queryEmail, status, scholarShip_id, q, page = "1", limit = "50" } = req.query;
        const role = req.authUser?.role;
        const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
        let query = {};

        // email filter: user can only query own, staff can query any
        if (queryEmail) {
          if (queryEmail !== req.decoded.email && !isStaff) {
            return res.status(403).json({ message: "forbidden: can only view own reviews" });
          }
          query.reviewer_email = queryEmail;
        } else if (!isStaff) {
          // non-staff without email filter -> own only
          query.reviewer_email = req.decoded.email;
        }
        // status filter: non-staff can only see approved (unless own)
        if (status) {
          const allowed = ["pending", "approved", "rejected", "hidden", "removed"];
          if (!allowed.includes(String(status))) return res.status(400).json({ message: "invalid status" });
          if (!isStaff && String(status) !== "approved" && queryEmail !== req.decoded.email) {
            // non-staff cannot list pending/rejected of others
            query.status = "approved";
          } else {
            query.status = String(status);
          }
        } else if (!isStaff && !queryEmail) {
          // default for non-staff self list: all own statuses
        } else if (!isStaff) {
          // public-like: only approved when browsing others (handled via :id route)
        }

        if (scholarShip_id) query.scholarShip_id = String(scholarShip_id);
        if (q) query.comment = { $regex: String(q).slice(0, 100), $options: "i" };

        // pagination
        const pg = Math.max(1, parseInt(String(page), 10) || 1);
        const lim = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
        const skip = (pg - 1) * lim;

        const reviewResult = await reviewsCollection.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).toArray();

        // safe join: skip invalid ObjectIds
        const validIds = [];
        const idMap = new Map();
        for (const item of reviewResult) {
          try {
            const oid = new ObjectId(item.scholarShip_id);
            validIds.push(oid);
            idMap.set(item.scholarShip_id, oid);
          } catch {
            // invalid id, skip join
          }
        }
        const reviewDetails = validIds.length
          ? await scholershipCollection.find({ _id: { $in: validIds } }).toArray()
          : [];
        const detailById = new Map(reviewDetails.map((d) => [String(d._id), d]));
        const combineResult = reviewResult.map((reviewItem) => ({
          ...reviewItem,
          scholership_details: detailById.get(String(reviewItem.scholarShip_id)) || null,
        }));

        res.status(200).json({ message: "All review get successfully", data: combineResult });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allReviews/:id", async (req, res) => {
      const id = req.params.id;
      // public: only approved reviews
      const query = { scholarShip_id: String(id), status: "approved" };
      try {
        const reviewResult = await reviewsCollection.find(query).sort({ createdAt: -1 }).toArray();
        const validIds = [];
        for (const item of reviewResult) {
          try {
            validIds.push(new ObjectId(item.scholarShip_id));
          } catch {}
        }
        const reviewDetails = validIds.length ? await scholershipCollection.find({ _id: { $in: validIds } }).toArray() : [];
        const detailById = new Map(reviewDetails.map((d) => [String(d._id), d]));
        const combineResult = reviewResult.map((reviewItem) => ({
          ...reviewItem,
          scholership_details: detailById.get(String(reviewItem.scholarShip_id)) || null,
        }));
        res.status(200).json({ message: "All review get successfully", data: combineResult });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete("/allReviews/:id", verifyToken, loadAuthUser, async (req, res) => {
      const id = req.params.id;
      let oid;
      try {
        oid = new ObjectId(id);
      } catch {
        return res.status(400).json({ message: "Invalid review id" });
      }
      const { reason, note, hard } = req.body || {};
      try {
        const review = await reviewsCollection.findOne({ _id: oid });
        if (!review) return res.status(404).json({ message: "Review not found" });
        const role = req.authUser?.role;
        const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
        const isOwner = review.reviewer_email === req.decoded.email;
        if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden: not owner nor moderator" });
        // hard delete only for superadmin via ?hard=true
        if (hard === true || hard === "true") {
          if (role !== "superadmin") return res.status(403).json({ message: "hard delete superadmin only" });
          const result = await reviewsCollection.deleteOne({ _id: oid });
          await recalcScholarshipRating(review.scholarShip_id);
          return res.status(200).json({ message: "review hard deleted", data: result });
        }
        // soft remove with history
        const now = new Date();
        const removedReason = String(reason || "No reason").slice(0, 300);
        const removedNote = note ? String(note).slice(0, 800) : null;
        const prevStatus = review.status;
        await reviewHistoryCollection.insertOne({
          reviewId: String(review._id),
          scholarshipId: review.scholarShip_id,
          action: "removed",
          from: prevStatus,
          to: "removed",
          by: req.decoded.email,
          byRole: role,
          at: now,
          reason: removedReason,
          note: removedNote,
          snapshot: { rating: review.rating, comment: review.comment, reviewer_email: review.reviewer_email },
        });
        const result = await reviewsCollection.updateOne({ _id: oid }, { $set: { status: "removed", removedBy: req.decoded.email, removedAt: now, removedReason, removedNote, previousStatus: prevStatus, updatedAt: now, history: [...(review.history || []), { action: "removed", from: prevStatus, to: "removed", by: req.decoded.email, at: now, reason: removedReason }] } });
        await recalcScholarshipRating(review.scholarShip_id);
        res.status(200).json({ message: "review removed (soft) with history", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // owner edit: comment/rating only, re-sets to pending
    app.patch("/allReviews/:id", verifyToken, loadAuthUser, async (req, res) => {
      const id = req.params.id;
      let oid;
      try {
        oid = new ObjectId(id);
      } catch {
        return res.status(400).json({ message: "Invalid review id" });
      }
      const { comment, rating } = req.body;
      try {
        const review = await reviewsCollection.findOne({ _id: oid });
        if (!review) return res.status(404).json({ message: "Review not found" });
        const role = req.authUser?.role;
        const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
        const isOwner = review.reviewer_email === req.decoded.email;
        if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden" });

        const updates = {};
        if (comment !== undefined) {
          const clean = String(comment).trim();
          if (clean.length < 5 || clean.length > 500) return res.status(400).json({ message: "comment 5-500 chars" });
          updates.comment = clean;
        }
        if (rating !== undefined) {
          const nr = Number(rating);
          if (!Number.isFinite(nr) || nr < 1 || nr > 5) return res.status(400).json({ message: "rating 1-5" });
          updates.rating = nr;
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ message: "nothing to update" });
        updates.updatedAt = new Date();
        updates.isEdited = true;
        // re-moderation if owner edits
        if (isOwner) {
          updates.status = "pending";
          updates.moderatedBy = null;
          updates.moderatedAt = null;
        }
        const result = await reviewsCollection.updateOne({ _id: oid }, { $set: updates });
        await recalcScholarshipRating(review.scholarShip_id);
        res.status(200).json({ message: "review updated", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // moderation queue: approve/reject/hidden
    app.patch("/allReviews/:id/moderate", verifyToken, loadAuthUser, verifyModaretor, async (req, res) => {
      const id = req.params.id;
      let oid;
      try {
        oid = new ObjectId(id);
      } catch {
        return res.status(400).json({ message: "Invalid review id" });
      }
      const { status, reason, note } = req.body;
      const allowed = ["approved", "rejected", "hidden", "pending", "removed"];
      if (!allowed.includes(String(status))) return res.status(400).json({ message: "status must be approved|rejected|hidden|pending|removed" });
      try {
        const review = await reviewsCollection.findOne({ _id: oid });
        if (!review) return res.status(404).json({ message: "Review not found" });
        const now = new Date();
        const prevStatus = review.status;
        const update = {
          status: String(status),
          moderatedBy: req.decoded.email,
          moderatedAt: now,
          moderationReason: reason ? String(reason).slice(0, 300) : null,
          removedReason: String(status) === "removed" ? (reason ? String(reason).slice(0, 300) : "No reason") : null,
          removedNote: note ? String(note).slice(0, 800) : null,
          updatedAt: now,
        };
        if (String(status) === "removed") {
          update.removedBy = req.decoded.email;
          update.removedAt = now;
          update.previousStatus = prevStatus;
        }
        // history log
        await reviewHistoryCollection.insertOne({
          reviewId: String(review._id),
          scholarshipId: review.scholarShip_id,
          action: String(status),
          from: prevStatus,
          to: String(status),
          by: req.decoded.email,
          byRole: req.authUser?.role,
          at: now,
          reason: reason ? String(reason).slice(0, 300) : null,
          note: note ? String(note).slice(0, 800) : null,
          snapshot: { rating: review.rating, comment: review.comment },
        });
        const result = await reviewsCollection.updateOne(
          { _id: oid },
          {
            $set: update,
            $push: { history: { action: String(status), from: prevStatus, to: String(status), by: req.decoded.email, at: now, reason: reason || null } },
          }
        );
        await recalcScholarshipRating(review.scholarShip_id);
        res.status(200).json({ message: "review moderated", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // review history + removed list
    app.get("/reviews/history/:id", verifyToken, loadAuthUser, verifyModaretor, async (req, res) => {
      try {
        const id = String(req.params.id);
        const data = await reviewHistoryCollection.find({ reviewId: id }).sort({ at: -1 }).toArray();
        res.json({ data });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
    app.get("/reviews/removed", verifyToken, loadAuthUser, verifyModaretor, async (req, res) => {
      try {
        const data = await reviewsCollection.find({ status: "removed" }).sort({ removedAt: -1 }).limit(100).toArray();
        res.json({ data });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // review stats for admin/mod dashboard
    app.get("/reviews/stats", verifyToken, loadAuthUser, verifyModaretor, async (req, res) => {
      try {
        const total = await reviewsCollection.countDocuments();
        const pending = await reviewsCollection.countDocuments({ status: "pending" });
        const approved = await reviewsCollection.countDocuments({ status: "approved" });
        const rejected = await reviewsCollection.countDocuments({ status: "rejected" });
        const hidden = await reviewsCollection.countDocuments({ status: "hidden" });
        const removed = await reviewsCollection.countDocuments({ status: "removed" });
        res.json({ total, pending, approved, rejected, hidden, removed });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // apply api

    app.post("/apply", verifyToken, async (req, res) => {
      const applyData = req.body;
      try {
        const result = await applyCollection.insertOne(applyData);

        res.status(201).json({
          message: "apply data added successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/apply", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      try {
        const result = await applyCollection.find(query).toArray();

        res.status(200).json({
          message: "apply data added successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allapply", verifyToken, async (req, res) => {
      try {
        const result = await applyCollection.find().toArray();

        res.status(200).json({
          message: "apply data added successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/singleApply/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await applyCollection.findOne(query);

        res.status(200).json({
          message: "apply data added successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch("/allapply/cancel/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          applicationStatus: "rejected",
        },
      };

      try {
        const result = await applyCollection.updateOne(filter, updateDoc);

        res.status(201).json({
          message: "apply data added successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch("/allapply/accepted/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          applicationStatus: "accepted",
        },
      };

      try {
        const result = await applyCollection.updateOne(filter, updateDoc);

        res.status(201).json({
          message: "application status completed ",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  } finally {
    //await client.close();
  }
}

run().catch(console.dir);

// mongodb end

app.get("/", (req, res) => {
  res.send("School Hive server is running");
});

app.listen(port, () => {
  //console.log(`job is waiting is : ${port}`);
});
