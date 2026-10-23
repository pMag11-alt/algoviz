import { mountPathfinding } from "./pathfinding/view.js";
import { mountSorting } from "./sorting/view.js";

const MOUNTERS = { pathfinding: mountPathfinding, sorting: mountSorting };
const views = {}; // mounted lazily: the grid sizes itself to the visible panel
let active = null;

function show(name) {
  if (!MOUNTERS[name]) name = "pathfinding";
  if (name === active) return;
  views[active]?.deactivate?.();

  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  }
  for (const key of Object.keys(MOUNTERS)) {
    document.getElementById(`panel-${key}`).hidden = key !== name;
  }
  views[name] ??= MOUNTERS[name](document.getElementById(`panel-${name}`));
  active = name;
}

window.addEventListener("hashchange", () => show(location.hash.slice(1)));
show(location.hash.slice(1));

// Space runs / pauses the active visualizer, unless a form control has focus.
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.target.closest("input, select, textarea, button, a")) return;
  event.preventDefault();
  views[active]?.primaryAction();
});
