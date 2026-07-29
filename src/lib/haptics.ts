// Light haptic tick for confirming a selection.
//
// Deliberately built on navigator.vibrate rather than @capacitor/haptics: the
// plugin would be a new native dependency and a new Android permission for a
// 10ms tap, and the Vibration API already works inside the Capacitor WebView
// and on Android browsers. Where it is unsupported — iOS Safari, desktop — the
// call is a no-op, which is the correct outcome: haptics are a garnish and
// nothing here should depend on one firing.
//
// Never call this on a scroll, a page load, or anything the user did not
// initiate. A device that buzzes on its own feels broken, not premium.
export function tapFeedback(): void {
  try {
    // Some browsers expose the method but reject it outside a user gesture.
    navigator.vibrate?.(10);
  } catch {
    // Ignored on purpose — see above.
  }
}
