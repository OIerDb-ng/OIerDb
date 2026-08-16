import type { DbContest, DbOIer, DbRecord, DbSchool } from '@oierdb/core';

export type ParsedOIer = Omit<DbOIer, 'provinces'> & { records: DbRecord[] };
export type ParsedSchool = Omit<DbSchool, 'rank' | 'awardCounts'>;
export type ParsedContest = Omit<DbContest, 'length' | 'levelCounts'>;

export interface ParsedStatic {
  schools: ParsedSchool[];
  contests: ParsedContest[];
  extras: Record<string, unknown>;
}

export interface DataInfo {
  sha512: string;
  size: number;
}
