
const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true
    },

    spotifyId: {
        type: String,
        required: true
    },

    title: {
        type: String,
        required: true
    },

    artist: {
        type: String,
        required: true
    },

    durationMs: {
        type: Number,
        required: true
    },

    imageUrl: {
        type: String
    },

    spotifyUrl: {
        type: String
    },

    addedAt: {
        type: Date,
        default: Date.now
    },

    playedAt: {
    type: Date,
    default: null
}
});

module.exports = mongoose.model("Song", songSchema);
