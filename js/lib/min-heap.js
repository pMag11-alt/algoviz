/**
 * Binary min-heap keyed by (priority, tie).
 *
 * push and pop are O(log n). `tie` breaks equal priorities: A* uses the
 * heuristic so it prefers nodes closer to the goal, and the others use
 * insertion order so equal-cost nodes come out first-in first-out.
 */
export class MinHeap {
  #items = [];
  #counter = 0;

  get size() {
    return this.#items.length;
  }

  push(value, priority, tie = this.#counter++) {
    this.#items.push({ value, priority, tie });
    this.#siftUp(this.#items.length - 1);
  }

  pop() {
    const items = this.#items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      this.#siftDown(0);
    }
    return top.value;
  }

  #less(a, b) {
    const x = this.#items[a];
    const y = this.#items[b];
    return x.priority < y.priority || (x.priority === y.priority && x.tie < y.tie);
  }

  #swap(a, b) {
    const items = this.#items;
    [items[a], items[b]] = [items[b], items[a]];
  }

  #siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#less(i, parent)) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  #siftDown(i) {
    const n = this.#items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.#less(left, smallest)) smallest = left;
      if (right < n && this.#less(right, smallest)) smallest = right;
      if (smallest === i) return;
      this.#swap(i, smallest);
      i = smallest;
    }
  }
}
