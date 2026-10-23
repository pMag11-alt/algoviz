/**
 * The grid model shared by the algorithms, the maze generators and the view.
 *
 * Cells are addressed by a flat id = row * cols + col, which keeps the
 * algorithms fast (typed arrays instead of nested objects) and easy to test.
 */

export const WEIGHT_COST = 5;

export function createGrid(rows, cols) {
  return {
    rows,
    cols,
    walls: new Uint8Array(rows * cols),
    weights: new Uint8Array(rows * cols).fill(1),
  };
}

export const toId = (grid, row, col) => row * grid.cols + col;
export const rowOf = (grid, id) => Math.floor(id / grid.cols);
export const colOf = (grid, id) => id % grid.cols;

/** Open 4-directional neighbours, in the order up, right, down, left. */
export function neighbors(grid, id) {
  const { rows, cols, walls } = grid;
  const row = rowOf(grid, id);
  const col = colOf(grid, id);
  const result = [];
  if (row > 0 && !walls[id - cols]) result.push(id - cols);
  if (col < cols - 1 && !walls[id + 1]) result.push(id + 1);
  if (row < rows - 1 && !walls[id + cols]) result.push(id + cols);
  if (col > 0 && !walls[id - 1]) result.push(id - 1);
  return result;
}

export function manhattan(grid, a, b) {
  return Math.abs(rowOf(grid, a) - rowOf(grid, b)) + Math.abs(colOf(grid, a) - colOf(grid, b));
}

/**
 * Build a grid from an ASCII map, handy in tests:
 *   S start, E end, # wall, w weighted cell, . open cell
 */
export function parseGrid(lines) {
  const rows = lines.length;
  const cols = lines[0].length;
  const grid = createGrid(rows, cols);
  let start = -1;
  let end = -1;
  lines.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      const id = toId(grid, row, col);
      if (ch === "#") grid.walls[id] = 1;
      else if (ch === "w") grid.weights[id] = WEIGHT_COST;
      else if (ch === "S") start = id;
      else if (ch === "E") end = id;
    });
  });
  return { grid, start, end };
}
