/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ParsedContest, ParsedStatic } from './types';

export function parseStatic(json: string): ParsedStatic {
  const { contests, schools, ...extras } = JSON.parse(json) as {
    contests: any[];
    schools: any[][];
    [key: string]: unknown;
  };

  return {
    contests: contests.map((contest, id) => {
      const parsed: ParsedContest = {
        id,
        name: contest.name,
        year: contest.year,
        type: contest.type,
        fallSemester: contest.fall_semester,
        fullScore: contest.full_score,
      };
      if (contest.capacity !== undefined) parsed.capacity = contest.capacity;
      return parsed;
    }),
    schools: schools.flatMap((school, id) => school[0] === ''
      ? []
      : [{ id, name: school[0], province: school[1], city: school[2], score: school[3] }]),
    extras,
  };
}
