import { AsyncQueueManager } from "./async-queue";
import {
  DEFAULT_ESTIMATED_KEYBOARD_HEIGHT,
  DEFAULT_KEYBOARD_EXPAND_WAIT_TIME,
  DEFAULT_KEYBOARD_COLLAPSE_CLEANUP_TIME,
  DEFAULT_SCROLL_RECHECK_INTERVAL,
  DEFAULT_SAFE_INPUT_PADDING,
} from "./constant";
import {
  getViewportHeight,
  ensureSpacer,
  removeSpacer,
  smartScrollToMakeVisible,
  checkElNeedScroll,
  setupKeyboardResizeListener,
  calculateKeyboardAdaptationParams,
} from "./utils";

// 键盘状态类型
export type KeyboardState = "idle" | "expanding" | "expanded" | "collapsing";

// 键盘服务配置选项
export interface KeyboardServiceOptions {
  /**
   * 预估的键盘高度，用于在键盘显示前预先调整布局
   * 默认值: 300 (px)
   */
  estimatedKeyboardHeight?: number;

  /**
   * 键盘展开时的等待时间，用于延迟执行适配逻辑以确保键盘完全展开
   * 默认值: 150 (ms)
   */
  keyboardExpandWaitTime?: number;

  /**
   * 键盘收起时的清理时间，用于延迟移除键盘间距等资源
   * 默认值: 100 (ms)
   */
  keyboardCollapseCleanupTime?: number;

  /**
   * 输入框滚动后重新检查可见性的时间间隔
   * 默认值: 100 (ms)
   */
  scrollRecheckInterval?: number;

  /**
   * 输入框与键盘之间的安全间距
   * 默认值: 16 (px)
   */
  safeInputPadding?: number;

  /**
   * 用于添加键盘间距的容器元素
   * 默认值: document.body
   */
  keyboardPaddingContainer?: HTMLElement;
}

/**
 * 键盘适配核心服务
 * 处理键盘显示和隐藏时的输入框适配逻辑
 */
export class KeyboardService {
  private config: Required<KeyboardServiceOptions>;
  private queueManager: AsyncQueueManager;

  // 是否需要适配；在首次聚焦之后，如果页面高度发生了变化，说明浏览器已经自行处理了键盘适配，不需要再进行适配
  private needAdaptation = true;

  // 能否触发 resize 事件
  private canTriggerResizeEvent = false;

  // 键盘状态
  private keyboardState: KeyboardState = "idle";

  // 上一次聚焦事件时间戳，用于处理快速切换输入框场景
  private lastFocusTime: number = 0;

  // 基准高度
  private baseline = getViewportHeight();

  // resize 事件清理函数
  private cleanupResizeEvent: (() => void) | null = null;

  constructor(options: KeyboardServiceOptions = {}) {
    this.config = Object.assign({}, options, {
      estimatedKeyboardHeight: DEFAULT_ESTIMATED_KEYBOARD_HEIGHT,
      keyboardExpandWaitTime: DEFAULT_KEYBOARD_EXPAND_WAIT_TIME,
      keyboardCollapseCleanupTime: DEFAULT_KEYBOARD_COLLAPSE_CLEANUP_TIME,
      scrollRecheckInterval: DEFAULT_SCROLL_RECHECK_INTERVAL,
      safeInputPadding: DEFAULT_SAFE_INPUT_PADDING,
      keyboardPaddingContainer: document.body,
    });
    this.queueManager = new AsyncQueueManager();
  }

  onPointerStart() {
    this.baseline = getViewportHeight();
  }

  /**
   * 处理输入框聚焦事件
   */
  onFocus(el: HTMLElement) {
    if (!el || !document.body.contains(el) || !this.needAdaptation) return;

    if (this.keyboardState === "expanding" || this.keyboardState === "expanded") {
      return;
    }

    // 如果当前在 collapsing 状态中，重新聚焦
    if (this.keyboardState === "collapsing") {
      // 清理正在进行的 collapse 操作
      this.queueManager.dispose();
    }

    this.lastFocusTime = Date.now();
    this.keyboardState = "expanding";
    this.cleanup();

    this.setupKeyboardExpandEvent(el, this.baseline);
  }

  /**
   * 处理输入框失焦事件
   */
  onBlur() {
    this.keyboardState = "collapsing";
    if (!this.needAdaptation) {
      this.keyboardState = "idle";
      return;
    };

    this.queueManager.add(() => {
      // 清理添加的 padding
      removeSpacer(this.config.keyboardPaddingContainer);
      // 键盘收起完成，状态恢复为idle
      this.keyboardState = "idle";
    }, this.config.keyboardCollapseCleanupTime);
  }

  /**
   * 设置键盘展开事件监听
   */
  private setupKeyboardExpandEvent(el: HTMLElement, baseline: number) {
    // 清理之前的事件监听器
    this.cleanupResizeEvent?.();

    const cleanupResizeEvent = setupKeyboardResizeListener(
      el,
      baseline,
      this.lastFocusTime,
      (targetEl, targetBaseline, height) => {
        this.canTriggerResizeEvent = true;
        this.handleKeyboardAdaptation(targetEl, targetBaseline, height);
      }
    );

    // 清理 resize 事件监听
    this.cleanupResizeEvent = () => {
      cleanupResizeEvent();
      this.cleanupResizeEvent = null;
    }

    if (!this.canTriggerResizeEvent) {
    // 兜底定时器, 用于处理 resize 事件没有触发的场景
      this.queueManager.add(() => {
        if (this.canTriggerResizeEvent) {
          return;
        }
        if (document.body.contains(el)) {
          this.handleKeyboardAdaptation(el, baseline, getViewportHeight());
        }
      }, this.config.keyboardExpandWaitTime);
    }
  }

  /**
   * 处理键盘适配的核心函数
   */
  private handleKeyboardAdaptation(
    el: HTMLElement,
    baseline: number,
    afterHeight: number
  ) {
    // 如果已经在处理中或元素不在文档中
    if (!document.body.contains(el)) {
      return;
    }

    this.keyboardState = 'expanded';

    // 使用工具函数计算适配参数
    const { heightChanged, allowedBottom } =
      calculateKeyboardAdaptationParams(
        baseline,
        afterHeight,
        this.config.estimatedKeyboardHeight
      );

    // 如果页面的高度发生了变化，可以认为浏览器已经自行处理
    if (heightChanged) {
      this.needAdaptation = true;
      return;
    }

    // 尝试直接滚动
    const hasScroll = smartScrollToMakeVisible(
      el,
      allowedBottom,
      this.config.safeInputPadding
    );

    // 如果无须滚动，目前已经可见，结束
    if (hasScroll) {
      return;
    }

    // 滚动之后再判断是否可见
    this.queueManager.add(() => {
      if (!document.body.contains(el)) {
        return;
      }

      const currentVh = getViewportHeight();
      const needScroll = checkElNeedScroll(
        el,
        allowedBottom,
        this.config.safeInputPadding
      );

      // 若已元素已经滚动到可见区域，结束
      if (!needScroll) {
        return;
      }

      // 滚动失败，在页面底部添加间距
      ensureSpacer(
        this.config.estimatedKeyboardHeight,
        this.config.keyboardPaddingContainer
      );

      // 重新滚动
      smartScrollToMakeVisible(
        el,
        currentVh - this.config.estimatedKeyboardHeight,
        this.config.safeInputPadding
      );
    }, this.config.scrollRecheckInterval);
  }

  /**
   * 清理所有资源
   */
  private cleanup() {
    this.queueManager.dispose();
    this.cleanupResizeEvent?.();
  }

  /**
   * 销毁服务
   */
  dispose() {
    this.cleanup();
    this.queueManager.dispose();
    removeSpacer(this.config.keyboardPaddingContainer);
    this.keyboardState = "idle";
  }
}
