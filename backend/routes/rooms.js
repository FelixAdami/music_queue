const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");

const router = express.Router();

// Create a new room
router.post("/", async (req, res) => {
    try {
        const { name } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                error: "Room name is required"
            });
        }

        const room = await Room.create({
            name: name.trim()
        });

        return res.status(201).json(room);

    } catch (error) {
        console.error("Error creating room:", error);

        return res.status(500).json({
            error: "Failed to create room"
        });
    }
});

// Get a room by its ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid room ID"
            });
        }

        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        return res.status(200).json(room);

    } catch (error) {
        console.error("Error fetching room:", error);

        return res.status(500).json({
            error: "Failed to fetch room"
        });
    }
});

module.exports = router;