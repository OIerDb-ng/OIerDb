import type { DbRecord, Gender } from '@oierdb/core';

import type { ParsedOIer } from './types';

export interface ResultParserOptions {
  onOIer?: (oier: ParsedOIer) => void;
}

export class ResultParser {
  private readonly options: ResultParserOptions;
  private decoder: InstanceType<typeof TextDecoder> | null = null;
  private oiers: ParsedOIer[] = [];
  private tail = '';
  private lastScore = NaN;
  private lastRank = 0;

  constructor(options: ResultParserOptions = {}) {
    this.options = options;
  }

  /** 已解析出的 OIer 数量 */
  get count(): number {
    return this.oiers.length;
  }

  push(chunk: string | Uint8Array): number {
    const text = typeof chunk === 'string' ? chunk : (this.decoder ??= new TextDecoder()).decode(chunk, { stream: true });

    const lines = (this.tail + text).split('\n');
    this.tail = lines.pop() ?? '';

    for (let i = 0; i < lines.length; i++) this.parseLine(lines[i]);
    return lines.length;
  }

  finish(): ParsedOIer[] {
    if (this.decoder) {
      const rest = this.decoder.decode();
      this.decoder = null;
      if (rest) this.tail += rest;
    }
    if (this.tail !== '') {
      this.parseLine(this.tail);
      this.tail = '';
    }
    return this.oiers;
  }

  reset(): void {
    this.decoder = null;
    this.oiers = [];
    this.tail = '';
    this.lastScore = NaN;
    this.lastRank = 0;
  }

  private parseLine(line: string): void {
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
      rank: dbScore === this.lastScore ? this.lastRank : this.oiers.length,
      records: compressedRecords.split('/').map(record => this.parseRecord(record, uid)),
    };

    this.lastScore = dbScore;
    this.lastRank = oier.rank;
    this.oiers.push(oier);
    this.options.onOIer?.(oier);
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

export function parseResult(text: string, options?: ResultParserOptions): ParsedOIer[] {
  const parser = new ResultParser(options);
  parser.push(text);
  return parser.finish();
}
