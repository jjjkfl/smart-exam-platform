require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Course = require('./src/models/Course');
const Session = require('./src/models/Session');
const Result = require('./src/models/Result');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    // Clear existing
    await User.deleteMany({});
    await Course.deleteMany({});
    await Session.deleteMany({});
    await Result.deleteMany({});

    // Create 2 Teachers and Courses
    const courses = [];
    for (let i = 1; i <= 2; i++) {
      const teacher = await User.create({
        name: `Teacher ${i}`,
        email: `teacher${i}@exam.com`,
        password: 'password123',
        role: 'teacher',
        courseIds: []
      });

      const course = await Course.create({
        courseName: `Medical Course ${i}`,
        teacherIds: [teacher._id]
      });

      // Update teacher with courseIds
      teacher.courseIds.push(course._id);
      await teacher.save();
      courses.push(course);
    }

    // Subjects for each course
    const courseSubjects = {
      1: ['Anatomy', 'Physiology', 'Biochemistry'],
      2: ['Pathology', 'Pharmacology', 'Microbiology']
    };

    // Create 4 Sessions for each Course with different subjects
    const sessions = [];
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const subjects = courseSubjects[i + 1];
      
      for (let j = 0; j < 4; j++) {
        const subject = subjects[j % subjects.length];
        const session = await Session.create({
          courseId: course._id,
          division: 'A',
          title: `${subject} Midterm Exam`,
          subject: subject,
          status: 'active',
          questions: [
            {
              questionText: `What is the primary function in ${subject}?`,
              options: [
                { label: 'A', text: 'Option A' },
                { label: 'B', text: 'Option B' },
                { label: 'C', text: 'Option C' },
                { label: 'D', text: 'Option D' }
              ],
              correctAnswer: 'A',
              marks: 10
            }
          ],
          startTime: new Date(Date.now() - (j * 24 * 60 * 60 * 1000)), // dynamic start times in the past
          duration: 60
        });
        sessions.push(session);
      }
    }

    // Create 15 Students
    const divisions = ['A', 'B', 'C', 'D'];
    const students = [];
    for (let i = 1; i <= 15; i++) {
      const randomCourse = courses[Math.floor(Math.random() * courses.length)];
      // Set most students to division A to match sessions
      const randomDiv = i <= 10 ? 'A' : divisions[Math.floor(Math.random() * divisions.length)];

      const student = await User.create({
        name: `Student ${i}`,
        email: `student${i}@exam.com`,
        password: 'password123',
        role: 'student',
        courseId: randomCourse._id,
        division: randomDiv
      });
      students.push(student);
    }

    // Seed results for students
    // We will generate results for all students in division A for the sessions of their course
    for (const student of students) {
      const studentSessions = sessions.filter(s => String(s.courseId) === String(student.courseId));
      
      for (const session of studentSessions) {
        // Not all students take all exams to make it realistic
        if (Math.random() > 0.15) {
          // Generate a realistic score
          // A mix of high, average and low scores
          let score = 50 + Math.floor(Math.random() * 46); // 50 to 95
          if (Math.random() > 0.9) score = 30 + Math.floor(Math.random() * 20); // 30 to 50
          
          await Result.create({
            studentId: student._id,
            courseId: student.courseId,
            sessionId: session._id,
            score: score,
            timeTaken: 15 + Math.floor(Math.random() * 25),
            answers: [
              {
                questionText: session.questions[0].questionText,
                options: session.questions[0].options,
                selectedAnswer: score >= 50 ? 'A' : 'B',
                correctAnswer: 'A',
                isCorrect: score >= 50
              }
            ]
          });
        }
      }
    }

    console.log('✅ Seeded 2 Teachers, 2 Courses, 8 Sessions, 15 Students, and Results.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
