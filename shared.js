const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  user: "postgres", // Replace with your PostgreSQL username
  host: "localhost",
  database: "giki_dms", // Replace with your database name
  password: "your_password", // Replace with your PostgreSQL password
  port: 5432, // Default PostgreSQL port
});

// API Route for Fetching Shared Files
app.get("/api/shared", async (req, res) => {
  try {
    const query = `
      SELECT 
        f.name, 
        f.url, 
        u.name AS shared_by 
      FROM shared_files sf
      JOIN files f ON sf.file_id = f.id
      JOIN users u ON sf.shared_by = u.id
      ORDER BY sf.shared_at DESC
    `;
    const result = await pool.query(query);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching shared files:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));