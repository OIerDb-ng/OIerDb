export class Counter<K> extends Map<K, number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(entries?: any) {
    super(entries);
  }

  private _counter_common(n: number, k: 1 | -1) {
    const all = [...this.entries()].sort((x, y) => {
      if (x[1] !== y[1]) return k * (y[1] - x[1]);
      return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
    });
    return typeof n === 'number' ? all.slice(0, n) : all;
  }

  get(key: K): number {
    return super.get(key) ?? 0;
  }

  least_common(n: number) {
    return this._counter_common(n, -1);
  }

  most_common(n: number) {
    return this._counter_common(n, 1);
  }

  update(key: K, value = 1) {
    const newValue = this.get(key) + value;
    this.set(key, newValue);
    return newValue;
  }
}
