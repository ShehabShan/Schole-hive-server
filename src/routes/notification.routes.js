const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const c = require("../controllers/notification.controller");

const router = express.Router();
router.get("/notifications/me", verifyToken, loadAuthUser, asyncHandler(c.listMine));
router.patch("/notifications/read-all", verifyToken, loadAuthUser, asyncHandler(c.markAllRead));
router.patch("/notifications/read/:id", verifyToken, loadAuthUser, asyncHandler(c.markRead));

module.exports = router;
