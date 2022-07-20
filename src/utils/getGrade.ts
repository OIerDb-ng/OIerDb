import { OIer, Record } from '@/libs/OIerDb';

export const currentYear =
  new Date().getFullYear() - Number(new Date().getMonth() + 1 < 9);

const grades = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '初一',
  '初二',
  '初三',
  '高一',
  '高二',
  '高三',
];

function getGrade(oier: OIer): string;
function getGrade(record: Record, rawData?: boolean): string;
function getGrade(enroll_middle: number, contestYear: number): string;
function getGrade(relativeGrade: number): string;
function getGrade(arg1: any, arg2?: any): string {
  let rel: number;
  if (arg1 instanceof OIer) {
    rel = currentYear - arg1.enroll_middle;
  } else if (arg1.oier) {
    rel =
      arg1.contest.school_year() -
      (arg2 ? arg1.enroll_middle.value : arg1.oier.enroll_middle);
  } else if (typeof arg2 === 'number') {
    rel = arg2 - arg1;
  } else {
    rel = arg1;
  }

  if (rel >= 6) return `高中毕业 ${rel - 5} 年`;
  else if (rel >= -6) return grades[rel + 6];
  else return '未知';
}

export default getGrade;
