/**
 * Test Utilities - Reusable mocks for Roblox-TypeScript testing
 * 
 * Usage: Import this file at the TOP of your test file, BEFORE any `import` statements.
 * The mocks must be set up before any module that uses Roblox globals is loaded.
 * 
 * Example:
 *   import "../testUtils"; // Sets up global mocks
 *   import { describe, it, expect } from "vitest";
 *   import MyModule from "../../src/shared/MyModule";
 */

// ═══════════════════════════════════════════════════════════════════════════════
// VECTOR3 MOCK
// ═══════════════════════════════════════════════════════════════════════════════

class Vector3Mock {
    X: number;
    Y: number;
    Z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.X = x;
        this.Y = y;
        this.Z = z;
    }

    // Lowercase aliases for compatibility
    get x(): number { return this.X; }
    get y(): number { return this.Y; }
    get z(): number { return this.Z; }

    add(other: Vector3Mock): Vector3Mock {
        return new Vector3Mock(this.X + other.X, this.Y + other.Y, this.Z + other.Z);
    }

    sub(other: Vector3Mock): Vector3Mock {
        return new Vector3Mock(this.X - other.X, this.Y - other.Y, this.Z - other.Z);
    }

    mul(scalar: number): Vector3Mock {
        return new Vector3Mock(this.X * scalar, this.Y * scalar, this.Z * scalar);
    }

    div(scalar: number): Vector3Mock {
        return new Vector3Mock(this.X / scalar, this.Y / scalar, this.Z / scalar);
    }

    get Magnitude(): number {
        return Math.sqrt(this.X ** 2 + this.Y ** 2 + this.Z ** 2);
    }

    Dot(other: Vector3Mock): number {
        return this.X * other.X + this.Y * other.Y + this.Z * other.Z;
    }

    Cross(other: Vector3Mock): Vector3Mock {
        return new Vector3Mock(
            this.Y * other.Z - this.Z * other.Y,
            this.Z * other.X - this.X * other.Z,
            this.X * other.Y - this.Y * other.X
        );
    }

    Unit(): Vector3Mock {
        const mag = this.Magnitude;
        return mag > 0 ? this.div(mag) : new Vector3Mock();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR3 MOCK
// ═══════════════════════════════════════════════════════════════════════════════

class Color3Mock {
    R: number;
    G: number;
    B: number;

    constructor(r: number = 0, g: number = 0, b: number = 0) {
        this.R = r;
        this.G = g;
        this.B = b;
    }

    // Lowercase aliases for compatibility
    get r(): number { return this.R; }
    get g(): number { return this.G; }
    get b(): number { return this.B; }

    static fromRGB(r: number, g: number, b: number): Color3Mock {
        return new Color3Mock(r / 255, g / 255, b / 255);
    }

    static fromHSV(h: number, s: number, v: number): Color3Mock {
        // Simplified HSV to RGB conversion
        const c = v * s;
        const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;

        if (h < 1 / 6) { r = c; g = x; }
        else if (h < 2 / 6) { r = x; g = c; }
        else if (h < 3 / 6) { g = c; b = x; }
        else if (h < 4 / 6) { g = x; b = c; }
        else if (h < 5 / 6) { r = x; b = c; }
        else { r = c; b = x; }

        return new Color3Mock(r + m, g + m, b + m);
    }

    Lerp(other: Color3Mock, alpha: number): Color3Mock {
        return new Color3Mock(
            this.r + (other.r - this.r) * alpha,
            this.g + (other.g - this.g) * alpha,
            this.b + (other.b - this.b) * alpha
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENUM MOCK
// ═══════════════════════════════════════════════════════════════════════════════

const EnumMock = {
    Material: {
        Brick: "Brick",
        Wood: "Wood",
        Grass: "Grass",
        Slate: "Slate",
        SmoothPlastic: "SmoothPlastic",
        Neon: "Neon",
        Ground: "Ground",
        Sand: "Sand",
    },
    PartType: {
        Block: "Block",
        Ball: "Ball",
        Cylinder: "Cylinder",
    },
    Font: {
        GothamBold: "GothamBold",
        Gotham: "Gotham",
        SourceSans: "SourceSans",
    },
    SurfaceType: {
        Smooth: "Smooth",
    },
    HttpContentType: {
        ApplicationJson: "application/json",
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LUAU BUILT-IN FUNCTION MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mock for Luau's `pairs()` function
 * Iterates over key-value pairs in objects/arrays
 */
const pairsMock = <T>(obj: Record<string, T> | T[]): [string, T][] => {
    if (Array.isArray(obj)) {
        // Lua arrays are 1-indexed
        return obj.map((v, i) => [String(i + 1), v]);
    }
    return Object.entries(obj) as [string, T][];
};

/**
 * Mock for Luau's `ipairs()` function
 * Iterates over sequential array elements
 */
const ipairsMock = <T>(arr: T[]): [number, T][] => {
    return arr.map((v, i) => [i + 1, v]); // Lua is 1-indexed
};

/**
 * Mock for Luau's `tonumber()` function
 */
const tonumberMock = (value: unknown): number | undefined => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
};

/**
 * Mock for Luau's `tostring()` function
 */
const tostringMock = (value: unknown): string => {
    return String(value);
};

/**
 * Mock for Luau's `typeIs()` function
 */
const typeIsMock = (val: unknown, typeName: string): boolean => {
    if (typeName === "table") return typeof val === "object" && val !== null;
    if (typeName === "string") return typeof val === "string";
    if (typeName === "number") return typeof val === "number";
    if (typeName === "boolean") return typeof val === "boolean";
    if (typeName === "nil") return val === undefined || val === null;
    if (typeName === "function") return typeof val === "function";
    return false;
};

/**
 * Mock for rbxts `$tuple()` function
 */
const tupleMock = <T extends unknown[]>(...args: T): T => args;

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE MOCK
// ═══════════════════════════════════════════════════════════════════════════════

const tableMock = {
    sort: <T>(arr: T[], compareFn?: (a: T, b: T) => number): T[] => {
        return arr.sort(compareFn);
    },
    insert: <T>(arr: T[], value: T): void => {
        arr.push(value);
    },
    remove: <T>(arr: T[], index?: number): T | undefined => {
        if (index === undefined) {
            return arr.pop();
        }
        // Lua is 1-indexed
        return arr.splice(index - 1, 1)[0];
    },
    concat: <T>(arr: T[], separator?: string): string => {
        return arr.join(separator ?? "");
    },
    find: <T>(arr: T[], value: T): number | undefined => {
        const idx = arr.indexOf(value);
        return idx >= 0 ? idx + 1 : undefined; // Lua is 1-indexed
    },
    clear: <T>(arr: T[]): void => {
        arr.length = 0;
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATH MOCK (Luau-compatible)
// Note: We must explicitly list Math methods because they are non-enumerable
// and { ...Math } doesn't copy them
// ═══════════════════════════════════════════════════════════════════════════════

const mathMock = {
    // Standard Math methods (non-enumerable, must be listed explicitly)
    abs: Math.abs,
    acos: Math.acos,
    acosh: Math.acosh,
    asin: Math.asin,
    asinh: Math.asinh,
    atan: Math.atan,
    atan2: Math.atan2,
    atanh: Math.atanh,
    cbrt: Math.cbrt,
    ceil: Math.ceil,
    cos: Math.cos,
    cosh: Math.cosh,
    exp: Math.exp,
    expm1: Math.expm1,
    floor: Math.floor,
    fround: Math.fround,
    hypot: Math.hypot,
    imul: Math.imul,
    log: Math.log,
    log10: Math.log10,
    log1p: Math.log1p,
    log2: Math.log2,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    round: Math.round,
    sign: Math.sign,
    sin: Math.sin,
    sinh: Math.sinh,
    sqrt: Math.sqrt,
    tan: Math.tan,
    tanh: Math.tanh,
    trunc: Math.trunc,

    // Luau-specific aliases and additions
    pi: Math.PI,
    huge: Infinity,
    rad: (degrees: number) => (degrees * Math.PI) / 180,
    deg: (radians: number) => (radians * 180) / Math.PI,
    random: (min?: number, max?: number) => {
        if (min === undefined) return Math.random();
        if (max === undefined) return Math.floor(Math.random() * min) + 1;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    clamp: (x: number, min: number, max: number) => Math.max(min, Math.min(max, x)),
    noise: () => Math.random() * 2 - 1, // Simplified Perlin noise mock
};

// ═══════════════════════════════════════════════════════════════════════════════
// STRING MOCK (Luau-compatible)
// ═══════════════════════════════════════════════════════════════════════════════

const stringMock = {
    split: (str: string, separator: string): string[] => str.split(separator),
    sub: (str: string, start: number, end?: number): string => {
        // Lua is 1-indexed
        return str.substring(start - 1, end);
    },
    len: (str: string): number => str.length,
    lower: (str: string): string => str.toLowerCase(),
    upper: (str: string): string => str.toUpperCase(),
    find: (str: string, pattern: string): [number, number] | [] => {
        const idx = str.indexOf(pattern);
        if (idx === -1) return [];
        return [idx + 1, idx + pattern.length];
    },
    format: (formatStr: string, ...args: unknown[]): string => {
        let result = formatStr;
        let i = 0;
        result = result.replace(/%[sd]/g, () => String(args[i++] ?? ""));
        return result;
    },
    rep: (str: string, count: number): string => str.repeat(count),
    gsub: (str: string, pattern: string, replacement: string): [string, number] => {
        const matches = str.match(new RegExp(pattern, "g"));
        const count = matches ? matches.length : 0;
        return [str.replace(new RegExp(pattern, "g"), replacement), count];
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// OS MOCK
// ═══════════════════════════════════════════════════════════════════════════════

const osMock = {
    time: () => Math.floor(Date.now() / 1000),
    clock: () => performance.now() / 1000,
    date: (format?: string) => new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════════════════════════════
// APPLY ALL MOCKS TO GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════

// Polyfill Array.prototype.size() for Luau compatibility
// In roblox-ts, arrays use .size() instead of .length
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arrayProto = Array.prototype as any;
if (!arrayProto.size) {
    // eslint-disable-next-line no-extend-native
    arrayProto.size = function (this: unknown[]) {
        return this.length;
    };
}

// Type assertion to allow setting globals
// Use globalThis for Node.js/Vitest compatibility
const g = globalThis as unknown as Record<string, unknown>;

// Core Roblox types
g.Vector3 = Vector3Mock;
g.Color3 = Color3Mock;
g.Enum = EnumMock;

// Luau built-ins
g.pairs = pairsMock;
g.ipairs = ipairsMock;
g.tonumber = tonumberMock;
g.tostring = tostringMock;
g.typeIs = typeIsMock;
g.$tuple = tupleMock;
g.table = tableMock;
g.math = mathMock;
g.string = stringMock;
g.os = osMock;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS (for direct usage if needed)
// ═══════════════════════════════════════════════════════════════════════════════

export {
    Vector3Mock,
    Color3Mock,
    EnumMock,
    pairsMock,
    ipairsMock,
    tonumberMock,
    tostringMock,
    typeIsMock,
    tupleMock,
    tableMock,
    mathMock,
    stringMock,
    osMock,
};

// Type definitions for globals
declare global {
    // eslint-disable-next-line no-var
    var Vector3: typeof Vector3Mock;
    // eslint-disable-next-line no-var
    var Color3: typeof Color3Mock;
    // eslint-disable-next-line no-var
    var Enum: typeof EnumMock;
    // eslint-disable-next-line no-var
    var pairs: typeof pairsMock;
    // eslint-disable-next-line no-var
    var ipairs: typeof ipairsMock;
    // eslint-disable-next-line no-var
    var tonumber: typeof tonumberMock;
    // eslint-disable-next-line no-var
    var tostring: typeof tostringMock;
    // eslint-disable-next-line no-var
    var typeIs: typeof typeIsMock;
    // eslint-disable-next-line no-var
    var $tuple: typeof tupleMock;
    // eslint-disable-next-line no-var
    var table: typeof tableMock;
    // eslint-disable-next-line no-var
    var math: typeof mathMock;
    // eslint-disable-next-line no-var
    var string: typeof stringMock;
    // eslint-disable-next-line no-var
    var os: typeof osMock;
}
