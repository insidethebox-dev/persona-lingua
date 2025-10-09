// Test the conversion specifically for dialog context
import { convertFilenameToAscii } from '../src/utils/greeklish';

console.log('🔍 Testing Dialog Conversion Context\n');

// Test with actual Greek filenames that might be used
const testCases = [
  'Άμεσο και Έμμεσο Αντικείμενο.pdf',
  'ΓΛΥΚΑ.png',
  'Αθήνα.jpg',
  'Φωτογραφίες.zip',
  'Επιβεβαιωμένο.docx'
];

testCases.forEach((filename, index) => {
  console.log(`${index + 1}. Testing: "${filename}"`);
  
  const result = convertFilenameToAscii(filename);
  
  console.log(`   Converted: "${result.convertedName}"`);
  console.log(`   Has Changes: ${result.hasChanges}`);
  console.log(`   Had Greek: ${result.originalHadGreek}`);
  console.log(`   Length: ${result.convertedName.length} chars`);
  console.log(`   Is ASCII: ${!/[^\x00-\x7F]/.test(result.convertedName)}`);
  console.log('');
});

// Test empty/edge cases
console.log('🔬 Edge Case Testing:');
const edgeCases = ['', '.pdf', 'α.pdf', 'αβγ', 'test.pdf'];

edgeCases.forEach(filename => {
  const result = convertFilenameToAscii(filename);
  console.log(`"${filename}" → "${result.convertedName}" (changes: ${result.hasChanges})`);
});