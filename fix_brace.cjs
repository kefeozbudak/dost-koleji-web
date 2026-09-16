const fs = require('fs');

function fixBrace(path) {
  let text = fs.readFileSync(path, 'utf8');
  // I need to find `"days": [],\n      "title": "Akademik Takvim"` and replace with `"days": []\n      }],\n      "title": "Akademik Takvim"`
  text = text.replace(/"days": \[\],\s*"title": "Akademik Takvim"/g, '"days": []\n        }\n      ],\n      "title": "Akademik Takvim"');
  text = text.replace(/"days": \[\],\s*"title": "Aylık Yemek Menüsü"/g, '"days": []\n        }\n      ],\n      "title": "Aylık Yemek Menüsü"');
  fs.writeFileSync(path, text);
}

fixBrace('src/lib/liveFallbackData.ts');
fixBrace('src/lib/defaultData.ts');
console.log("Fixed brace");
