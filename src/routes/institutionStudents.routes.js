const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const verifyToken = require("../middleware/verifyToken");
const loadAuthUser = require("../middleware/loadAuthUser");
const c = require("../controllers/institutionStudents.controller");

const router = express.Router();

router.post("/institutions/:email/students", verifyToken, loadAuthUser, asyncHandler(c.addStudent));
router.post("/institutions/:email/students/bulk", verifyToken, loadAuthUser, asyncHandler(c.bulkAddStudents));
router.get("/institutions/:email/students", verifyToken, loadAuthUser, asyncHandler(c.listStudents));
router.patch("/institutions/:email/students/:id", verifyToken, loadAuthUser, asyncHandler(c.updateStudent));
router.delete("/institutions/:email/students/:id", verifyToken, loadAuthUser, asyncHandler(c.deleteStudent));

module.exports = router;
