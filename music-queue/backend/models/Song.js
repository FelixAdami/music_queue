const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },

  spotifyId: {
    type: String,
    required: true,
  },

  title: {
    type: String,
    required: true,
  },

  artist: {
    type: String,
    required: true,
  },

  durationMs: {
    type: Number,
    required: true,
  },

  imageUrl: {
    type: String,
  },

  spotifyUrl: {
    type: String,
  },

  addedAt: {
    type: Date,
    default: Date.now,
  },

  queuePosition: {
    type: Number,
    default: Date.now,
  },

  playedAt: {
    type: Date,
    default: null,
  },

  // Genre Rules
  allowedGenres: {
    type: [{ type: String }],
    default: [],
    set: (genres) => [
      ...new Set(
        genres
          .filter((genre) => typeof genre === "string")
          .map((genre) => genre.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
  },
});

module.exports = mongoose.model("Song", songSchema);