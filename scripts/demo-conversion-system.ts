// Demo of the filename conversion system
import { convertFilenameToAscii, hasNonAsciiChars, hasGreekChars } from '../src/utils/greeklish';

console.log('🎯 Filename Conversion System Demo\n');

const testFiles = [
  'Άμεσο και Έμμεσο Αντικείμενο.pdf',
  'ΓΛΥΚΑ.png', 
  'poster Ρωτάω I ask (1).docx',
  'Αθήνα - Athens.jpg',
  'regular-file.pdf',
  'café-français.txt',
  'file-with-ñ-character.doc',
  'Φωτογραφίες διακοπών.zip'
];

console.log('📋 Upload Process Simulation:');
console.log('=' .repeat(80));

testFiles.forEach((filename, index) => {
  console.log(`\n${index + 1}. User selects file: "${filename}"`);
  
  const hasNonAscii = hasNonAsciiChars(filename);
  const hasGreek = hasGreekChars(filename);
  
  if (hasNonAscii) {
    const result = convertFilenameToAscii(filename);
    
    console.log(`   ⚠️  Non-ASCII detected (Greek: ${hasGreek})`);
    console.log(`   💬 Show conversion dialog:`);
    console.log(`      Original: "${filename}"`);
    console.log(`      Converted: "${result.convertedName}"`);
    console.log(`   ✅ User confirms → File uploaded as "${result.convertedName}"`);
  } else {
    console.log(`   ✅ ASCII-compatible → Upload directly as "${filename}"`);
  }
});

console.log('\n' + '=' .repeat(80));
console.log('🎉 Result: All files are now ASCII-compatible and uploaded successfully!');
console.log('📁 No "material.pdf" fallbacks or broken Greek characters anymore.');
console.log('🌐 Full Cloudinary compatibility maintained.');