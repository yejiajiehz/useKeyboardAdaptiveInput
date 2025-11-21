import { useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_ANDROID_KEYBOARD_HEIGHT,
  DEFAULT_FOCUS_WAIT_MS,
  DEFAULT_SCROLL_RECHECK_MS,
  DEFAULT_BLUR_CLEANUP_MS,
  DEFAULT_SAFE_PADDING,
} from "./constant";

import {
  getViewportHeight,
  ensureSpacer,
  removeSpacer,
  smartScrollToMakeVisible,
  checkElNeedScroll,
} from "./utils";
import { bindEvent } from "./event";

/**
 * useKeyboardAdaptiveInput 配置选项
 */
export interface KeyboardAdaptiveInputOptions {
  /** 键盘覆盖模式下的默认键盘高度 */
  defaultAndroidKeyboardHeight?: number;
  /** focus 后等待键盘动画完成的延迟(ms) */
  focusWaitMs?: number;
  /** 滚动后校验的延迟(ms) */
  scrollRecheckMs?: number;
  /** blur 清理操作的延迟(ms) */
  blurCleanupMs?: number;
  /** 输入框底部预留的安全距离(px) */
  safePadding?: number;
}

/**
 * Hook：自动处理 H5 输入框被键盘遮挡的问题（iOS & Android 通用）
 * @param inputRef 输入元素的引用
 * @param options 配置选项
 */
export function useKeyboardAdaptiveInput(
  inputRef: React.RefObject<HTMLElement>,
  options: KeyboardAdaptiveInputOptions = {}
): void {
  // 合并默认配置与用户配置
  const config = {
    defaultAndroidKeyboardHeight:
      options.defaultAndroidKeyboardHeight ?? DEFAULT_ANDROID_KEYBOARD_HEIGHT,
    focusWaitMs: options.focusWaitMs ?? DEFAULT_FOCUS_WAIT_MS,
    scrollRecheckMs: options.scrollRecheckMs ?? DEFAULT_SCROLL_RECHECK_MS,
    blurCleanupMs: options.blurCleanupMs ?? DEFAULT_BLUR_CLEANUP_MS,
    safePadding: options.safePadding ?? DEFAULT_SAFE_PADDING,
  };

  // 初始页面的高度
  const preFocusHeightRef = useRef<number | null>(null);
  // 上一次页面的高度
  const lastKnownHeightRef = useRef<number>(getViewportHeight());
  // 记住最后一次计算的键盘高度
  const lastKeyboardHeightRef = useRef<number>(0);

  // 是否正在处理页面高度
  const isAdaptingRef = useRef<boolean>(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number[]>([]);
  const adaptationStartTimeRef = useRef<number>(0); // 记录适配开始时间

  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    timerRef.current.forEach((timerId) => {
      clearTimeout(timerId);
    });
    timerRef.current = [];
  }, []);

  // 安全地设置定时器并存储其ID
  const safeSetTimeout = useCallback(
    (callback: () => void, delay: number): void => {
      const id = setTimeout(() => {
        // 从数组中移除已执行的定时器ID
        const index = timerRef.current.indexOf(id);
        if (index > -1) {
          timerRef.current.splice(index, 1);
        }
        callback();
      }, delay) as unknown as number;
      timerRef.current.push(id);
    },
    []
  );

  // 清理所有资源
  const cleanupAll = useCallback(() => {
    clearAllTimers();

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    isAdaptingRef.current = false;
  }, [clearAllTimers]);

  // 处理键盘适配的核心函数
  const handleKeyboardAdaptation = useCallback(
    (el: HTMLElement, baseline: number, afterHeight: number): void => {
      // 如果已经在处理中
      if (isAdaptingRef.current || !document.body.contains(el)) {
        // TODO: 逻辑需要加强，需要保障最终可用
        return;
      }

      isAdaptingRef.current = true;
      adaptationStartTimeRef.current = Date.now();

      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      // 如果页面的高度发生了变化，可以认为浏览器已经自行处理；无须额外处理
      // TODO: 考虑从一个输入框到另外一个输入框的场景
      const heightChanged = baseline - afterHeight > 20;
      if (heightChanged) {
        console.log('页面高度变化，无须滚动', baseline, afterHeight)
        return;
      }

      const keyboardHeight = config.defaultAndroidKeyboardHeight;
      const vh = getViewportHeight();
      const allowedBottom = vh - keyboardHeight;

      // 尝试直接滚动
      const hasScroll = smartScrollToMakeVisible(
        el,
        allowedBottom,
        config.safePadding
      );
      if (!hasScroll) {
        lastKnownHeightRef.current = vh;
        isAdaptingRef.current = false;
        console.log('页面元素可见，无须滚动')
        return;
      }

      // 滚动之后再判断是否可见
      safeSetTimeout(() => {
        if (!document.body.contains(el)) {
          isAdaptingRef.current = false;
        console.log('页面滚动之后，元素可见')

          return;
        }

        const currentVh = getViewportHeight();

        const needScroll = checkElNeedScroll(
          el,
          allowedBottom,
          config.safePadding
        );

        // 若已元素已经滚动到可见区域，结束
        if (!needScroll) {
          lastKnownHeightRef.current = currentVh;
          isAdaptingRef.current = false;
          return;
        }

        // 滚动失败，在页面底部添加间距
        ensureSpacer(keyboardHeight);

        // 重新滚动
        smartScrollToMakeVisible(
          el,
          currentVh - keyboardHeight,
          config.safePadding
        );
        console.log('页面底部添加间距，重新滚动')


        // 再次更新最终高度，使用固定的短延迟
        safeSetTimeout(() => {
          lastKnownHeightRef.current = getViewportHeight();
          isAdaptingRef.current = false;
        }, 50); // 使用固定的50ms延迟进行最终确认
      }, config.scrollRecheckMs);
    },
    [safeSetTimeout, config]
  );

  const onPointerStart = useCallback(() => {
    preFocusHeightRef.current = getViewportHeight();
  }, []);

  // 创建一个引用，用于在onFocus和onBlur中访问最新的el
  const elRef = useRef<HTMLElement | null>(null);

  const onFocus = useCallback(() => {
    const el = elRef.current;
    if (!el) return;

    cleanupAll();

    const baseline = preFocusHeightRef.current ?? lastKnownHeightRef.current;

    if (window.visualViewport) {
      const onVV = () => {
        // 检查是否是快速连续触发的情况
        const adaptationDuration = Date.now() - adaptationStartTimeRef.current;
        if (adaptationDuration > 500 && document.body.contains(el)) {
          handleKeyboardAdaptation(el, baseline, window.visualViewport!.height);
        }
      };

      window.visualViewport.addEventListener("resize", onVV, { once: true, passive: true });

      cleanupRef.current = () => {
        window.visualViewport?.removeEventListener("resize", onVV);
      };

      // 兜底定时器，直接使用配置中的延迟
      safeSetTimeout(() => {
        if (document.body.contains(el)) {
          handleKeyboardAdaptation(el, baseline, getViewportHeight());
        }
      }, config.focusWaitMs);
    } else {
      const onWin = () => {
        if (document.body.contains(el)) {
          handleKeyboardAdaptation(el, baseline, getViewportHeight());
        }
      };

      window.addEventListener("resize", onWin, { once: true, passive: true });

      cleanupRef.current = () => {
        window.removeEventListener("resize", onWin);
      };

      safeSetTimeout(() => {
        if (document.body.contains(el)) {
          handleKeyboardAdaptation(el, baseline, getViewportHeight());
        }
      }, config.focusWaitMs);
    }
  }, [handleKeyboardAdaptation, cleanupAll, safeSetTimeout, config]);

  const onBlur = useCallback(() => {
    cleanupAll();

    // blur清理使用配置中的延迟时间
    safeSetTimeout(() => {
      removeSpacer();
      preFocusHeightRef.current = null;
      // 保留lastKnownHeightRef，这样在快速聚焦时可以更快响应
      // 仅在blur后较长时间没有再次focus时才更新
      safeSetTimeout(() => {
        lastKnownHeightRef.current = getViewportHeight();
      }, 500); // 500ms内没有再次focus才更新
    }, config.blurCleanupMs);
  }, [cleanupAll, safeSetTimeout, config]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    // 更新elRef以在事件处理函数中使用
    elRef.current = el;

    // 绑定事件
    const uninstall = bindEvent(el, onPointerStart, onFocus, onBlur);

    // 组件卸载时的清理
    return () => {
      elRef.current = null;
      uninstall();
      cleanupAll();
      removeSpacer();
    };
  }, [inputRef, onPointerStart, onFocus, onBlur, cleanupAll]);
}
