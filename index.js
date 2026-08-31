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
      const user = req.body;
      const query = { email: user.email };

      try {
        const existingUser = await usersCollection.findOne(query);

        if (existingUser) {
          return res.send({
            message: "user already exist",
            data: { insertedId: null },
          });
        }

        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean);

        if (adminEmails.includes((user.email || "").toLowerCase())) {
          user.role = "superadmin";
        }

        const result = await usersCollection.insertOne(user);
        res
          .status(201)
          .json({ message: "User Added successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/users", verifyToken, async (req, res) => {
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

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      try {
        const result = await usersCollection.findOne(query);

        res.status(200).json({
          message: "allScholarship fetcing successfull",
          data: result,
        });
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

    app.post("/addReviews", async (req, res) => {
      const review = req.body;
      try {
        const result = await reviewsCollection.insertOne(review);
        res
          .status(201)
          .json({ message: "Review added successfully", data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allReviews", verifyToken, async (req, res) => {
      const userEmail = req.query.email;
      let query = {};

      if (userEmail) {
        query = {
          reviewer_email: userEmail,
        };
      }

      try {
        const reviewResult = await reviewsCollection.find(query).toArray();

        const reviewId = reviewResult.map(
          (item) => new ObjectId(item.scholarShip_id)
        );

        const reviewDetails = await scholershipCollection
          .find({
            _id: { $in: reviewId },
          })
          .toArray();

        const combineResult = reviewResult.map((reviewItem) => {
          const reviewDetail = reviewDetails.find(
            (review) => review._id.toString() === reviewItem.scholarShip_id
          );
          return { ...reviewItem, scholership_details: reviewDetail || null };
        });

        res.status(200).json({
          message: "All review get successfully",
          data: combineResult,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/allReviews/:id", async (req, res) => {
      const id = req.params.id;

      let query = {};

      if (id) {
        query = { scholarShip_id: id };
      }

      try {
        const reviewResult = await reviewsCollection.find(query).toArray();

        const reviewId = reviewResult.map(
          (item) => new ObjectId(item.scholarShip_id)
        );

        const reviewDetails = await scholershipCollection
          .find({
            _id: { $in: reviewId },
          })
          .toArray();

        const combineResult = reviewResult.map((reviewItem) => {
          const reviewDetail = reviewDetails.find(
            (review) => review._id.toString() === reviewItem.scholarShip_id
          );
          return { ...reviewItem, scholership_details: reviewDetail || null };
        });

        res.status(200).json({
          message: "All review get successfully",
          data: combineResult,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete("/allReviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      try {
        const result = await reviewsCollection.deleteOne(query);

        res.status(201).json({
          message: "review deleted successfully",
          data: result,
        });
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
