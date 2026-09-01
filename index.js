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

    // review indexes: 1 per (user, scholarship) + filter by scholarship+status
    try {
      await reviewsCollection.createIndex({ reviewer_email: 1, scholarShip_id: 1 }, { unique: true, background: true });
      await reviewsCollection.createIndex({ scholarShip_id: 1, status: 1 }, { background: true });
      await reviewsCollection.createIndex({ status: 1, createdAt: -1 }, { background: true });
    } catch (e) {
      // index creation may fail if dup data exists - log but don't crash
      console.log("index creation warning", e.message);
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

    // scholership collection

    app.post("/allScholership", async (req, res) => {
      const scholership = req.body;

      try {
        const result = await scholershipCollection.insertOne(scholership);
        res
          .status(201)
          .json({ message: "Scholarship added successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allScholership", async (req, res) => {
      try {
        const result = await scholershipCollection.find().toArray();
        res.status(200).json({
          message: "allScholarship fetcing successfull",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allScholership/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await scholershipCollection.findOne(query);
        res.status(200).json({
          message: "allScholarship fetcing successfull",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete("/allScholership/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await scholershipCollection.deleteOne(query);
        res.status(201).json({
          message: "Scholership delete successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch("/allScholership/:id", async (req, res) => {
      const id = req.params.id;
      const updateScholership = req.body;
      const query = { _id: new ObjectId(id) };

      try {
        const update = {
          $set: updateScholership,
        };

        const result = await scholershipCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.status(200).json({
            message: "Scholership updated successfully",
            data: result,
          });
        } else {
          res
            .status(404)
            .json({ message: "Scholership not found or no changes made" });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
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
        const doc = {
          comment: cleanComment,
          rating: numRating,
          scholarShip_id: sid,
          reviewer_email: email,
          reviewer_name: req.authUser?.name || req.authUser?.displayName || email,
          reviewer_photo: req.authUser?.photoURL || req.body.reviewer_photo || null,
          reviewer_postDate: reviewer_postDate || now.toISOString().slice(0, 10),
          status: "pending",
          isVerified: true,
          appliedApplicationId: acceptedApply._id,
          createdAt: now,
          updatedAt: now,
          moderatedBy: null,
          moderatedAt: null,
          moderationReason: null,
          isEdited: false,
        };
        const result = await reviewsCollection.insertOne(doc);
        res.status(201).json({ message: "Review submitted and pending moderation", data: result });
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
          const allowed = ["pending", "approved", "rejected", "hidden"];
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
      try {
        const review = await reviewsCollection.findOne({ _id: oid });
        if (!review) return res.status(404).json({ message: "Review not found" });
        const role = req.authUser?.role;
        const isStaff = role === "admin" || role === "superadmin" || role === "modaretor";
        const isOwner = review.reviewer_email === req.decoded.email;
        if (!isOwner && !isStaff) return res.status(403).json({ message: "forbidden: not owner nor moderator" });
        const result = await reviewsCollection.deleteOne({ _id: oid });
        await recalcScholarshipRating(review.scholarShip_id);
        res.status(200).json({ message: "review deleted successfully", data: result });
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
      const { status, reason } = req.body;
      const allowed = ["approved", "rejected", "hidden", "pending"];
      if (!allowed.includes(String(status))) return res.status(400).json({ message: "status must be approved|rejected|hidden|pending" });
      try {
        const review = await reviewsCollection.findOne({ _id: oid });
        if (!review) return res.status(404).json({ message: "Review not found" });
        const update = {
          status: String(status),
          moderatedBy: req.decoded.email,
          moderatedAt: new Date(),
          moderationReason: reason ? String(reason).slice(0, 300) : null,
          updatedAt: new Date(),
        };
        const result = await reviewsCollection.updateOne({ _id: oid }, { $set: update });
        await recalcScholarshipRating(review.scholarShip_id);
        res.status(200).json({ message: "review moderated", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // review stats for admin/mod dashboard
    app.get("/reviews/stats", verifyToken, loadAuthUser, verifyModaretor, async (req, res) => {
      try {
        const total = await reviewsCollection.countDocuments();
        const pending = await reviewsCollection.countDocuments({ status: "pending" });
        const approved = await reviewsCollection.countDocuments({ status: "approved" });
        const rejected = await reviewsCollection.countDocuments({ status: "rejected" });
        res.json({ total, pending, approved, rejected });
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
