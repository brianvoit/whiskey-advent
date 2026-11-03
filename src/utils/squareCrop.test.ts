import { describe, expect, it } from "vitest";
import { centerSquare, centeredView, clampView, viewToCrop, zoomAround } from "./squareCrop";

// A 3024×4032 portrait phone photo shown in a 300px window: at zoom 1 the
// scale is 300/3024, so the photo is 300×400 on screen.
const W = 3024;
const H = 4032;
const VIEW = 300;

describe("centerSquare", () => {
  it("trims the sides of a landscape photo", () => {
    expect(centerSquare(4032, 3024)).toEqual({ x: 504, y: 0, side: 3024 });
  });

  it("trims the top and bottom of a portrait photo", () => {
    expect(centerSquare(3024, 4032)).toEqual({ x: 0, y: 504, side: 3024 });
  });

  it("leaves a square photo whole", () => {
    expect(centerSquare(1000, 1000)).toEqual({ x: 0, y: 0, side: 1000 });
  });
});

describe("centeredView", () => {
  it("crops the same square as centerSquare", () => {
    expect(viewToCrop(W, H, VIEW, centeredView(W, H, VIEW))).toEqual(centerSquare(W, H));
  });
});

describe("clampView", () => {
  it("stops the photo being dragged past its top edge", () => {
    expect(clampView(W, H, VIEW, { zoom: 1, ox: 0, oy: 40 })).toEqual({ zoom: 1, ox: 0, oy: 0 });
  });

  it("stops the photo being dragged past its bottom edge", () => {
    expect(clampView(W, H, VIEW, { zoom: 1, ox: 0, oy: -500 }).oy).toBeCloseTo(-100);
  });

  it("can't slide sideways when the width already fits exactly", () => {
    expect(clampView(W, H, VIEW, { zoom: 1, ox: -30, oy: 0 }).ox).toBe(0);
  });

  it("keeps zoom between 1 and 4", () => {
    expect(clampView(W, H, VIEW, { zoom: 0.5, ox: 0, oy: 0 }).zoom).toBe(1);
    expect(clampView(W, H, VIEW, { zoom: 9, ox: 0, oy: 0 }).zoom).toBe(4);
  });
});

describe("viewToCrop", () => {
  it("takes the top of the photo when dragged to the top", () => {
    expect(viewToCrop(W, H, VIEW, { zoom: 1, ox: 0, oy: 0 })).toEqual({ x: 0, y: 0, side: 3024 });
  });

  it("takes the bottom of the photo when dragged to the bottom", () => {
    expect(viewToCrop(W, H, VIEW, { zoom: 1, ox: 0, oy: -100 })).toEqual({ x: 0, y: 1008, side: 3024 });
  });

  it("takes a smaller square when zoomed in", () => {
    expect(viewToCrop(W, H, VIEW, { zoom: 2, ox: 0, oy: 0 }).side).toBe(1512);
  });
});

describe("zoomAround", () => {
  it("keeps the middle of the window on the same spot of the photo", () => {
    const start = centeredView(W, H, VIEW);
    const zoomed = zoomAround(W, H, VIEW, start, 2);
    expect(viewToCrop(W, H, VIEW, zoomed)).toEqual({ x: 756, y: 1260, side: 1512 });
  });

  it("stays inside the photo when zooming near a corner", () => {
    const zoomed = zoomAround(W, H, VIEW, { zoom: 1, ox: 0, oy: 0 }, 3, 0, 0);
    expect(zoomed).toEqual({ zoom: 3, ox: 0, oy: 0 });
  });
});
