import { $, el, fillSelect } from "../lib/dom.js";
import { SORTERS, measure } from "./algorithms.js";

// Steps per animation frame for speed 1..10 (fractions = one step every few frames).
const STEP_SPEEDS = [0.05, 0.12, 0.25, 0.5, 1, 2, 4, 9, 20, 50];

export function mountSorting(root) {
  const barsEl = $("#so-bars", root);
  const algoSelect = $("#so-algo", root);
  const sizeInput = $("#so-size", root);
  const speedInput = $("#so-speed", root);
  const playBtn = $("#so-play", root);
  const stepBtn = $("#so-step", root);

  fillSelect(algoSelect, SORTERS);

  let initial = []; // the unsorted input, kept for "Compare all"
  let values = []; // what the bars currently show
  let bars = [];
  let steps = null; // the running generator
  let playing = false;
  let finished = false;
  let highlighted = [];
  let pivot = -1;
  let counters = { comparisons: 0, writes: 0, steps: 0 };

  // -------------------------------------------------------------- array + bars

  function newArray() {
    stop();
    const n = Number(sizeInput.value);
    initial = Array.from({ length: n }, () => 4 + Math.floor(Math.random() * 96));
    reset();
  }

  function reset() {
    stop();
    values = [...initial];
    bars = values.map((v) => {
      const bar = el("div", { className: "bar" });
      bar.style.height = `${v}%`;
      return bar;
    });
    barsEl.classList.toggle("dense", values.length > 70);
    barsEl.replaceChildren(...bars);
    steps = null;
    finished = false;
    highlighted = [];
    pivot = -1;
    counters = { comparisons: 0, writes: 0, steps: 0 };
    renderCounters();
    updateButtons();
  }

  function setHeight(i) {
    bars[i].style.height = `${values[i]}%`;
  }

  function highlight(className, ...indices) {
    for (const i of indices) bars[i]?.classList.add(className);
    highlighted.push(...indices.map((i) => [i, className]));
  }

  function clearHighlights() {
    for (const [i, className] of highlighted) bars[i]?.classList.remove(className);
    highlighted = [];
  }

  // -------------------------------------------------------------- stepping

  /** Apply one step from the generator to the bars. Returns false when done. */
  function advance() {
    if (!steps) {
      // The generator sorts its own copy; the view mirrors each step onto `values`.
      steps = SORTERS[algoSelect.value].run([...values]);
    }
    const { value: step, done } = steps.next();
    clearHighlights();
    if (done) {
      finish();
      return false;
    }

    counters.steps++;
    switch (step.type) {
      case "compare":
        counters.comparisons++;
        highlight("compare", step.i, step.j);
        break;
      case "swap":
        counters.writes += 2;
        [values[step.i], values[step.j]] = [values[step.j], values[step.i]];
        setHeight(step.i);
        setHeight(step.j);
        highlight("swap", step.i, step.j);
        break;
      case "set":
        counters.writes++;
        values[step.i] = step.value;
        setHeight(step.i);
        highlight("swap", step.i);
        break;
      case "pivot":
        if (pivot >= 0) bars[pivot].classList.remove("pivot");
        pivot = step.i;
        bars[pivot].classList.add("pivot");
        break;
      case "sorted":
        bars[step.i].classList.remove("pivot");
        bars[step.i].classList.add("sorted");
        break;
    }
    return true;
  }

  function finish() {
    playing = false;
    finished = true;
    if (pivot >= 0) bars[pivot].classList.remove("pivot");
    renderCounters();
    updateButtons();
    // Sweep left to right marking everything as sorted.
    let i = 0;
    const sweep = () => {
      for (let k = 0; k < Math.max(1, bars.length / 30) && i < bars.length; k++) bars[i++].classList.add("sorted");
      if (i < bars.length && finished) requestAnimationFrame(sweep);
    };
    requestAnimationFrame(sweep);
  }

  let budget = 0;
  function loop() {
    if (!playing) return;
    budget += STEP_SPEEDS[speedInput.value - 1];
    while (budget >= 1) {
      budget -= 1;
      if (!advance()) return;
    }
    renderCounters();
    requestAnimationFrame(loop);
  }

  function play() {
    if (finished) reset();
    playing = true;
    budget = 1; // take the first step immediately
    updateButtons();
    requestAnimationFrame(loop);
  }

  function stop() {
    playing = false;
    updateButtons();
  }

  function togglePlay() {
    if (playing) stop();
    else play();
  }

  function stepOnce() {
    if (finished) reset();
    stop();
    advance();
    renderCounters();
  }

  // -------------------------------------------------------------- side panel

  function renderCounters() {
    $("#so-comparisons", root).textContent = counters.comparisons.toLocaleString();
    $("#so-writes", root).textContent = counters.writes.toLocaleString();
    $("#so-steps", root).textContent = counters.steps.toLocaleString();
  }

  function updateButtons() {
    playBtn.textContent = playing ? "❚❚ Pause" : finished ? "↺ Replay" : steps ? "▶ Resume" : "▶ Play";
    stepBtn.disabled = playing;
  }

  function showInfo() {
    const info = SORTERS[algoSelect.value];
    $("#so-name", root).textContent = info.name;
    $("#so-blurb", root).textContent = info.blurb;
    const facts = [
      ["Best case", `O(${info.best})`],
      ["Average case", `O(${info.average})`],
      ["Worst case", `O(${info.worst})`],
      ["Extra space", `O(${info.space})`],
      ["Stable", info.stable ? "Yes" : "No"],
    ];
    $("#so-facts", root).replaceChildren(
      ...facts.map(([label, value]) => el("div", {}, el("dt", { textContent: label }), el("dd", { textContent: value }))),
    );
  }

  function compareAll() {
    const rows = Object.entries(SORTERS)
      .map(([key, info]) => ({ key, info, ...measure(info.run, initial) }))
      .sort((a, b) => a.comparisons - b.comparisons);
    const most = Math.max(...rows.map((r) => r.comparisons), 1);

    const table = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { textContent: `Algorithm (n = ${initial.length})` }),
        el("th", { className: "num", textContent: "Compares" }),
        el("th", { className: "num", textContent: "Writes" }))),
      el("tbody", {}, ...rows.map(({ key, info, comparisons, writes }) => {
        const meter = el("div", { className: "meter" });
        meter.style.width = `${(comparisons / most) * 100}%`;
        const row = el("tr", { className: key === algoSelect.value ? "selected" : "" },
          el("td", {}, info.name, meter),
          el("td", { className: "num", textContent: comparisons.toLocaleString() }),
          el("td", { className: "num", textContent: writes.toLocaleString() }));
        row.dataset.key = key;
        row.title = `Select ${info.name}`;
        return row;
      })));

    const out = $("#so-compare-out", root);
    out.replaceChildren(table);
    out.querySelectorAll("tr[data-key]").forEach((row) => {
      row.onclick = () => {
        algoSelect.value = row.dataset.key;
        algoSelect.onchange();
      };
    });
  }

  // -------------------------------------------------------------- wiring

  algoSelect.onchange = () => {
    showInfo();
    reset();
    if ($("#so-compare-out table", root)) compareAll();
  };
  sizeInput.oninput = () => {
    $("#so-size-out", root).textContent = sizeInput.value;
    newArray();
    $("#so-compare-out", root).textContent = "Counts comparisons and writes for every algorithm on the same input.";
  };
  playBtn.onclick = togglePlay;
  stepBtn.onclick = stepOnce;
  $("#so-shuffle", root).onclick = () => {
    newArray();
    if ($("#so-compare-out table", root)) compareAll();
  };
  $("#so-compare", root).onclick = compareAll;

  showInfo();
  newArray();

  return { primaryAction: togglePlay, deactivate: stop };
}
