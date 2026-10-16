require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const roomRoutes = require("./routes/rooms");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/rooms", roomRoutes);

async function startServer() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("Connected to MongoDB");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();