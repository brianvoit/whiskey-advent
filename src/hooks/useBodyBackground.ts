import { useEffect } from "react";

/**
 * Sets the page's body background while a screen is mounted, so iOS
 * overscroll and the area behind the notch match it. Restores the previous
 * color on unmount.
 */
export function useBodyBackground(color: string) {
  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = color;
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, [color]);
}
