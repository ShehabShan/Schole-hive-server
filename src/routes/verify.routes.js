const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const { verifySuperAdmin } = require("../middleware/authorize");
const c = require("../controllers/verify.controller");

const router = express.Router();

router.post("/verify-request", verifyToken, loadAuthUser, asyncHandler(c.createVerifyRequest));
router.get("/verify-requests/me", verifyToken, loadAuthUser, asyncHandler(c.getMyVerifyRequests));
router.get("/verify-requests", verifyToken, loadAuthUser, verifySuperAdmin, asyncHandler(c.getAllVerifyRequests));
router.patch("/verify-request/:id", verifyToken, loadAuthUser, verifySuperAdmin, asyncHandler(c.patchVerifyRequest));

module.exports = router;
