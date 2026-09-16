const fs = require('fs');
let content = fs.readFileSync('src/components/PageBlocks.tsx', 'utf8');

// For menu_calendar header:
// From:
// <div className="flex items-center gap-4">
//   <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) - 1}))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
//   <h2
//     className="text-2xl font-bold text-slate-800 whitespace-normal md:whitespace-pre-line"
//     style={getTitleStyle(block)}
//   >
//     {getNavMonthYear(block.month || block.title, calendarMonthOffsets[index] || 0)}
//   </h2>
//   <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) + 1}))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
// </div>
// {block.subtitle && (
//   <p className="text-slate-500 whitespace-normal md:whitespace-pre-line">
//     {block.subtitle}
//   </p>
// )}

const oldMenuHeader = `<div className="flex items-center gap-4">
                  <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) - 1}))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <h2
                    className="text-2xl font-bold text-slate-800 whitespace-normal md:whitespace-pre-line"
                    style={getTitleStyle(block)}
                  >
                    {getNavMonthYear(block.month || block.title, calendarMonthOffsets[index] || 0)}
                  </h2>
                  <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) + 1}))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
                {block.subtitle && (
                  <p className="text-slate-500 whitespace-normal md:whitespace-pre-line">
                    {block.subtitle}
                  </p>
                )}`;

const newMenuHeader = `<div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    {typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && (
                      <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) - 1}))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                    )}
                    <h2
                      className="text-2xl font-bold text-slate-800 whitespace-normal md:whitespace-pre-line"
                      style={getTitleStyle(block)}
                    >
                      {block.title || getNavMonthYear(block.month, calendarMonthOffsets[index] || 0)}
                    </h2>
                    {typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && (
                      <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) + 1}))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                    )}
                  </div>
                  {block.title && block.month && (
                    <div className="text-lg font-semibold text-primary whitespace-normal md:whitespace-pre-line">
                       {getNavMonthYear(block.month, calendarMonthOffsets[index] || 0)}
                    </div>
                  )}
                  {block.subtitle && (
                    <p className="text-slate-500 whitespace-normal md:whitespace-pre-line mt-2">
                      {block.subtitle}
                    </p>
                  )}
                </div>`;

if (content.includes(oldMenuHeader)) {
  content = content.replace(oldMenuHeader, newMenuHeader);
  console.log("Updated menu header");
} else {
  console.log("oldMenuHeader not found");
}

// For academic_calendar header:
const oldAcademicHeader = `<div className="flex items-center space-x-6 mb-4 md:mb-0 whitespace-normal md:whitespace-pre-line">
                <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) - 1}))} className="p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface flex items-center justify-center whitespace-normal md:whitespace-pre-line">
                  <span className="material-symbols-outlined whitespace-normal md:whitespace-pre-line" translate="no" aria-hidden="true">chevron_left</span>
                </button>
                <h2 className="font-headline-xl text-headline-xl text-on-surface whitespace-normal md:whitespace-pre-line">
                  {getNavMonthYear(block.month || "Ekim 2023", calendarMonthOffsets[index] || 0)}
                </h2>
                <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) + 1}))} className="p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface flex items-center justify-center whitespace-normal md:whitespace-pre-line">
                  <span className="material-symbols-outlined whitespace-normal md:whitespace-pre-line" translate="no" aria-hidden="true">chevron_right</span>
                </button>
              </div>`;

const newAcademicHeader = `<div className="flex items-center space-x-6 mb-4 md:mb-0 whitespace-normal md:whitespace-pre-line">
                {typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && (
                  <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) - 1}))} className="p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface flex items-center justify-center whitespace-normal md:whitespace-pre-line">
                    <span className="material-symbols-outlined whitespace-normal md:whitespace-pre-line" translate="no" aria-hidden="true">chevron_left</span>
                  </button>
                )}
                <div className="flex flex-col gap-1">
                  <h2 className="font-headline-xl text-headline-xl text-on-surface whitespace-normal md:whitespace-pre-line" style={getTitleStyle(block)}>
                    {block.title || getNavMonthYear(block.month || "Ekim 2023", calendarMonthOffsets[index] || 0)}
                  </h2>
                  {block.title && block.month && (
                    <div className="text-lg font-semibold text-primary whitespace-normal md:whitespace-pre-line">
                       {getNavMonthYear(block.month, calendarMonthOffsets[index] || 0)}
                    </div>
                  )}
                </div>
                {typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && (
                  <button onClick={() => setCalendarMonthOffsets(prev => ({...prev, [index]: (prev[index] || 0) + 1}))} className="p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface flex items-center justify-center whitespace-normal md:whitespace-pre-line">
                    <span className="material-symbols-outlined whitespace-normal md:whitespace-pre-line" translate="no" aria-hidden="true">chevron_right</span>
                  </button>
                )}
              </div>`;

if (content.includes(oldAcademicHeader)) {
  content = content.replace(oldAcademicHeader, newAcademicHeader);
  console.log("Updated academic header");
} else {
  console.log("oldAcademicHeader not found");
}

fs.writeFileSync('src/components/PageBlocks.tsx', content);
