const fs = require('fs');

function processFile(path) {
  let text = fs.readFileSync(path, 'utf8');
  // It's a JS object export. We can just replace `"days": [...]` with `"days": []` where the array items are objects
  
  // We'll just replace the specific days arrays for menu_calendar and academic_calendar.
  text = text.replace(/"days":\s*\[\s*\{[\s\S]*?\}\s*\],/g, '"days": [],');
  
  fs.writeFileSync(path, text);
}

processFile('src/lib/liveFallbackData.ts');
processFile('src/lib/defaultData.ts');
