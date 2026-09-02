const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { seedDatabase } = require("../controllers/seed.controller");

const router = express.Router();

// GET or POST /seed to populate the database
router.get("/seed", asyncHandler(seedDatabase));
router.post("/seed", asyncHandler(seedDatabase));

module.exports = router;
