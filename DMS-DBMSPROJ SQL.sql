-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM('admin', 'student', 'teacher');
CREATE TYPE document_type AS ENUM('pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'other');
CREATE TYPE notification_type AS ENUM('shared', 'comment', 'system');

-- Users table (authentication)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Courses table
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assignments table
CREATE TABLE assignments (
    assignment_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE,
    total_points INTEGER DEFAULT 100,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE documents (
    document_id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type document_type NOT NULL,
    file_size INTEGER NOT NULL,
    owner_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_private BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1
);

-- Shared documents
CREATE TABLE shared_documents (
    share_id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    shared_by INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    shared_with INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT FALSE,
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, shared_with)
);

-- Document versions
CREATE TABLE document_versions (
    version_id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INTEGER REFERENCES users(user_id) ON DELETE CASCADE
);

-- Comments
CREATE TABLE document_comments (
    comment_id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_title ON documents(title);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_upload_date ON documents(upload_date);

CREATE INDEX idx_document_shares_document ON shared_documents(document_id);
CREATE INDEX idx_document_shares_shared_with ON shared_documents(shared_with);

CREATE INDEX idx_document_comments_document ON document_comments(document_id);
CREATE INDEX idx_document_comments_user ON document_comments(user_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;

CREATE INDEX idx_assignments_created_by ON assignments(created_by);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignments_course ON assignments(course_id);

-- Create views
CREATE OR REPLACE VIEW user_documents_view AS
SELECT 
    d.document_id,
    d.title,
    d.file_name,
    d.file_type,
    d.file_size,
    d.upload_date,
    d.is_private,
    u.user_id as owner_id,
    u.full_name as owner_name
FROM 
    documents d
JOIN 
    users u ON d.owner_id = u.user_id;

CREATE OR REPLACE VIEW shared_documents_view AS
SELECT 
    d.document_id,
    d.title,
    d.file_type,
    u.user_id as owner_id,
    u.full_name as owner_name,
    ds.shared_with as shared_with_user_id,
    u2.full_name as shared_with_name,
    ds.can_edit
FROM 
    documents d
JOIN 
    shared_documents ds ON d.document_id = ds.document_id
JOIN 
    users u ON d.owner_id = u.user_id
JOIN 
    users u2 ON ds.shared_with = u2.user_id;

CREATE OR REPLACE VIEW unread_notifications_view AS
SELECT 
    n.notification_id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.created_at
FROM 
    notifications n
WHERE 
    n.is_read = FALSE
ORDER BY 
    n.created_at DESC;

--functions and triggers
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hash_password()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.password_hash IS DISTINCT FROM NEW.password_hash) THEN
        NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_file_size()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.file_size > 5242880 THEN  -- 5MB limit for the file that was uplaoded
    RAISE EXCEPTION 'File size exceeds 5MB limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_document_version()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.file_path IS DISTINCT FROM NEW.file_path) THEN
        INSERT INTO document_versions (document_id, file_path, version_number, uploaded_by)
        VALUES (OLD.document_id, OLD.file_path, OLD.version, OLD.owner_id);
        
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_document_share()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, related_entity_id)
    VALUES (
        NEW.shared_with, 
        'shared', 
        'Document Shared With You', 
        'A document has been shared with you by ' || (SELECT full_name FROM users WHERE user_id = NEW.shared_by),
        NEW.document_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_user_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER hash_user_password
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION hash_password();

CREATE TRIGGER update_document_timestamp
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER document_version_trigger
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION handle_document_version();

CREATE TRIGGER document_share_notification
AFTER INSERT ON shared_documents
FOR EACH ROW EXECUTE FUNCTION notify_document_share();

CREATE TRIGGER update_comment_timestamp
BEFORE UPDATE ON document_comments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_assignment_timestamp
BEFORE UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER validate_file_size
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION check_file_size();
