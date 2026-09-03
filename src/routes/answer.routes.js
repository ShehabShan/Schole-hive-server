const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const c = require("../controllers/answer.controller");

const router = express.Router();

// create answer for a question — any authenticated role (Q1)
router.post("/questions/:id/answers", verifyToken, loadAuthUser, asyncHandler(c.createAnswer));

// accept — asker only (checked in controller)
router.patch("/questions/:id/accept", verifyToken, loadAuthUser, asyncHandler(c.acceptAnswer));

// voting — any authenticated for upvote; downvote requires 125 rep (checked in controller)
router.post("/answers/:id/upvote", verifyToken, loadAuthUser, asyncHandler(c.upvoteAnswer));
router.post("/answers/:id/downvote", verifyToken, loadAuthUser, asyncHandler(c.downvoteAnswer));

module.exports = router;
