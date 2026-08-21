import type { DbRecord, Gender } from '@oierdb/core';

import type { ParsedOIer } from './types';

export class ResultParser {
  private decoder: InstanceType<typeof TextDecoder> | null = null;
  private parsedCount = 0;
  private tail = '';
  private lastScore = NaN;
  private lastRank = 0;

  get count(): number {
    return this.parsedCount;
  }

  push(chunk: string | Uint8Array): ParsedOIer[] {
    const text = typeof chunk === 'string' ? chunk : (this.decoder ??= new TextDecoder()).decode(chunk, { stream: true });
    const input = this.tail + text;
    const oiers: ParsedOIer[] = [];
    let start = 0;
    let end = input.indexOf('\n');

    while (end !== -1) {
      oiers.push(this.parseLine(input.slice(start, end)));
      start = end + 1;
      end = input.indexOf('\n', start);
    }

    this.tail = input.slice(start);
    return oiers;
  }

  finish(): ParsedOIer[] {
    if (this.decoder) {
      const rest = this.decoder.decode();
      this.decoder = null;
      if (rest) this.tail += rest;
    }
    if (this.tail !== '') {
      const oier = this.parseLine(this.tail);
      this.tail = '';
      return [oier];
    }
    return [];
  }

  reset(): void {
    this.decoder = null;
    this.parsedCount = 0;
    this.tail = '';
    this.lastScore = NaN;
    this.lastRank = 0;
  }

  private parseLine(line: string): ParsedOIer {
    const [uid_, initials, name, gender, enrollMiddle, dbScore_, ccfScore, ccfLevel, compressedRecords] = line.split(',');

    const uid = Number(uid_);
    const dbScore = Number(dbScore_);
    const oier: ParsedOIer = {
      uid: uid,
      name,
      loweredName: name.toLowerCase(),
      initials,
      gender: Number(gender) as Gender,
      enrollMiddle: Number(enrollMiddle),
      oierdbScore: dbScore,
      ccfScore: Number(ccfScore),
      ccfLevel: Number(ccfLevel),
      rank: dbScore === this.lastScore ? this.lastRank : this.parsedCount,
      records: compressedRecords.split('/').map(record => this.parseRecord(record, uid)),
    };

    this.lastScore = dbScore;
    this.lastRank = oier.rank;
    this.parsedCount += 1;
    return oier;
  }

  private parseRecord(record: string, uid: number): DbRecord {
    const tokens = record.split(/([:;])/);
    const [contestId, , schoolId, , score, , rank, , province, , award, separator, enrollMiddle] = tokens;

    const parsed: DbRecord = {
      contestId: Number(contestId),
      uid,
      schoolId: Number(schoolId),
      award: Number(award),
      rank: Number(rank),
      province: Number(province),
    };
    if (score !== '') parsed.score = Number(score);
    if (enrollMiddle !== undefined) {
      parsed.enrollMiddle = Number(enrollMiddle);
      parsed.isStayDown = separator === ';';
    }
    return parsed;
  }
}

export function parseResult(text: string): ParsedOIer[] {
  const parser = new ResultParser();
  return parser.push(text).concat(parser.finish());
}
