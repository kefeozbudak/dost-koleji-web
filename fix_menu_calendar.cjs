const fs = require('fs');
let content = fs.readFileSync('src/components/PageBlocks.tsx', 'utf8');

const oldUl = `                            <ul className="space-y-1 md:space-y-2 whitespace-normal md:whitespace-pre-line">
                              {(Array.isArray(day.meals)
                                ? day.meals
                                : typeof day.meals === "string"
                                  ? day.meals
                                      .split(/[,\n]+/)
                                      .map((s: string) => s.trim())
                                      .filter(Boolean)
                                  : []
                              )?.map((meal: string, mIndex: number) => (
                                <li
                                  key={mIndex}
                                  className="text-[10px] md:text-sm font-bold text-slate-800 flex items-start gap-1 md:gap-2 leading-tight whitespace-normal md:whitespace-pre-line"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 flex-shrink-0 whitespace-normal md:whitespace-pre-line"></span>
                                  <span className="flex-1 whitespace-normal md:whitespace-pre-line">{meal}</span>
                                </li>
                              ))}
                            </ul>`;

const newMeals = `
                            {day.breakfast && (
                              <div className="mb-2 whitespace-normal md:whitespace-pre-line">
                                <div className="text-[9px] md:text-[11px] uppercase text-slate-500 font-bold mb-1 whitespace-normal md:whitespace-pre-line">Sabah Kahvaltısı</div>
                                <ul className="space-y-0.5 md:space-y-1 whitespace-normal md:whitespace-pre-line">
                                  {day.breakfast.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).map((meal: string, mIndex: number) => (
                                    <li key={mIndex} className="text-[10px] md:text-[13px] font-semibold text-slate-700 flex items-start gap-1 md:gap-1.5 leading-tight whitespace-normal md:whitespace-pre-line">
                                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary/40 mt-1 md:mt-1.5 flex-shrink-0 whitespace-normal md:whitespace-pre-line"></span>
                                      <span className="flex-1 whitespace-normal md:whitespace-pre-line">{meal}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {day.lunch && (
                              <div className="mb-2 whitespace-normal md:whitespace-pre-line">
                                <div className="text-[9px] md:text-[11px] uppercase text-slate-500 font-bold mb-1 whitespace-normal md:whitespace-pre-line">Öğle Yemeği</div>
                                <ul className="space-y-0.5 md:space-y-1 whitespace-normal md:whitespace-pre-line">
                                  {day.lunch.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).map((meal: string, mIndex: number) => (
                                    <li key={mIndex} className="text-[10px] md:text-[13px] font-semibold text-slate-700 flex items-start gap-1 md:gap-1.5 leading-tight whitespace-normal md:whitespace-pre-line">
                                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary/40 mt-1 md:mt-1.5 flex-shrink-0 whitespace-normal md:whitespace-pre-line"></span>
                                      <span className="flex-1 whitespace-normal md:whitespace-pre-line">{meal}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {day.snack && (
                              <div className="mb-2 whitespace-normal md:whitespace-pre-line">
                                <div className="text-[9px] md:text-[11px] uppercase text-slate-500 font-bold mb-1 whitespace-normal md:whitespace-pre-line">İkindi Beslenmesi</div>
                                <ul className="space-y-0.5 md:space-y-1 whitespace-normal md:whitespace-pre-line">
                                  {day.snack.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).map((meal: string, mIndex: number) => (
                                    <li key={mIndex} className="text-[10px] md:text-[13px] font-semibold text-slate-700 flex items-start gap-1 md:gap-1.5 leading-tight whitespace-normal md:whitespace-pre-line">
                                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary/40 mt-1 md:mt-1.5 flex-shrink-0 whitespace-normal md:whitespace-pre-line"></span>
                                      <span className="flex-1 whitespace-normal md:whitespace-pre-line">{meal}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!day.breakfast && !day.lunch && !day.snack && day.meals && (
                              <ul className="space-y-1 md:space-y-2 whitespace-normal md:whitespace-pre-line">
                                {(Array.isArray(day.meals)
                                  ? day.meals
                                  : typeof day.meals === "string"
                                    ? day.meals
                                        .split(/[,\n]+/)
                                        .map((s: string) => s.trim())
                                        .filter(Boolean)
                                    : []
                                )?.map((meal: string, mIndex: number) => (
                                  <li
                                    key={mIndex}
                                    className="text-[10px] md:text-sm font-bold text-slate-800 flex items-start gap-1 md:gap-2 leading-tight whitespace-normal md:whitespace-pre-line"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 flex-shrink-0 whitespace-normal md:whitespace-pre-line"></span>
                                    <span className="flex-1 whitespace-normal md:whitespace-pre-line">{meal}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
`;

if (content.includes(oldUl)) {
    content = content.replaceAll(oldUl, newMeals);
    fs.writeFileSync('src/components/PageBlocks.tsx', content);
    console.log("Updated both instances of menu meals");
} else {
    console.log("oldUl not found, maybe spacing differs?");
}
