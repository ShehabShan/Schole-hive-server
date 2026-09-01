const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const c = require("../controllers/apply.controller");

const router = express.Router();
router.post("/apply", verifyToken, loadAuthUser, asyncHandler(c.createApply));
router.get("/apply", verifyToken, loadAuthUser, asyncHandler(c.getApply));
router.get("/allapply", verifyToken, loadAuthUser, asyncHandler(c.getAllApply));
router.get("/singleApply/:id", verifyToken, loadAuthUser, asyncHandler(c.getSingleApply));
router.patch("/allapply/cancel/:id", verifyToken, loadAuthUser, asyncHandler(c.cancelApply));
router.patch("/allapply/accepted/:id", verifyToken, loadAuthUser, asyncHandler(c.acceptApply));
module.exports = router;
