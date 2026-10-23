/**
 * Pathfinding algorithms on a 4-connected grid.
 *
 * Every algorithm has the signature (grid, start, end) => result where
 *   result.visited  cell ids in the order they were expanded (for animation)
 *   result.path     cell ids from start to end inclusive, [] if unreachable
 *   result.cost     sum of the weights of the cells entered along the path
 *
 * They are pure functions with no DOM access, so they are unit-tested
 * directly in tests/pathfinding.test.js.
 */
import { MinHeap } from "../lib/min-heap.js";
import { manhattan, neighbors } from "./grid.js";

function buildResult(grid, visited, prev, start, end) {
  const path = [];
  if (start === end || prev[end] !== -1) {
    for (let node = end; node !== -1; node = prev[node]) path.push(node);
    path.reverse();
  }
  let cost = 0;
  for (let i = 1; i < path.length; i++) cost += grid.weights[path[i]];
  return { visited, path, cost };
}

/** Breadth-first search: fewest steps, ignores weights. O(V + E). */
export function bfs(grid, start, end) {
  const n = grid.rows * grid.cols;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const queue = [start];
  const visited = [];
  seen[start] = 1;

  // An index pointer instead of queue.shift() keeps dequeue O(1).
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    visited.push(node);
    if (node === end) break;
    for (const next of neighbors(grid, node)) {
      if (seen[next]) continue;
      seen[next] = 1;
      prev[next] = node;
      queue.push(next);
    }
  }
  return buildResult(grid, visited, prev, start, end);
}

/** Depth-first search (iterative): finds *a* path, usually not the shortest. O(V + E). */
export function dfs(grid, start, end) {
  const n = grid.rows * grid.cols;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const stack = [start];
  const visited = [];

  while (stack.length > 0) {
    const node = stack.pop();
    if (seen[node]) continue;
    seen[node] = 1;
    visited.push(node);
    if (node === end) break;
    // Push in reverse so the first neighbour (up) is explored first.
    const next = neighbors(grid, node);
    for (let i = next.length - 1; i >= 0; i--) {
      if (!seen[next[i]]) {
        prev[next[i]] = node;
        stack.push(next[i]);
      }
    }
  }
  return buildResult(grid, visited, prev, start, end);
}

/**
 * Shared engine for Dijkstra, A* and greedy best-first search. They differ
 * only in how a frontier node is prioritised, given its cost so far `g`.
 */
function bestFirst(grid, start, end, priority, tie) {
  const n = grid.rows * grid.cols;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  const visited = [];

  dist[start] = 0;
  heap.push(start, priority(0, start), tie?.(start));
  while (heap.size > 0) {
    const node = heap.pop();
    if (done[node]) continue; // stale entry: a cheaper route was found later
    done[node] = 1;
    visited.push(node);
    if (node === end) break;
    for (const next of neighbors(grid, node)) {
      if (done[next]) continue;
      const g = dist[node] + grid.weights[next];
      if (g < dist[next]) {
        dist[next] = g;
        prev[next] = node;
        heap.push(next, priority(g, next), tie?.(next));
      }
    }
  }
  return buildResult(grid, visited, prev, start, end);
}

/** Dijkstra: cheapest path on non-negative weights. O((V + E) log V). */
export function dijkstra(grid, start, end) {
  return bestFirst(grid, start, end, (g) => g);
}

/** A*: Dijkstra guided by the Manhattan-distance heuristic. Still optimal because
 *  the heuristic never overestimates (every step costs at least 1). */
export function astar(grid, start, end) {
  const h = (id) => manhattan(grid, id, end);
  return bestFirst(grid, start, end, (g, id) => g + h(id), h);
}

/** Greedy best-first: follows the heuristic only. Fast, but not optimal. */
export function greedy(grid, start, end) {
  const h = (id) => manhattan(grid, id, end);
  return bestFirst(grid, start, end, (_, id) => h(id));
}

export const PATHFINDERS = {
  astar: {
    name: "A* Search",
    run: astar,
    weighted: true,
    optimal: true,
    complexity: "O((V + E) log V)",
    blurb: "Dijkstra plus a heuristic: expands the node with the lowest cost-so-far + estimated distance to the goal. Optimal with an admissible heuristic, and usually explores far fewer cells.",
  },
  dijkstra: {
    name: "Dijkstra's Algorithm",
    run: dijkstra,
    weighted: true,
    optimal: true,
    complexity: "O((V + E) log V)",
    blurb: "Always expands the cheapest unexplored node using a priority queue. Guarantees the cheapest path on graphs with non-negative weights.",
  },
  bfs: {
    name: "Breadth-First Search",
    run: bfs,
    weighted: false,
    optimal: true,
    complexity: "O(V + E)",
    blurb: "Explores level by level with a FIFO queue. Finds the path with the fewest steps but ignores weights, so it may cross expensive cells.",
  },
  dfs: {
    name: "Depth-First Search",
    run: dfs,
    weighted: false,
    optimal: false,
    complexity: "O(V + E)",
    blurb: "Dives as deep as possible with a LIFO stack before backtracking. Finds a path if one exists, but it is often long and winding.",
  },
  greedy: {
    name: "Greedy Best-First",
    run: greedy,
    weighted: true,
    optimal: false,
    complexity: "O((V + E) log V)",
    blurb: "Always moves toward whatever looks closest to the goal by the heuristic, ignoring the cost so far. Very fast on open grids, but easily fooled by walls.",
  },
};
