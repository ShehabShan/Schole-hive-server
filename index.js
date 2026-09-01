// Shim for Vercel backward compat — real app lives in src/server.js
// Keeps `vercel.json: builds.src=index.js` working during migration
module.exports = require("./src/server");
