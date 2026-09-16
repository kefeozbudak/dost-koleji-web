const fs = require('fs');
let content = fs.readFileSync('src/components/PageBlocks.tsx', 'utf8');

const menuTodayOld = `<span className="text-sm md:text-xl font-black text-primary whitespace-normal md:whitespace-pre-line">
                                {day.date}
                              </span>`;
const menuTodayNew = `<span className="text-sm md:text-xl font-black text-primary whitespace-normal md:whitespace-pre-line">
                                {day.date} <span className="md:hidden ml-1 text-xs opacity-75">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i % 7]}</span>
                              </span>`;
content = content.replace(menuTodayOld, menuTodayNew);

const menuNormalOld = `<span className="text-sm md:text-xl font-black text-slate-800 whitespace-normal md:whitespace-pre-line">
                              {day.date}
                            </span>`;
const menuNormalNew = `<span className="text-sm md:text-xl font-black text-slate-800 whitespace-normal md:whitespace-pre-line">
                              {day.date} <span className="md:hidden ml-1 text-xs opacity-75">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i % 7]}</span>
                            </span>`;
content = content.replace(menuNormalOld, menuNormalNew);


const academicWeekendOld = `<span className="font-label-md text-label-md text-on-surface-variant opacity-50 absolute top-1 md:top-2 right-1 md:right-2 whitespace-normal md:whitespace-pre-line">
                            {day.date}
                          </span>`;
const academicWeekendNew = `<span className="font-label-md text-label-md text-on-surface-variant opacity-50 absolute top-1 md:top-2 right-1 md:right-2 whitespace-normal md:whitespace-pre-line">
                            <span className="md:hidden mr-1 text-xs opacity-75">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i % 7]}</span>
                            {day.date}
                          </span>`;
content = content.replace(academicWeekendOld, academicWeekendNew);

const academicNormalOld = `<span
                          className={\`font-label-md text-label-md absolute top-1 md:top-2 right-1 md:right-2 \${day.isToday ? "text-primary font-bold" : "text-on-surface"}\`}
                        >
                          {day.date}
                        </span>`;
const academicNormalNew = `<span
                          className={\`font-label-md text-label-md absolute top-1 md:top-2 right-1 md:right-2 \${day.isToday ? "text-primary font-bold" : "text-on-surface"}\`}
                        >
                          <span className="md:hidden mr-1 text-xs opacity-75">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i % 7]}</span>
                          {day.date}
                        </span>`;
content = content.replace(academicNormalOld, academicNormalNew);

fs.writeFileSync('src/components/PageBlocks.tsx', content);
