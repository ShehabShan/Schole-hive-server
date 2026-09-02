const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const { verifyAdmin, verifySuperAdmin, verifyOwnerModifiable } = require("../middleware/authorize");
const c = require("../controllers/user.controller");

const router = express.Router();

router.post("/users", asyncHandler(c.createUser));
router.get("/users", verifyToken, loadAuthUser, asyncHandler(c.getAllUsers));
router.get("/users/admin/:email", verifyToken, asyncHandler(c.checkAdmin));
router.get("/users/superAdmin/:email", verifyToken, asyncHandler(c.checkSuperAdmin));
router.get("/users/modaretor/:email", verifyToken, asyncHandler(c.checkModaretor));
router.get("/users/user/:email", verifyToken, asyncHandler(c.checkUser));
router.get("/user", verifyToken, loadAuthUser, asyncHandler(c.getUserByEmail));
router.get("/users/public/:email", asyncHandler(c.getPublicUser));
router.get("/users/public/:email/stats", asyncHandler(c.getPublicStats));
router.get("/users/me", verifyToken, loadAuthUser, asyncHandler(c.getMe));
router.get("/users/me/stats", verifyToken, loadAuthUser, asyncHandler(c.getMeStats));
router.get("/users/me/portal", verifyToken, loadAuthUser, asyncHandler(c.getPortal));
router.get("/users/:email/followers", asyncHandler(c.getFollowers));
router.get("/users/:email/follow", verifyToken, loadAuthUser, asyncHandler(c.checkFollow));
router.post("/users/:email/follow", verifyToken, loadAuthUser, asyncHandler(c.toggleFollow));
router.patch("/users/me", verifyToken, loadAuthUser, asyncHandler(c.patchMe));
router.patch("/users/admin/:id", verifyToken, loadAuthUser, verifyAdmin, verifyOwnerModifiable, asyncHandler((req, res) => c.patchRole({ ...req, params: { ...req.params, role: "admin" } }, res)));
router.patch("/users/modaretor/:id", verifyToken, loadAuthUser, verifyAdmin, verifyOwnerModifiable, asyncHandler((req, res) => c.patchRole({ ...req, params: { ...req.params, role: "modaretor" } }, res)));
router.patch("/users/user/:id", verifyToken, loadAuthUser, verifyAdmin, verifyOwnerModifiable, asyncHandler((req, res) => c.patchRole({ ...req, params: { ...req.params, role: "user" } }, res)));
router.delete("/users/:id", verifyToken, loadAuthUser, verifyAdmin, verifyOwnerModifiable, asyncHandler(c.deleteUser));

// institution approvals (superadmin only)
router.get("/users/institution/:email", verifyToken, loadAuthUser, asyncHandler(c.checkInstitution));
router.get("/institutions", verifyToken, loadAuthUser, verifySuperAdmin, asyncHandler(c.getInstitutions));
router.get("/institutions/pending", verifyToken, loadAuthUser, verifySuperAdmin, asyncHandler(c.getPendingInstitutions));
router.patch("/users/institution/:id", verifyToken, loadAuthUser, verifySuperAdmin, asyncHandler(c.patchInstitutionStatus));

module.exports = router;
