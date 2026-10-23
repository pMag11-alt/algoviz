export const $ = (selector, root = document) => root.querySelector(selector);

/** Tiny element builder: el("td", { className: "num" }, "42"). */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export function fillSelect(select, entries) {
  select.replaceChildren(...Object.entries(entries).map(([value, { name }]) => el("option", { value, textContent: name })));
}

/**
 * Call `onIndex(i)` for i = 0..count-1, `perFrame` times per animation frame
 * (fractions allowed: 0.25 means once every 4 frames). Resolves to false if
 * `signal` was aborted before the end.
 */
export function animateIndices(count, perFrame, onIndex, signal) {
  return new Promise((resolve) => {
    let i = 0;
    let budget = 0;
    function frame() {
      if (signal?.aborted) return resolve(false);
      budget += perFrame;
      while (budget >= 1 && i < count) {
        onIndex(i++);
        budget -= 1;
      }
      if (i >= count) return resolve(true);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
