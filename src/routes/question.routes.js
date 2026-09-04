const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const c = require("../controllers/question.controller");

const router = express.Router();

// public list and detail
router.get("/questions", asyncHandler(c.listQuestions));
router.get("/questions/:id", asyncHandler(c.getQuestionById));

// create — any authenticated role per Q1 resolved (open to all auth roles)
router.post("/questions", verifyToken, loadAuthUser, asyncHandler(c.createQuestion));

// voting — question upvote (+2) and downvote (125 rep)
router.post("/questions/:id/upvote", verifyToken, loadAuthUser, asyncHandler(c.upvoteQuestion));
router.post("/questions/:id/downvote", verifyToken, loadAuthUser, asyncHandler(c.downvoteQuestion));

// question following (watchlist)
router.get("/questions/:id/follow", asyncHandler(c.getQuestionFollow));
router.post("/questions/:id/follow", verifyToken, loadAuthUser, asyncHandler(c.toggleQuestionFollow));
router.delete("/questions/:id/follow", verifyToken, loadAuthUser, asyncHandler(c.unfollowQuestion));

// update / delete — owner or staff (checked in controller)
router.patch("/questions/:id", verifyToken, loadAuthUser, asyncHandler(c.patchQuestion));
router.delete("/questions/:id", verifyToken, loadAuthUser, asyncHandler(c.deleteQuestion));

module.exports = router;
