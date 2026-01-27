// src/routes/bookingRoutes.js

const express = require("express");

const Booking = require("../models/Booking");
const PG = require("../models/PG");
const { protect, requireOwner } = require("../middleware/auth");

const router = express.Router();

// ==========================
// CREATE BOOKING (USER)
// ==========================
router.post("/", protect, async (req, res) => {
  try {
    const { pgId, roomType, stayType, checkInDate, days, months } = req.body;

    if (!pgId || !roomType || !stayType || !checkInDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const pg = await PG.findById(pgId);

    if (!pg) {
      return res.status(404).json({ message: "PG not found" });
    }

    const room = pg.rooms.find((r) => r.type === roomType);

    if (!room) {
      return res.status(404).json({ message: "Room type not found" });
    }

    if (room.availableBeds <= 0) {
      return res.status(400).json({ message: "No beds available" });
    }

    let totalAmount = 0;

    // Calculate price
    if (stayType === "daily") {
      if (!days || days <= 0) {
        return res
          .status(400)
          .json({ message: "Days required for daily stay" });
      }
      totalAmount = room.pricePerDay * days;
    }

    if (stayType === "monthly") {
      if (!months || months <= 0) {
        return res
          .status(400)
          .json({ message: "Months required for monthly stay" });
      }
      totalAmount = room.pricePerMonth * months;
    }

    // Create Booking
    const booking = await Booking.create({
      user: req.user._id,
      pg: pgId,
      roomType,
      stayType,
      checkInDate,
      days,
      months,
      totalAmount,
      status: "pending",
    });

    // Reduce available beds
    room.availableBeds -= 1;
    await pg.save();

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// USER BOOKINGS LIST
// ==========================
router.get("/my", protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate("pg");

    res.json({ bookings });
  } catch (error) {
    console.error("Get user bookings error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// USER BOOKINGS COUNT
// ==========================
router.get("/my/count", protect, async (req, res) => {
  try {
    const count = await Booking.countDocuments({ user: req.user._id });
    res.json({ count });
  } catch (error) {
    console.error("Get user bookings count error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// OWNER VIEW BOOKINGS
// ==========================
router.get("/owner", protect, requireOwner, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: "pg",
        match: { owner: req.user._id },
      })
      .populate("user", "name phone");

    // Remove entries where pg didn't match owner
    const filtered = bookings.filter((b) => b.pg !== null);

    res.json({ bookings: filtered });
  } catch (error) {
    console.error("Owner bookings error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// ACCEPT/REJECT BOOKING (OWNER)
// ==========================
router.patch("/:id/status", protect, requireOwner, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["confirmed", "cancelled"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Invalid status. Use 'confirmed' or 'cancelled'" });
    }

    const booking = await Booking.findById(req.params.id).populate("pg");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if user owns the PG
    if (booking.pg.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this booking" });
    }

    const oldStatus = booking.status;
    booking.status = status;

    // If rejecting/cancelling, restore available beds
    if (status === "cancelled" && oldStatus === "pending") {
      const pg = await PG.findById(booking.pg._id);
      const room = pg.rooms.find((r) => r.type === booking.roomType);
      if (room) {
        room.availableBeds += 1;
        await pg.save();
      }
    }

    // If confirming, ensure beds are already reduced (they should be from creation)
    // If rejecting a confirmed booking, restore beds
    if (oldStatus === "confirmed" && status === "cancelled") {
      const pg = await PG.findById(booking.pg._id);
      const room = pg.rooms.find((r) => r.type === booking.roomType);
      if (room) {
        room.availableBeds += 1;
        await pg.save();
      }
    }

    await booking.save();

    res.json({
      message: `Booking ${status} successfully`,
      booking,
    });
  } catch (error) {
    console.error("Update booking status error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
