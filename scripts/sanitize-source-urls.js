const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../services/api/src/views/web-client.html.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Replace unsafe raw sourceUrl interpolation with isSafeHttpUrl guard
// Pattern 1: in renderLibraryCards
code = code.replace(
  'href=\\"${escapeHtml(r.sourceUrl)}\\" target=\\"_blank\\"',
  'href=\\"${isSafeHttpUrl(r.sourceUrl) ? escapeHtml(r.sourceUrl) : \'#\'}\\" target=\\"_blank\\"'
);

// Pattern 2: in recipe detail view
code = code.replace(
  'href=\\"${escapeHtml(currentRecipe.sourceUrl)}\\" target=\\"_blank\\"',
  'href=\\"${isSafeHttpUrl(currentRecipe.sourceUrl) ? escapeHtml(currentRecipe.sourceUrl) : \'#\'}\\" target=\\"_blank\\"'
);

// Pattern 3: in discover trend cards
code = code.replace(
  '${t.sourceUrl ? `<a href=\\"${escapeHtml(t.sourceUrl)}\\" target=\\"_blank\\"',
  '${t.sourceUrl && isSafeHttpUrl(t.sourceUrl) ? `<a href=\\"${escapeHtml(t.sourceUrl)}\\" target=\\"_blank\\"'
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully sanitized sourceUrl href attributes with isSafeHttpUrl in web-client.html.ts');
