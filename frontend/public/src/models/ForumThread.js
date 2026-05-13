const mongoose = require('mongoose');

const forumThreadSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPinned: { type: Boolean, default: false },
    tags: [String]
}, { timestamps: true });

module.exports = mongoose.model('ForumThread', forumThreadSchema);
