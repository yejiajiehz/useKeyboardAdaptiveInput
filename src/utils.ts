import { DEFAULT_SAFE_PADDING } from "./constant";

/** 获取当前视口高度（优先 visualViewport，更准确） */
export function getViewportHeight(): number {
  if (
    window.visualViewport &&
    typeof window.visualViewport.height === "number"
  ) {
    return window.visualViewport.height;
  }
  return window.innerHeight;
}

export function getRect(el: HTMLElement): DOMRect {
  return el.getBoundingClientRect();
}

const DATA_KEY = "use-keyboard-origin-padding-bottom_" + Date.now();
// 在 body 插入 padding，用于撑起页面高度
export function ensureSpacer(keyboardHeight: number) {
  const style = getComputedStyle(document.body);
  const originalPaddingBottom = parseFloat(style.paddingBottom);
  document.body.style.paddingBottom =
    originalPaddingBottom + keyboardHeight + "px";
  document.body.dataset[DATA_KEY] = style.paddingBottom;
}

export function removeSpacer() {
  const originalPaddingBottom = document.body.dataset[DATA_KEY];
  if (originalPaddingBottom) {
    document.body.style.paddingBottom = originalPaddingBottom;
    delete document.body.dataset[DATA_KEY];
  }
}

// 查找可滚动的父元素
function findScrollableParent(el: HTMLElement): HTMLElement | Window {
  let parent: HTMLElement | null = el.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const { overflowY } = style;

    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

// 判断是否需要滚动
function getElNeedScrollOffset(
  el: HTMLElement,
  allowedBottom: number,
  padding = DEFAULT_SAFE_PADDING
) {
  const rect = getRect(el);
  const offset = allowedBottom - padding - rect.bottom;

  return offset;
}

export function checkElNeedScroll(
  el: HTMLElement,
  allowedBottom: number,
  padding = DEFAULT_SAFE_PADDING
) {
  const offset = getElNeedScrollOffset(el, allowedBottom, padding)

  return offset > 0;
}

// 如果元素不可见，滚动元素到可见位置
export function smartScrollToMakeVisible(
  el: HTMLElement,
  allowedBottom: number,
  padding = DEFAULT_SAFE_PADDING
): boolean {
  const needScroll = checkElNeedScroll(el, allowedBottom, padding);
  console.log("🚀 ~ smartScrollToMakeVisible ~ needScroll:", needScroll)

  if (needScroll) {
    // 滚动到元素可见位置
    el.scrollIntoView({ behavior: "smooth", inline: "end" });
  }

  // TODO: 考虑使用 scroll 事件判断已经滚动完成；
  return needScroll;
}
