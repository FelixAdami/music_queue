const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const response = await fetch(
      "http://cloudflared:20241/quicktunnel",
      {
        signal: AbortSignal.timeout(3000),
      }
    );

    if (!response.ok) {
      throw new Error("Tunnel unavailable");
    }

    const data = await response.json();

    const hostname = data.hostname;

    if (
      typeof hostname !== "string" ||
      !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(hostname)
    ) {
      throw new Error("Invalid tunnel hostname");
    }

    return res.json({
      publicUrl: `https://${hostname}`,
    });
  } catch (error) {
    return res.json({
      publicUrl: null,
    });
  }
});

module.exports = router;