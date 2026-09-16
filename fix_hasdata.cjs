const fs = require('fs');
let content = fs.readFileSync('src/admin/CalendarGridEditor.tsx', 'utf8');

const oldHasData = `            return matchesDate && (d.meals?.length > 0 || d.events?.length > 0 || d.eventTitle);`;
const newHasData = `            return matchesDate && (d.meals?.length > 0 || d.events?.length > 0 || d.eventTitle || d.breakfast?.length > 0 || d.lunch?.length > 0 || d.snack?.length > 0);`;

if (content.includes(oldHasData)) {
  content = content.replace(oldHasData, newHasData);
  fs.writeFileSync('src/admin/CalendarGridEditor.tsx', content);
  console.log("Updated hasData check");
}
