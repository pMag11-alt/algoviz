/**
 * Maze and obstacle generators. Each returns the cells to change in the
 * order they should be drawn, so the view can animate them.
 */
import { randInt } from "../lib/random.js";
import { toId } from "./grid.js";

/**
 * Recursive division: start from an open room, split it with a wall that has
 * one gap, then recurse into both halves. Walls sit on even rows/cols and
 * passages on odd ones, so the grid should have odd dimensions and start/end
 * should sit on odd coordinates. The result is a perfect maze: every open
 * cell is reachable, with exactly one route between any two cells.
 */
export function recursiveDivision(grid, rng = Math.random) {
  const { rows, cols } = grid;
  const walls = [];
  const add = (row, col) => walls.push(toId(grid, row, col));

  // Outer border, drawn clockwise.
  for (let c = 0; c < cols; c++) add(0, c);
  for (let r = 1; r < rows; r++) add(r, cols - 1);
  for (let c = cols - 2; c >= 0; c--) add(rows - 1, c);
  for (let r = rows - 2; r > 0; r--) add(r, 0);

  // A random value from lo, lo + 2, lo + 4, ... <= hi, so it keeps lo's parity.
  const pick = (lo, hi) => lo + 2 * randInt(rng, 0, Math.floor((hi - lo) / 2));

  // top/bottom/left/right are odd (passage) coordinates bounding a room.
  function divide(top, bottom, left, right) {
    const height = bottom - top;
    const width = right - left;
    if (height < 2 || width < 2) return;

    const horizontal = height > width || (height === width && rng() < 0.5);
    if (horizontal) {
      const wallRow = pick(top + 1, bottom - 1); // even
      const gapCol = pick(left, right); // odd
      for (let c = left; c <= right; c++) if (c !== gapCol) add(wallRow, c);
      divide(top, wallRow - 1, left, right);
      divide(wallRow + 1, bottom, left, right);
    } else {
      const wallCol = pick(left + 1, right - 1);
      const gapRow = pick(top, bottom);
      for (let r = top; r <= bottom; r++) if (r !== gapRow) add(r, wallCol);
      divide(top, bottom, left, wallCol - 1);
      divide(top, bottom, wallCol + 1, right);
    }
  }

  divide(1, rows - 2, 1, cols - 2);
  return walls;
}

/** Scatter cells at the given density, never touching `keep` (start/end). */
export function scatter(grid, keep, density, rng = Math.random) {
  const cells = [];
  for (let id = 0; id < grid.rows * grid.cols; id++) {
    if (!keep.includes(id) && rng() < density) cells.push(id);
  }
  return cells;
}

export const MAZES = {
  division: { name: "Recursive division maze" },
  walls: { name: "Random walls" },
  weights: { name: "Random weights" },
};
