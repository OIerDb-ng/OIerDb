/** 省级行政区代码到名称的映射；与 generator 严格对应 */
export const provincesIdMap = {
  AH: '安徽',
  BJ: '北京',
  FJ: '福建',
  GS: '甘肃',
  GD: '广东',
  GX: '广西',
  GZ: '贵州',
  HI: '海南',
  HE: '河北',
  HA: '河南',
  HL: '黑龙江',
  HB: '湖北',
  HN: '湖南',
  JL: '吉林',
  JS: '江苏',
  JX: '江西',
  LN: '辽宁',
  NM: '内蒙古',
  SD: '山东',
  SX: '山西',
  SN: '陕西',
  SH: '上海',
  SC: '四川',
  TJ: '天津',
  XJ: '新疆',
  ZJ: '浙江',
  CQ: '重庆',
  NX: '宁夏',
  YN: '云南',
  MO: '澳门',
  HK: '香港',
  QH: '青海',
  XC: '西藏',
  TW: '台湾',
} as const;

/** 省级行政区名称列表；下标和 generator 严格对应 */
export const provinces: readonly string[] = Object.values(provincesIdMap);

/** 奖项名称到展示颜色的映射；awards 的顺序与 generator 严格对应，不得调整 */
export const awardColors = {
  '金牌': '#ee961b',
  '银牌': '#939291',
  '铜牌': '#9c593b',
  '一等奖': '#ee961b',
  '二等奖': '#939291',
  '三等奖': '#9c593b',
  '国际金牌': '#ee961b',
  '国际银牌': '#939291',
  '国际铜牌': '#9c593b',
  '前5%': '#ee961b',
  '前15%': '#939291',
  '前25%': '#9c593b',
} as const;

/** 奖项名称列表；下标与 generator 严格对应 */
export const awards: readonly string[] = Object.keys(awardColors);

/** 比赛类型列表；下标与 generator 严格对应 */
export const contestTypes: readonly string[] = [
  'NOI',
  'NOIP提高',
  'CTSC',
  'APIO',
  'NOID类',
  'IOI',
  'NOIP普及',
  'WC',
  'CSP提高',
  'CSP入门',
  'NOIP',
  'NGOI',
  'NOIST',
  'WC-AI',
];

/** 性别列表；下标与 generator 严格对应 */
export const genders = {
  [-1]: '女',
  1: '男',
  0: '不详',
} as const;

export const genderKeys = Object.keys(genders).map(Number) as readonly (-1 | 0 | 1)[];
