# School Database Design

## Tables

### students
Stores one row for each student.
- `student_id`: the primary key, a unique number for each student.
- `name`: the student's full name (NOT NULL).
- `email`: the student's email (NOT NULL and UNIQUE, so two students cannot share one).

### courses
Stores one row for each course.
- `course_id`: the primary key.
- `title`: the name of the course (NOT NULL).
- `credits`: how many credits the course is worth (NOT NULL).

### enrolments
Stores one row for each student on each course. It is the join table.
- `enrolment_id`: the primary key.
- `student_id`: a foreign key to `students` (NOT NULL).
- `course_id`: a foreign key to `courses` (NOT NULL).
- `grade`: the student's grade. It can be empty because a grade is not known when the student first enrols.
- A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice.

## Relationships

- **One student to many enrolments** (one-to-many): one student can have many enrolment rows.
- **One course to many enrolments** (one-to-many): one course can have many enrolment rows.
- **Students to courses** (many-to-many): a student can take many courses, and a course can have many students.

A many-to-many relationship needs a join table because a single column cannot hold a list of values. Putting a list of course ids inside the students table would break the rules of good design and make searching hard. The `enrolments` table solves this by holding one row for each pair of student and course. It is also the right place for the grade, because a grade belongs to a student on a course, not to the student alone or the course alone.

## Index

I would add an index on `enrolments(course_id)`:

`CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);`

The UNIQUE rule on `(student_id, course_id)` already helps searches by student. But searches such as "all students on one course" and "number of students per course" start from the course, so they would be slow on a big table without an index on `course_id`. The index lets the database find those rows quickly instead of reading every row.

## SQL or NoSQL?

I would choose SQL for this system. School data is highly structured and connected: students, courses and enrolments always have the same fields and clear relationships. SQL can enforce these rules for me, such as unique emails, foreign keys that stop an enrolment pointing to a student who does not exist, and a rule that blocks duplicate enrolments. SQL also makes questions like "which students have no enrolments" or "how many students are on each course" easy to answer with JOIN and GROUP BY, and its transactions keep grades and enrolments correct when many users update them at the same time. NoSQL would be a better choice if the data had no fixed shape or had to scale across many servers, but a school database does not need that.
