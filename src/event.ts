export function bindEvent(
  el: HTMLElement,
  onPointerStart: () => void,
  onFocus: () => void,
  onBlur: () => void
) {
  // 绑定事件
  el.addEventListener("touchstart", onPointerStart, { passive: true });
  el.addEventListener("mousedown", onPointerStart, { passive: true });
  el.addEventListener("focus", onFocus);
  el.addEventListener("blur", onBlur);

  // 组件卸载时的清理
  return () => {
    el.removeEventListener("touchstart", onPointerStart);
    el.removeEventListener("mousedown", onPointerStart);
    el.removeEventListener("focus", onFocus);
    el.removeEventListener("blur", onBlur);
  };
}
