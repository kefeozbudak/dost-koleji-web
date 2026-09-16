const fs = require('fs');
let content = fs.readFileSync('src/admin/BlockFormEditor.tsx', 'utf8');
content = content.replace('\\n      {block.type === "tuition_fees_hero"', '      {block.type === "tuition_fees_hero"');
fs.writeFileSync('src/admin/BlockFormEditor.tsx', content);
console.log("Fixed stray newline");
