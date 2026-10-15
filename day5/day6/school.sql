-- School database
-- Run in an SQLite playground such as sqliteonline.com

PRAGMA foreign_keys = ON;

-- Start clean so the script can be run again
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ========== 1. TABLES ==========

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  title     TEXT NOT NULL,
  credits   INTEGER NOT NULL
);

CREATE TABLE enrolments (
  enrolment_id INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL,
  course_id    INTEGER NOT NULL,
  grade        TEXT,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id)  REFERENCES courses(course_id),
  UNIQUE (student_id, course_id)
);

-- Index to speed up searches by course
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

-- ========== 2. SAMPLE DATA ==========

INSERT INTO students (student_id, name, email) VALUES
  (1, 'Amina Wanjiru', 'amina@example.com'),
  (2, 'Brian Otieno',  'brian@example.com'),
  (3, 'Cynthia Mutua', 'cynthia@example.com'),
  (4, 'David Kiptoo',  'david@example.com');

INSERT INTO courses (course_id, title, credits) VALUES
  (1, 'Web Development', 4),
  (2, 'Databases',       3),
  (3, 'Mathematics',     3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 'A'),
  (1, 2, 'B'),
  (2, 1, 'B'),
  (2, 3, 'C'),
  (3, 2, 'A');

-- ========== 3. QUERIES ==========

-- Query 1: all courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON students.student_id = enrolments.student_id
JOIN courses    ON enrolments.course_id = courses.course_id
WHERE students.name = 'Amina Wanjiru';

-- Query 2: all students on one course
SELECT students.name, students.email, enrolments.grade
FROM courses
JOIN enrolments ON courses.course_id = enrolments.course_id
JOIN students   ON enrolments.student_id = students.student_id
WHERE courses.title = 'Databases';

-- Query 3: number of students per course
SELECT courses.title, COUNT(enrolments.enrolment_id) AS number_of_students
FROM courses
LEFT JOIN enrolments ON courses.course_id = enrolments.course_id
GROUP BY courses.course_id, courses.title;

-- Query 4: students who have no enrolments
SELECT students.name, students.email
FROM students
LEFT JOIN enrolments ON students.student_id = enrolments.student_id
WHERE enrolments.enrolment_id IS NULL;

-- Query 5: update one enrolment's grade (Brian, Web Development: B to A)
UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2 AND course_id = 1;

-- Check the update
SELECT students.name, courses.title, enrolments.grade
FROM enrolments
JOIN students ON enrolments.student_id = students.student_id
JOIN courses  ON enrolments.course_id = courses.course_id
WHERE enrolments.student_id = 2;
