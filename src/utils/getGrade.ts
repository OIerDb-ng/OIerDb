export default (enroll_middle: number, contestYear?: number) => {
    const nowYear =
        contestYear ||
        new Date().getFullYear() - Number(new Date().getMonth() + 1 < 9);
    const years1 = ['初一', '初二', '初三', '高一', '高二', '高三'];
    const years2 = ['六年级', '五年级', '四年级', '三年级', '二年级', '一年级'];

    let grade = null;
    const year = nowYear - enroll_middle;

    if (year < 0) {
        grade = years2[-(year + 1)];
    } else if (year >= 6) {
        grade = '高中毕业 ' + (year - 5) + ' 年';
    } else {
        grade = years1[year];
    }

    if (!grade) grade = '未知';
    return grade;
};
