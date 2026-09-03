const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const securityHeaders = require("./middleware/security");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { connect } = require("./config/db");

let dbPromise = null;
async function ensureDb(req, res, next) {
  if (req.path === "/" && req.method === "GET") return next();
  try {
    if (!dbPromise) dbPromise = connect();
    await dbPromise;
    next();
  } catch (e) { next(e); }
}

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const scholarshipRoutes = require("./routes/scholarship.routes");
const savedRoutes = require("./routes/saved.routes");
const inquiryRoutes = require("./routes/inquiry.routes");
const reviewRoutes = require("./routes/review.routes");
const applyRoutes = require("./routes/apply.routes");
const seedRoutes = require("./routes/seed.routes");
const institutionStudentsRoutes = require("./routes/institutionStudents.routes");
const questionRoutes = require("./routes/question.routes");
const answerRoutes = require("./routes/answer.routes");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://scholarhive-913e4.web.app",
        "https://scholarhive-913e4.firebaseapp.com",
      ],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(securityHeaders);
  app.use(ensureDb);

  // health
  app.get("/", (req, res) => res.send("School Hive server is running"));

  // mount all routers (order matters: specific before param)
  app.use(authRoutes);
  app.use(userRoutes);
  app.use(scholarshipRoutes);
  app.use(savedRoutes);
  app.use(inquiryRoutes);
  app.use(reviewRoutes);
  app.use(applyRoutes);
  app.use(seedRoutes);
  app.use(institutionStudentsRoutes);
  app.use(questionRoutes);
  app.use(answerRoutes);

  // 404 + error handler
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
