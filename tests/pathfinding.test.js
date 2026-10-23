import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mulberry32 } from "../js/lib/random.js";
import { PATHFINDERS, astar, bfs, dfs, dijkstra, greedy } from "../js/pathfinding/algorithms.js";
import { colOf, createGrid, neighbors, parseGrid, rowOf, toId } from "../js/pathfinding/grid.js";
import { recursiveDivision, scatter } from "../js/pathfinding/mazes.js";

const ALL = { bfs, dfs, dijkstra, astar, greedy };

/** A path is valid if it starts and ends correctly, moves one orthogonal step at a time and never enters a wall. */
function assertValidPath(grid, path, start, end) {
  assert.equal(path[0], start);
  assert.equal(path.at(-1), end);
  for (let i = 1; i < path.length; i++) {
    assert.ok(neighbors(grid, path[i - 1]).includes(path[i]), `step ${i} is not a legal move`);
  }
}

describe("all algorithms", () => {
  for (const [name, run] of Object.entries(ALL)) {
    test(`${name} finds a valid path around walls`, () => {
      const { grid, start, end } = parseGrid([
        "S..#....",
        ".#.#.##.",
        ".#...#.E",
      ]);
      const { path, visited } = run(grid, start, end);
      assertValidPath(grid, path, start, end);
      assert.equal(visited[0], start);
      assert.ok(visited.includes(end));
    });

    test(`${name} reports an empty path when the end is walled off`, () => {
      const { grid, start, end } = parseGrid([
        "S..#.",
        "...#E",
        "...##",
      ]);
      const result = run(grid, start, end);
      assert.deepEqual(result.path, []);
      assert.equal(result.cost, 0);
      assert.equal(result.visited.length, 9); // explored the whole reachable region
    });

    test(`${name} handles start === end`, () => {
      const { grid, start } = parseGrid(["S.."]);
      assert.deepEqual(run(grid, start, start).path, [start]);
    });
  }
});

describe("optimality", () => {
  test("BFS finds the fewest steps on an unweighted grid", () => {
    const { grid, start, end } = parseGrid([
      "S.....",
      ".####.",
      "......",
      ".####.",
      ".....E",
    ]);
    assert.equal(bfs(grid, start, end).path.length - 1, 9); // Manhattan distance, unobstructed route exists
  });

  test("Dijkstra and A* route around expensive cells; BFS walks straight through", () => {
    const { grid, start, end } = parseGrid([
      "S.wwwww.E",
      ".........",
    ]);
    assert.equal(bfs(grid, start, end).cost, 5 * 5 + 3);
    assert.equal(dijkstra(grid, start, end).cost, 10);
    assert.equal(astar(grid, start, end).cost, 10);
  });

  test("A* matches Dijkstra's cost and expands no more cells, on random weighted grids", () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 40; trial++) {
      const grid = createGrid(15, 25);
      const start = toId(grid, 1, 1);
      const end = toId(grid, 13, 23);
      for (const id of scatter(grid, [start, end], 0.25, rng)) grid.walls[id] = 1;
      for (const id of scatter(grid, [start, end], 0.15, rng)) if (!grid.walls[id]) grid.weights[id] = 5;

      const d = dijkstra(grid, start, end);
      const a = astar(grid, start, end);
      assert.equal(a.cost, d.cost, `trial ${trial}`);
      assert.equal(a.path.length > 0, d.path.length > 0);
      assert.ok(a.visited.length <= d.visited.length, `trial ${trial}: A* expanded more than Dijkstra`);
    }
  });

  test("greedy and DFS can return longer paths than the optimum", () => {
    const { grid, start, end } = parseGrid([
      "..........",
      ".########.",
      ".#......#.",
      ".#.####.#.",
      "S#.#..E.#.",
      ".#.####.#.",
      ".#......#.",
      "..........",
    ]);
    const best = dijkstra(grid, start, end).cost;
    assert.ok(dfs(grid, start, end).cost >= best);
    assert.ok(greedy(grid, start, end).cost >= best);
  });

  test("the metadata matches the algorithms", () => {
    for (const [key, info] of Object.entries(PATHFINDERS)) {
      assert.equal(info.run, ALL[key]);
      assert.equal(typeof info.blurb, "string");
    }
  });
});

describe("recursive division maze", () => {
  test("produces a perfect maze: every passage cell is reachable", () => {
    for (const seed of [1, 2, 3, 42]) {
      const grid = createGrid(21, 41);
      for (const id of recursiveDivision(grid, mulberry32(seed))) grid.walls[id] = 1;

      const start = toId(grid, 1, 1);
      // BFS towards an unreachable target explores everything reachable.
      const reached = new Set(bfs(grid, start, -1).visited);
      for (let id = 0; id < grid.rows * grid.cols; id++) {
        const oddCell = rowOf(grid, id) % 2 === 1 && colOf(grid, id) % 2 === 1;
        if (oddCell) {
          assert.equal(grid.walls[id], 0, "walls never land on odd/odd cells");
          assert.ok(reached.has(id), `cell ${id} unreachable with seed ${seed}`);
        }
      }
    }
  });

  test("is deterministic for a given seed", () => {
    const grid = createGrid(11, 21);
    assert.deepEqual(recursiveDivision(grid, mulberry32(5)), recursiveDivision(grid, mulberry32(5)));
  });
});
