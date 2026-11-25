/** Open a native modal and restore the viewport and focus when its owner unmounts. */
export function openModalLayer(
  dialog: HTMLDialogElement,
  returnFocus?: HTMLElement | null,
) {
  const previousFocus = returnFocus ?? document.activeElement;
  const root = document.documentElement;
  const body = document.body;
  const gutter = () => window.innerWidth - root.clientWidth;
  const scrollbar = gutter();
  dialog.showModal();
  const overflow = root.style.overflow;
  const padding = body.style.paddingRight;
  root.style.overflow = "hidden";
  // Some browsers drop the reserved scrollbar gutter when locking the root.
  const lost = scrollbar - gutter();
  if (lost > 0) body.style.paddingRight = `${lost}px`;

  return () => {
    dialog.close();
    root.style.overflow = overflow;
    body.style.paddingRight = padding;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
      previousFocus.focus({ preventScroll: true });
  };
}
