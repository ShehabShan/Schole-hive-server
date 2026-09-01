require("dotenv").config();

function required(name, fallback) {
  const val = process.env[name] || fallback;
  if (!val) throw new Error(`Missing required env: ${name}`);
  return val;
}

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI || null,
  DB_USER: process.env.DB_USER || null,
  DB_PASS: process.env.DB_PASS || null,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || null,
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  REVIEW_AUTO_APPROVE: process.env.REVIEW_AUTO_APPROVE !== "false",
  get MONGO_URL() {
    if (this.MONGO_URI) return this.MONGO_URI;
    if (this.DB_USER && this.DB_PASS) {
      return `mongodb+srv://${this.DB_USER}:${this.DB_PASS}@cluster0.d6z2i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    }
    return null;
  },
};

module.exports = env;
