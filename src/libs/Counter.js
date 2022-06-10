function counter_common(data, n, k) {
  let all = Object.entries(data).sort((x, y) => {
    if (x[1] !== y[1]) return k * (y[1] - x[1]);
    return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
  });
  return typeof n === 'number' ? all.slice(0, n) : all;
}

export class Counter {
  constructor() {
    this.dict = Object.create(null);
  }

  clear() {
    for (let key in this.dict) delete this.dict[key];
  }
  get(key) {
    return this.dict[key] ?? 0;
  }
  least_common(n) {
    return counter_common(this.dict, n, -1);
  }
  length() {
    return Object.keys(this.dict).length;
  }
  most_common(n) {
    return counter_common(this.dict, n, 1);
  }

  update(key, value = 1) {
    if (!(key in this.dict)) this.dict[key] = 0;
    this.dict[key] += value;
  }
}
