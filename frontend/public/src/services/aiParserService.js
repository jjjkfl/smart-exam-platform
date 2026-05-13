/*
 * src/services/aiParserService.js  — v4.0 "Iron Extraction"
 *
 * Pipeline:
 *  DOCX  →  mammoth (HTML + embedded images)  →  struct parser  →  Claude Vision fallback
 *  PDF   →  pdfimages (poppler) + pdf-parse   →  regex parser   →  Claude Vision fallback
 *
 * Claude Vision is used whenever an image is detected near a question.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, execFileSync } = require('child_process');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/* ─── Anthropic client (lazy) ───────────────────────────────────── */
let _anthropic = null;
const getAnthropic = () => {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is not set');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
};

/* ─── Upload directory ──────────────────────────────────────────── */
const UPLOAD_DIR = path.join(__dirname, '../../uploads/extracted');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ─── Temp directory (PDF image dumps) ─────────────────────────── */
const TMP_DIR = path.join(__dirname, '../../uploads/tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

/* ══════════════════════════════════════════════════════════════════
   SECTION 1  —  UTILITY
══════════════════════════════════════════════════════════════════ */

const uid = () => crypto.randomBytes(8).toString('hex');
const extFor = (mime) => ({
  'image/png': '.png', 'image/jpeg': '.jpg',
  'image/jpg': '.jpg', 'image/gif': '.gif',
  'image/bmp': '.bmp', 'image/webp': '.webp',
  'image/svg+xml': '.svg', 'image/tiff': '.tiff'
}[mime] || '.png');

const decodeHtmlEntities = (s = '') =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

const extractImgSrc = (html) => {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
};

/** Read a local file and return base64 */
const toBase64 = (filePath) => fs.readFileSync(filePath).toString('base64');

/** MIME from extension */
const mimeFromExt = (ext) => ({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
}[ext.toLowerCase()] || 'image/png');

/* ══════════════════════════════════════════════════════════════════
   SECTION 2  —  DOCX  IMAGE EXTRACTION
══════════════════════════════════════════════════════════════════ */

/**
 * Convert DOCX → HTML, saving every embedded image to UPLOAD_DIR.
 * Returns { html, imageList: [{filename, publicPath, index}] }
 * The `index` is the sequential order the image appeared in the document.
 */
const convertDocxToHtml = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const imageList = [];        // ordered list of extracted images
  let imgIndex = 0;

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const imgBuffer = await image.read();
          const ext = extFor(image.contentType);
          const filename = `docx-img-${uid()}${ext}`;
          const savePath = path.join(UPLOAD_DIR, filename);
          fs.writeFileSync(savePath, imgBuffer);

          const publicPath = `/uploads/extracted/${filename}`;
          imageList.push({ filename, publicPath, index: imgIndex++ });

          logger.info(`[DOCX] Extracted image #${imgIndex}: ${filename} (${image.contentType})`);
          return { src: publicPath, 'data-img-index': String(imgIndex - 1) };
        } catch (err) {
          logger.warn(`[DOCX] Image extraction failed: ${err.message}`);
          return { src: '' };
        }
      }),
    }
  );

  return { html: result.value, imageList };
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 3  —  PDF  IMAGE EXTRACTION  (via poppler pdfimages)
══════════════════════════════════════════════════════════════════ */

/**
 * Attempt to extract embedded images from a PDF using `pdfimages` (poppler-utils).
 * Falls back gracefully if poppler is not installed.
 *
 * Returns an array of { page, publicPath, localPath } objects.
 */
const extractPdfImages = (pdfPath) => {
  const sessionId = uid();
  const dumpDir = path.join(TMP_DIR, `pdf-img-${sessionId}`);
  fs.mkdirSync(dumpDir, { recursive: true });

  try {
    // -all extracts all image types; -png forces png output
    execFileSync('pdfimages', ['-all', '-png', pdfPath, path.join(dumpDir, 'img')],
      { timeout: 60000, stdio: 'pipe' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn('[PDF] pdfimages (poppler-utils) not found. Install with: apt-get install poppler-utils');
    } else {
      logger.warn(`[PDF] pdfimages failed: ${err.message}`);
    }
    return [];
  }

  // Read extracted files and copy to UPLOAD_DIR
  const extracted = [];
  try {
    const files = fs.readdirSync(dumpDir).filter(f => /\.(png|ppm|pbm|jpg|jpeg)$/i.test(f)).sort();
    files.forEach((file, i) => {
      const srcPath = path.join(dumpDir, file);
      const ext = path.extname(file).toLowerCase().replace('.ppm', '.png').replace('.pbm', '.png');
      const destName = `pdf-img-${sessionId}-${String(i).padStart(3, '0')}${ext}`;
      const destPath = path.join(UPLOAD_DIR, destName);
      fs.copyFileSync(srcPath, destPath);

      // Parse page number from pdfimages naming: img-001.png → page approx
      const pageMatch = file.match(/img-(\d+)/);
      extracted.push({
        page: pageMatch ? parseInt(pageMatch[1], 10) : i,
        publicPath: `/uploads/extracted/${destName}`,
        localPath: destPath,
      });
    });
  } finally {
    // Cleanup temp dir
    try { fs.rmSync(dumpDir, { recursive: true, force: true }); } catch (_) { }
  }

  logger.info(`[PDF] Extracted ${extracted.length} images from PDF`);
  return extracted;
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 4  —  CLAUDE VISION  (for image-bearing questions)
══════════════════════════════════════════════════════════════════ */

/**
 * Ask Claude to parse MCQs from a page image or diagram.
 * Used when text parsing yields no question or when an image is present.
 *
 * @param {string[]} imagePaths  — local file paths of images to include
 * @param {string}   contextText — surrounding text as hint
 * @param {number}   targetCount
 */
const claudeVisionExtract = async (imagePaths, contextText = '', targetCount = 10) => {
  const anthropic = getAnthropic();

  // Build multi-image content array
  const contentBlocks = [];

  for (const imgPath of imagePaths.slice(0, 10)) {   // cap at 10 images per call
    if (!fs.existsSync(imgPath)) continue;
    const ext = path.extname(imgPath).toLowerCase();
    const mime = mimeFromExt(ext);
    contentBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: mime, data: toBase64(imgPath) },
    });
  }

  if (contentBlocks.length === 0) return [];

  contentBlocks.push({
    type: 'text',
    text: `${contextText ? `Surrounding document text for context:\n${contextText}\n\n` : ''}
You are an expert MCQ extractor. Analyze the image(s) above and extract every MCQ question you can identify.

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "questionText": "Full question text here (include any equation/formula)",
    "image": "EMBEDDED",
    "options": [
      { "label": "A", "text": "Option A text", "image": "" },
      { "label": "B", "text": "Option B text", "image": "" },
      { "label": "C", "text": "Option C text", "image": "" },
      { "label": "D", "text": "Option D text", "image": "" }
    ],
    "correctAnswer": "B",
    "explanation": "Brief rationale",
    "difficulty": "medium",
    "topic": "inferred topic",
    "marks": 1
  }
]

Rules:
- If a diagram/figure is the question itself, set questionText to a description and "image": "EMBEDDED"
- Extract up to ${targetCount} questions
- If an option contains an image rather than text, set its "text" to "[Image option]" and "image": "EMBEDDED"
- If you cannot determine the correct answer from the image, set correctAnswer to the most likely letter
- Return [] if no MCQs are found in the image`
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return parseJSONSafe(raw);
  } catch (err) {
    logger.error(`[Claude Vision] API error: ${err.message}`);
    return [];
  }
};

/**
 * Ask Claude to extract MCQs from plain text (no vision needed).
 */
const claudeTextExtract = async (text, subject = 'General', targetCount = 20) => {
  const anthropic = getAnthropic();
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are an expert MCQ extractor for the MCQ Pro platform.

Extract exactly ${targetCount} MCQ questions from the text below.

Rules:
1. Each question must have exactly 4 options (A, B, C, D) with ONE correct answer.
2. If the correct answer is not stated, infer it from context.
3. Return ONLY a valid JSON array — no markdown fences, no commentary.

Subject hint: ${subject}

TEXT:
${text.substring(0, 12000)}

JSON format:
[{"questionText":"...","image":"","options":[{"label":"A","text":"...","image":""},...],"correctAnswer":"B","explanation":"...","difficulty":"medium","topic":"...","marks":1}]`
      }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return parseJSONSafe(raw);
  } catch (err) {
    logger.error(`[Claude Text] API error: ${err.message}`);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 5  —  HTML → MCQ  STRUCTURED PARSER  (DOCX mode)
══════════════════════════════════════════════════════════════════ */

const parseHtmlToMCQs = (html, imageList = []) => {
  // Build a lookup: data-img-index → publicPath
  const indexedImages = {};
  imageList.forEach(img => { indexedImages[img.index] = img.publicPath; });

  // Enrich img tags with their index so we can retrieve the path
  const blocks = html
    .split(/<\/p>/)
    .map(b => {
      const imgSrc = extractImgSrc(b);
      const idxMatch = b.match(/data-img-index=["'](\d+)["']/);
      const imgPath = idxMatch ? (indexedImages[parseInt(idxMatch[1])] || imgSrc) : imgSrc;
      return {
        raw: b,
        text: decodeHtmlEntities(b.replace(/<[^>]+>/g, '').trim()),
        imgSrc: imgPath,
      };
    })
    .filter(b => b.text.length > 0 || b.imgSrc);

  if (blocks.length === 0) return [];

  const isAdda247 = blocks.some(b => /^QUESTION\s+(?:NO\.?\s*)?\d+/i.test(b.text));
  return isAdda247
    ? parseAdda247Format(blocks)
    : parseGenericFormat(blocks);
};

/* ─── Adda247 / "QUESTION N" format ───────────────────────────── */
const parseAdda247Format = (blocks) => {
  const questions = [];
  let state = 'idle', currentQ = null, lastOptLabel = null;

  const HEADER_RX = [
    /SECTION\s*-\s*[A-Z]/i, /APTITUDE\s*-TEST/i, /WRITTEN\s*TEST/i,
    /SYLLABUS\s*SECTION/i, /QUESTIONS\s*-\s*\d+MINUTES/i,
    /Analytical\s*Thinking/i, /Mathematical\s*and\s*Critical\s*Thinking/i,
    /Verbal\s*Ability/i, /Direction\s*Test/i, /Cube\s*and\s*Cuboids/i,
  ];

  const save = () => {
    if (currentQ && (currentQ.questionText || currentQ.image)) {
      const isHeader = HEADER_RX.some(r => r.test(currentQ.questionText) && currentQ.questionText.length < 100);
      if (!isHeader) questions.push(finalizeMCQ(currentQ));
    }
    currentQ = null; lastOptLabel = null; state = 'idle';
  };

  for (const { text, imgSrc } of blocks) {
    if (/SECTION\s*-\s*[A-Z]/i.test(text) || /\(\d+\s*QUESTIONS\s*-\d+MINUTES\)/i.test(text)) continue;

    const isNewQ = /^QUESTION\s+(?:NO\.?\s*)?\d+/i.test(text) ||
      /^(?:Q\.?\s*\d+[\.\:\)\-]\s*|\d+[\.\)\:\-]\s*)/i.test(text);
    if (isNewQ) {
      save();
      currentQ = { questionText: '', image: '', options: [], correctAnswer: '' };
      state = 'in_answer';
      const clean = text.replace(/^(?:QUESTION\s+(?:NO\.?\s*)?\d+[\.\:\s]*|Q\.?\s*\d+[\.\:\)\-]\s*|\d+[\.\)\:\-]\s*)/i, '').trim();
      if (clean) { currentQ.questionText = clean; state = 'in_question'; }
      continue;
    }
    if (!currentQ) continue;

    // Correct answer line
    const ansM = text.match(/^Correct\s*:\s*([A-Da-d])/i) || text.match(/(?:Answer|Ans|Correct|Key)\s*[\:\-\s]*([A-Da-d])\b/i);
    if (ansM && !currentQ.correctAnswer) {
      currentQ.correctAnswer = ansM[1].toUpperCase(); state = 'in_question'; continue;
    }

    // Image attachment — IMPROVED: attach to current question
    if (imgSrc) {
      if (!currentQ.image) {
        currentQ.image = imgSrc;
        logger.info(`[Parser] Attached image to question: ${imgSrc}`);
      } else {
        // Secondary image might belong to an option
        if (lastOptLabel) {
          const opt = currentQ.options.find(o => o.label === lastOptLabel);
          if (opt) opt.image = imgSrc;
        }
      }
      if (!text) continue;
    }

    if (/^Question\s+\d+\s+Image$/i.test(text)) continue;

    // Option detection
    const optM = text.match(/^([A-Da-d])[\.\)\:\-\s]\s*(.*)/i) ||
      (text.length === 1 && text.match(/^([A-Da-d])$/i));
    if (optM) {
      const label = optM[1].toUpperCase();
      const optText = (optM[2] || '').trim();
      if (optText) {
        if (!currentQ.options.find(o => o.label === label))
          currentQ.options.push({ label, text: optText, image: imgSrc || '' });
        lastOptLabel = null;
      } else {
        lastOptLabel = label;
      }
      state = 'in_options'; continue;
    }

    if (state === 'in_options' && lastOptLabel) {
      const lbl = lastOptLabel;
      if (!currentQ.options.find(o => o.label === lbl))
        currentQ.options.push({ label: lbl, text: text, image: imgSrc || '' });
      lastOptLabel = null; continue;
    }

    if (state === 'in_question') {
      const isJunk = /^\d[\d\s\.\%\+\-\×\÷\=\?]*Q\d+/.test(text) || /^[\d\:\s\.]{12,}$/.test(text);
      if (!isJunk) {
        const clean = text.replace(/\s*\d*Q\d+[\.\:\)].*/i, '').trim();
        if (clean) currentQ.questionText += (currentQ.questionText ? ' ' : '') + clean;
      }
    }
  }

  save();
  return questions;
};

/* ─── Generic "1." / "Q1." format ─────────────────────────────── */
const parseGenericFormat = (blocks) => {
  const questions = [];
  let currentQ = null, pendingImage = null, lastOptLabel = null;

  const expanded = [];
  for (const block of blocks) {
    const { text, imgSrc } = block;
    const dotMarks = [...text.matchAll(/(?<![a-zA-Z\d])(\d{1,2})[\.]\s+(?=[A-Z])/g)];
    if (dotMarks.length >= 2) {
      const parts = text.split(/(?<=\S)\s+(?=(?<![a-zA-Z\d])\d{1,2}[\.]\s+(?=[A-Z]))/);
      parts.forEach((t, i) => { t = t.trim(); if (t) expanded.push({ text: t, imgSrc: i === 0 ? imgSrc : null }); });
      continue;
    }
    expanded.push(block);
  }

  for (let i = 0; i < expanded.length; i++) {
    const { text, imgSrc } = expanded[i];

    // Image block handling — improved context awareness
    if (imgSrc) {
      if (currentQ) {
        if (!currentQ.image && currentQ.options.length === 0) {
          // Image appears right after question text but before options → question image
          currentQ.image = imgSrc;
          logger.info(`[Parser] Question image attached: ${imgSrc}`);
        } else if (currentQ.options.length > 0 && lastOptLabel) {
          // Image appears after an option label → option image
          const opt = currentQ.options.find(o => o.label === lastOptLabel);
          if (opt) { opt.image = imgSrc; logger.info(`[Parser] Option ${lastOptLabel} image: ${imgSrc}`); }
        } else if (!currentQ.image) {
          currentQ.image = imgSrc;
        }
      } else {
        pendingImage = imgSrc;
      }
      if (!text) continue;
    }

    const qMatch = text.match(/^(?:Q\.?\s*\d+[\.\:\)\-]?\s*|(\d+)[\.\)\:\-]\s*)(.*)/i);

    // Lookahead: is the next non-image block an option? (unnumbered question heuristic)
    let isUnnumbered = false;
    if (!qMatch && text.length > 10 && !/^(?:\(?[A-Da-d][\.\)\:])/i.test(text)) {
      for (let j = 1; j <= 3; j++) {
        if (!expanded[i + j]) break;
        const nt = expanded[i + j].text;
        if (/^(?:\(?[Aa][\.\)\:])/i.test(nt)) { isUnnumbered = true; break; }
        if (expanded[i + j].imgSrc) continue;
        break;
      }
    }

    if (qMatch || isUnnumbered) {
      if (currentQ) questions.push(finalizeMCQ(currentQ));
      let qText = qMatch
        ? (qMatch[2] || '').replace(/^[\d\:\s\.]{4,}(?=[A-Z])/, '').trim()
        : text;

      // Strip inline options from question text
      const inlineRx = /^(.*?)\s+(?:a[\)\.]\s*(.+?))(?:\s+b[\)\.]\s*(.+?))?(?:\s+c[\)\.]\s*(.+?))?(?:\s+d[\)\.]\s*(.+?))?$/is;
      const inlineM = qText.match(inlineRx);
      const extractedOpts = [];
      if (inlineM && inlineM[2] && (inlineM[3] || inlineM[4])) {
        qText = (inlineM[1] || '').trim() || qText;
        ['A', 'B', 'C', 'D'].forEach((l, li) => {
          const t = (inlineM[li + 2] || '').trim();
          if (t) extractedOpts.push({ label: l, text: t, image: '' });
        });
      }

      currentQ = { questionText: qText || '[See image below]', image: imgSrc || pendingImage || '', options: extractedOpts, correctAnswer: '' };
      pendingImage = null; lastOptLabel = null;
      continue;
    }

    if (!currentQ) continue;

    // Single-letter label alone on a line
    if (/^([A-Da-d])$/.test(text)) {
      lastOptLabel = text.toUpperCase(); continue;
    }

    if (lastOptLabel) {
      if (!currentQ.options.find(o => o.label === lastOptLabel))
        currentQ.options.push({ label: lastOptLabel, text: text || `Option ${lastOptLabel}`, image: imgSrc || '' });
      lastOptLabel = null; continue;
    }

    // Inline options  "A. text  B. text"
    const optRx = /(?:\(?([A-Da-d])[\.\)\:\]])\s*([\s\S]*?)(?=\s*(?:\(?[A-Da-d][\.\)\:\]])|$)/g;
    let m, foundOpt = false;
    while ((m = optRx.exec(text)) !== null) {
      const lbl = m[1].toUpperCase();
      const optText = decodeHtmlEntities(m[2].trim()).replace(/\s*Q\.?\d+[\.\:\)\-].*$/i, '').trim();
      if (!currentQ.options.find(o => o.label === lbl)) {
        currentQ.options.push({ label: lbl, text: optText || `Option ${lbl}`, image: imgSrc || '' });
        foundOpt = true;
      }
    }
    if (foundOpt) continue;

    // Answer line
    const ansM = text.match(/(?:Answer|Ans|Correct|Key)\s*[\:\-\s]*([A-Da-d])\b/i);
    if (ansM) { currentQ.correctAnswer = ansM[1].toUpperCase(); continue; }

    // Continuation of question text
    if (currentQ.options.length === 0) currentQ.questionText += ' ' + text;
  }

  if (currentQ) questions.push(finalizeMCQ(currentQ));
  return questions;
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 6  —  REGEX TEXT  PARSER  (PDF / fallback)
══════════════════════════════════════════════════════════════════ */

exports.regexExtractFromText = (text) => {
  const questions = [];

  const blocks = text.split(
    /(?=\s\d+[\.\)\:\-]\s+|\n\s*\d+[\.\)\:\-]\s+|\n\s*Q(?:uestion)?\.?\s*\d+[\.\)\:\-]?\s*|^Q(?:uestion)?\.?\s*\d+[\.\)\:\-]?\s*|^\d+[\.\)\:\-]\s*|(?:\n|^)(?=\s*[A-Z][^a-z]{5,}.*?[\n\s]+[A-Da-d][\.\)\:\-]\s+)|(?<=\?)\s+(?=[A-Z])|(?<=\.)\s+(?=Which|What|How|When|The\s+following|This\s+logo|This\s+is|Identify|Choose|Select|A\s+\d+|In\s+the|Clinical))/i
  );

  for (let block of blocks) {
    block = block.trim();
    if (!block || block.length < 15) continue;

    let qMatch = block.match(/^(?:Q(?:uestion)?\.?\s*\d+[\.\)\:\-]?\s*|\d+[\.\)\:\-]\s*)([\s\S]*?)(?=\s*[\(\[]?[A-Da-d][\.\)\:\-\]]\s+|[\n\s]?[A-Da-d][\.\)\:\-\]]\s+)/i);
    if (!qMatch)
      qMatch = block.match(/^([\s\S]*?)(?=\s*[\(\[]?[A-Da-d][\.\)\:\-\]]\s+|[\n\s]?[A-Da-d][\.\)\:\-\]]\s+)/i);
    if (!qMatch) continue;

    const questionText = qMatch[1].trim().replace(/<[^>]+>/g, '').replace(/^[\d\:\s]{5,}/, '').trim();

    const options = [];
    const optRx = /[\(\[]?([A-Da-d])[\.\)\:\-\]]\s*([\s\S]*?)(?=\s*[\(\[]?[A-Da-d][\.\)\:\-\]]\s+|[\n\s]?(?:Answer|Ans|Correct|Q|Key|Choice|Response)|$)/gi;
    let m;
    while ((m = optRx.exec(block)) !== null) {
      const lbl = m[1].toUpperCase();
      let optText = m[2].trim().replace(/\s+/g, ' ').replace(/<[^>]+>/g, '').replace(/^[\d\:\s]{5,}/, '').trim();
      if (!options.find(o => o.label === lbl))
        options.push({ label: lbl, text: optText || `Option ${lbl}` });
    }

    const ansM = block.match(/(?:Answer|Ans|Correct|Key|Choice|Response)\s*[\:\-\s]*([A-Da-d])\b/i);
    const correct = ansM ? ansM[1].toUpperCase() : (options.length > 0 ? options[0].label : 'A');
    const imgM = block.match(/\[IMAGE:([^\]]+)\]/) || block.match(/<img[^>]+src=["']([^"']+)["']/i);

    if (options.length >= 1 && questionText.length > 5) {
      const finalOpts = ['A', 'B', 'C', 'D'].map(l => options.find(o => o.label === l) || { label: l, text: `Option ${l}` });
      questions.push({
        questionText: questionText.replace(/<img[^>]+>/gi, '').replace(/\s+/g, ' ').trim() || 'Untitled',
        image: imgM ? imgM[1] : '',
        options: finalOpts,
        correctAnswer: correct,
        marks: 1,
      });
    }
  }

  return questions;
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 7  —  FINALIZE + VALIDATE
══════════════════════════════════════════════════════════════════ */

const finalizeMCQ = (q) => {
  const labels = ['A', 'B', 'C', 'D'];
  const finalOptions = labels.map(l => {
    const ex = q.options.find(o => o.label === l);
    const txt = ex ? (ex.text || '').trim() : '';
    return { label: l, text: txt || `Option ${l}`, image: (ex && ex.image) || '' };
  });
  return {
    questionText: (q.questionText || 'Untitled Question').trim().substring(0, 5000),
    image: q.image || '',
    options: finalOptions,
    correctAnswer: q.correctAnswer || 'A',
    marks: typeof q.marks === 'number' ? q.marks : 1,
    explanation: q.explanation || '',
  };
};

const isValidMCQ = (q) => {
  if (!q?.questionText || typeof q.questionText !== 'string') return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) return false;
  return ['A', 'B', 'C', 'D'].every(l => q.options.find(o => o.label === l));
};

const sanitizeMCQ = (q, i) => ({
  questionText: String(q.questionText).trim().substring(0, 1000),
  image: q.image || '',
  options: ['A', 'B', 'C', 'D'].map(label => {
    const opt = q.options.find(o => o.label === label) || { label, text: `Option ${label}` };
    return { label, text: (String(opt.text || '')).trim() || `Option ${label}`, image: opt.image || '' };
  }),
  correctAnswer: q.correctAnswer,
  explanation: q.explanation ? String(q.explanation).trim().substring(0, 500) : '',
  difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
  topic: q.topic ? String(q.topic).trim().substring(0, 100) : '',
  marks: typeof q.marks === 'number' && q.marks > 0 ? Math.min(q.marks, 10) : 1,
  negativeMark: typeof q.negativeMark === 'number' ? Math.max(0, q.negativeMark) : 0,
});

const parseJSONSafe = (raw) => {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.questions)) return parsed.questions;
    return Object.values(parsed).find(Array.isArray) || [];
  } catch (err) {
    logger.warn(`[JSON] Parse failed: ${err.message}`);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 8  —  IMAGE → QUESTION  ASSOCIATOR
   After extraction, link orphaned PDF images to questions by
   proximity (image index ≈ question index).
══════════════════════════════════════════════════════════════════ */

/**
 * For PDF questions that have no image yet, attempt to assign one from
 * the extracted image pool using a simple 1:1 proximity match.
 *
 * Logic: if a question has no image and the next extracted image has not
 * yet been claimed, assign it.
 */
const associatePdfImages = (questions, pdfImages) => {
  if (!pdfImages || pdfImages.length === 0) return questions;

  const available = [...pdfImages]; // shallow copy to track claims
  return questions.map(q => {
    if (q.image) return q;          // already has an image
    if (available.length === 0) return q;

    // Heuristic: assign next unclaimed image to this question
    // You can refine this with page-number matching if pdfImages carry page info
    const img = available.shift();
    logger.info(`[Associator] Assigned ${img.publicPath} to "${q.questionText.substring(0, 40)}..."`);
    return { ...q, image: img.publicPath };
  });
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 9  —  MAIN ENTRY POINT
══════════════════════════════════════════════════════════════════ */

/**
 * extractMCQsFromDocument
 *
 * Full pipeline with 4-stage fallback:
 *  1. Structured DOCX parser (mammoth + HTML parse, images extracted)
 *  2. Regex text parser (fast, no API)
 *  3. Claude Vision (for image-heavy or unstructured docs)
 *  4. Claude Text   (last AI resort for clean-text PDFs)
 *
 * @param {string}  filePath     — absolute path to uploaded file
 * @param {string}  subject      — subject hint for AI prompts
 * @param {number}  count        — max questions to return
 * @param {string}  originalName — original filename (used for extension)
 */
exports.extractMCQsFromDocument = async (filePath, subject = 'General', count = 20, originalName = '') => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  logger.info(`[MCQ Engine v4] Processing: ${originalName || filePath}  ext=${ext}  count=${count}`);

  try {
    /* ── DOCX ─────────────────────────────────────────────────────── */
    if (ext === '.docx' || ext === '.doc') {
      // Stage 1: Structured DOCX parse (extracts images via mammoth)
      const { html, imageList } = await convertDocxToHtml(filePath);
      logger.info(`[DOCX] HTML length=${html.length}  images extracted=${imageList.length}`);

      let questions = parseHtmlToMCQs(html, imageList);
      logger.info(`[DOCX] Structured parse → ${questions.length} questions`);

      if (questions.length >= 1) {
        // Identify questions with embedded images that need Vision enrichment
        const needsVision = questions.filter(q => q.image === '' && imageList.length > 0);
        if (needsVision.length > 0 && process.env.ANTHROPIC_API_KEY) {
          logger.info(`[DOCX] ${needsVision.length} questions lack images — running Vision pass on orphaned images`);
          const orphanedImgPaths = imageList
            .filter(img => !questions.some(q => q.image === img.publicPath))
            .map(img => path.join(UPLOAD_DIR, img.filename));

          if (orphanedImgPaths.length > 0) {
            const rawText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            const visionQs = await claudeVisionExtract(orphanedImgPaths, rawText.substring(0, 2000), needsVision.length);
            const validVision = visionQs.filter(isValidMCQ).map(sanitizeMCQ);

            // Merge: attach EMBEDDED image flag to questions that Vision identified
            let vIdx = 0;
            questions = questions.map(q => {
              if (q.image || vIdx >= validVision.length) return q;
              const vq = validVision[vIdx++];
              return { ...q, image: vq.image === 'EMBEDDED' ? (imageList[vIdx - 1]?.publicPath || '') : (vq.image || '') };
            });
          }
        }
        return { questions: questions.slice(0, count), meta: { model: 'docx-structured-parser', images: imageList.length } };
      }

      // Stage 2: Regex on raw DOCX text
      const rawText = await extractWordText(filePath);
      const regexQs = exports.regexExtractFromText(rawText);
      logger.info(`[DOCX] Regex fallback → ${regexQs.length} questions`);
      if (regexQs.length >= 1)
        return { questions: regexQs.slice(0, count), meta: { model: 'regex-engine' } };

      // Stage 3: Claude Vision on all DOCX images
      if (imageList.length > 0 && process.env.ANTHROPIC_API_KEY) {
        logger.info(`[DOCX] Attempting Claude Vision on ${imageList.length} images...`);
        const imgPaths = imageList.map(i => path.join(UPLOAD_DIR, i.filename));
        const visionQs = await claudeVisionExtract(imgPaths, rawText.substring(0, 2000), count);
        const validated = visionQs.filter(isValidMCQ).map(sanitizeMCQ);

        // Replace EMBEDDED placeholder with actual image path
        validated.forEach((q, idx) => {
          if (q.image === 'EMBEDDED' && imageList[idx]) q.image = imageList[idx].publicPath;
        });

        if (validated.length > 0)
          return { questions: validated.slice(0, count), meta: { model: 'claude-vision-docx' } };
      }

      // Stage 4: Claude Text
      if (process.env.ANTHROPIC_API_KEY) {
        logger.info(`[DOCX] Attempting Claude Text extraction...`);
        const aiQs = (await claudeTextExtract(rawText, subject, count)).filter(isValidMCQ).map(sanitizeMCQ);
        if (aiQs.length > 0) return { questions: aiQs.slice(0, count), meta: { model: 'claude-text-docx' } };
      }
    }

    /* ── PDF ──────────────────────────────────────────────────────── */
    else if (ext === '.pdf') {
      // Extract text AND images in parallel
      const [pdfData, pdfImages] = await Promise.all([
        pdfParse(fs.readFileSync(filePath)),
        Promise.resolve(extractPdfImages(filePath)),  // sync inside, wrapped for parallel
      ]);

      const text = pdfData.text || '';
      logger.info(`[PDF] Pages=${pdfData.numpages}  textLen=${text.length}  images=${pdfImages.length}`);

      // Stage 1: Regex on PDF text
      if (text.length > 50) {
        let regexQs = exports.regexExtractFromText(text);
        logger.info(`[PDF] Regex → ${regexQs.length} questions`);

        if (regexQs.length >= 1) {
          // Associate extracted PDF images with questions missing images
          regexQs = associatePdfImages(regexQs, pdfImages);
          return { questions: regexQs.slice(0, count), meta: { model: 'regex-engine-pdf', images: pdfImages.length } };
        }
      }

      // Stage 2: Claude Vision on PDF images
      if (pdfImages.length > 0 && process.env.ANTHROPIC_API_KEY) {
        logger.info(`[PDF] Running Claude Vision on ${pdfImages.length} PDF images...`);
        // Process images in batches of 5 (Vision API limit)
        const BATCH = 5;
        const allVisionQs = [];
        for (let b = 0; b < pdfImages.length; b += BATCH) {
          const batch = pdfImages.slice(b, b + BATCH);
          const imgPaths = batch.map(i => i.localPath);
          const batchQs = await claudeVisionExtract(imgPaths, text.substring(0, 1500), Math.ceil(count / Math.ceil(pdfImages.length / BATCH)));
          // Replace EMBEDDED placeholder with actual image path
          batchQs.forEach((q, idx) => {
            if (q.image === 'EMBEDDED' && batch[idx]) q.image = batch[idx].publicPath;
          });
          allVisionQs.push(...batchQs);
          if (allVisionQs.length >= count) break;
        }

        const validated = allVisionQs.filter(isValidMCQ).map(sanitizeMCQ);
        if (validated.length > 0)
          return { questions: validated.slice(0, count), meta: { model: 'claude-vision-pdf', pages: pdfData.numpages } };
      }

      // Stage 3: Claude Text (for scanned PDFs that have legible text layer)
      if (text.length > 50 && process.env.ANTHROPIC_API_KEY) {
        logger.info(`[PDF] Attempting Claude Text extraction...`);
        let aiQs = (await claudeTextExtract(text, subject, count)).filter(isValidMCQ).map(sanitizeMCQ);
        aiQs = associatePdfImages(aiQs, pdfImages);
        if (aiQs.length > 0) return { questions: aiQs.slice(0, count), meta: { model: 'claude-text-pdf' } };
      }

      if (text.length < 50 && pdfImages.length === 0) {
        throw new Error('PDF appears to be scanned with no extractable text or images. Please use a text-based or digitally-created PDF.');
      }
    }

    else {
      throw new Error(`Unsupported file format: ${ext}. Supported: .docx, .doc, .pdf`);
    }

    // Ultimate fallback — shouldn't reach here if API key is set
    logger.warn('[MCQ Engine] All extraction methods exhausted. No questions found.');
    return { questions: [], meta: { model: 'none', error: 'No questions could be extracted' } };

  } catch (err) {
    logger.error(`[MCQ Engine] CRITICAL: ${err.message}\n${err.stack}`);
    throw err;   // Let the controller handle the error response
  }
};

/* ══════════════════════════════════════════════════════════════════
   SECTION 10  —  MISC EXPORTS
══════════════════════════════════════════════════════════════════ */

exports.validateMCQs = (questions) => {
  if (!Array.isArray(questions)) return { valid: false, errors: ['Questions must be an array'] };
  const errors = [];
  questions.forEach((q, i) => { if (!isValidMCQ(q)) errors.push(`Question ${i + 1} is invalid`); });
  return { valid: errors.length === 0, errors, count: questions.length };
};

// Re-export legacy text helpers for backward compatibility
exports.extractWordText = async (filePath) => {
  const result = await mammoth.extractRawText({ buffer: fs.readFileSync(filePath) });
  return result.value;
};

exports.extractPDFText = async (filePath) => {
  const data = await pdfParse(fs.readFileSync(filePath));
  return data.text;
};