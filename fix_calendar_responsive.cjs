const fs = require('fs');
let content = fs.readFileSync('src/components/PageBlocks.tsx', 'utf8');

// menu_calendar modifications
content = content.replace(
  '<div className="min-w-[800px] whitespace-normal md:whitespace-pre-line">\n                  <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 whitespace-normal md:whitespace-pre-line">',
  '<div className="md:min-w-[800px] whitespace-normal md:whitespace-pre-line">\n                  <div className="hidden md:grid grid-cols-7 bg-slate-50 border-b border-slate-200 whitespace-normal md:whitespace-pre-line">'
);

content = content.replace(
  '<div className="grid grid-cols-7 divide-x divide-y divide-slate-200 whitespace-normal md:whitespace-pre-line">',
  '<div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-x md:divide-y divide-slate-200 whitespace-normal md:whitespace-pre-line">'
);

// We need to find the empty day rendering in menu_calendar and academic_calendar.
// Let's do it with regex to be safer.

// 1. Hide empty days on mobile (both calendars)
content = content.replace(
  /className="p-2 md:p-4 bg-slate-50\/50 min-h-\[120px\] md:min-h-\[220px\] whitespace-normal md:whitespace-pre-line"/g,
  'className="hidden md:block p-2 md:p-4 bg-slate-50/50 min-h-[120px] md:min-h-[220px] whitespace-normal md:whitespace-pre-line"'
);

content = content.replace(
  /className="min-h-\[80px\] md:min-h-\[120px\] p-1 md:p-2 border-r border-b border-border-subtle bg-surface-container relative whitespace-normal md:whitespace-pre-line"/g,
  'className="hidden md:block min-h-[80px] md:min-h-[120px] p-1 md:p-2 border-r border-b border-border-subtle bg-surface-container relative whitespace-normal md:whitespace-pre-line"'
);

fs.writeFileSync('src/components/PageBlocks.tsx', content);
console.log("Replaced grid and empty days visibility.");
