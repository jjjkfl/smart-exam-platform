const mongoose = require('mongoose');
const User = require('../src/models/User');

async function batchUpdate() {
    try {
        // Connect to your database
        await mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db');
        
        console.log('--- Starting Batch Grade Assignment ---');
        
        // Update all students who don't have a classTag yet
        const result = await User.updateMany(
            { role: 'student', $or: [{ classTag: '' }, { classTag: { $exists: false } }] },
            { $set: { classTag: 'Grade 6' } }
        );

        console.log(`✅ Success! Updated ${result.modifiedCount} students to Grade 6.`);
        console.log('They can now see any materials uploaded for Grade 6.');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during batch update:', err);
        process.exit(1);
    }
}

batchUpdate();
