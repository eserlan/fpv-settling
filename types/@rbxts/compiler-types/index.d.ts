declare const globalThis: unknown;

declare function assert(condition: unknown, message?: string): asserts condition;
declare function identity<T>(value: T): T;
declare function typeOf(value: unknown): string;
declare function typeIs<T>(value: unknown, type: string): value is T;
declare function classIs<T>(value: unknown, className: string): value is T;
declare function $range(start: number, finish: number, step?: number): number[];
declare function $tuple<T extends unknown[]>(...values: T): LuaTuple<T>;
declare function $getModuleTree(module: string): [string, string[]];

type Record<K extends keyof any, T> = {
  [P in K]: T;
};

type Exclude<T, U> = T extends U ? never : T;

type InstanceType<T> = T extends new (...args: Array<unknown>) => infer R ? R : never;

type symbol = string;

interface SymbolConstructor {
  readonly iterator: symbol;
}

declare const Symbol: SymbolConstructor;

interface Boolean {}

interface BooleanConstructor {
  new (value?: unknown): Boolean;
}

declare const Boolean: BooleanConstructor;

interface Function {}

interface CallableFunction extends Function {}

interface NewableFunction extends Function {}

interface FunctionConstructor {
  new (...args: Array<unknown>): Function;
}

declare const Function: FunctionConstructor;

interface IArguments {
  length: number;
}

interface RegExp {}

interface RegExpConstructor {
  new (pattern: string, flags?: string): RegExp;
}

declare const RegExp: RegExpConstructor;

interface Iterable<T> {
  [Symbol.iterator](): Iterator<T>;
}

interface IterableFunction<T> extends Iterable<T> {
  (iterable: Iterable<T>): Iterable<T>;
}

interface Generator<T> extends Iterable<T> {
  next(): IteratorResult<T>;
}

interface Iterator<T> {
  next(value?: unknown): IteratorResult<T>;
}

interface IteratorResult<T> {
  done?: boolean;
  value: T;
}

interface Object {}

interface ObjectConstructor {
  keys<T extends object>(value: T): Array<keyof T>;
}

declare const Object: ObjectConstructor;

interface ArrayLike<T> {
  size(): number;
}

interface ReadonlyArray<T> extends ArrayLike<T>, Iterable<T> {
  [Symbol.iterator](): Iterator<T>;
  readonly [index: number]: T;
  isEmpty(): boolean;
  join(separator?: string): string;
  move(start: number, finish: number, target: number, targetArray?: Array<T>): Array<T>;
  includes(value: T, fromIndex?: number): boolean;
  indexOf(value: T, fromIndex?: number): number;
  every(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => boolean,
  ): boolean;
  some(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => boolean,
  ): boolean;
  forEach(callback: (value: T, index: number, array: ReadonlyArray<T>) => void): void;
  map<U>(callback: (value: T, index: number, array: ReadonlyArray<T>) => U): Array<U>;
  mapFiltered<U>(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => U | undefined,
  ): Array<U>;
  filter(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => boolean,
  ): Array<T>;
  filterUndefined<U>(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => U | undefined,
  ): Array<U>;
  find(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => boolean,
  ): T | undefined;
  findIndex(
    callback: (value: T, index: number, array: ReadonlyArray<T>) => boolean,
  ): number;
  reduce<U>(
    callback: (accumulator: U, value: T, index: number, array: ReadonlyArray<T>) => U,
    initialValue: U,
  ): U;
}

interface Array<T> extends ReadonlyArray<T> {
  [index: number]: T;
  clear(): void;
  insert(value: T, index?: number): void;
  pop(): T | undefined;
  push(...items: T[]): number;
  remove(index?: number): T | undefined;
  shift(): T | undefined;
  sort(callback?: (a: T, b: T) => boolean): void;
  unorderedRemove(index?: number): T | undefined;
  unshift(...items: T[]): number;
}

interface ArrayConstructor {
  new <T>(length?: number): Array<T>;
}

declare const Array: ArrayConstructor;

interface ReadonlySet<T> {
  has(value: T): boolean;
  isEmpty(): boolean;
  size(): number;
  forEach(callback: (value: T, value2: T, set: ReadonlySet<T>) => void): void;
}

interface Set<T> extends ReadonlySet<T> {
  add(value: T): Set<T>;
  clear(): void;
  delete(value: T): boolean;
}

interface SetConstructor {
  new <T>(values?: ReadonlyArray<T>): Set<T>;
}

interface WeakSet<T extends object> {}

interface WeakSetConstructor {
  new <T extends object>(): WeakSet<T>;
}

declare const Set: SetConstructor;
declare const WeakSet: WeakSetConstructor;

interface ReadonlyMap<K, V> extends Iterable<ReadonlyArray<K | V>> {
  [Symbol.iterator](): Iterator<ReadonlyArray<K | V>>;
  has(key: K): boolean;
  isEmpty(): boolean;
  size(): number;
  forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void;
  get(key: K): V | undefined;
}

interface Map<K, V> extends ReadonlyMap<K, V> {
  clear(): void;
  delete(key: K): boolean;
  set(key: K, value: V): Map<K, V>;
}

interface MapConstructor {
  new <K, V>(entries?: ReadonlyArray<ReadonlyArray<K | V>>): Map<K, V>;
}

interface WeakMap<K extends object, V> {}

interface WeakMapConstructor {
  new <K extends object, V>(): WeakMap<K, V>;
}

interface ReadonlyMapConstructor {
  new <K, V>(entries?: ReadonlyArray<ReadonlyArray<K | V>>): ReadonlyMap<K, V>;
}

interface ReadonlySetConstructor {
  new <T>(values?: ReadonlyArray<T>): ReadonlySet<T>;
}

declare const Map: MapConstructor;
declare const WeakMap: WeakMapConstructor;

interface String {
  size(): number;
  byte(i?: number, j?: number): number | Array<number>;
  find(pattern: string, init?: number, plain?: boolean): Array<number> | undefined;
  format(...args: Array<unknown>): string;
  gmatch(pattern: string): Iterable<string>;
  gsub(pattern: string, replacement: string, n?: number): string;
  lower(): string;
  match(pattern: string, init?: number): string | undefined;
  rep(n: number, sep?: string): string;
  reverse(): string;
  split(sep?: string): Array<string>;
  sub(i: number, j?: number): string;
  upper(): string;
}

interface StringConstructor {
  new (value?: string): String;
}

declare const String: StringConstructor;

interface TemplateStringsArray extends ReadonlyArray<string> {
  readonly raw: ReadonlyArray<string>;
}

interface Promise<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2>;
}

interface PromiseConstructor {
  new <T>(
    executor: (
      resolve: (value: T | Promise<T>) => void,
      reject: (reason?: unknown) => void,
    ) => void,
  ): Promise<T>;
}

declare const Promise: PromiseConstructor;

type ReadVoxelsArray = Array<number>;

type LuaTuple<T extends unknown[]> = T & {
  readonly _nominal_LuaTuple: unique symbol;
  [index: number]: unknown;
} & Iterable<unknown>;
