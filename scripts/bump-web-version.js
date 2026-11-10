const fs = require('fs');
const path = require('path');

const webClientPath = path.resolve(__dirname, '../services/api/src/views/web-client.html.ts');
let code = fs.readFileSync(webClientPath, 'utf8');

// Replace all occurrences of v1.4.0 (Build 16) with v1.5.0 (Build 17)
const beforeCount = (code.match(/v1\.4\.0\s*\(Build 16\)/g) || []).length;
code = code.replace(/v1\.4\.0\s*\(Build 16\)/g, 'v1.5.0 (Build 17)');
const afterCount = (code.match(/v1\.5\.0\s*\(Build 17\)/g) || []).length;

fs.writeFileSync(webClientPath, code, 'utf8');
console.log(`Replaced ${beforeCount} occurrences of Build 16 with v1.5.0 (Build 17). Total v1.5.0 count: ${afterCount}`);

