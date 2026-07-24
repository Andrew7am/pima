/**
 * Safe haptic feedback utility using the HTML5 Vibration API.
 * Safely handles iframe permissions constraints and device compatibility.
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'success' | 'error' | 'warning' = 'light') => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(12);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'success':
          navigator.vibrate([15, 60, 20]);
          break;
        case 'error':
          navigator.vibrate([40, 60, 40]);
          break;
        case 'warning':
          navigator.vibrate([30, 40, 30]);
          break;
        default:
          navigator.vibrate(15);
      }
    } catch (e) {
      // Safely ignore any permission or feature errors, common in sandboxed iframes
      console.debug('Haptic feedback vibrator blocked or unsupported in this context:', e);
    }
  }
};
