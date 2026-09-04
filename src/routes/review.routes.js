const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const { verifyModaretor } = require("../middleware/authorize");
const c = require("../controllers/review.controller");

const router = express.Router();

router.post("/addReviews", verifyToken, loadAuthUser, asyncHandler(c.createReview));
router.get("/allReviews", verifyToken, loadAuthUser, asyncHandler(c.listReviews));
router.get("/allReviews/:id", asyncHandler(c.getReviewsByScholarship));
router.post("/allReviews/:id/helpful", verifyToken, loadAuthUser, asyncHandler(c.toggleReviewHelpful));
router.delete("/allReviews/:id", verifyToken, loadAuthUser, asyncHandler(c.deleteReview));
router.patch("/allReviews/:id", verifyToken, loadAuthUser, asyncHandler(c.patchReview));
router.patch("/allReviews/:id/moderate", verifyToken, loadAuthUser, verifyModaretor, asyncHandler(c.moderateReview));
router.get("/reviews/history/:id", verifyToken, loadAuthUser, verifyModaretor, asyncHandler(c.getReviewHistory));
router.get("/reviews/removed", verifyToken, loadAuthUser, verifyModaretor, asyncHandler(c.getRemovedReviews));
router.get("/reviews/stats", verifyToken, loadAuthUser, verifyModaretor, asyncHandler(c.getReviewStats));

module.exports = router;
