import { AsyncQueueManager } from './async-queue';
import {
  DEFAULT_ANDROID_KEYBOARD_HEIGHT,
  DEFAULT_FOCUS_WAIT_MS,
  DEFAULT_SCROLL_RECHECK_MS,
  DEFAULT_BLUR_CLEANUP_MS,
  DEFAULT_SAFE_PADDING,
} from './constant';
import {
  getViewportHeight,
  ensureSpacer,
  removeSpacer,
  smartScrollToMakeVisible,
  checkElNeedScroll,
  setupKeyboardResizeListener,
  calculateKeyboardAdaptationParams,
  performKeyboardCollapseCleanup
} from './utils';

// 键盘状态类型
export type KeyboardState = 'idle' | 'expanding' | 'collapsing' | 'adapting';

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

  // 状态管理
  private keyboardState: KeyboardState = 'idle';
  private preFocusHeight: number | null = null;
  private lastKnownHeight: number = getViewportHeight();
  private adaptationStartTime: number = 0;
  private lastFocusTime: number = 0;
  private lastBlurTime: number = 0;

  // 事件清理函数
  private cleanupFn: (() => void) | null = null;

  constructor(options: KeyboardServiceOptions = {}) {
    this.config = {
      estimatedKeyboardHeight: options.estimatedKeyboardHeight ?? DEFAULT_ANDROID_KEYBOARD_HEIGHT,
      keyboardExpandWaitTime: options.keyboardExpandWaitTime ?? DEFAULT_FOCUS_WAIT_MS,
      keyboardCollapseCleanupTime: options.keyboardCollapseCleanupTime ?? DEFAULT_BLUR_CLEANUP_MS,
      scrollRecheckInterval: options.scrollRecheckInterval ?? DEFAULT_SCROLL_RECHECK_MS,
      safeInputPadding: options.safeInputPadding ?? DEFAULT_SAFE_PADDING,
      keyboardPaddingContainer: options.keyboardPaddingContainer ?? document.body,
    };
    this.queueManager = new AsyncQueueManager();
  }

  /**
   * 处理输入框聚焦前的准备
   */
  onPointerStart(): void {
    this.preFocusHeight = getViewportHeight();
  }

  /**
   * 处理输入框聚焦事件
   */
  onFocus(el: HTMLElement): void {
    if (!el || !document.body.contains(el)) return;

    const now = Date.now();
    const timeSinceLastFocus = now - this.lastFocusTime;

    // 场景1：切换输入框场景 - 如果当前在expanding状态中，快速的失去焦点，并重新聚焦<50ms
    if (this.keyboardState === 'expanding' && timeSinceLastFocus < 50) {
      return;
    }

    // 场景2：频繁点击场景 - 如果当前在collapsing状态中，重新聚焦
    if (this.keyboardState === 'collapsing') {
      // 清理正在进行的collapse操作
      this.queueManager.clearAll();
      // 重置键盘状态
      this.keyboardState = 'idle';
    }

    this.lastFocusTime = now;
    this.keyboardState = 'expanding';
    this.cleanup();

    const baseline = this.preFocusHeight ?? this.lastKnownHeight;
    this.setupKeyboardExpandEvent(el, baseline);
  }

  /**
   * 处理输入框失焦事件
   */
  onBlur(): void {
    const now = Date.now();
    const timeSinceLastFocus = now - this.lastFocusTime;

    // 场景1：如果当前在expanding状态中，快速的失去焦点<50ms，忽略失焦事件
    if (this.keyboardState === 'expanding' && timeSinceLastFocus < 50) {
      return;
    }

    this.lastBlurTime = now;
    this.keyboardState = 'collapsing';

    // 清除所有定时器，但不立即清理，因为需要等待延迟
    this.queueManager.clearAll();

    // blur清理使用配置中的延迟时间
    this.queueManager.setTimeout(() => {
      // 使用工具函数执行清理逻辑
      performKeyboardCollapseCleanup(this.config.keyboardPaddingContainer, {
        get value() { return this.lastKnownHeight; },
        set value(v) { this.lastKnownHeight = v; }
      });

      this.preFocusHeight = null;

      // 键盘收起完成，状态恢复为idle
      this.keyboardState = 'idle';
    }, this.config.keyboardCollapseCleanupTime);
  }

  /**
   * 设置键盘展开事件监听
   */
  private setupKeyboardExpandEvent(el: HTMLElement, baseline: number): void {
    // 使用工具函数设置视口事件监听
    this.cleanupFn = setupKeyboardResizeListener(
      el,
      baseline,
      this.adaptationStartTime,
      (targetEl, targetBaseline, height) => {
        this.handleKeyboardAdaptation(targetEl, targetBaseline, height);
      }
    );

    // 兜底定时器
    this.queueManager.setTimeout(() => {
      if (document.body.contains(el)) {
        this.handleKeyboardAdaptation(el, baseline, getViewportHeight());
      }
    }, this.config.keyboardExpandWaitTime);
  }

  /**
   * 处理键盘适配的核心函数
   */
  private handleKeyboardAdaptation(el: HTMLElement, baseline: number, afterHeight: number): void {
    // 如果已经在处理中或元素不在文档中
    if (this.keyboardState === 'adapting' || !document.body.contains(el)) {
      return;
    }

    this.keyboardState = 'adapting';
    this.adaptationStartTime = Date.now();

    // 清理之前的事件监听器
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }

    // 使用工具函数计算适配参数
    const { heightChanged, allowedBottom, vh } = calculateKeyboardAdaptationParams(
      baseline,
      afterHeight,
      this.config.estimatedKeyboardHeight
    );

    // 如果页面的高度发生了变化，可以认为浏览器已经自行处理
    if (heightChanged) {
      this.keyboardState = 'idle';
      return;
    }

    // 尝试直接滚动
    const hasScroll = smartScrollToMakeVisible(
      el,
      allowedBottom,
      this.config.safeInputPadding
    );

    if (!hasScroll) {
      this.lastKnownHeight = vh;
      this.keyboardState = 'idle';
      return;
    }

    // 滚动之后再判断是否可见
    this.queueManager.setTimeout(() => {
      if (!document.body.contains(el)) {
        this.keyboardState = 'idle';
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
        this.lastKnownHeight = currentVh;
        // 键盘展开完成，状态恢复为idle
        this.keyboardState = 'idle';
        return;
      }

      // 滚动失败，在页面底部添加间距
      ensureSpacer(this.config.estimatedKeyboardHeight, this.config.keyboardPaddingContainer);

      // 重新滚动
      smartScrollToMakeVisible(
        el,
        currentVh - this.config.estimatedKeyboardHeight,
        this.config.safeInputPadding
      );

      // 再次更新最终高度
      this.queueManager.setTimeout(() => {
        this.lastKnownHeight = getViewportHeight();
        // 键盘展开完成，状态恢复为idle
        this.keyboardState = 'idle';
      }, 50);
    }, this.config.scrollRecheckInterval);
  }

  /**
   * 清理所有资源
   */
  private cleanup(): void {
    this.queueManager.clearAll();

    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }
  }

  /**
   * 获取当前键盘状态
   */
  getState(): KeyboardState {
    return this.keyboardState;
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    this.cleanup();
    this.queueManager.dispose();
    removeSpacer(this.config.keyboardPaddingContainer);
    this.keyboardState = 'idle';
  }
}
