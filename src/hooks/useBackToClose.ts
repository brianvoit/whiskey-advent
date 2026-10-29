import { useEffect, useRef } from "react";

/**
 * Makes the system Back action (Android back gesture/button, browser Back)
 * close an overlay such as a drawer, instead of changing the page underneath
 * it or leaving the app.
 *
 * While `open`, an extra history entry with the same URL sits on top. Back
 * pops it and calls `onClose`. If the overlay closes any other way (its X,
 * the backdrop, Escape), the entry is removed again so history is unchanged.
 *
 * To navigate from inside the overlay, use `navigate(to, { replace: true })`
 * so the new page takes the overlay's entry. A plain push still works, but
 * leaves a duplicate of the previous page in history.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const key = `overlay-${Date.now()}-${Math.random()}`;
    // Keep React Router's state so returning to this page restores it.
    window.history.pushState({ ...window.history.state, overlayKey: key }, "");

    let closedByBack = false;
    const handlePop = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      // Only step back if our entry is still the current one. If the overlay
      // navigated somewhere, that page has replaced or covered it.
      if (!closedByBack && window.history.state?.overlayKey === key) {
        window.history.back();
      }
    };
  }, [open]);
}
