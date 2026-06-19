/**
 * js/teacher/upload.js
 * DOCX Upload + MCQ Preview Controller
 * Handles file upload, shows extraction progress, displays parsed MCQs with images.
 */

const PDFUpload = {
  selectedFile: null,

  handleUpload(event) {
    const file = event.target.files[0];
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!file || !allowed.includes(file.type)) {
      notifications.error('Please select a valid PDF or Word (.docx) file.');
      return;
    }

    PDFUpload.selectedFile = file;

    const isDocx = file.name.toLowerCase().endsWith('.docx');

    Modal.show('upload-details', `
      <div class="upload-form-container">
        <div class="file-preview-badge">
          <span class="file-icon">${isDocx ? '📄' : '📕'}</span>
          <div>
            <strong>${file.name}</strong>
            <span class="p-dim" style="font-size: 12px; display: block;">${(file.size / 1024).toFixed(1)} KB · ${isDocx ? 'Word Document' : 'PDF'}</span>
          </div>
        </div>
        <form id="upload-form" onsubmit="PDFUpload.process(event)" style="margin-top: 20px;">
          <div class="form-group">
            <label>Bank Title</label>
            <input type="text" name="title" class="form-control" placeholder="e.g. Chapter 1: Anatomy Basics" required>
          </div>
          <div class="form-group">
            <label>Subject</label>
            <input type="text" name="subject" class="form-control" placeholder="e.g. General Surgery" required>
          </div>
          <div class="form-group">
            <label>Educational Board</label>
            <select name="board" class="form-control" required>
              <option value="All">All Boards (Global)</option>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="State">State Board</option>
              <option value="TestStream">TestStream (Mock)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Number of Questions to Extract</label>
            <input type="number" name="numQuestions" class="form-control" value="20" min="1" max="500">
            ${isDocx ? '<p class="p-dim" style="font-size: 11px; margin-top: 4px;">✨ DOCX: Images and answers are extracted directly. Set to a large number (e.g. 200) to get all questions.</p>' : ''}
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
            ${isDocx ? '📋 Extract Questions from DOCX' : '🤖 Start Extraction'}
          </button>
        </form>
      </div>
    `, { title: '📤 Upload Document' });

    // Reset file input so the same file can be re-selected
    event.target.value = '';
  },

  async process(event, isReextract = false) {
    if (event) event.preventDefault();
    
    // Immediately show the new pleasant loader
    Modal.show('processing', `
      <div class="loader-container">
        <div class="loader-animation">
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__ball"></div>
        </div>
        <h3 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px;letter-spacing:-0.02em;">
          AI Extraction in Progress
        </h3>
        <p id="study-loader-msg" style="font-size:14px; color:#64748b; min-height:20px; margin-bottom:24px; transition: opacity 0.4s ease;">
          Preparing the question detector... 🔬
        </p>
        <div style="width:100%;height:8px;background:#f1f5f9;border-radius:100px;overflow:hidden;">
          <div id="upload-progress" style="height:100%; width:0%; border-radius:100px; background: var(--primary); transition: width 0.4s ease;"></div>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin-top:12px;">
          Parsing document nodes & extracting medical assets...
        </p>
      </div>
    `, { title: '📖 AI Extraction Hall', width: '450px' });

    try {
      const finalData = new FormData();

      if (isReextract) {
        if (!PDFUpload.selectedFile) {
          throw new Error('No document file is cached. Please select the file again.');
        }
        if (!PDFUpload.lastFormData) {
          PDFUpload.lastFormData = {
            title: 'Re-extracted MCQ Bank',
            subject: 'General',
            board: 'All',
            numQuestions: 20
          };
        }
        finalData.append('pdf', PDFUpload.selectedFile);
        finalData.append('title', PDFUpload.lastFormData.title);
        finalData.append('subject', PDFUpload.lastFormData.subject);
        finalData.append('board', PDFUpload.lastFormData.board);
        if (PDFUpload.lastFormData.numQuestions) {
          finalData.append('numQuestions', PDFUpload.lastFormData.numQuestions);
        }
      } else {
        const form = event.target;
        const formData = new FormData(form);
        PDFUpload.lastFormData = {
          title: formData.get('title'),
          subject: formData.get('subject'),
          board: formData.get('board'),
          numQuestions: formData.get('numQuestions')
        };

        finalData.append('pdf', PDFUpload.selectedFile);
        finalData.append('title', PDFUpload.lastFormData.title);
        finalData.append('subject', PDFUpload.lastFormData.subject);
        finalData.append('board', PDFUpload.lastFormData.board);
        if (PDFUpload.lastFormData.numQuestions) {
          finalData.append('numQuestions', PDFUpload.lastFormData.numQuestions);
        }
      }

      // Cycle witty study messages
      const msgs = [
        'Reading every paragraph carefully 🧐',
        'Hunting for medical answer keys... 🗝️',
        'Extracting diagrams & surgical options 🖼️',
        'Almost done, keep calm & study on 📐',
        'Parsing multiple choice delights ✨',
        'Cross-referencing clinical content 📋',
        'Making questions exam-ready 🎯',
      ];
      let msgIdx = 0;
      const msgEl = document.getElementById('study-loader-msg');
      const msgInterval = setInterval(() => {
        if (!msgEl || !document.getElementById('study-loader-msg')) { clearInterval(msgInterval); return; }
        msgEl.style.opacity = '0';
        setTimeout(() => {
          msgIdx = (msgIdx + 1) % msgs.length;
          msgEl.textContent = msgs[msgIdx];
          msgEl.style.opacity = '1';
        }, 400);
      }, 2200);
      window._studyLoaderMsgInterval = msgInterval;

      // Animate progress bar
      PDFUpload._animateProgress();

      const result = await api.upload('/portal/teacher/mcq-banks/upload', finalData);
      clearInterval(window._studyLoaderMsgInterval);

      if (result.success) {
        notifications.success(`✅ Extracted ${result.data.questionCount} questions!`);
        PDFUpload._showPreview(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('Extraction Error:', err);
      clearInterval(window._studyLoaderMsgInterval);
      Modal.close();
      notifications.error(`Extraction failed: ${err.message || 'Server error'}`);
    }
  },

  /**
   * Show extracted MCQ preview with images
   */
  _showPreview(data) {
    PDFUpload.lastBankId = data._id;
    const questions = data.questions || [];
    const meta = data.meta || {};

    let questionsHtml = questions.map((q, i) => `
      <div class="preview-question extraction-question-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <span style="
            background: var(--primary-soft); 
            color: var(--primary); 
            padding: 6px 16px; 
            border-radius: 10px; 
            font-size: 13px; 
            font-weight: 800;
            letter-spacing: 0.03em;
            text-transform: uppercase;
          ">QUESTION ${i + 1}</span>
          ${q.correctAnswer ? `
            <span style="
              background: var(--success-soft); 
              color: var(--success); 
              padding: 6px 16px; 
              border-radius: 10px; 
              font-size: 13px; 
              font-weight: 700;
            ">Correct Key: ${q.correctAnswer}</span>
          ` : ''}
        </div>

        <h3 style="
          font-size: 18px; 
          line-height: 1.6; 
          color: #1e293b; 
          margin-bottom: 24px; 
          font-weight: 600;
          letter-spacing: -0.01em;
        ">${PDFUpload._escapeHtml(q.questionText)}</h3>

        ${q.image ? `
          <div style="margin-bottom: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #f1f5f9;">
            <img src="${window.SERVER_URL}${q.image}" alt="Question ${i + 1} Image" style="width: 100%; display: block;" 
                 onerror="this.src='/img/placeholder.png'; this.style.opacity='0.5';">
          </div>` : ''}

        <div class="extraction-options-grid">
          ${(q.options || []).map(opt => `
            <div style="
              display: flex; 
              align-items: flex-start; 
              gap: 16px; 
              padding: 18px; 
              background: ${q.correctAnswer && q.correctAnswer.includes(opt.label) ? 'var(--success-soft)' : '#f8fafc'}; 
              border: 1px solid ${q.correctAnswer && q.correctAnswer.includes(opt.label) ? 'rgba(16, 185, 129, 0.3)' : '#f1f5f9'}; 
              border-radius: 14px;
              min-height: 64px;
              transition: transform 0.2s ease;
            ">
              <span style="
                width: 32px; 
                height: 32px; 
                background: ${q.correctAnswer && q.correctAnswer.includes(opt.label) ? 'var(--success)' : '#fff'}; 
                color: ${q.correctAnswer && q.correctAnswer.includes(opt.label) ? '#fff' : '#64748b'}; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                border-radius: 10px; 
                font-weight: 800; 
                font-size: 14px; 
                flex-shrink: 0;
                box-shadow: 0 2px 6px rgba(0,0,0,0.06);
              ">${opt.label}</span>
              <div style="flex: 1;">
                <div style="font-size: 15px; font-weight: 500; color: ${q.correctAnswer && q.correctAnswer.includes(opt.label) ? '#065f46' : '#334155'}; line-height: 1.5; word-break: break-word;">
                  ${PDFUpload._escapeHtml(opt.text)}
                </div>
                ${opt.image ? `
                  <div style="margin-top: 8px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05);">
                    <img src="${window.SERVER_URL}${opt.image}" style="max-width: 100%; height: auto; cursor: zoom-in;" 
                         onclick="window.open('${window.SERVER_URL}${opt.image}', '_blank')">
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        ${q.explanation ? `
          <div style="
            margin-top: 24px; 
            padding: 18px; 
            background: #f0f7ff; 
            border: 1px dashed #bfdbfe; 
            border-radius: 14px;
          ">
            <div style="color: #1e40af; font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>💡 Explanation / Rationale</span>
            </div>
            <div style="font-size: 14px; color: #1e3a8a; line-height: 1.6;">
              ${PDFUpload._escapeHtml(q.explanation)}
            </div>
          </div>
        ` : ''}
      </div>
    `).join('');

    Modal.show('mcq-preview', `
      <div class="preview-container">
        <style>
          .extraction-meta-card {
            background: #fff; 
            border-radius: 24px; 
            padding: 32px; 
            margin-bottom: 32px; 
            border: 1px solid #eef2f6;
            box-shadow: 0 10px 30px -5px rgba(0,0,0,0.06);
          }
          .extraction-meta-grid {
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 24px; 
            text-align: center; 
            align-items: center;
          }
          .extraction-question-card {
            background: #fff; 
            border: 1px solid #eef2f6; 
            border-radius: 20px; 
            margin-bottom: 24px; 
            padding: 32px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.03);
            transition: all 0.3s ease;
          }
          .extraction-options-grid {
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 16px;
          }
          .extraction-actions-row {
            display: flex; 
            gap: 16px; 
            margin-top: 24px;
          }
          .extraction-scroll-wrapper {
            max-height: 60vh; 
            overflow-y: auto; 
            padding: 4px 16px 4px 4px; 
            margin-right: -16px;
          }

          @media (max-width: 768px) {
            .extraction-meta-card {
              padding: 16px;
              margin-bottom: 20px;
              border-radius: 16px;
            }
            .extraction-meta-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }
            .extraction-meta-grid > div {
              border-right: none !important;
              border-bottom: 2px solid #f1f5f9;
              padding-bottom: 16px;
            }
            .extraction-meta-grid > div:last-child {
              border-bottom: none !important;
              padding-bottom: 0;
              padding-top: 8px;
            }
            .extraction-question-card {
              padding: 20px 16px;
              border-radius: 16px;
              margin-bottom: 16px;
            }
            .extraction-options-grid {
              grid-template-columns: 1fr;
              gap: 12px;
            }
            .extraction-actions-row {
              flex-direction: column;
              gap: 12px;
            }
            .extraction-scroll-wrapper {
              padding: 4px;
              margin-right: 0;
            }
          }
        </style>
        <div class="extraction-meta-card">
          <div class="extraction-meta-grid">
            <div style="border-right: 2px solid #f1f5f9;">
              <div style="font-size: 42px; font-weight: 800; color: var(--primary); letter-spacing: -0.03em; line-height: 1;">${questions.length}</div>
              <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 8px;">Questions Extracted</div>
            </div>
            <div style="border-right: 2px solid #f1f5f9;">
              <div style="font-size: 42px; font-weight: 800; color: var(--success); letter-spacing: -0.03em; line-height: 1;">
                ${questions.filter(q => q.image).length}
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 8px;">Images Found</div>
            </div>
            <div style="padding: 0 12px;">
              <div style="
                font-size: 14px; 
                font-weight: 800; 
                color: var(--accent); 
                background: var(--warning-soft);
                padding: 8px 16px;
                border-radius: 12px;
                display: inline-block;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              ">
                ${(meta.model || 'parser').replace('-engine', '').toUpperCase()}
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 10px;">Extraction Engine</div>
            </div>
          </div>
        </div>
        <div class="extraction-scroll-wrapper preview-scroll-custom">
          ${questionsHtml}
        </div>
        <div class="extraction-actions-row">
          <button onclick="PDFUpload.reextract()" 
                  class="btn btn-secondary" style="flex: 1; height: 56px; font-size: 16px; font-weight: 700; border-radius: 16px; background: rgba(37, 99, 235, 0.08); color: var(--secondary-blue); border: 1px solid rgba(37, 99, 235, 0.15); margin-top: 0;">
            🔄 Re-extract Document
          </button>
          <button onclick="Modal.close(); if(typeof TeacherDashboard !== 'undefined') TeacherDashboard.loadMCQBanks();" 
                  class="btn btn-primary" style="flex: 1.5; height: 56px; font-size: 16px; font-weight: 700; border-radius: 16px; margin-top: 0;">
            ✅ Done — Return to Dashboard
          </button>
        </div>
      </div>
    `, { 
      title: `📋 ${data.title} — Extraction Results`,
      width: '850px' 
    });
  },

  async reextract() {
    console.log('Reextract triggered. lastBankId:', PDFUpload.lastBankId);
    if (PDFUpload.lastBankId) {
      try {
        await api.delete(`/portal/teacher/mcq-banks/${PDFUpload.lastBankId}`);
        console.log('Previous MCQ bank deleted successfully');
      } catch (e) {
        console.warn('Failed to delete previous MCQ bank during re-extraction:', e);
      }
    }
    await PDFUpload.process(null, true);
  },

  /**
   * Animate progress bar during upload
   */
  _animateProgress() {
    let progress = 0;
    const bar = document.getElementById('upload-progress');
    if (!bar) return;

    if (PDFUpload._progressInterval) {
      clearInterval(PDFUpload._progressInterval);
    }

    const interval = setInterval(() => {
      progress += Math.random() * 8;
      if (progress > 90) progress = 90;
      bar.style.width = progress + '%';
    }, 300);

    // Store interval for cleanup
    PDFUpload._progressInterval = interval;
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.PDFUpload = PDFUpload;
