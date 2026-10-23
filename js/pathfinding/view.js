import { $, animateIndices, el, fillSelect } from "../lib/dom.js";
import { PATHFINDERS } from "./algorithms.js";
import { WEIGHT_COST, colOf, createGrid, rowOf, toId } from "./grid.js";
import { MAZES, recursiveDivision, scatter } from "./mazes.js";

const VISIT_SPEEDS = [0.5, 1, 3, 7, 18]; // cells revealed per frame, by speed slider
const PATH_SPEED = 0.6;
const MIN_CELL = 20;
const TARGET_CELL = 27;

export function mountPathfinding(root) {
  const gridEl = $("#pf-grid", root);
  const algoSelect = $("#pf-algo", root);
  const mazeSelect = $("#pf-maze", root);
  const speedInput = $("#pf-speed", root);
  const controls = [...root.querySelectorAll(".toolbar button, .toolbar select, #pf-compare")]
    .filter((node) => node.id !== "pf-clear-path" && node.id !== "pf-clear-board");

  fillSelect(algoSelect, PATHFINDERS);
  fillSelect(mazeSelect, MAZES);

  let grid;
  let cells = [];
  let start;
  let end;
  let brush = "wall";
  let lastResult = null; // set once a search has been drawn: edits then re-run instantly
  let abort = null; // AbortController of the running animation, if any

  // -------------------------------------------------------------- building the board

  function odd(n) {
    return n % 2 === 0 ? n - 1 : n;
  }

  function build() {
    const width = gridEl.parentElement.clientWidth;
    const cols = Math.max(11, odd(Math.floor(width / (width < 640 ? MIN_CELL : TARGET_CELL))));
    const cellSize = width / cols;
    const available = window.innerHeight - gridEl.getBoundingClientRect().top - 70;
    const rows = Math.min(31, Math.max(11, odd(Math.floor(available / cellSize))));

    grid = createGrid(rows, cols);
    gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    cells = Array.from({ length: rows * cols }, (_, id) => {
      const cell = el("div", { className: "cell" });
      cell.dataset.id = id;
      return cell;
    });
    gridEl.replaceChildren(...cells);

    // Endpoints sit on odd coordinates so they are always open in a maze.
    const midRow = odd(Math.floor(rows / 2)) || 1;
    start = toId(grid, midRow, odd(Math.floor(cols / 4)) || 1);
    end = toId(grid, midRow, odd(Math.floor((cols * 3) / 4)));
    cells[start].classList.add("start");
    cells[end].classList.add("end");
    lastResult = null;
    resetStats();
  }

  // -------------------------------------------------------------- cell state

  function setWall(id, on) {
    if (id === start || id === end) return;
    grid.walls[id] = on ? 1 : 0;
    if (on) grid.weights[id] = 1;
    cells[id].classList.toggle("wall", on);
    cells[id].classList.remove("weight");
  }

  function setWeight(id, on) {
    if (id === start || id === end || grid.walls[id]) return;
    grid.weights[id] = on ? WEIGHT_COST : 1;
    cells[id].classList.toggle("weight", on);
  }

  function moveEndpoint(which, id) {
    const current = which === "start" ? start : end;
    if (id === start || id === end || grid.walls[id]) return;
    cells[current].classList.remove(which);
    cells[id].classList.add(which);
    if (which === "start") start = id;
    else end = id;
  }

  function snapToPassage(id) {
    const fix = (n, size) => Math.min(size - 2, Math.max(1, n % 2 ? n : n - 1));
    return toId(grid, fix(rowOf(grid, id), grid.rows), fix(colOf(grid, id), grid.cols));
  }

  function clearPath() {
    abort?.abort();
    for (const cell of cells) cell.classList.remove("visited", "path", "instant");
    lastResult = null;
    resetStats();
  }

  function clearBoard() {
    clearPath();
    for (let id = 0; id < cells.length; id++) {
      setWall(id, false);
      setWeight(id, false);
    }
  }

  // -------------------------------------------------------------- running searches

  function search(key = algoSelect.value) {
    const t0 = performance.now();
    const result = PATHFINDERS[key].run(grid, start, end);
    result.ms = performance.now() - t0;
    return result;
  }

  function showStats(result) {
    $("#pf-visited", root).textContent = result.visited.length.toLocaleString();
    $("#pf-length", root).textContent = result.path.length ? `${result.path.length - 1} steps` : "No path";
    $("#pf-cost", root).textContent = result.path.length ? result.cost : "—";
    $("#pf-time", root).textContent = `${result.ms.toFixed(2)} ms`;
  }

  function resetStats() {
    for (const id of ["#pf-visited", "#pf-length", "#pf-cost", "#pf-time"]) $(id, root).textContent = "—";
  }

  function drawInstant(result) {
    for (const cell of cells) cell.classList.remove("visited", "path");
    for (const id of result.visited) cells[id].classList.add("visited", "instant");
    for (const id of result.path) cells[id].classList.add("path", "instant");
    showStats(result);
  }

  async function visualize() {
    clearPath();
    const result = search();
    setBusy(true);
    abort = new AbortController();
    const { signal } = abort;
    const speed = VISIT_SPEEDS[speedInput.value - 1];

    const finished =
      (await animateIndices(result.visited.length, speed, (i) => cells[result.visited[i]].classList.add("visited"), signal)) &&
      (await animateIndices(result.path.length, PATH_SPEED * Math.max(1, speed / 3), (i) => cells[result.path[i]].classList.add("path"), signal));

    setBusy(false);
    if (finished) {
      lastResult = result;
      showStats(result);
    }
  }

  /** After a run, any edit re-runs the search and redraws without animation. */
  function refreshIfLive() {
    if (lastResult) {
      lastResult = search();
      drawInstant(lastResult);
    }
  }

  async function generateObstacles() {
    clearBoard();
    const rng = Math.random;
    const kind = mazeSelect.value;
    let ids;
    let apply;
    if (kind === "division") {
      // The maze's passages are the odd/odd cells; make sure both endpoints sit on one.
      moveEndpoint("start", snapToPassage(start));
      moveEndpoint("end", snapToPassage(end));
      ids = recursiveDivision(grid, rng);
      apply = (id) => setWall(id, true);
    } else if (kind === "walls") {
      ids = scatter(grid, [start, end], 0.3, rng);
      apply = (id) => setWall(id, true);
    } else {
      ids = scatter(grid, [start, end], 0.35, rng);
      apply = (id) => setWeight(id, true);
    }
    setBusy(true);
    abort = new AbortController();
    await animateIndices(ids.length, VISIT_SPEEDS[speedInput.value - 1] * 3, (i) => apply(ids[i]), abort.signal);
    setBusy(false);
  }

  function setBusy(busy) {
    gridEl.classList.toggle("busy", busy);
    for (const node of controls) node.disabled = busy;
    if (!busy) abort = null;
  }

  // -------------------------------------------------------------- compare all

  function compareAll() {
    const rows = Object.entries(PATHFINDERS).map(([key, info]) => ({ key, info, result: search(key) }));
    const reachable = rows.some((r) => r.result.path.length);
    const bestCost = Math.min(...rows.filter((r) => r.result.path.length).map((r) => r.result.cost));
    const mostVisited = Math.max(...rows.map((r) => r.result.visited.length));

    const table = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { textContent: "Algorithm" }),
        el("th", { className: "num", textContent: "Visited" }),
        el("th", { className: "num", textContent: "Cost" }))),
      el("tbody", {}, ...rows.map(({ key, info, result }) => {
        const meter = el("div", { className: "meter" });
        meter.style.width = `${(result.visited.length / mostVisited) * 100}%`;
        const costCell = el("td", { className: "num", textContent: result.path.length ? result.cost : "—" });
        if (reachable && result.cost === bestCost && result.path.length) costCell.classList.add("best");
        const row = el("tr", { className: key === algoSelect.value ? "selected" : "" },
          el("td", {}, info.name.replace("'s Algorithm", ""), meter),
          el("td", { className: "num", textContent: result.visited.length.toLocaleString() }),
          costCell);
        row.dataset.key = key;
        row.title = `Show ${info.name} on the grid`;
        return row;
      })));

    const out = $("#pf-compare-out", root);
    out.replaceChildren(table, el("p", {
      className: "muted",
      textContent: reachable ? "Green = cheapest path. Click a row to draw it." : "The end node is unreachable.",
    }));
    out.querySelectorAll("tr[data-key]").forEach((row) => {
      row.onclick = () => {
        algoSelect.value = row.dataset.key;
        showInfo();
        lastResult = search();
        drawInstant(lastResult);
        compareAll();
      };
    });
  }

  function showInfo() {
    const info = PATHFINDERS[algoSelect.value];
    $("#pf-name", root).textContent = info.name;
    $("#pf-blurb", root).textContent = info.blurb;
    $("#pf-complexity", root).textContent = info.complexity;
    $("#pf-weighted", root).textContent = info.weighted ? "Yes" : "No (treats every step as 1)";
    $("#pf-optimal", root).textContent = info.optimal ? "Guaranteed" : "Not guaranteed";
  }

  // -------------------------------------------------------------- pointer editing

  let drag = null; // "start" | "end" | "paint"
  let paintOn = true;
  let lastId = -1;

  function cellAt(x, y) {
    const node = document.elementFromPoint(x, y)?.closest(".cell");
    return node && gridEl.contains(node) ? Number(node.dataset.id) : -1;
  }

  function paint(id) {
    if (brush === "wall") setWall(id, paintOn);
    else setWeight(id, paintOn);
  }

  /** Cells on the straight line between two cells, so fast drags don't leave gaps. */
  function* lineBetween(a, b) {
    const [r0, c0, r1, c1] = [rowOf(grid, a), colOf(grid, a), rowOf(grid, b), colOf(grid, b)];
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
    for (let s = 1; s <= steps; s++) {
      yield toId(grid, Math.round(r0 + ((r1 - r0) * s) / steps), Math.round(c0 + ((c1 - c0) * s) / steps));
    }
  }

  gridEl.addEventListener("pointerdown", (event) => {
    if (abort || event.button > 0) return;
    const id = cellAt(event.clientX, event.clientY);
    if (id < 0) return;
    event.preventDefault();
    gridEl.setPointerCapture(event.pointerId);
    lastId = id;
    if (id === start || id === end) {
      drag = id === start ? "start" : "end";
      document.body.classList.add("dragging");
    } else {
      drag = "paint";
      paintOn = brush === "wall" ? !grid.walls[id] : grid.weights[id] === 1;
      paint(id);
      refreshIfLive();
    }
  });

  gridEl.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const id = cellAt(event.clientX, event.clientY);
    if (id < 0 || id === lastId) return;
    if (drag === "paint") {
      for (const step of lineBetween(lastId, id)) paint(step);
    } else {
      moveEndpoint(drag, id);
    }
    lastId = id;
    refreshIfLive();
  });

  const endDrag = () => {
    drag = null;
    document.body.classList.remove("dragging");
  };
  gridEl.addEventListener("pointerup", endDrag);
  gridEl.addEventListener("pointercancel", endDrag);

  // -------------------------------------------------------------- wiring

  root.querySelectorAll("[data-brush]").forEach((button) => {
    button.onclick = () => {
      brush = button.dataset.brush;
      root.querySelectorAll("[data-brush]").forEach((b) => b.setAttribute("aria-checked", String(b === button)));
    };
  });
  algoSelect.onchange = () => {
    showInfo();
    refreshIfLive();
  };
  $("#pf-run", root).onclick = visualize;
  $("#pf-maze-run", root).onclick = generateObstacles;
  $("#pf-clear-path", root).onclick = clearPath;
  $("#pf-clear-board", root).onclick = clearBoard;
  $("#pf-compare", root).onclick = compareAll;

  let lastWidth = 0;
  const onResize = () => {
    const width = gridEl.parentElement.clientWidth;
    if (width > 0 && !abort && Math.abs(width - lastWidth) > TARGET_CELL) {
      lastWidth = width;
      build();
    }
  };
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 200);
  });

  showInfo();
  lastWidth = gridEl.parentElement.clientWidth;
  build();

  return { primaryAction: () => (abort ? clearPath() : visualize()) };
}
