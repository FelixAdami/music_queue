const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  hostSpotifyId: {
    type: String,
    required: true,
  },

  currentSongId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Song",
    default: null,
  },

  isPaused: {
    type: Boolean,
    default: false,
  },

  lastSpotifyTrackId: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Room", roomSchema);
