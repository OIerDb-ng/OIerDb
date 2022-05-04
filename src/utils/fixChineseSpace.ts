export default function fixChineseSpace(str: string) {
  const isChinese = (str: string) => /[\u3400-\u9FBF]/.test(str);
  const isLatin = (str: string) => /[a-zA-Z0-9@/*&%#]/.test(str);
  return [...str]
    .map(
      (char, i) =>
        (i > 0 && isChinese(str[i]) && isLatin(str[i - 1]) ? ' ' : '') +
        char +
        (i < str.length - 1 && isChinese(str[i]) && isLatin(str[i + 1])
          ? ' '
          : '')
    )
    .join('');
}
