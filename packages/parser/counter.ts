export class Counter<K> extends Map<K, number> {
  get(key: K): number {
    return super.get(key) ?? 0;
  }

  update(key: K, value = 1): number {
    const newValue = this.get(key) + value;
    this.set(key, newValue);
    return newValue;
  }

  toRecord(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.entries()) {
      result[String(key)] = value;
    }
    return result;
  }
}
