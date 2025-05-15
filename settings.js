const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  user: "postgres", // Replace with your PostgreSQL username
  host: "localhost",
  database: "DMS", // Replace with your database name
  password: "pgadmin", // Replace with your PostgreSQL password
  port: 5432, // Default PostgreSQL port
});

// API Route for Updating User Settings
app.post("/api/settings", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const updateQuery = `
      UPDATE users
      SET name = $1, email = $2, password = COALESCE($3, password)
      WHERE id = 1 -- Replace with the logged-in user's ID
    `;
    await pool.query(updateQuery, [name, email, password || null]);

    res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));