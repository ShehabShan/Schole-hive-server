const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const { verifyScholarshipEditor, verifyScholarshipOwner } = require("../middleware/authorize");
const c = require("../controllers/scholarship.controller");

const router = express.Router();

// list (public) - primary + aliases
router.get("/allScholership", asyncHandler(c.listScholarships));
router.get("/allScholarships", asyncHandler(c.listScholarships));
router.get("/scholarships", asyncHandler(c.listScholarships));
router.get("/api/scholarships", asyncHandler(c.listScholarships));

// stats (before :id)
router.get("/allScholership/stats", asyncHandler(c.getStats));
router.get("/allScholarships/stats", asyncHandler(c.getStats));
router.get("/scholarships/stats", asyncHandler(c.getStats));

// single (after stats)
router.get("/allScholership/:id", asyncHandler(c.getScholarshipById));
router.get("/allScholarships/:id", asyncHandler(c.getScholarshipById));
router.get("/scholarships/:id", asyncHandler(c.getScholarshipById));

// create / update / delete (secured)
router.post("/allScholership", verifyToken, loadAuthUser, verifyScholarshipEditor, asyncHandler(c.createScholarship));
router.post("/allScholarships", verifyToken, loadAuthUser, verifyScholarshipEditor, asyncHandler(c.createScholarship));
router.post("/scholarships", verifyToken, loadAuthUser, verifyScholarshipEditor, asyncHandler(c.createScholarship));

router.delete("/allScholership/:id", verifyToken, loadAuthUser, verifyScholarshipOwner, asyncHandler(c.deleteScholarship));
router.delete("/allScholarships/:id", verifyToken, loadAuthUser, verifyScholarshipOwner, asyncHandler(c.deleteScholarship));
router.delete("/scholarships/:id", verifyToken, loadAuthUser, verifyScholarshipOwner, asyncHandler(c.deleteScholarship));

router.patch("/allScholership/:id", verifyToken, loadAuthUser, verifyScholarshipOwner, asyncHandler(c.patchScholarship));
router.patch("/allScholarships/:id", verifyToken, loadAuthUser, verifyScholarshipOwner, asyncHandler(c.patchScholarship));
router.patch("/scholarships/:id", verifyToken, loadAuthUser, verifyScholarshipOwner, asyncHandler(c.patchScholarship));

module.exports = router;
