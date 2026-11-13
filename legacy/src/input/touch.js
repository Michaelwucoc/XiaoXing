export function installTouchControls({ onAction, root = document }) {
  const handler = (event) => {
    const button = event.target.closest('[data-move]');
    if (button && !button.disabled) onAction({ type: 'move', direction: button.dataset.move });
  };
  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
}
