import { useEffect, useRef } from 'react';

// The page body that slides: every page is `<div class="app-shell"><Sidebar /><main …>`.
const PAGE = '.app-shell > main';
const SWIPE_KEY = 'begani-swipe-direction';
const EDGE_GUARD = 24; // px from the screen edge left to the browser's own back gesture
const COMMIT_DISTANCE = 70; // px a swipe must travel to change page
const LOCK_DISTANCE = 10; // px before we decide if the gesture is horizontal or vertical
const IGNORE = 'input, textarea, select, audio, video, canvas, [contenteditable="true"], [data-no-swipe], [role="dialog"], [role="slider"], .mobile-more-sheet';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const readDirection = () => {
  try {
    const value = sessionStorage.getItem(SWIPE_KEY);
    return value === 'next' || value === 'previous' ? value : null;
  } catch {
    return null;
  }
};

const clearDirection = () => {
  try {
    sessionStorage.removeItem(SWIPE_KEY);
  } catch {
    /* nothing stored */
  }
};

const writeDirection = (value) => {
  try {
    sessionStorage.setItem(SWIPE_KEY, value);
  } catch {
    /* swiping still works, it just will not slide in */
  }
};

// Is the touch inside something that scrolls sideways (a carousel, a wide table)? Then the swipe is
// that element's business, not ours.
function insideHorizontalScroller(element) {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Swipe left / right on a phone to move to the next / previous page in the bottom-nav order.
 * `paths` is the ordered list of page paths, `currentIndex` where we are (-1 = not in the list).
 */
export default function useSwipeNavigation({ paths, currentIndex, disabled, onNavigate }) {
  // Keep the listeners stable across renders: the path list is compared by value and the
  // navigate function is read from a ref.
  const pathKey = paths.join('|');
  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; });

  // Slide the new page in from the side the swipe came from.
  useEffect(() => {
    const direction = readDirection();
    // Cleared a moment later (not here) so a development double-run of this effect still sees it.
    const forget = window.setTimeout(clearDirection, 400);
    const page = document.querySelector(PAGE);
    if (!direction || !page || reducedMotion()) return () => window.clearTimeout(forget);
    page.classList.add(direction === 'next' ? 'swipe-in-from-right' : 'swipe-in-from-left');
    const done = () => page.classList.remove('swipe-in-from-right', 'swipe-in-from-left');
    const timer = window.setTimeout(done, 320);
    return () => { window.clearTimeout(timer); done(); };
  }, []);

  useEffect(() => {
    if (disabled || currentIndex < 0) return undefined;
    const list = pathKey.split('|');
    const phone = window.matchMedia('(max-width: 900px)');
    let start = null;

    const page = () => document.querySelector(PAGE);
    const reset = (animate) => {
      const element = page();
      if (!element) return;
      element.style.transition = animate ? 'transform .18s ease, opacity .18s ease' : 'none';
      element.style.transform = '';
      element.style.opacity = '';
    };

    const onStart = (event) => {
      start = null;
      if (!phone.matches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) return;
      if (event.target.closest?.(IGNORE) || insideHorizontalScroller(event.target)) return;
      start = { x: touch.clientX, y: touch.clientY, locked: null };
    };

    const onMove = (event) => {
      if (!start) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (start.locked === null && Math.max(Math.abs(dx), Math.abs(dy)) > LOCK_DISTANCE) {
        start.locked = Math.abs(dx) > Math.abs(dy) * 1.6 ? 'x' : 'y';
      }
      if (start.locked !== 'x') return;
      const target = currentIndex + (dx < 0 ? 1 : -1);
      const element = page();
      if (!element) return;
      // Follow the finger a little, with more resistance when there is no page that way.
      const pull = list[target] ? 0.4 : 0.12;
      element.style.transition = 'none';
      element.style.transform = `translateX(${Math.max(-90, Math.min(90, dx * pull))}px)`;
    };

    const onEnd = (event) => {
      if (!start) return;
      const { x, y, locked } = start;
      start = null;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - x;
      const dy = touch.clientY - y;
      const target = currentIndex + (dx < 0 ? 1 : -1);
      const selecting = String(window.getSelection?.() || '').length > 0;
      const commit = locked === 'x' && Math.abs(dx) >= COMMIT_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.6
        && list[target] && !selecting;
      if (!commit) {
        reset(locked === 'x');
        return;
      }
      // The finger lifting after a swipe can still register as a tap on whatever was underneath; swallow it.
      const swallowClick = (clickEvent) => { clickEvent.preventDefault(); clickEvent.stopPropagation(); };
      document.addEventListener('click', swallowClick, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallowClick, true), 500);
      writeDirection(dx < 0 ? 'next' : 'previous');
      const element = page();
      if (element && !reducedMotion()) {
        element.style.transition = 'transform .12s ease-in, opacity .12s ease-in';
        element.style.transform = `translateX(${dx < 0 ? -48 : 48}px)`;
        element.style.opacity = '0';
        window.setTimeout(() => navigateRef.current(list[target]), 110);
      } else {
        navigateRef.current(list[target]);
      }
    };

    const onCancel = () => { start = null; reset(true); };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      reset(false);
    };
  }, [pathKey, currentIndex, disabled]);
}
