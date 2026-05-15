/**
 * generateSampleDocx.js
 * Creates a sample 20-question MCQ bank DOCX with:
 * - 10 multiple-answer (MSQ) questions
 * - 5 image-based questions (with placeholder image)
 * - 5 single-answer questions
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType } = require('docx');
const fs = require('fs');
const path = require('path');

// --- Questions Data ---
const questions = [

  // ── SINGLE ANSWER ──────────────────────────────────────
  {
    num: 1,
    text: "What is the capital city of France?",
    options: { A: "Berlin", B: "Paris", C: "Madrid", D: "Rome" },
    answer: "B",
    explanation: "Paris is the capital and most populous city of France."
  },
  {
    num: 2,
    text: "Which gas is most abundant in Earth's atmosphere?",
    options: { A: "Oxygen", B: "Carbon Dioxide", C: "Nitrogen", D: "Hydrogen" },
    answer: "C",
    explanation: "Nitrogen makes up approximately 78% of Earth's atmosphere."
  },
  {
    num: 3,
    text: "Who invented the telephone?",
    options: { A: "Thomas Edison", B: "Nikola Tesla", C: "Alexander Graham Bell", D: "James Watt" },
    answer: "C",
    explanation: "Alexander Graham Bell is credited with the invention of the telephone in 1876."
  },
  {
    num: 4,
    text: "What is the chemical symbol for water?",
    options: { A: "WA", B: "HO", C: "H2O", D: "HO2" },
    answer: "C",
    explanation: "Water is composed of two hydrogen atoms bonded to one oxygen atom, hence H2O."
  },
  {
    num: 5,
    text: "Which planet is the largest in our Solar System?",
    options: { A: "Saturn", B: "Neptune", C: "Uranus", D: "Jupiter" },
    answer: "D",
    explanation: "Jupiter is the largest planet in the Solar System by mass and volume."
  },

  // ── MULTIPLE ANSWER (MSQ) ──────────────────────────────
  {
    num: 6,
    text: "Which of the following are programming languages?",
    options: { A: "Python", B: "HTML", C: "Java", D: "CSS" },
    answer: "A, C",
    explanation: "Python and Java are programming languages. HTML and CSS are markup/styling languages."
  },
  {
    num: 7,
    text: "Which of the following are mammals?",
    options: { A: "Shark", B: "Dolphin", C: "Whale", D: "Tuna" },
    answer: "B, C",
    explanation: "Dolphins and whales are marine mammals. Sharks and tuna are fish."
  },
  {
    num: 8,
    text: "Which of the following are primary colors in light (Additive Color Model)?",
    options: { A: "Red", B: "Yellow", C: "Green", D: "Blue" },
    answer: "A, C, D",
    explanation: "In the additive color model (light), the primary colors are Red, Green, and Blue (RGB)."
  },
  {
    num: 9,
    text: "Which countries are located in the continent of Asia?",
    options: { A: "India", B: "Brazil", C: "China", D: "Japan" },
    answer: "A, C, D",
    explanation: "India, China, and Japan are all located in Asia. Brazil is in South America."
  },
  {
    num: 10,
    text: "Which of the following are types of renewable energy?",
    options: { A: "Solar", B: "Coal", C: "Wind", D: "Natural Gas" },
    answer: "A, C",
    explanation: "Solar and Wind energy are renewable. Coal and Natural Gas are non-renewable fossil fuels."
  },
  {
    num: 11,
    text: "Which of the following are organs of the human digestive system?",
    options: { A: "Stomach", B: "Liver", C: "Lungs", D: "Small Intestine" },
    answer: "A, B, D",
    explanation: "The stomach, liver, and small intestine are part of the digestive system. The lungs belong to the respiratory system."
  },
  {
    num: 12,
    text: "Which of the following are characteristics of a democracy?",
    options: { A: "Free Elections", B: "Monarchy", C: "Freedom of Speech", D: "Rule of Law" },
    answer: "A, C, D",
    explanation: "Free elections, freedom of speech, and rule of law are hallmarks of democracy. Monarchy is not."
  },
  {
    num: 13,
    text: "Which of the following elements are noble gases?",
    options: { A: "Neon", B: "Oxygen", C: "Argon", D: "Chlorine" },
    answer: "A, C",
    explanation: "Neon and Argon are noble gases in Group 18. Oxygen and Chlorine are non-metals but not noble gases."
  },
  {
    num: 14,
    text: "Which of the following are symptoms of diabetes?",
    options: { A: "Frequent Urination", B: "Excessive Thirst", C: "Hair Growth", D: "Weight Loss" },
    answer: "A, B, D",
    explanation: "Frequent urination, excessive thirst, and unexplained weight loss are common symptoms of diabetes."
  },
  {
    num: 15,
    text: "Which of the following are web browsers?",
    options: { A: "Google Chrome", B: "Microsoft Word", C: "Mozilla Firefox", D: "Safari" },
    answer: "A, C, D",
    explanation: "Chrome, Firefox, and Safari are web browsers. Microsoft Word is a word processor."
  },

  // ── IMAGE-BASED QUESTIONS ─────────────────────────────
  {
    num: 16,
    isImageQ: true,
    text: "[Refer to the diagram below]\nBased on the human heart diagram, which chambers pump oxygenated blood?",
    options: { A: "Right Atrium", B: "Left Ventricle", C: "Left Atrium", D: "Right Ventricle" },
    answer: "B, C",
    explanation: "The left atrium receives oxygenated blood from the lungs, and the left ventricle pumps it to the body."
  },
  {
    num: 17,
    isImageQ: true,
    text: "[Refer to the periodic table excerpt below]\nWhich elements shown are in the Halogen group (Group 17)?",
    options: { A: "Fluorine (F)", B: "Neon (Ne)", C: "Chlorine (Cl)", D: "Argon (Ar)" },
    answer: "A, C",
    explanation: "Fluorine and Chlorine belong to the Halogen group (Group 17). Neon and Argon are Noble Gases."
  },
  {
    num: 18,
    isImageQ: true,
    text: "[Refer to the graph below showing speed vs time]\nDuring which phases does the object shown in the graph have constant velocity?",
    options: { A: "Phase 1 (0-2s)", B: "Phase 2 (2-5s)", C: "Phase 3 (5-8s)", D: "Phase 4 (8-10s)" },
    answer: "B, D",
    explanation: "Constant velocity means zero acceleration, which appears as a flat (horizontal) line on a speed-time graph."
  },
  {
    num: 19,
    isImageQ: true,
    text: "[Refer to the cell diagram below]\nWhich organelles labeled in the diagram are responsible for energy production and protein synthesis?",
    options: { A: "Mitochondria", B: "Nucleus", C: "Ribosome", D: "Cell Wall" },
    answer: "A, C",
    explanation: "Mitochondria produce energy (ATP) and ribosomes synthesize proteins. The nucleus contains DNA and the cell wall provides structure."
  },
  {
    num: 20,
    isImageQ: true,
    text: "[Refer to the map below]\nWhich of the following countries shown on the map are part of the G7?",
    options: { A: "United States", B: "Russia", C: "Germany", D: "China" },
    answer: "A, C",
    explanation: "The United States and Germany are G7 members. Russia was suspended in 2014 and China is not a G7 member."
  }
];

// --- Build Document Paragraphs ---
const children = [];

// Title
children.push(
  new Paragraph({
    text: "Sample MCQ Exam — 20 Questions (Multiple Select + Image Based)",
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 400 }
  })
);

questions.forEach(q => {
  // Question number heading
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `QUESTION ${q.num}`, bold: true, size: 28 })],
      spacing: { before: 400, after: 100 }
    })
  );

  // Answer Key line - format that parser catches perfectly
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Correct Key: ${q.answer}`, bold: true, color: "2E7D32", size: 24 })],
      spacing: { after: 100 }
    })
  );

  // Question text
  children.push(
    new Paragraph({
      children: [new TextRun({ text: q.text, size: 24 })],
      spacing: { after: 150 }
    })
  );

  // Options
  Object.entries(q.options).forEach(([label, text]) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${label}. `, bold: true, size: 22 }),
          new TextRun({ text, size: 22 })
        ],
        spacing: { after: 80 }
      })
    );
  });

  // Explanation
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Explanation:", bold: true, size: 20, color: "1565C0" })],
      spacing: { before: 150, after: 60 }
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: q.explanation, size: 20, italics: true, color: "555555" })],
      spacing: { after: 200 }
    })
  );

  // Divider
  children.push(new Paragraph({ text: "─────────────────────────────────────", spacing: { after: 100 } }));
});

// --- Create and Save Document ---
const doc = new Document({ sections: [{ children }] });

const outputPath = path.join(__dirname, '..', 'Sample_MCQ_20_Questions.docx');

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ DOCX saved to: ' + outputPath);
}).catch(err => {
  console.error('Error:', err.message);
});
