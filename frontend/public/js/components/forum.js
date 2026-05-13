const Forum = {
    currentThreadId: null,

    async init() {
        this.showThreads();
    },

    async loadThreads() {
        const list = document.getElementById('forum-threads-list');
        if (!list) return;
        list.innerHTML = '<p class="p-dim">Loading discussions...</p>';

        try {
            const res = await api.get('/portal/edu/forum/threads');
            const threads = res.data || [];

            if (threads.length === 0) {
                list.innerHTML = '<p class="p-dim">No discussions yet. Be the first to start one!</p>';
                return;
            }

            list.innerHTML = threads.map(t => `
        <div class="forum-thread" onclick="Forum.viewThread('${t._id}')">
          <div class="flex-between">
            <h4 class="h3" style="font-size:16px;">${t.title}</h4>
            <span class="p-dim" style="font-size:11px;">${new Date(t.createdAt).toLocaleDateString()}</span>
          </div>
          <p class="p-dim" style="margin-top:8px;">${t.content.substring(0, 100)}...</p>
          <div style="margin-top:12px; font-size:12px; font-weight:600; color:var(--primary);">
            By ${t.authorId?.name || 'User'}
          </div>
        </div>
      `).join('');
        } catch (err) {
            notifications.error('Failed to load forum threads');
        }
    },

    showThreads() {
        document.getElementById('forum-threads-list').style.display = 'block';
        document.getElementById('forum-thread-detail').style.display = 'none';
        this.loadThreads();
    },

    async viewThread(id) {
        this.currentThreadId = id;
        const list = document.getElementById('forum-threads-list');
        const detail = document.getElementById('forum-thread-detail');
        list.style.display = 'none';
        detail.style.display = 'block';

        try {
            const [threadRes, commentsRes] = await Promise.all([
                api.get(`/portal/edu/forum/threads/${id}`), // Need to implement this endpoint if not there
                api.get(`/portal/edu/forum/threads/${id}/comments`)
            ]);

            const thread = threadRes.data;
            const comments = commentsRes.data || [];

            document.getElementById('thread-header').innerHTML = `
        <h2 class="h2">${thread.title}</h2>
        <div class="p-dim" style="margin: 12px 0;">Posted by ${thread.authorId?.name || 'User'} • ${new Date(thread.createdAt).toLocaleString()}</div>
        <div class="glass-card" style="font-size:15px; line-height:1.6;">${thread.content}</div>
      `;

            this.renderComments(comments);
        } catch (err) {
            notifications.error('Failed to load thread details');
        }
    },

    renderComments(comments) {
        const list = document.getElementById('comments-list');
        if (comments.length === 0) {
            list.innerHTML = '<p class="p-dim">No comments yet.</p>';
            return;
        }
        list.innerHTML = comments.map(c => `
      <div style="margin-bottom:20px; padding-left:16px; border-left:2px solid var(--border);">
        <div style="font-weight:600; font-size:13px;">${c.authorId?.name || 'User'}</div>
        <div style="font-size:14px; margin-top:4px;">${c.content}</div>
        <div class="p-dim" style="font-size:11px; margin-top:4px;">${new Date(c.createdAt).toLocaleString()}</div>
      </div>
    `).join('');
    },

    async submitComment() {
        const input = document.getElementById('comment-input');
        const content = input.value.trim();
        if (!content) return;

        try {
            const res = await api.post('/portal/edu/forum/comments', {
                threadId: this.currentThreadId,
                content
            });
            if (res.success) {
                input.value = '';
                notifications.success('Comment posted');
                this.viewThread(this.currentThreadId);
            }
        } catch (err) {
            notifications.error('Failed to post comment');
        }
    },

    showCreateThread() {
        // Implement modal for creating thread
        Modal.show('create-thread', `
      <div class="form-group">
        <label>Topic Title</label>
        <input type="text" id="new-thread-title" class="form-control" placeholder="e.g., Doubts regarding Cardiology MCQ">
      </div>
      <div class="form-group">
        <label>Content</label>
        <textarea id="new-thread-content" class="form-control" rows="5" placeholder="Describe your doubt or insight..."></textarea>
      </div>
      <button onclick="Forum.submitThread()" class="btn btn-primary" style="width:100%;">Publish Thread</button>
    `, { title: 'Start New Discussion' });
    },

    async submitThread() {
        const title = document.getElementById('new-thread-title').value.trim();
        const content = document.getElementById('new-thread-content').value.trim();
        if (!title || !content) return;

        try {
            const res = await api.post('/portal/edu/forum/threads', { title, content });
            if (res.success) {
                Modal.close();
                notifications.success('Discussion thread created');
                this.showThreads();
            }
        } catch (err) {
            notifications.error('Failed to create thread');
        }
    }
};
