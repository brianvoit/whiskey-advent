import { useEffect } from "react";

const APP_NAME = "Whiskey Advent";
const DEFAULT_DESCRIPTION = "A private whiskey advent calendar.";

type PageMeta = {
  title?: string;
  description?: string;
  image?: string | null;
};

function setMetaTag(property: string, content: string) {
  let el = document.querySelector(
    `meta[property="${property}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function usePageMeta({ title, description, image }: PageMeta) {
  useEffect(() => {
    const fullTitle = title ?? APP_NAME;

    document.title = fullTitle;
    setMetaTag("og:title", fullTitle);
    setMetaTag("og:description", description ?? DEFAULT_DESCRIPTION);
    if (image) setMetaTag("og:image", image);

    return () => {
      document.title = APP_NAME;
      setMetaTag("og:title", APP_NAME);
      setMetaTag("og:description", DEFAULT_DESCRIPTION);
    };
  }, [title, description, image]);
}
