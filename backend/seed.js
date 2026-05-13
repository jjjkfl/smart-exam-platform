require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Course = require('./src/models/Course');
const Session = require('./src/models/Session');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    // Clear existing
    await User.deleteMany({});
    await Course.deleteMany({});

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
        courseName: `Course ${i}`,
        teacherIds: [teacher._id]
      });

      // Update teacher with courseIds
      teacher.courseIds.push(course._id);
      await teacher.save();
      courses.push(course);
    }

    // Create a Session for each Course
    for (const course of courses) {
      await Session.create({
        courseId: course._id,
        division: 'A',
        title: `Live Exam: ${course.courseName}`,
        status: 'active',
        questions: [
          {
            questionText: 'What is the primary function of the cardiovascular system?',
            options: [
              { label: 'A', text: 'Transport nutrients and oxygen' },
              { label: 'B', text: 'Regulate body temperature' },
              { label: 'C', text: 'Digestion of food' },
              { label: 'D', text: 'Filter blood' }
            ],
            correctAnswer: 'A',
            marks: 1
          }
        ],
        startTime: new Date(),
        duration: 60
      });
    }

    // Create 15 Students
    const divisions = ['A', 'B', 'C', 'D'];
    for (let i = 1; i <= 15; i++) {
      const randomCourse = courses[Math.floor(Math.random() * courses.length)];
      const randomDiv = divisions[Math.floor(Math.random() * divisions.length)];

      await User.create({
        name: `Student ${i}`,
        email: `student${i}@exam.com`,
        password: 'password123',
        role: 'student',
        courseId: randomCourse._id,
        division: randomDiv
      });
    }

    console.log('✅ Seeded 2 Teachers, 2 Courses, and 15 Students.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
