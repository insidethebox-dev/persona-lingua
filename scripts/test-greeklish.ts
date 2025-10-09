// Test the Greeklish conversion functionality
import { 
  convertToGreeklish, 
  convertFilenameToAscii, 
  hasGreekChars, 
  hasNonAsciiChars,
  GREEKLISH_EXAMPLES 
} from '../src/utils/greeklish';

console.log('🇬🇷 Testing Greek to Greeklish Conversion\n');

// Test the example conversions
console.log('📝 Testing Example Conversions:');
GREEKLISH_EXAMPLES.forEach((example, index) => {
  const result = convertFilenameToAscii(example.greek);
  const matches = result.convertedName === example.greeklish;
  
  console.log(`${index + 1}. ${matches ? '✅' : '❌'} "${example.greek}"`);
  console.log(`   Expected: "${example.greeklish}"`);
  console.log(`   Got:      "${result.convertedName}"`);
  console.log(`   Had Greek: ${result.originalHadGreek}`);
  console.log(`   Changed:   ${result.hasChanges}`);
  console.log('');
});

// Test individual Greek words
console.log('🔤 Testing Individual Greek Words:');
const greekWords = [
  'Αθήνα', 'Θεσσαλονίκη', 'φιλοσοφία', 'ψυχολογία', 
  'χημεία', 'μαθηματικά', 'ιστορία', 'γεωγραφία'
];

greekWords.forEach(word => {
  const converted = convertToGreeklish(word);
  console.log(`${word} → ${converted}`);
});

// Test filename detection
console.log('\n🔍 Testing Character Detection:');
const testFiles = [
  'regular-file.pdf',
  'Άμεσο και Έμμεσο.pdf',
  'café-français.txt',
  'file-with-ñ-character.doc',
  'ΓΛΥΚΑ.png'
];

testFiles.forEach(file => {
  console.log(`"${file}"`);
  console.log(`  Has Greek: ${hasGreekChars(file)}`);
  console.log(`  Has Non-ASCII: ${hasNonAsciiChars(file)}`);
  console.log('');
});

console.log('✅ All tests completed!');