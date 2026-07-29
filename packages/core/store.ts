import type { DbContest, DbOIer, DbRecord, DbSchool, DbMetadata } from './interface';

export type KeyRangeBound = string | number | readonly (string | number)[];

export interface KeyRange<K extends KeyRangeBound = KeyRangeBound> {
  lower?: K;
  lowerOpen?: boolean;
  upper?: K;
  upperOpen?: boolean;
  equals?: K;
}

export const KeyRange = {
  only<const K extends KeyRangeBound>(value: K): KeyRange<K> {
    return { equals: value };
  },

  bound<const K extends KeyRangeBound>(
    lower: K,
    upper: K,
    lowerOpen = false,
    upperOpen = false
  ): KeyRange<K> {
    return { lower, upper, lowerOpen, upperOpen };
  },

  lowerBound<const K extends KeyRangeBound>(lower: K, open = false): KeyRange<K> {
    return { lower, lowerOpen: open };
  },

  upperBound<const K extends KeyRangeBound>(upper: K, open = false): KeyRange<K> {
    return { upper, upperOpen: open };
  },

  prefix(value: string): KeyRange<string> {
    return {
      lower: value,
      lowerOpen: false,
      upper: `${value}${String.fromCharCode(0xffff)}`,
      upperOpen: false,
    };
  },
};

export interface StoreRecordMap {
  oiers: DbOIer;
  schools: DbSchool;
  contests: DbContest;
  records: DbRecord;
  meta: DbMetadata;
}

export type StoreName = keyof StoreRecordMap;
export type StoreRecord<Table extends StoreName> = StoreRecordMap[Table];

type KeyField<Record> = {
  [Field in keyof Record]-?: Record[Field] extends KeyRangeBound ? Field : never;
}[keyof Record] & string;
type KeyPath<Record> = KeyField<Record> | readonly [KeyField<Record>, ...KeyField<Record>[]];

type StoreSchema = {
  [Table in StoreName]: {
    pk: KeyPath<StoreRecord<Table>>;
    indexes: readonly KeyPath<StoreRecord<Table>>[];
  };
};

export const SCHEMA = {
  oiers: {
    pk: 'uid',
    indexes: [
      'name', 'loweredName', 'initials', 'enrollMiddle', 'gender', 'rank', 'provinces',
      ['rank', 'uid'], // 复合索引在 IndexRangeQuery 中使用 `+` 拼接，例如 `rank+uid`
    ],
  },
  schools: {
    pk: 'id',
    indexes: ['name', 'province', 'city', 'rank', ['rank', 'id'], ['province', 'city']],
  },
  contests: {
    pk: 'id',
    indexes: ['id', 'name', 'year', 'type', ['type', 'year']],
  },
  records: {
    pk: ['contestId', 'uid'],
    indexes: ['contestId', ['contestId', 'rank'], 'schoolId', 'uid', 'award', 'province'],
  },
  meta: {
    pk: 'key',
    indexes: [],
  },
} as const satisfies StoreSchema;

type KeyPathValue<Record, Path>
  = Path extends keyof Record
    ? Extract<Record[Path], KeyRangeBound>
    : Path extends readonly unknown[]
      ? Readonly<{
        [Position in keyof Path]: Path[Position] extends keyof Record
          ? Extract<Record[Path[Position]], string | number> : never;
      }> : never;

type IndexKeyPathValue<Record, Path>
  = Path extends keyof Record
    ? Record[Path] extends readonly (infer Item)[]
      ? Extract<Item, string | number>
      : Extract<Record[Path], string | number>
    : KeyPathValue<Record, Path>;

type KeyPathName<Path>
  = Path extends string
    ? Path
    : Path extends readonly [infer First extends string, ...infer Rest extends readonly string[]]
      ? Rest extends readonly [] ? First : `${First}+${KeyPathName<Rest>}`
      : never;

type MatchingKeyPath<Paths, Name>
  = Paths extends unknown
    ? KeyPathName<Paths> extends Name
      ? Paths
      : never
    : never;

export type StorePrimaryKey<Table extends StoreName>
  = KeyPathValue<StoreRecord<Table>, (typeof SCHEMA)[Table]['pk']>;

export type StoreRecordByPrimaryKey<
  Table extends StoreName,
  Key extends StorePrimaryKey<Table>,
> = StoreRecord<Table> extends infer Record
  ? Record extends unknown
    ? Key extends KeyPathValue<Record, (typeof SCHEMA)[Table]['pk']>
      ? Record
      : never
    : never
  : never;

export type StoreIndexName<Table extends StoreName>
  = KeyPathName<(typeof SCHEMA)[Table]['indexes'][number]>;

export type StoreIndexKey<
  Table extends StoreName,
  Index extends StoreIndexName<Table>,
> = IndexKeyPathValue<
  StoreRecord<Table>,
  MatchingKeyPath<(typeof SCHEMA)[Table]['indexes'][number], Index>
>;

interface IndexRangeOptions {
  reverse?: boolean;
  offset?: number;
  limit?: number;
}

type PrimaryKeyRangeQuery<Table extends StoreName> = IndexRangeOptions & {
  table: Table;
  index?: undefined; // 省略时按主键扫描
  range?: KeyRange<StorePrimaryKey<Table>>;
};

type NamedIndexRangeQuery<Table extends StoreName> = {
  [Index in StoreIndexName<Table>]: IndexRangeOptions & {
    table: Table;
    index: Index;
    range?: KeyRange<StoreIndexKey<Table, Index>>;
  };
}[StoreIndexName<Table>];

export type IndexRangeQuery<Table extends StoreName = StoreName>
  = Table extends StoreName
    ? PrimaryKeyRangeQuery<Table> | NamedIndexRangeQuery<Table>
    : never;

type CountArgs<Table extends StoreName>
  = | [index?: undefined, range?: KeyRange<StorePrimaryKey<Table>>]
    | {
      [Index in StoreIndexName<Table>]: [
        index: Index,
        range?: KeyRange<StoreIndexKey<Table, Index>>,
      ];
    }[StoreIndexName<Table>];

export interface IDataStore {
  get<
    Table extends StoreName,
    const Key extends StorePrimaryKey<NoInfer<Table>>,
  >(table: Table, key: Key): Promise<StoreRecordByPrimaryKey<Table, Key> | undefined>;
  bulkGet<
    Table extends StoreName,
    const Keys extends readonly StorePrimaryKey<NoInfer<Table>>[],
  >(table: Table, keys: Keys): Promise<{
    -readonly [Position in keyof Keys]:
      StoreRecordByPrimaryKey<Table, Keys[Position]> | undefined;
  }>;
  indexRange<Table extends StoreName>(query: IndexRangeQuery<Table>): Promise<StoreRecord<Table>[]>;
  count<Table extends StoreName>(table: Table, ...args: CountArgs<NoInfer<Table>>): Promise<number>;
  putBatch<Table extends StoreName>(table: Table, items: readonly StoreRecord<NoInfer<Table>>[]): Promise<void>;
  clear<Table extends StoreName>(table: Table): Promise<void>;
}
