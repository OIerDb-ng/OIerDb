import { staticEndpoint } from './constant';

export const getShortVersion = (version: string) => version.slice(0, 7);
export const getStaticUrl = (version: string) =>
  `${staticEndpoint}/static.${getShortVersion(version)}.json`;
export const getResultUrl = (version: string) =>
  `${staticEndpoint}/result.${getShortVersion(version)}.txt`;
