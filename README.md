# Document Management System (DMS)

A full-stack document management system with user authentication, document sharing, and notifications.

## Features

- User authentication (register/login)
- Document upload and management
- Document sharing with other users
- Real-time notifications
- File version control
- Role-based access control

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd dms-website
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
- Create a new database named `dms_db`
- Run the SQL script in `DMS-DBMSPROJ SQL.sql` to create tables and functions

4. Configure environment variables:
- Update the PostgreSQL connection details in `index.js`
- Change the JWT secret in `index.js`

5. Create uploads directory:
```bash
mkdir uploads
```

6. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication
- POST `/api/register` - Register a new user
- POST `/api/login` - Login user

### Documents
- POST `/api/documents/upload` - Upload a new document
- GET `/api/documents` - Get user's documents
- POST `/api/documents/share` - Share a document
- GET `/api/documents/shared` - Get shared documents

### Notifications
- GET `/api/notifications` - Get user's notifications
- PUT `/api/notifications/:id` - Mark notification as read

## Security

- Passwords are hashed using bcrypt
- JWT authentication for API endpoints
- File size limit of 5MB
- Role-based access control

## File Structure

```
dms-website/
├── index.js           # Main server file
├── package.json       # Project dependencies
├── uploads/          # Document storage
├── public/           # Static files
└── DMS-DBMSPROJ SQL.sql  # Database schema
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 