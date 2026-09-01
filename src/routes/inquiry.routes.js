const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const { verifyModaretor } = require("../middleware/authorize");
const c = require("../controllers/inquiry.controller");

const router = express.Router();
router.post("/inquiries", asyncHandler(c.createInquiry));
router.get("/inquiries", verifyToken, loadAuthUser, verifyModaretor, asyncHandler(c.listInquiries));
module.exports = router;
