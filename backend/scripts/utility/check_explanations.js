require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./src/models/Result');

async function checkExplanations() {
  await mongoose.connect(process.env.MONGO_URI);
  const results = await Result.find({ 'answers.explanation': { $exists: true, $ne: '' } });
  console.log(`Found ${results.length} results with explanations.`);
  if (results.length > 0) {
    console.log('Sample explanation:', results[0].answers.find(a => a.explanation).explanation);
  }
  process.exit(0);
}

checkExplanations();
