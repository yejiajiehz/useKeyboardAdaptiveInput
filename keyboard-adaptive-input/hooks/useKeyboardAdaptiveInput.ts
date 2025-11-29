import React, { useEffect, useRef, useCallback } from 'react';
import { KeyboardAdaptiveOptions, KeyboardState } from '../types';

// Module-level variables to share state across multiple inputs using this hook.
// This prevents race conditions when switching focus between two inputs quickly.
let globalCollapseTimer: number | null = null;
let globalKeyboardState: KeyboardState = KeyboardState.HIDDEN;

export const useKeyboardAdaptiveInput = (
  ref: React.RefObject<HTMLElement>,
  options: KeyboardAdaptiveOptions = {}
) => {
  const {
    estimatedKeyboardHeight = 300,
    safeInputPadding = 16,
    keyboardExpandWaitTime = 150,
    scrollRecheckInterval = 100,
    keyboardCollapseCleanupTime = 100,
    keyboardPaddingContainer = document.body,
  } = options;

  // We use a ref to track the original padding to restore it later
  const originalPaddingRef = useRef<string>('');
  const isSetupRef = useRef<boolean>(false);

  // Helper to get the current viewport height
  const getViewportHeight = () => window.innerHeight;

  // Helper to check if input is occluded by the estimated keyboard area
  const isInputOccluded = useCallback(() => {
    if (!ref.current) return false;
    const rect = ref.current.getBoundingClientRect();
    const viewportHeight = getViewportHeight();
    
    // The "danger zone" is the bottom part of the screen where the keyboard might be
    const dangerZoneTop = viewportHeight - estimatedKeyboardHeight;

    // Check if the bottom of the input (plus safe padding) is below the danger zone top
    return rect.bottom + safeInputPadding > dangerZoneTop;
  }, [estimatedKeyboardHeight, safeInputPadding, ref]);

  const addBottomPadding = useCallback(() => {
    if (keyboardPaddingContainer) {
      // Only save original padding if we haven't already modified it
      if (globalKeyboardState !== KeyboardState.VISIBLE) {
        originalPaddingRef.current = keyboardPaddingContainer.style.paddingBottom;
      }
      keyboardPaddingContainer.style.paddingBottom = `${estimatedKeyboardHeight}px`;
    }
  }, [keyboardPaddingContainer, estimatedKeyboardHeight]);

  const removeBottomPadding = useCallback(() => {
    if (keyboardPaddingContainer) {
      keyboardPaddingContainer.style.paddingBottom = originalPaddingRef.current;
    }
  }, [keyboardPaddingContainer]);

  const scrollToVisible = useCallback(() => {
    if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ref]);

  const handleFocus = useCallback(() => {
    // 1. If currently collapsing, cancel the collapse (user switched focus quickly)
    if (globalCollapseTimer !== null) {
      clearTimeout(globalCollapseTimer);
      globalCollapseTimer = null;
    }

    // 2. If already expanding or visible, ignore new heavy logic, just ensure visible
    if (globalKeyboardState === KeyboardState.EXPANDING || globalKeyboardState === KeyboardState.VISIBLE) {
        // Just ensure this specific input is in view
        scrollToVisible();
        globalKeyboardState = KeyboardState.VISIBLE;
        return;
    }

    globalKeyboardState = KeyboardState.EXPANDING;
    const initialHeight = getViewportHeight();

    // Wait for keyboard to likely be fully open
    setTimeout(() => {
      const currentHeight = getViewportHeight();
      const heightDifference = Math.abs(initialHeight - currentHeight);

      // Core Rule 1: If height changed significantly, browser handled layout.
      if (heightDifference > 50) { 
        globalKeyboardState = KeyboardState.VISIBLE;
        return; 
      }

      // Core Rule 2: Height didn't change (overlay mode). Check occlusion.
      if (isInputOccluded()) {
        // Attempt 1: Scroll to view
        scrollToVisible();

        // Check again after scroll animation
        setTimeout(() => {
           if (isInputOccluded()) {
              // Attempt 2: Add padding and scroll again
              addBottomPadding();
              // Short delay to let layout update apply
              setTimeout(() => {
                  scrollToVisible();
              }, 50);
           }
        }, scrollRecheckInterval);
      }
      
      globalKeyboardState = KeyboardState.VISIBLE;
    }, keyboardExpandWaitTime);

  }, [
    keyboardExpandWaitTime,
    scrollRecheckInterval,
    isInputOccluded,
    addBottomPadding,
    scrollToVisible
  ]);

  const handleBlur = useCallback(() => {
    // Schedule cleanup
    globalCollapseTimer = window.setTimeout(() => {
      globalKeyboardState = KeyboardState.COLLAPSING;
      removeBottomPadding();
      globalKeyboardState = KeyboardState.HIDDEN;
      globalCollapseTimer = null;
    }, keyboardCollapseCleanupTime);
  }, [keyboardCollapseCleanupTime, removeBottomPadding]);

  // Setup event listeners
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Save initial padding state once
    if (!isSetupRef.current && keyboardPaddingContainer) {
       originalPaddingRef.current = keyboardPaddingContainer.style.paddingBottom;
       isSetupRef.current = true;
    }

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    };
  }, [ref, handleFocus, handleBlur, keyboardPaddingContainer]);
};