const fs = require('fs');
const path = require('path');

function parseMarkdownToMCQs(markdownText) {
  const questions = [];
  
  // 1. Split the markdown by question headers
  // Matches: "1.", "**1.", "### 1.", "### 1. *What...*" etc.
  const questionHeaderRegex = /(?:\r?\n|^)(?:\*\*|###)?\s*(\d+)[\.\)]\s*(?:\*|_)?/g;
  
  const matches = [];
  let match;
  while ((match = questionHeaderRegex.exec(markdownText)) !== null) {
    matches.push({
      index: match.index,
      qNum: parseInt(match[1], 10),
      matchStr: match[0]
    });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : markdownText.length;
    const block = markdownText.substring(startIdx, endIdx).trim();
    
    // Process single question block
    const lines = block.split(/\r?\n/).map(l => l.trim());
    if (lines.length === 0) continue;
    
    // The first line is the question header
    let headerLine = lines[0];
    // Clean header markdown characters
    headerLine = headerLine.replace(/^(?:\*\*|###)?\s*\d+[\.\)]\s*/, '') // strip number
                           .replace(/^[\*\_]+|[\*\_]+$/g, '') // strip italics/bold
                           .trim();
                           
    let questionBody = headerLine;
    const options = [];
    let correctAnswer = 'A';
    let explanation = '';
    let image = '';
    
    let state = 'body'; // 'body', 'options', 'answer'
    
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line) continue;
      
      // Check for Option A, B, C, D lines
      // Matches: "A) Scalene", "A. Scalene", "A)Scalene"
      const optMatch = line.match(/^([A-D])[\)\.]\s*(.*)/i);
      
      // Check for Answer line
      // Matches: "**Answer: D) Isosceles**", "**Answer:** A) A"
      const ansMatch = line.match(/(?:Answer|Ans|Correct(?:\s+Key)?|Key|Choice|Response)\s*[\:\-\s]*[\(\[]?([A-D](?:[\s\,\&]+[A-D])*)[\)\]]?/i);
      
      if (ansMatch) {
        state = 'answer';
        const letters = ansMatch[1].toUpperCase().match(/[A-D]/g);
        if (letters && letters.length > 0) {
          correctAnswer = [...new Set(letters)].sort().join(',');
        }
        
        // Anything after the answer indicator on the same line could be the explanation
        const afterAns = line.replace(/(?:Answer|Ans|Correct(?:\s+Key)?|Key|Choice|Response)\s*[\:\-\s]*[\(\[]?[A-D](?:[\s\,\&]+[A-D]*)[\)\]]?/i, '').trim();
        if (afterAns) {
          explanation = afterAns.replace(/^[\s\,\&\)\.\-\/]+[A-D]?[\b\s\)\.\-\/]*/i, '').trim();
        }
        continue;
      }
      
      if (optMatch) {
        state = 'options';
        const label = optMatch[1].toUpperCase();
        let optText = optMatch[2].trim().replace(/^[\*\_]+|[\*\_]+$/g, '').trim();
        
        // Remove trailing answers if leaked
        optText = optText.replace(/\s*\*\*Answer.*$/i, '').trim();
        
        if (!options.some(o => o.label === label)) {
          options.push({ label, text: optText || `Option ${label}`, image: '' });
        }
        continue;
      }
      
      if (state === 'body') {
        // Look for image links in the body: ![description](url)
        const imgMatch = line.match(/\!\[(.*?)\]\((.*?)\)/);
        if (imgMatch) {
          // If we found a valid image file name/url
          const imgUrl = imgMatch[2].trim();
          if (imgUrl !== 'image' && imgUrl !== '') {
            image = imgUrl;
          }
          // Append description to body text
          questionBody += '\n' + line;
        } else {
          questionBody += '\n' + line;
        }
      } else if (state === 'answer') {
        explanation += (explanation ? ' ' : '') + line;
      }
    }
    
    // Ensure we have all 4 options
    const finalOptions = ['A', 'B', 'C', 'D'].map(l => {
      const existing = options.find(o => o.label === l);
      return existing || { label: l, text: `Option ${l}`, image: '' };
    });
    
    // Clean explanation
    explanation = explanation.replace(/^[\s\,\&\)\.\-\/]+[A-D]?[\b\s\)\.\-\/]*/i, '').trim();
    
    questions.push({
      questionText: questionBody.trim(),
      image,
      options: finalOptions,
      correctAnswer,
      marks: 1,
      explanation: explanation || '',
      isMSQ: correctAnswer.includes(',')
    });
  }
  
  return questions;
}

// Read debug file and parse it
const debugPath = path.join(__dirname, '../uploads/debug_llamaparse.md');
const text = fs.readFileSync(debugPath, 'utf8');
const result = parseMarkdownToMCQs(text);

console.log(JSON.stringify(result, null, 2));
console.log(`Parsed ${result.length} questions successfully.`);
