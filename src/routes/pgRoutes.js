// src/routes/pgRoutes.js
const express = require("express");
const PG = require("../models/PG");
const { protect, requireOwner } = require("../middleware/auth");

const router = express.Router();

/**
 * @route   POST /api/pgs
 * @desc    Create a new PG (owner only)
 * @access  Private (owner)
 */
router.post("/", protect, requireOwner, async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      area,
      genderType,
      hasFood,
      amenities,
      rooms,
      photos,
    } = req.body;

    // Basic validation
    if (!name || !address || !area || !genderType) {
      return res
        .status(400)
        .json({ message: "Name, address, area and genderType are required" });
    }

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one room option is required" });
    }

    // Create PG
    const pg = await PG.create({
      owner: req.user._id,
      name,
      description,
      address,
      area,
      genderType,
      hasFood: !!hasFood,
      amenities: amenities || [],
      photos: photos || [],
      rooms,
    });

    res.status(201).json({
      message: "PG created successfully",
      pg,
    });
  } catch (error) {
    console.error("Create PG error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/pgs
 * @desc    Get list of PGs (with optional filters)
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const { area, genderType } = req.query;

    const filter = { isActive: true };

    if (area) {
      // case-insensitive match on area
      filter.area = new RegExp(area, "i");
    }

    if (genderType) {
      filter.genderType = genderType;
    }

    const pgs = await PG.find(filter)
      .populate("owner", "name phone email")
      .sort({ createdAt: -1 });

    res.json({ pgs });
  } catch (error) {
    console.error("Get PGs error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/pgs/owner/my-pgs
 * @desc    Get owner's PGs count
 * @access  Private (owner)
 */
router.get("/owner/my-pgs", protect, requireOwner, async (req, res) => {
  try {
    const count = await PG.countDocuments({ owner: req.user._id });
    res.json({ count });
  } catch (error) {
    console.error("Get owner PGs count error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/pgs/:id
 * @desc    Get single PG details by ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const pg = await PG.findById(req.params.id).populate(
      "owner",
      "name phone email",
    );

    if (!pg) {
      return res.status(404).json({ message: "PG not found" });
    }

    res.json({ pg });
  } catch (error) {
    console.error("Get PG by ID error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PUT /api/pgs/:id
 * @desc    Update a PG (owner only)
 * @access  Private (owner)
 */
router.put("/:id", protect, requireOwner, async (req, res) => {
  try {
    const pg = await PG.findById(req.params.id);

    if (!pg) {
      return res.status(404).json({ message: "PG not found" });
    }

    // Check if user owns this PG
    if (pg.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this PG" });
    }

    const {
      name,
      description,
      address,
      area,
      genderType,
      hasFood,
      amenities,
      rooms,
      photos,
    } = req.body;

    // Update fields
    if (name) pg.name = name;
    if (description !== undefined) pg.description = description;
    if (address) pg.address = address;
    if (area) pg.area = area;
    if (genderType) pg.genderType = genderType;
    if (hasFood !== undefined) pg.hasFood = !!hasFood;
    if (amenities) pg.amenities = amenities;
    if (rooms) pg.rooms = rooms;
    if (photos) pg.photos = photos;

    await pg.save();

    res.json({
      message: "PG updated successfully",
      pg,
    });
  } catch (error) {
    console.error("Update PG error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   DELETE /api/pgs/:id
 * @desc    Delete a PG (owner only)
 * @access  Private (owner)
 */
router.delete("/:id", protect, requireOwner, async (req, res) => {
  try {
    const pg = await PG.findById(req.params.id);

    if (!pg) {
      return res.status(404).json({ message: "PG not found" });
    }

    // Check if user owns this PG
    if (pg.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this PG" });
    }

    await PG.findByIdAndDelete(req.params.id);

    res.json({ message: "PG deleted successfully" });
  } catch (error) {
    console.error("Delete PG error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
