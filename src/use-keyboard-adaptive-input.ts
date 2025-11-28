import { useEffect, useRef } from 'react';
import { KeyboardService, KeyboardServiceOptions } from './keyboard-service';
import { bindEvent } from './event';

/**
 * Hook：自动处理 H5 输入框被键盘遮挡的问题（iOS & Android 通用）
 * @param inputRef 输入元素的引用
 * @param options 配置选项
 */
export function useKeyboardAdaptiveInput(
  inputRef: React.RefObject<HTMLElement>,
  options: KeyboardServiceOptions = {}
): void {
  // 使用useRef存储键盘服务实例，避免每次渲染都创建新实例
  const keyboardServiceRef = useRef<KeyboardService | null>(null);
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 初始化键盘服务
    if (!keyboardServiceRef.current) {
      keyboardServiceRef.current = new KeyboardService(options);
    }

    const el = inputRef.current;
    if (!el) return;

    elRef.current = el;

    // 创建事件处理函数
    const onPointerStart = () => {
      keyboardServiceRef.current?.onPointerStart();
    };

    const onFocus = () => {
      const currentEl = elRef.current;
      if (currentEl) {
        keyboardServiceRef.current?.onFocus(currentEl);
      }
    };

    const onBlur = () => {
      keyboardServiceRef.current?.onBlur();
    };

    // 绑定事件
    const uninstall = bindEvent(el, onPointerStart, onFocus, onBlur);

    // 组件卸载时的清理
    return () => {
      elRef.current = null;
      uninstall();
      keyboardServiceRef.current?.dispose();
      keyboardServiceRef.current = null;
    };
  }, [inputRef, options]);
}
