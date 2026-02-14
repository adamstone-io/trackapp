export function autoGrow(textarea) {
  if (!textarea) return;

  textarea.style.height = "0px";

  requestAnimationFrame(() => {
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
}

export function bindAutoGrow(textarea) {
  if (!textarea) return;

  const handler = () => autoGrow(textarea);

  textarea.addEventListener("input", handler);
  textarea.addEventListener("keyup", handler);
  textarea.addEventListener("change", handler);

  handler(); // run once on load

  return () => {
    textarea.removeEventListener("input", handler);
    textarea.removeEventListener("keyup", handler);
    textarea.removeEventListener("change", handler);
  };
}
