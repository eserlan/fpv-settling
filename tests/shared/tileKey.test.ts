import { describe, expect, it } from "vitest";

import { makeTileKey } from "../../src/shared/TileKey";

describe("makeTileKey", () => {
	it("builds a key from axial coordinates", () => {
		expect(makeTileKey(2, 5)).toBe("2_5");
	});

	it("preserves negative coordinates", () => {
		expect(makeTileKey(-3, 0)).toBe("-3_0");
	});
});
