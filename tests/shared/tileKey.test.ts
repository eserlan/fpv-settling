// Import mocks before any other imports
import "../testUtils";

import { describe, expect, it } from "vitest";
import { makeTileKey, parseTileKey } from "../../src/shared/TileKey";

describe("makeTileKey", () => {
	it("builds a key from axial coordinates", () => {
		expect(makeTileKey(2, 5)).toBe("2_5");
	});

	it("preserves negative coordinates", () => {
		expect(makeTileKey(-3, 0)).toBe("-3_0");
	});

	it("handles zero coordinates", () => {
		expect(makeTileKey(0, 0)).toBe("0_0");
	});

	it("handles mixed sign coordinates", () => {
		expect(makeTileKey(-2, 3)).toBe("-2_3");
		expect(makeTileKey(4, -7)).toBe("4_-7");
	});
});

describe("parseTileKey", () => {
	it("parses positive coordinates", () => {
		const result = parseTileKey("2_5");
		expect(result.q).toBe(2);
		expect(result.r).toBe(5);
	});

	it("parses negative coordinates", () => {
		const result = parseTileKey("-3_0");
		expect(result.q).toBe(-3);
		expect(result.r).toBe(0);
	});

	it("parses zero coordinates", () => {
		const result = parseTileKey("0_0");
		expect(result.q).toBe(0);
		expect(result.r).toBe(0);
	});

	it("round-trips with makeTileKey", () => {
		const testCases = [
			{ q: 5, r: 3 },
			{ q: -2, r: 7 },
			{ q: 0, r: -4 },
			{ q: -8, r: -1 },
		];

		for (const original of testCases) {
			const key = makeTileKey(original.q, original.r);
			const parsed = parseTileKey(key);
			expect(parsed.q).toBe(original.q);
			expect(parsed.r).toBe(original.r);
		}
	});
});
