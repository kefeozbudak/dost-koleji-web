const fs = require('fs');
let content = fs.readFileSync('src/components/PageBlocks.tsx', 'utf8');

const oldLoop = `    for (let j = 0; j < originalDays.length; j++) {
      const d = originalDays[j];
      if (!d) continue;
      
      const oDate = String(d.date || "").replace(/\\D/g, '');
      if (oDate === dayStr || oDate === padStr || parseInt(oDate) === i) {
          bestMatch = d;
          bestMatchIndex = j;
          break;
      }
    }`;

const newLoop = `    for (let j = 0; j < originalDays.length; j++) {
      const d = originalDays[j];
      if (!d) continue;
      
      const oDateRaw = String(d.date || "");
      let matched = false;
      if (oDateRaw.includes('-')) {
         const parts = oDateRaw.split('-');
         if (parts.length === 3) {
             const dYear = parseInt(parts[0]);
             const dMonth = parseInt(parts[1]) - 1;
             const dDay = parseInt(parts[2]);
             if (dYear === year && dMonth === mIndex && dDay === i) {
                 matched = true;
             }
         }
      } else {
         const oDate = oDateRaw.replace(/\\D/g, '');
         if (oDate === dayStr || oDate === padStr || parseInt(oDate) === i) {
             matched = true;
         }
      }

      if (matched) {
          bestMatch = d;
          bestMatchIndex = j;
          break;
      }
    }`;

if (content.includes(oldLoop)) {
  content = content.replace(oldLoop, newLoop);
  fs.writeFileSync('src/components/PageBlocks.tsx', content);
  console.log("Fixed date matching in PageBlocks.tsx");
} else {
  console.log("Could not find oldLoop in PageBlocks.tsx");
}
