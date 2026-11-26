const mongoose = require("mongoose");

const spotifyTokenSchema = new mongoose.Schema(
  {
    spotifyUserId: {
      type: String,
      required: true,
      unique: true,
    },

    accessToken: {
      type: String,
      required: true,
    },

    refreshToken: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SpotifyToken", spotifyTokenSchema);
