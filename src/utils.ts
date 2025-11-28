import { DEFAULT_SAFE_INPUT_PADDING } from "./constant";

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
// 在滚动容器底部插入 padding，用于撑起页面高度
export function ensureSpacer(keyboardHeight: number, container = document.body) {
  const style = getComputedStyle(container);
  const originalPaddingBottom = parseFloat(style.paddingBottom);
  container.style.paddingBottom =
    originalPaddingBottom + keyboardHeight + "px";
  container.dataset[DATA_KEY] = style.paddingBottom;
}

// 移除滚动容器底部的 padding
export function removeSpacer(container = document.body) {
  const originalPaddingBottom = container.dataset[DATA_KEY];
  if (originalPaddingBottom) {
    container.style.paddingBottom = originalPaddingBottom;
    delete container.dataset[DATA_KEY];
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
export function checkElNeedScroll(
  el: HTMLElement,
  allowedBottom: number,
  padding = DEFAULT_SAFE_INPUT_PADDING
) {
  const rect = getRect(el);
  const offset = allowedBottom - padding - rect.bottom;

  return offset > 0;
}

// 如果元素不可见，滚动元素到可见位置
export function smartScrollToMakeVisible(
  el: HTMLElement,
  allowedBottom: number,
  padding = DEFAULT_SAFE_INPUT_PADDING
): boolean {
  const needScroll = checkElNeedScroll(el, allowedBottom, padding);

  if (needScroll) {
    // 滚动到元素可见位置
    el.scrollIntoView({ behavior: "smooth", inline: "end" });
  }

  return needScroll;
}

/**
 * 设置键盘展开时的视口事件监听
 * 处理 visualViewport 和 window resize 事件的兼容性
 */
export function setupKeyboardResizeListener(
  el: HTMLElement,
  baseline: number,
  adaptationStartTime: number,
  onAdaptation: (el: HTMLElement, baseline: number, height: number) => void
): () => void {
  let cleanupFn: () => void;

  if (window.visualViewport) {
    const onVisualViewportResize = () => {
      // 检查是否是快速连续触发的情况
      const adaptationDuration = Date.now() - adaptationStartTime;
      if (adaptationDuration > 500 && document.body.contains(el)) {
        onAdaptation(el, baseline, window.visualViewport!.height);
      }
    };

    window.visualViewport.addEventListener('resize', onVisualViewportResize, {
      once: true,
      passive: true,
    });

    cleanupFn = () => {
      window.visualViewport?.removeEventListener('resize', onVisualViewportResize);
    };
  } else {
    const onWindowResize = () => {
      if (document.body.contains(el)) {
        onAdaptation(el, baseline, getViewportHeight());
      }
    };

    window.addEventListener('resize', onWindowResize, { once: true, passive: true });

    cleanupFn = () => {
      window.removeEventListener('resize', onWindowResize);
    };
  }

  return cleanupFn;
}

/**
 * 计算键盘适配所需的参数
 */
export function calculateKeyboardAdaptationParams(
  baseline: number,
  afterHeight: number,
  estimatedKeyboardHeight: number
) {
  const heightChanged = baseline - afterHeight > 20;
  const allowedBottom = getViewportHeight() - estimatedKeyboardHeight;

  return {
    heightChanged,
    allowedBottom
  };
}
