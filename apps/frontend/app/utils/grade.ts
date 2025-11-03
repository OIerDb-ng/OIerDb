/**
 * Get current year based on the time of year
 * Before September 1st, it's still the previous academic year
 */
export function getCurrentAcademicYear(): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-indexed

  // If before September, still in previous academic year
  return currentMonth < 9 ? currentYear - 1 : currentYear;
}

/**
 * Grade names mapping
 * Index 0-5: Elementary school (一年级 to 六年级)
 * Index 6-8: Middle school (初一 to 初三)
 * Index 9-11: High school (高一 to 高三)
 */
const GRADES = [
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

/**
 * Convert enrollment year to readable grade string
 * @param enrollmentYear - The year when the student enrolled (入学年份)
 * @returns Grade string like "高一", "初二", "高中毕业 2 年", etc.
 */
export function getGrade(enrollmentYear: number): string;
export function getGrade(enrollmentYear: number, contestYear: number): string;
export function getGrade(enrollmentYear: number, contestYear?: number): string {
  const referenceYear = contestYear ?? getCurrentAcademicYear();
  const yearsSinceEnrollment = referenceYear - enrollmentYear;

  // High school graduated (高中毕业 X 年): year 6+
  if (yearsSinceEnrollment >= 6) {
    const yearsAfterGraduation = yearsSinceEnrollment - 5;
    return `高中毕业 ${yearsAfterGraduation} 年`;
  }

  // In school (elementary to high school): years -6 to 5
  if (yearsSinceEnrollment >= -6 && yearsSinceEnrollment <= 5) {
    return GRADES[yearsSinceEnrollment + 6];
  }

  // Unknown (未知): before elementary school
  return '未知';
}
