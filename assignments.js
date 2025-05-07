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

// API Route for Fetching Assignments
app.get("/api/assignments", async (req, res) => {
  try {
    const query = `
      SELECT 
        title, 
        course, 
        due_date, 
        status 
      FROM assignments
      ORDER BY due_date ASC
    `;
    const result = await pool.query(query);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));