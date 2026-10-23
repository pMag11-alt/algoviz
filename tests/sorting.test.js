import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { MinHeap } from "../js/lib/min-heap.js";
import { mulberry32, randInt } from "../js/lib/random.js";
import { SORTERS, measure } from "../js/sorting/algorithms.js";

const rng = mulberry32(2026);
const randomArray = (n, max = 100) => Array.from({ length: n }, () => randInt(rng, 1, max));

const CASES = {
  empty: [],
  single: [7],
  sorted: [1, 2, 3, 4, 5, 6, 7, 8],
  reversed: [9, 8, 7, 6, 5, 4, 3, 2, 1],
  duplicates: [3, 1, 3, 2, 1, 3, 2, 2],
  random50: randomArray(50),
  random200: randomArray(200, 20), // many duplicates
};

/** Replay steps the way the view does, on a separate copy of the input. */
function replay(input, run) {
  const shadow = [...input];
  const work = [...input];
  for (const step of run(work)) {
    if (step.type === "swap") [shadow[step.i], shadow[step.j]] = [shadow[step.j], shadow[step.i]];
    if (step.type === "set") shadow[step.i] = step.value;
  }
  return shadow;
}

for (const [key, { name, run }] of Object.entries(SORTERS)) {
  describe(name, () => {
    for (const [label, input] of Object.entries(CASES)) {
      test(`sorts ${label} input`, () => {
        const expected = [...input].sort((x, y) => x - y);
        assert.deepEqual(measure(run, input).sorted, expected);
      });

      test(`its steps replay to the sorted ${label} array`, () => {
        const expected = [...input].sort((x, y) => x - y);
        assert.deepEqual(replay(input, run), expected);
      });
    }
  });
}

describe("complexity sanity checks", () => {
  test("bubble and insertion sort are linear on sorted input", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i);
    assert.equal(measure(SORTERS.bubble.run, sorted).comparisons, 99);
    assert.equal(measure(SORTERS.insertion.run, sorted).comparisons, 99);
  });

  test("selection sort always does n(n-1)/2 comparisons", () => {
    assert.equal(measure(SORTERS.selection.run, randomArray(40)).comparisons, (40 * 39) / 2);
  });

  test("O(n log n) sorts beat O(n²) sorts on a large random array", () => {
    const input = randomArray(500, 10_000);
    const fast = ["merge", "quick", "heap"].map((k) => measure(SORTERS[k].run, input).comparisons);
    const slow = ["bubble", "selection", "insertion"].map((k) => measure(SORTERS[k].run, input).comparisons);
    assert.ok(Math.max(...fast) < Math.min(...slow));
  });

  test("quick sort stays fast on already-sorted input (middle pivot)", () => {
    const sorted = Array.from({ length: 1000 }, (_, i) => i);
    assert.ok(measure(SORTERS.quick.run, sorted).comparisons < 15_000);
  });
});

describe("MinHeap", () => {
  test("pops values in priority order", () => {
    const heap = new MinHeap();
    const values = randomArray(300, 1000);
    values.forEach((v) => heap.push(v, v));
    const out = [];
    while (heap.size) out.push(heap.pop());
    assert.deepEqual(out, [...values].sort((x, y) => x - y));
    assert.equal(heap.pop(), undefined);
  });

  test("breaks ties first-in first-out by default", () => {
    const heap = new MinHeap();
    ["a", "b", "c"].forEach((v) => heap.push(v, 1));
    assert.deepEqual([heap.pop(), heap.pop(), heap.pop()], ["a", "b", "c"]);
  });

  test("uses an explicit tie-breaker when given", () => {
    const heap = new MinHeap();
    heap.push("far", 5, 9);
    heap.push("near", 5, 1);
    assert.equal(heap.pop(), "near");
  });
});
