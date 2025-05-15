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

// API Route for Fetching Documents
app.get("/api/documents", async (req, res) => {
  try {
    const query = "SELECT id, name, size, uploaded_at, url FROM documents ORDER BY uploaded_at DESC";
    const result = await pool.query(query);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));