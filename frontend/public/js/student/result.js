/**
 * js/student/result.js
 * Result display and Blockchain verification UI
 */

const ResultDetail = {
  resultId: null,

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.resultId = params.get('resultId');

    if (!this.resultId) {
      window.location.href = '/index.html';
      return;
    }

    Navbar.render('nav-container');
    await this.loadResult();
  },

  async loadResult() {
    Loader.show('result-content');
    try {
      const { data } = await api.get(`/portal/student/results/${this.resultId}`);
      this.render(data);
    } catch (err) {
      notifications.error('Failed to load result');
    }
  },

  render(result) {
    const container = document.getElementById('result-content');

    container.innerHTML = `
      <div class="animate-fade-in" style="text-align: center; max-width: 700px; margin: 0 auto;">
        <h1 class="h1" style="margin-bottom: 8px;">Exam Completed</h1>
        <p class="p-dim" style="margin-bottom: 48px;">${result.session.title}</p>

        <div class="glass-card" style="margin-bottom: 40px; padding: 48px;">
          <div class="result-score">${result.percentage}%</div>
          <p style="font-size: 18px; margin: 16px 0;">Grade: <span class="grade-badge ${result.isPassed ? 'grade-a' : 'grade-f'}">${result.grade}</span></p>
          <div class="flex-center" style="gap: 40px; margin-top: 32px; border-top: 1px solid var(--border); padding-top: 32px;">
            <div>
              <div class="p-dim">Score</div>
              <div style="font-size: 20px; font-weight: 600;">${result.marksObtained}/${result.totalMarks}</div>
            </div>
            <div>
              <div class="p-dim">Correct</div>
              <div style="font-size: 20px; font-weight: 600;">${result.correctCount}/${result.totalQuestions}</div>
            </div>
            <div>
              <div class="p-dim">Time</div>
              <div style="font-size: 20px; font-weight: 600;">${utils.formatTime(result.timeTaken)}</div>
            </div>
          </div>
        </div>

        ${result.resultHash ? `
          <div class="glass-card" style="margin-bottom: 24px; padding: 24px; text-align: left; border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary);">🛡️ Security Audit</h3>
              <span class="badge" style="background: rgba(52, 199, 89, 0.1); color: var(--success); font-size: 11px;">Validated</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
              <div style="background: var(--bg); padding: 12px; border-radius: 8px;">
                <div class="p-dim" style="font-size: 11px;">Proctoring Integrity</div>
                <div style="font-weight: 600; color: ${result.violationCount > 3 ? 'var(--danger)' : result.violationCount > 0 ? 'var(--warning)' : 'var(--success)'}">
                  ${result.violationCount === 0 ? 'Perfect (0 Violations)' : `${result.violationCount} Violations Recorded`}
                </div>
              </div>
              <div style="background: var(--bg); padding: 12px; border-radius: 8px;">
                <div class="p-dim" style="font-size: 11px;">EVM Anchor</div>
                <div style="font-family: monospace; font-size: 12px;">${result.blockchainTx ? result.blockchainTx.substring(0, 14) + '...' : 'Sealing...'}</div>
              </div>
            </div>

            <div class="blockchain-seal" onclick="ResultDetail.verifyOnChain('${result.resultHash}')" style="cursor:pointer; margin:0; width:100%; justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Verify Integrity Chain on Blockchain</span>
            </div>
          </div>
        ` : ''}

        <div style="margin-top: 48px; text-align: left;">
          <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 24px;">Question Breakdown</h3>
          <div class="result-breakdown" style="display: flex; flex-direction: column; gap: 24px;">
            ${(result.answers || []).map((ans, idx) => `
              <div class="glass-card" style="padding: 24px; border-left: 4px solid ${ans.isCorrect ? 'var(--success)' : 'var(--danger)'};">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                  <span style="font-weight: 600;">Question ${idx + 1}</span>
                  <span style="color: ${ans.isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                    ${ans.isCorrect ? '+1 Mark' : '0 Marks'}
                  </span>
                </div>
                <div style="font-size: 16px; margin-bottom: 16px; color: var(--text);">
                  ${ans.questionText || 'See Image'}
                </div>
                ${ans.image ? `<img src="${window.SERVER_URL}${ans.image}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 16px;" />` : ''}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 14px;">
                  <div style="background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.1);">
                    <div style="color: var(--danger); font-size: 12px; font-weight: 600; margin-bottom: 4px;">YOUR ANSWER</div>
                    <div>${ans.selectedAnswer ? (Array.isArray(ans.selectedAnswer) ? ans.selectedAnswer.join(', ') : ans.selectedAnswer) : 'Not Answered'}</div>
                  </div>
                  <div style="background: rgba(16, 185, 129, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.1);">
                    <div style="color: var(--success); font-size: 12px; font-weight: 600; margin-bottom: 4px;">CORRECT ANSWER</div>
                    <div>${ans.correctAnswer || 'N/A'}</div>
                  </div>
                </div>

                ${ans.explanation ? `
                  <div style="background: var(--bg); padding: 16px; border-radius: 8px; font-size: 14px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--primary);">Explanation</div>
                    <div style="color: var(--text-dim); line-height: 1.5;">${ans.explanation}</div>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-top: 48px; text-align: center;">
          <a href="/index.html" class="btn btn-outline">Back to Dashboard</a>
          ${result.isPassed ? `<button onclick="Certificate.generate('${this.resultId}')" class="btn btn-primary" style="margin-left: 12px;">Download Certificate</button>` : ''}
        </div>
      </div>
    `;
  },

  async verifyOnChain(hash) {
    Modal.show('verify', `
      <div style="text-align: center">
        <div class="spinner" style="margin: 0 auto 20px;"></div>
        <p>Querying Ethereum Smart Contract...</p>
      </div>
    `, { title: 'Verifying Integrity' });

    try {
      const { data } = await api.post('/portal/blockchain/verify', { resultHash: hash });

      Modal.show('verify', `
        <div style="text-align: left">
          <div style="background: rgba(52, 199, 89, 0.1); color: var(--success); padding: 16px; border-radius: 12px; margin-bottom: 24px; display:flex; align-items:center; gap:12px;">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
             <div>
               <div style="font-weight: 600;">Hash Verified!</div>
               <div style="font-size: 12px;">Data matches blockchain record exactly.</div>
             </div>
          </div>
          <div class="p-dim" style="font-size: 12px; margin-bottom: 4px;">Sealed On</div>
          <div style="margin-bottom: 16px;">${new Date(data.timestamp).toLocaleString()}</div>
          <div class="p-dim" style="font-size: 12px; margin-bottom: 4px;">Smart Contract</div>
          <div style="word-break: break-all; font-family: monospace; font-size: 12px;">${data.sealer}</div>
        </div>
      `, { title: 'Blockchain Verification', footer: '<button onclick="Modal.close()" class="btn btn-primary">Done</button>' });
    } catch (err) {
      Modal.show('verify', `<p class="error">${err.message}</p>`, { title: 'Verification Failed' });
    }
  }
};

window.ResultDetail = ResultDetail;
