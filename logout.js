const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 5001;

// Middleware
app.use(cors({ origin: "http://localhost:5001", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Simulated session storage (for demonstration purposes)
let sessions = {};

// API Route for Logout
app.post("/api/logout", (req, res) => {
    const sessionId = req.cookies.sessionId;

    if (sessionId && sessions[sessionId]) {
        // Clear the session
        delete sessions[sessionId];
        res.clearCookie("sessionId"); // Clear the session cookie
        return res.status(200).json({ message: "Logout successful" });
    }

    res.status(400).json({ message: "No active session found" });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));