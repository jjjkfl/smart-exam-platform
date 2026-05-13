const mongoose = require('mongoose');

const forumCommentSchema = new mongoose.Schema({
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumThread', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumComment' } // For nested replies
}, { timestamps: true });

module.exports = mongoose.model('ForumComment', forumCommentSchema);
