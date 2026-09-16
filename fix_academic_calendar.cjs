const fs = require('fs');
let content = fs.readFileSync('src/components/PageBlocks.tsx', 'utf8');

content = content.replace(
  '<div className="min-w-[800px] whitespace-normal md:whitespace-pre-line">\n                <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-container-low whitespace-normal md:whitespace-pre-line">',
  '<div className="md:min-w-[800px] whitespace-normal md:whitespace-pre-line">\n                <div className="hidden md:grid grid-cols-7 border-b border-border-subtle bg-surface-container-low whitespace-normal md:whitespace-pre-line">'
);

content = content.replace(
  '<div className="grid grid-cols-7 border-l border-t border-border-subtle whitespace-normal md:whitespace-pre-line">',
  '<div className="grid grid-cols-1 md:grid-cols-7 border-l border-t border-border-subtle whitespace-normal md:whitespace-pre-line">'
);

fs.writeFileSync('src/components/PageBlocks.tsx', content);
