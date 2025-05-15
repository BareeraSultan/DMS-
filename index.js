const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5001;  // Changed from 5000 to 5001

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));  // Serve files from the current directory

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// PostgreSQL connection configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'DMS',
  password: 'pgadmin', // Change this to your PostgreSQL password
  port: 5432,
});

// JWT Secret
const JWT_SECRET = 'your_jwt_secret'; // Change this to a secure secret

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { full_name, email, password, userType } = req.body;
    console.log('Registration attempt:', { full_name, email, userType });
    
    // Validate required fields
    if (!full_name || !email || !password || !userType) {
      console.log('Missing fields:', { full_name: !full_name, email: !email, password: !password, userType: !userType });
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { full_name: !full_name, email: !email, password: !password, userType: !userType }
      });
    }

    // Validate user type
    if (!['admin', 'student', 'teacher'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type. Must be one of: admin, student, teacher' });
    }

    // Check if email already exists
    const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Let the database trigger handle password hashing
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4::user_role) RETURNING user_id, full_name, email, role',
      [full_name, email, password, userType]
    );

    console.log('User registered successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ 
        error: 'Registration failed',
        details: error.message 
      });
    }
  }
});

// Debug endpoint to check user registration
app.get('/api/debug/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      'SELECT user_id, email, full_name, role FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      res.json({ exists: false, message: 'User not found' });
    } else {
      res.json({ 
        exists: true, 
        user: result.rows[0],
        message: 'User found'
      });
    }
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    // First get the user by email
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Then verify the password using crypt
    const passwordResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password_hash = crypt($2, password_hash)',
      [email, password]
    );

    if (passwordResult.rows.length === 0) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User authenticated successfully:', { user_id: user.user_id, email: user.email });

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        user_id: user.user_id, 
        email: user.email, 
        role: user.role,
        full_name: user.full_name 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload document
app.post('/api/documents/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title } = req.body;
    const file = req.file;
    // Store the full URL for the file
    const fileUrl = `http://localhost:${port}/uploads/${file.filename}`;

    const result = await pool.query(
      'INSERT INTO documents (title, file_name, file_path, file_type, file_size, owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title || file.originalname, file.originalname, fileUrl, path.extname(file.originalname).slice(1), file.size, req.user.user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch file upload
app.post("/api/upload/batch", authenticateToken, upload.array("files"), async (req, res) => {
  try {
    const files = req.files;
    console.log("Received files:", files);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
      // Store the full URL for the file
      const fileUrl = `http://localhost:${port}/uploads/${file.filename}`;
      
      // Map file extension to document_type enum
      let documentType = 'other';
      if (['pdf', 'docx', 'txt'].includes(fileExtension)) {
        documentType = fileExtension;
      }

      console.log("Inserting document:", {
        title: file.originalname,
        fileName: file.originalname,
        filePath: fileUrl,
        fileType: documentType,
        fileSize: file.size,
        ownerId: req.user.user_id
      });

      await pool.query(
        'INSERT INTO documents (title, file_name, file_path, file_type, file_size, owner_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [file.originalname, file.originalname, fileUrl, documentType, file.size, req.user.user_id]
      );
    }

    res.status(200).json({ message: "Files uploaded successfully" });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ 
      error: "Failed to upload files",
      details: error.message 
    });
  }
});

// Get user's documents
app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT document_id, title, file_name, file_path, file_type, file_size, upload_date, owner_id FROM documents WHERE owner_id = $1',
      [req.user.user_id]
    );

    // Log the results for debugging
    console.log('Documents found:', result.rows);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download document
app.get('/api/documents/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get document details
    const result = await pool.query(
      'SELECT * FROM documents WHERE document_id = $1 AND owner_id = $2',
      [id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];
    // Extract filename from the URL
    const filename = document.file_path.split('/').pop();
    const filePath = path.join(__dirname, 'uploads', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Share document
app.post('/api/documents/share', authenticateToken, async (req, res) => {
  try {
    const { document_id, shared_with, can_edit } = req.body;

    // First, get the user ID from the email
    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [shared_with]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found with the provided email' });
    }

    const shared_with_id = userResult.rows[0].user_id;

    // Check if the document exists and belongs to the user
    const documentResult = await pool.query(
      'SELECT * FROM documents WHERE document_id = $1 AND owner_id = $2',
      [document_id, req.user.user_id]
    );

    if (documentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or you do not have permission to share it' });
    }

    // Check if the document is already shared with this user
    const existingShare = await pool.query(
      'SELECT * FROM shared_documents WHERE document_id = $1 AND shared_with = $2',
      [document_id, shared_with_id]
    );

    if (existingShare.rows.length > 0) {
      // Update existing share if permissions are different
      if (existingShare.rows[0].can_edit !== can_edit) {
        await pool.query(
          'UPDATE shared_documents SET can_edit = $1 WHERE document_id = $2 AND shared_with = $3',
          [can_edit, document_id, shared_with_id]
        );
        return res.json({ message: 'Share permissions updated successfully' });
      }
      return res.status(400).json({ error: 'Document is already shared with this user' });
    }

    // Share the document
    const result = await pool.query(
      'INSERT INTO shared_documents (document_id, shared_by, shared_with, can_edit) VALUES ($1, $2, $3, $4) RETURNING *',
      [document_id, req.user.user_id, shared_with_id, can_edit]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sharing document:', error);
    res.status(500).json({ error: 'Failed to share document' });
  }
});

// Get shared documents
app.get('/api/documents/shared', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shared_documents_view WHERE shared_with_user_id = $1',
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM unread_notifications_view WHERE user_id = $1',
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_id = $2',
      [id, req.user.user_id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get shared documents
app.get('/api/shared', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const query = `
      SELECT 
        d.title as name,
        d.file_path as url,
        u.full_name as shared_by
      FROM shared_documents sd
      JOIN documents d ON sd.document_id = d.document_id
      JOIN users u ON sd.shared_by = u.user_id
      WHERE sd.shared_with = $1
      ORDER BY sd.shared_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching shared documents:', error);
    res.status(500).json({ error: 'Failed to fetch shared documents' });
  }
});

// Get all assignments
app.get('/api/assignments', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];

    // If user is a student, show all assignments
    if (req.user.role === 'student') {
      query = `
        SELECT 
          a.assignment_id,
          a.title,
          a.description,
          a.due_date,
          a.total_points,
          a.created_at,
          a.file_path,
          c.name as course_name,
          c.code as course_code
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.course_id
        ORDER BY a.due_date DESC
      `;
    } 
    // If user is a teacher, show assignments they created
    else if (req.user.role === 'teacher') {
      query = `
        SELECT 
          a.assignment_id,
          a.title,
          a.description,
          a.due_date,
          a.total_points,
          a.created_at,
          a.file_path,
          c.name as course_name,
          c.code as course_code
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.course_id
        WHERE a.created_by = $1
        ORDER BY a.due_date DESC
      `;
      params = [req.user.user_id];
    }
    // If user is admin, show all assignments
    else {
      query = `
        SELECT 
          a.assignment_id,
          a.title,
          a.description,
          a.due_date,
          a.total_points,
          a.created_at,
          a.file_path,
          c.name as course_name,
          c.code as course_code,
          u.full_name as created_by_name
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.course_id
        LEFT JOIN users u ON a.created_by = u.user_id
        ORDER BY a.due_date DESC
      `;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create new assignment
app.post('/api/assignments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('Received assignment creation request:', req.body);
    console.log('File:', req.file);

    const { title, description, course_name, course_code, due_date, total_points } = req.body;

    // Validate required fields
    if (!title || !course_name || !course_code || !due_date) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { title: !title, course_name: !course_name, course_code: !course_code, due_date: !due_date }
      });
    }

    // Check if user has permission to create assignments
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can create assignments' });
    }

    // First, try to get the existing course
    let courseId;
    try {
      const existingCourse = await pool.query(
        'SELECT course_id FROM courses WHERE code = $1',
        [course_code]
      );

      if (existingCourse.rows.length > 0) {
        // Course exists, update its name if needed
        courseId = existingCourse.rows[0].course_id;
        await pool.query(
          'UPDATE courses SET name = $1 WHERE course_id = $2',
          [course_name, courseId]
        );
      } else {
        // Course doesn't exist, create it
        const newCourse = await pool.query(
          'INSERT INTO courses (name, code) VALUES ($1, $2) RETURNING course_id',
          [course_name, course_code]
        );
        courseId = newCourse.rows[0].course_id;
      }
    } catch (error) {
      console.error('Error processing course:', error);
      return res.status(500).json({ 
        error: 'Failed to process course information',
        details: error.message 
      });
    }

    // Create the assignment
    try {
      const result = await pool.query(
        `INSERT INTO assignments 
         (title, description, course_id, due_date, total_points, created_by, file_path) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          title, 
          description, 
          courseId, 
          due_date, 
          total_points || 100, 
          req.user.user_id,
          req.file ? `http://localhost:${port}/uploads/${req.file.filename}` : null
        ]
      );

      // Get the full assignment details with course information
      const assignmentResult = await pool.query(
        `SELECT 
          a.*,
          c.name as course_name,
          c.code as course_code,
          u.full_name as created_by_name
         FROM assignments a
         JOIN courses c ON a.course_id = c.course_id
         JOIN users u ON a.created_by = u.user_id
         WHERE a.assignment_id = $1`,
        [result.rows[0].assignment_id]
      );

      res.status(201).json(assignmentResult.rows[0]);
    } catch (error) {
      console.error('Error creating assignment:', error);
      // If there was a file uploaded, we should clean it up
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up uploaded file:', unlinkError);
        }
      }
      return res.status(500).json({ 
        error: 'Failed to create assignment',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Unexpected error in assignment creation:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: error.message 
    });
  }
});

// Get single assignment
app.get('/api/assignments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        a.*,
        c.name as course_name,
        c.code as course_code,
        u.full_name as created_by_name
      FROM assignments a
      JOIN courses c ON a.course_id = c.course_id
      JOIN users u ON a.created_by = u.user_id
      WHERE a.assignment_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Update assignment
app.put('/api/assignments/:id', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('Received assignment update request:', req.body);
    console.log('File:', req.file);

    const { id } = req.params;
    const { title, description, course_name, course_code, due_date, total_points } = req.body;

    // Check if user has permission to update assignments
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can update assignments' });
    }

    // First, create or get the course
    let courseId;
    try {
      const courseResult = await pool.query(
        `INSERT INTO courses (name, code) 
         VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE 
         SET name = EXCLUDED.name
         RETURNING course_id`,
        [course_name, course_code]
      );
      courseId = courseResult.rows[0].course_id;
    } catch (error) {
      console.error('Error creating/updating course:', error);
      return res.status(500).json({ error: 'Failed to process course information' });
    }

    // Get the current assignment to check file path
    const currentAssignment = await pool.query(
      'SELECT file_path FROM assignments WHERE assignment_id = $1',
      [id]
    );

    // Update the assignment
    try {
      const result = await pool.query(
        `UPDATE assignments 
         SET title = $1, 
             description = $2, 
             course_id = $3, 
             due_date = $4, 
             total_points = $5,
             file_path = CASE 
               WHEN $6 IS NOT NULL THEN $6
               ELSE file_path
             END
         WHERE assignment_id = $7 AND (created_by = $8 OR $9 = 'admin')
         RETURNING *`,
        [
          title, 
          description, 
          courseId, 
          due_date, 
          total_points,
          req.file ? `http://localhost:${port}/uploads/${req.file.filename}` : null,
          id, 
          req.user.user_id, 
          req.user.role
        ]
      );

      if (result.rows.length === 0) {
        // If there was a file uploaded, we should clean it up
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('Error cleaning up uploaded file:', unlinkError);
          }
        }
        return res.status(404).json({ error: 'Assignment not found or you do not have permission to update it' });
      }

      // If there was a new file uploaded and there was an old file, delete the old file
      if (req.file && currentAssignment.rows[0].file_path) {
        const oldFilePath = currentAssignment.rows[0].file_path.split('/').pop();
        const oldFileFullPath = path.join(__dirname, 'uploads', oldFilePath);
        try {
          fs.unlinkSync(oldFileFullPath);
        } catch (unlinkError) {
          console.error('Error deleting old file:', unlinkError);
        }
      }

      // Get the full assignment details with course information
      const assignmentResult = await pool.query(
        `SELECT 
          a.*,
          c.name as course_name,
          c.code as course_code,
          u.full_name as created_by_name
         FROM assignments a
         JOIN courses c ON a.course_id = c.course_id
         JOIN users u ON a.created_by = u.user_id
         WHERE a.assignment_id = $1`,
        [id]
      );

      res.json(assignmentResult.rows[0]);
    } catch (error) {
      console.error('Error updating assignment:', error);
      // If there was a file uploaded, we should clean it up
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up uploaded file:', unlinkError);
        }
      }
      return res.status(500).json({ 
        error: 'Failed to update assignment',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Unexpected error in assignment update:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: error.message 
    });
  }
});

// Delete assignment
app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has permission to delete assignments
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can delete assignments' });
    }

    const result = await pool.query(
      'DELETE FROM assignments WHERE assignment_id = $1 AND (created_by = $2 OR $3 = \'admin\') RETURNING *',
      [id, req.user.user_id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found or you do not have permission to delete it' });
    }

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// Download assignment attachment
app.get('/api/assignments/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get assignment details
    const result = await pool.query(
      'SELECT * FROM assignments WHERE assignment_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = result.rows[0];
    
    if (!assignment.file_path) {
      return res.status(404).json({ error: 'No file attached to this assignment' });
    }

    // Extract filename from the URL
    const filename = assignment.file_path.split('/').pop();
    const filePath = path.join(__dirname, 'uploads', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create necessary tables if they don't exist
async function createTables() {
  try {
    // Create courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        course_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        assignment_id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(course_id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date TIMESTAMP,
        total_points INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        submission_id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES assignments(assignment_id),
        student_id INTEGER REFERENCES users(user_id),
        file_path VARCHAR(255) NOT NULL,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        grade INTEGER,
        feedback TEXT,
        status VARCHAR(50) DEFAULT 'pending'
      )
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Insert sample data for testing
async function insertSampleData() {
  try {
    // Check if we already have data
    const courseCheck = await pool.query('SELECT COUNT(*) FROM courses');
    if (courseCheck.rows[0].count > 0) {
      console.log('Sample data already exists');
      return;
    }

    // Insert sample course
    const courseResult = await pool.query(
      'INSERT INTO courses (name, code, description) VALUES ($1, $2, $3) RETURNING course_id',
      ['Introduction to Computer Science', 'CS101', 'Basic computer science concepts']
    );
    const courseId = courseResult.rows[0].course_id;

    // Insert sample assignment
    const assignmentResult = await pool.query(
      'INSERT INTO assignments (course_id, title, description, due_date) VALUES ($1, $2, $3, $4) RETURNING assignment_id',
      [courseId, 'Programming Assignment 1', 'Basic programming concepts', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );
    const assignmentId = assignmentResult.rows[0].assignment_id;

    // Get a student user
    const studentResult = await pool.query(
      'SELECT user_id FROM users WHERE role = $1 LIMIT 1',
      ['student']
    );

    if (studentResult.rows.length > 0) {
      const studentId = studentResult.rows[0].user_id;

      // Insert sample submission
      await pool.query(
        'INSERT INTO submissions (assignment_id, student_id, file_path, grade, status) VALUES ($1, $2, $3, $4, $5)',
        [assignmentId, studentId, 'http://localhost:5001/uploads/sample.pdf', 85, 'graded']
      );
    }

    console.log('Sample data inserted successfully');
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
}

// Call insertSampleData after creating tables
createTables().then(() => {
  insertSampleData();
});

// Get user's grades
app.get('/api/grades', authenticateToken, async (req, res) => {
  try {
    // First, check if the user is a student
    const userResult = await pool.query(
      'SELECT role FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;
    let query;
    let params = [];

    if (userRole === 'student') {
      // For students, show only their submissions
      query = `
        SELECT 
          s.submission_id,
          a.title as assignment_name,
          c.name as course_name,
          s.grade,
          s.submission_date,
          s.file_path as file_url
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.assignment_id
        JOIN courses c ON a.course_id = c.course_id
        WHERE s.student_id = $1
        ORDER BY s.submission_date DESC
      `;
      params = [req.user.user_id];
    } else if (userRole === 'teacher') {
      // For teachers, show all submissions for their courses
      query = `
        SELECT 
          s.submission_id,
          a.title as assignment_name,
          c.name as course_name,
          s.grade,
          s.submission_date,
          s.file_path as file_url,
          u.full_name as student_name
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.assignment_id
        JOIN courses c ON a.course_id = c.course_id
        JOIN users u ON s.student_id = u.user_id
        WHERE c.teacher_id = $1
        ORDER BY s.submission_date DESC
      `;
      params = [req.user.user_id];
    } else {
      return res.status(403).json({ error: 'Unauthorized role' });
    }

    const result = await pool.query(query, params);
    console.log('Grades query result:', result.rows); // Debug log
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get submission details
app.get('/api/submissions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        s.submission_id,
        s.file_path as file_url,
        s.submission_date,
        s.grade,
        a.title as assignment_name,
        c.name as course_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.assignment_id
      JOIN courses c ON a.course_id = c.course_id
      WHERE s.submission_id = $1 AND s.student_id = $2`,
      [id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user role
app.get('/api/user/role', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, email, role, full_name FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all courses
app.get('/api/courses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT course_id, name, code, description FROM courses ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});