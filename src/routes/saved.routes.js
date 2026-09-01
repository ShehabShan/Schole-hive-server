const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const c = require("../controllers/saved.controller");

const router = express.Router();
router.post("/saved", verifyToken, loadAuthUser, asyncHandler(c.toggleSave));
router.get("/saved", verifyToken, loadAuthUser, asyncHandler(c.getSaved));
router.delete("/saved/:id", verifyToken, loadAuthUser, asyncHandler(c.deleteSaved));
router.get("/saved/check/:id", verifyToken, asyncHandler(c.checkSaved));
module.exports = router;
