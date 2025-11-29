export interface KeyboardAdaptiveOptions {
  /**
   * Estimated height of the keyboard in pixels.
   * Used when the browser does not resize the viewport automatically.
   * @default 300
   */
  estimatedKeyboardHeight?: number;

  /**
   * Extra space between the input and the top of the keyboard.
   * @default 16
   */
  safeInputPadding?: number;

  /**
   * Delay in ms to wait for the keyboard to fully expand before checking layout.
   * @default 150
   */
  keyboardExpandWaitTime?: number;

  /**
   * Interval in ms to re-check visibility after attempting a scroll.
   * @default 100
   */
  scrollRecheckInterval?: number;

  /**
   * Delay in ms after blur before removing the padding (debouncing blur).
   * @default 100
   */
  keyboardCollapseCleanupTime?: number;

  /**
   * The container to add padding to. Defaults to document.body.
   */
  keyboardPaddingContainer?: HTMLElement | null;
}

export enum KeyboardState {
  HIDDEN = 'HIDDEN',
  EXPANDING = 'EXPANDING',
  VISIBLE = 'VISIBLE',
  COLLAPSING = 'COLLAPSING'
}