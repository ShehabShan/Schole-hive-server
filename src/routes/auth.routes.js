const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { postJwt, clearJwt } = require("../controllers/auth.controller");
const { authRateLimit } = require("../middleware/rateLimit");

const router = express.Router();
router.post("/jwt", authRateLimit, asyncHandler(postJwt));
router.post("/clear-jwt", asyncHandler(clearJwt));
module.exports = router;
