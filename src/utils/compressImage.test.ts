import { describe, expect, it } from "vitest";
import { fitWithin } from "./compressImage";

describe("fitWithin", () => {
  it("scales a landscape photo by its width", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait photo by its height", () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("keeps very thin images at least 1px", () => {
    expect(fitWithin(10000, 2, 500)).toEqual({ width: 500, height: 1 });
  });
});

