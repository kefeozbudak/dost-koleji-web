const extract = async (obj) => {
  if (!obj) return obj;
  if (typeof obj === "string") { return obj; }
  if (Array.isArray(obj)) {
    const newArr = [];
    for (const item of obj) {
      newArr.push(await extract(item));
    }
    return newArr;
  }
  if (typeof obj === "object") {
    if (obj.constructor && obj.constructor.name !== "Object" && obj.constructor.name !== "Array") { return obj; }
    const newObj = {};
    for (const key of Object.keys(obj)) {
      const val = await extract(obj[key]);
      if (val !== undefined) {
        newObj[key] = val;
      }
    }
    return newObj;
  }
  return obj;
};

const obj = {
  blocks: [
    { type: "menu_calendar", days: [{ date: "2026-09-01", breakfast: "b", kcal: "1" }], month: "" }
  ]
};
extract(obj).then(res => console.log(JSON.stringify(res, null, 2)));
