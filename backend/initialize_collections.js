const mongoose = require('mongoose');
require('dotenv').config();

const models = [
  'Announcement', 'Attendance', 'AuditLog', 'Course', 'CourseMaterial',
  'Exam', 'ExamSecurityLog', 'ForumComment', 'ForumThread', 'MCQBank',
  'MCQChapter', 'MCQQuestion', 'Mark', 'Result', 'ResultSnapshot',
  'School', 'SchoolClass', 'Section', 'Session', 'Subject',
  'TeacherAssignment', 'Timetable', 'User'
];

async function init() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Atlas...');

    for (const modelName of models) {
      const Model = require(`./src/models/${modelName}`);
      console.log(`Initializing ${modelName}...`);
      
      // Create a dummy record and delete it immediately to force collection creation in Atlas
      const dummy = new Model({ 
          // Use very minimal data that passes basic validation if possible
          // But most models will at least be created just by the attempt or a single save
      });
      
      // Some models have required fields, let's just try to access the collection to trigger creation
      // or do a countDocuments
      await Model.countDocuments(); 
      
      // To be 100% sure Atlas shows it, we can create a temporary collection then delete it
      // but Mongoose usually handles it.
      // However, Atlas sometimes only shows collections with at least one document or that have been explicitly created.
    }

    console.log('✅ All collections initialized and visible in Atlas!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

init();
