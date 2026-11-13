const paths = {
  plug: '<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.9 2.1c-1.1.7-1.4 1.2-1.4 2.4M12 17h.01"/>',
  settings: '<path d="m9 3-.6 2.1-2 .9-2-.6-2 3.5 1.5 1.5V13L2.4 15l2 3.5 2-.5 2 1L9 21h4l.6-2.1 2-.9 2 .6 2-3.5-1.5-1.5V11L19.6 9l-2-3.5-2 .5-2-1L13 3H9Z"/><circle cx="11" cy="12" r="3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
  up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  power: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  undo: '<path d="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 0 14"/>',
  restart: '<path d="M3 10a9 9 0 1 1 1 7M3 3v7h7"/>',
  light: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 .8-1 1.5-1 2H9c0-.5 0-1.2-1-2Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bridge: '<path d="M3 7v13m18-13v13M3 9c5 0 6 7 9 7s4-7 9-7M3 18h18M8 13v5m8-5v5"/>',
  gate: '<path d="M4 21V4h16v17M8 4v17m8-17v17M8 12h8"/>',
  crane: '<path d="M4 21h9M8 21V3m-4 3h16M8 3l12 3m-3 0v8l-3 2 3 2 3-2"/>',
  rail: '<path d="M5 3v18M19 3v18M5 6h14M5 12h14M5 18h14"/>',
  battery: '<rect x="4" y="6" width="15" height="12" rx="2"/><path d="M21 10v4M8 12h7m-3-3v6"/>',
  robot: '<rect x="5" y="6" width="14" height="14" rx="3"/><path d="M12 2v4M8 11h2m4 0h2M9 16h6M2 10v6m20-6v6"/>',
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
}
