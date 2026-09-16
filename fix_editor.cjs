const fs = require('fs');
let content = fs.readFileSync('src/admin/CalendarGridEditor.tsx', 'utf8');

const updateFuncOld = `  const updateActiveItem = (field: string, value: any) => {
    const newArray = [...currentArray];
    if (activeItemIndex !== -1) {
      newArray[activeItemIndex] = { ...newArray[activeItemIndex], [field]: value };
    } else {
      newArray.push({ ...activeItem, [field]: value });
    }
    onChange(arrayKey, newArray);
  };`;

const updateFuncNew = `  const updateActiveItem = (field: string, value: any) => {
    const newArray = [...currentArray];
    if (activeItemIndex !== -1) {
      const updatedItem = { ...newArray[activeItemIndex], [field]: value };
      if (field === 'breakfast') {
         updatedItem.meals = "";
         updatedItem.events = "";
      }
      newArray[activeItemIndex] = updatedItem;
    } else {
      const newItem = { ...activeItem, [field]: value };
      if (field === 'breakfast') {
         newItem.meals = "";
         newItem.events = "";
      }
      newArray.push(newItem);
    }
    onChange(arrayKey, newArray);
  };`;

content = content.replace(updateFuncOld, updateFuncNew);

const textareaOld = `value={activeItem.breakfast || activeItem.meals || activeItem.events || ""}`;
const textareaNew = `value={activeItem.breakfast !== undefined ? activeItem.breakfast : (activeItem.meals || activeItem.events || "")}`;

content = content.replace(textareaOld, textareaNew);

fs.writeFileSync('src/admin/CalendarGridEditor.tsx', content);
