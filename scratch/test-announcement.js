const mongoose = require('mongoose');
const Announcement = require('../backend/src/models/Announcement');

// Connect to local MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db')
    .then(async () => {
        console.log('Connected to DB');
        try {
            await Announcement.create({
                title: 'Test Title',
                content: 'Test Content',
                courseId: undefined,
                authorId: null
            });
        } catch (err) {
            console.log('Error caught:');
            console.log(err.message);
            console.log(err.name);
        } finally {
            mongoose.disconnect();
        }
    });
