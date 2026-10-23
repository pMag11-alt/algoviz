/**
 * Sorting algorithms written as generators.
 *
 * Each one sorts the array it is given in place and yields a step after
 * every comparison or write, so the view can replay the algorithm one step
 * at a time:
 *   { type: "compare", i, j }    two indices are being compared
 *   { type: "swap", i, j }       a[i] and a[j] were swapped
 *   { type: "set", i, value }    a[i] was overwritten (merge sort)
 *   { type: "pivot", i }         a[i] is the current pivot (quick sort)
 *   { type: "sorted", i }        a[i] is in its final position
 */

function* swap(a, i, j) {
  [a[i], a[j]] = [a[j], a[i]];
  yield { type: "swap", i, j };
}

export function* bubbleSort(a) {
  const n = a.length;
  for (let end = n - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      yield { type: "compare", i, j: i + 1 };
      if (a[i] > a[i + 1]) {
        yield* swap(a, i, i + 1);
        swapped = true;
      }
    }
    yield { type: "sorted", i: end };
    if (!swapped) break; // already sorted: best case O(n)
  }
}

export function* selectionSort(a) {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      yield { type: "compare", i: min, j };
      if (a[j] < a[min]) min = j;
    }
    if (min !== i) yield* swap(a, i, min);
    yield { type: "sorted", i };
  }
}

export function* insertionSort(a) {
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0; j--) {
      yield { type: "compare", i: j - 1, j };
      if (a[j - 1] <= a[j]) break;
      yield* swap(a, j - 1, j);
    }
  }
}

export function* mergeSort(a) {
  yield* mergeRange(a, 0, a.length - 1);
}

function* mergeRange(a, lo, hi) {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;
  yield* mergeRange(a, lo, mid);
  yield* mergeRange(a, mid + 1, hi);

  const left = a.slice(lo, mid + 1);
  const right = a.slice(mid + 1, hi + 1);
  let i = 0;
  let j = 0;
  let k = lo;
  while (i < left.length && j < right.length) {
    yield { type: "compare", i: k, j: mid + 1 + j };
    // `<=` takes from the left run on ties, which keeps merge sort stable.
    a[k] = left[i] <= right[j] ? left[i++] : right[j++];
    yield { type: "set", i: k, value: a[k] };
    k++;
  }
  while (i < left.length) {
    a[k] = left[i++];
    yield { type: "set", i: k, value: a[k] };
    k++;
  }
  while (j < right.length) {
    a[k] = right[j++];
    yield { type: "set", i: k, value: a[k] };
    k++;
  }
}

export function* quickSort(a) {
  yield* quickRange(a, 0, a.length - 1);
}

function* quickRange(a, lo, hi) {
  if (lo > hi) return;
  if (lo === hi) {
    yield { type: "sorted", i: lo };
    return;
  }
  // Lomuto partition with the middle element as pivot, which avoids the
  // O(n²) worst case on already-sorted input.
  const mid = (lo + hi) >> 1;
  yield* swap(a, mid, hi);
  yield { type: "pivot", i: hi };
  let store = lo;
  for (let i = lo; i < hi; i++) {
    yield { type: "compare", i, j: hi };
    if (a[i] < a[hi]) {
      if (i !== store) yield* swap(a, i, store);
      store++;
    }
  }
  if (store !== hi) yield* swap(a, store, hi);
  yield { type: "sorted", i: store };
  yield* quickRange(a, lo, store - 1);
  yield* quickRange(a, store + 1, hi);
}

export function* heapSort(a) {
  const n = a.length;
  for (let i = (n >> 1) - 1; i >= 0; i--) yield* siftDown(a, i, n);
  for (let end = n - 1; end > 0; end--) {
    yield* swap(a, 0, end); // move the current max to its final place
    yield { type: "sorted", i: end };
    yield* siftDown(a, 0, end);
  }
  if (n > 0) yield { type: "sorted", i: 0 };
}

function* siftDown(a, i, size) {
  for (;;) {
    const left = 2 * i + 1;
    const right = left + 1;
    let largest = i;
    if (left < size) {
      yield { type: "compare", i: left, j: largest };
      if (a[left] > a[largest]) largest = left;
    }
    if (right < size) {
      yield { type: "compare", i: right, j: largest };
      if (a[right] > a[largest]) largest = right;
    }
    if (largest === i) return;
    yield* swap(a, i, largest);
    i = largest;
  }
}

export const SORTERS = {
  merge: {
    name: "Merge Sort",
    run: mergeSort,
    best: "n log n", average: "n log n", worst: "n log n", space: "n", stable: true,
    blurb: "Divide and conquer: split the array in half, sort each half recursively, then merge the two sorted halves. Predictable O(n log n), at the cost of O(n) extra memory.",
  },
  quick: {
    name: "Quick Sort",
    run: quickSort,
    best: "n log n", average: "n log n", worst: "n²", space: "log n", stable: false,
    blurb: "Pick a pivot, partition smaller elements to its left and larger to its right, then recurse. Usually the fastest in practice thanks to cache-friendly in-place partitioning.",
  },
  heap: {
    name: "Heap Sort",
    run: heapSort,
    best: "n log n", average: "n log n", worst: "n log n", space: "1", stable: false,
    blurb: "Build a max-heap, then repeatedly swap the root (the maximum) to the end and restore the heap. Guaranteed O(n log n) using no extra memory.",
  },
  insertion: {
    name: "Insertion Sort",
    run: insertionSort,
    best: "n", average: "n²", worst: "n²", space: "1", stable: true,
    blurb: "Grow a sorted prefix by sliding each new element left into place. Excellent on small or nearly-sorted inputs, which is why hybrid sorts like Timsort use it.",
  },
  selection: {
    name: "Selection Sort",
    run: selectionSort,
    best: "n²", average: "n²", worst: "n²", space: "1", stable: false,
    blurb: "Repeatedly find the minimum of the unsorted part and swap it to the front. Always O(n²) comparisons, but at most n − 1 swaps.",
  },
  bubble: {
    name: "Bubble Sort",
    run: bubbleSort,
    best: "n", average: "n²", worst: "n²", space: "1", stable: true,
    blurb: "Repeatedly swap adjacent out-of-order pairs so the largest values bubble to the end. Stops early when a full pass makes no swaps.",
  },
};

/** Run an algorithm to completion and count its operations (used by "Compare all"). */
export function measure(run, input) {
  const a = [...input];
  let comparisons = 0;
  let writes = 0;
  for (const step of run(a)) {
    if (step.type === "compare") comparisons++;
    else if (step.type === "swap") writes += 2;
    else if (step.type === "set") writes++;
  }
  return { comparisons, writes, sorted: a };
}
