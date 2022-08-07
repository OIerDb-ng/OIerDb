import type { DropdownItemProps } from 'semantic-ui-react';

const compareGrades = (a: DropdownItemProps, b: DropdownItemProps) => {
  const t = ['一', '二', '三', '四', '五', '六'];

  let keyA = a.key;
  let keyB = b.key;

  // 高中
  if (a.text[0] === '高' && !(a.text as string).includes('毕业')) keyA *= 4;
  if (b.text[0] === '高' && !(b.text as string).includes('毕业')) keyB *= 4;

  // 初中
  if (a.text[0] === '初') keyA *= 3;
  if (b.text[0] === '初') keyB *= 3;

  // 小学
  if (t.includes(a.text[0])) keyA *= 2;
  if (t.includes(b.text[0])) keyB *= 2;

  return keyB - keyA;
};

export default compareGrades;
