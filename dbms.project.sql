--table for roles
CREATE TABLE Roles
(
RoleID INT PRIMARY KEY,
RoleName VARCHAR(50) NOT NULL
);
INSERT INTO Roles(RoleID,RoleName) VALUES
(1, 'Student'),
(2, 'Instructor'),
(3, 'Admin');

--table for users
CREATE TABLE Users 
(
    UserID INT PRIMARY KEY ,
    FullName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    RoleID INT,
    FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
);
INSERT INTO Users(UserID, FullName, Email, PasswordHash, RoleID) VALUES
(101, 'Hiba Zulfiqar', 'hiba@student.edu.pk', 'hashed_pw1', 1),
(102, 'Bareera Sultan', 'bareera@student.edu.pk', 'hashed_pw2', 1),
(103, 'Nawal Jabeen', 'nawal@student.edu.pk', 'hashed_pw3', 1),
(104, 'Mahvash Imran', 'mahvash@student.edu.pk', 'hashed_pw4', 1),
(105, 'Dua Amir', 'dua@student.edu.pk', 'hashed_pw5', 1),
(201, 'Engr. Said Nabi', 'said.nabi@uni.edu.pk', 'hashed_pw6', 2),
(202, 'Miss Laraib Afzal', 'laraib.afzal@uni.edu.pk', 'hashed_pw7', 2),
(203, 'Dr. Tahir Naseem', 'tahir@uni.edu.pk', 'hashed_pw8', 2),
(301, 'Admin Sabahat', 'sabahat@admin.edu.pk', 'hashed_pw9', 3),
(302, 'Admin Faheem', 'faheem@admin.edu.pk', 'hashed_pw10', 3);


--table for documents
CREATE TABLE Documents 
(
    DocumentID INT PRIMARY KEY,
    Title VARCHAR(200) NOT NULL,
    AuthorID INT NOT NULL,
    FileType VARCHAR(10) NOT NULL,
    FileSizeMB DECIMAL(5,2),
    UploadDate DATE,
    FOREIGN KEY (AuthorID) REFERENCES Users(UserID)
);
INSERT INTO Documents(DocumentID, Title, AuthorID, FileType, FileSizeMB, UploadDate) VALUES
(1, 'Lecture 1 Notes', 201, 'PDF', 2.3, '2025-04-25'),
(2, 'Assignment 1 Guidelines', 201, 'DOCX', 1.1, '2025-04-26'),
(3, 'Student Report Template', 202, 'DOCX', 0.9, '2025-04-26'),
(4, 'Lecture 2 Notes', 203, 'PDF', 2.0, '2025-04-27'),
(5, 'Research Template', 202, 'DOCX', 1.5, '2025-04-28'),
(6, 'Final Exam Topics', 203, 'PDF', 1.8, '2025-04-28'),
(7, 'Assignment 2 Guidelines', 201, 'DOCX', 1.2, '2025-04-29'),
(8, 'Course Syllabus', 202, 'PDF', 0.7, '2025-04-24'),
(9, 'Presentation Rubric', 203, 'DOCX', 1.0, '2025-04-23'),
(10, 'Project Proposal Template', 202, 'DOCX', 1.4, '2025-04-22');

--table for document permissions
CREATE TABLE DocumentPermissions 
(
    PermissionID INT PRIMARY KEY,
    DocumentID INT,
    UserID INT,
    PermissionType VARCHAR(15),
    FOREIGN KEY (DocumentID) REFERENCES Documents(DocumentID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

INSERT INTO DocumentPermissions(PermissionID, DocumentID, UserID, PermissionType) VALUES
(1, 1, 101, 'View'),
(2, 2, 101, 'Download'),
(3, 3, 102, 'Edit'),
(4, 4, 103, 'View'),
(5, 5, 104, 'Download'),
(6, 6, 105, 'Edit'),
(7, 7, 102, 'View'),
(8, 8, 101, 'Download'),
(9, 9, 103, 'Edit'),
(10, 10, 104, 'View');
 

--table for document versions
CREATE TABLE DocumentVersions 
(
    VersionID INT PRIMARY KEY,
    DocumentID INT,
    VersionNumber INT,
    ModifiedBy INT,
    ModifiedDate DATE,
    FOREIGN KEY (DocumentID) REFERENCES Documents(DocumentID),
    FOREIGN KEY (ModifiedBy) REFERENCES Users(UserID)
);
INSERT INTO DocumentVersions(VersionID, DocumentID, VersionNumber, ModifiedBy, ModifiedDate) VALUES
(1, 1, 1, 201, '2025-04-25'),
(2, 1, 2, 201, '2025-04-27'),
(3, 2, 1, 201, '2025-04-26'),
(4, 3, 1, 202, '2025-04-26'),
(5, 4, 1, 203, '2025-04-27'),
(6, 5, 1, 202, '2025-04-28'),
(7, 6, 1, 203, '2025-04-28'),
(8, 7, 1, 201, '2025-04-29'),
(9, 8, 1, 202, '2025-04-24'),
(10, 9, 1, 203, '2025-04-23');


--table for submissions
CREATE TABLE Submissions 
(
    SubmissionID INT PRIMARY KEY,
    StudentID INT,
    DocumentID INT,
    SubmissionDate DATE,
    Grade INT,
    Comments TEXT,
    FOREIGN KEY (StudentID) REFERENCES Users(UserID),
    FOREIGN KEY (DocumentID) REFERENCES Documents(DocumentID)
);
INSERT INTO Submissions(SubmissionID, StudentID, DocumentID, SubmissionDate, Grade, Comments) VALUES
(1, 101, 2, '2025-04-28', 88, 'Good work!'),
(2, 102, 2, '2025-04-28', 76, 'Needs improvement.'),
(3, 103, 2, '2025-04-28', 92, 'Excellent submission.'),
(4, 104, 3, '2025-04-29', 80, 'Nice format.'),
(5, 105, 4, '2025-04-29', 70, 'Late submission.'),
(6, 101, 5, '2025-04-29', 85, 'Well done.'),
(7, 102, 6, '2025-04-30', 90, 'Great effort.'),
(8, 103, 7, '2025-04-30', 78, 'Needs revision.'),
(9, 104, 8, '2025-05-01', 83, 'Accepted.'),
(10, 105, 9, '2025-05-01', 87, 'Very detailed.');


--table for notifications
CREATE TABLE Notifications 
(
    NotificationID INT PRIMARY KEY,
    UserID INT,
    Message VARCHAR(255),
    NotificationDate DATE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);
INSERT INTO Notifications(NotificationID, UserID, Message, NotificationDate) VALUES
(1, 101, 'New document uploaded: Lecture 1 Notes', '2025-04-25'),
(2, 201, 'Assignment 1 submission received from Hiba Zulfiqar', '2025-04-28'),
(3, 103, 'Document available: Research Template', '2025-04-28'),
(4, 202, 'New version uploaded for Lecture 1 Notes', '2025-04-27'),
(5, 104, 'Submission reminder for Assignment 2', '2025-04-29'),
(6, 105, 'Lecture 2 available', '2025-04-28'),
(7, 203, 'System backup completed', '2025-04-28'),
(8, 301, 'Admin login detected', '2025-04-28'),
(9, 302, 'User feedback received', '2025-04-29'),
(10, 102, 'Your document was approved', '2025-04-30');


--table for backup logs
CREATE TABLE BackupLogs 
(
    BackupID INT PRIMARY KEY,
    BackupDate DATE,
    Status VARCHAR(50)
);
INSERT INTO BackupLogs(BackupID, BackupDate, Status) VALUES
(1, '2025-04-28', 'Success'),
(2, '2025-04-29', 'Success'),
(3, '2025-04-30', 'Failed'),
(4, '2025-05-01', 'Success'),
(5, '2025-05-02', 'Success'),
(6, '2025-05-03', 'Failed'),
(7, '2025-05-04', 'Success'),
(8, '2025-05-05', 'Success'),
(9, '2025-05-06', 'Partial'),
(10, '2025-05-07', 'Success');


--table for synclogs
CREATE TABLE SyncLogs 
(
    SyncID INT PRIMARY KEY,
    UserID INT,
    DocumentID INT,
    SyncDate DATE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (DocumentID) REFERENCES Documents(DocumentID)
);
INSERT INTO SyncLogs(SyncID, UserID, DocumentID, SyncDate) VALUES
(1, 101, 2, '2025-04-28'),
(2, 103, 5, '2025-04-29'),
(3, 101, 4, '2025-04-30'),
(4, 102, 6, '2025-04-30'),
(5, 104, 7, '2025-05-01'),
(6, 105, 8, '2025-05-01'),
(7, 103, 9, '2025-05-02'),
(8, 101, 10, '2025-05-02'),
(9, 104, 3, '2025-05-03'),
(10, 105, 1, '2025-05-03');
