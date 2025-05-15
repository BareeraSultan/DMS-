const express = require("express");
const cors = require("cors");
const multer = require("multer");
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

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files in the "uploads" folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); // Add a timestamp to the filename
  },
});

const upload = multer({ storage });

// API Route for File Upload
app.post("/api/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files;

    // Save file metadata to the database
    const insertQuery = `
      INSERT INTO documents (name, size, format, privacy, url)
      VALUES ($1, $2, $3, $4, $5)
    `;

    for (let i = 0; i < files.length; i++) {
      const { originalname, size, path } = files[i];
      const format = req.body[`format_${i}`];
      const privacy = req.body[`privacy_${i}`];
      const url = `http://localhost:5001/${path}`;
      await pool.query(insertQuery, [originalname, size / 1024 / 1024, format, privacy, url]); // Size in MB
    }

    res.status(200).json({ message: "Files uploaded successfully" });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Serve Uploaded Files
app.use("/uploads", express.static("uploads"));

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));