import { ops, StatefulEvaluatorImpl } from "hbs-parser-next";
import { module as qunitModule, test as qunitTest } from "qunit";
import type * as qunit from "qunit";
import { printIndentedItems } from "./helpers";

// The test facilities below are intentionally using unnecessary
// combinators when they could have used `lift` to stress-test
// the system.

export class CustomArray<T> extends Array<T>
  implements ops.Concattable, ops.Reducable<T> {
  constructor(...args: ConstructorParameters<typeof Array>) {
    if (new.target !== CustomArray) {
      throw new Error(`CustomArray is final -- don't subclass`);
    }

    super(...(args as any));
  }

  breakableReduce<Output>(
    callback: (accum: Output, item: T) => IteratorResult<Output>,
    init: Output
  ): Output {
    let current = init;

    for (let item of this) {
      let next = callback(current, item);

      if (next.done) {
        return next.value;
      }

      current = next.value;
    }

    return current;
  }

  zero<U>(): CustomArray<U> {
    return new CustomArray() as CustomArray<U>;
  }

  merge(other: this): void {
    for (let item of other) {
      this.push(item);
    }
  }
}

function list<T>(...items: T[]): CustomArray<T> {
  let a = new CustomArray<T>();
  a.push(...items);
  return a;
}

const flatIncrement = ops.pure((i: number) => list(i + 1), "flat-increment");

export function flatIncrementTrace(input: number, out: number[]): StringTrace {
  return formatOp(input, { type: "Pure", label: "flat-increment" }, out);
}

const firstReducable = ops.pure(
  (numbers: ops.Reducable<number>) =>
    numbers.breakableReduce((_, value) => ({ done: true, value }), 0),
  "first"
);

function firstReducableTrace(input: number[], output: number): StringTrace {
  return formatOp(input, { type: "Pure", label: "first" }, output);
}

const first: ops.Arrow<[number, ...number[]], number> = ops.pure(
  (numbers: number[]) => numbers[0]
);

const second: ops.Arrow<[number, number], number> = ops.pure(
  (numbers: number[]) => numbers[1]
);

const increment = ops.pipeline(flatIncrement, firstReducable, "increment");

// this is useful for examples that are already very noisy
const boringIncrement = ops.pure(
  (input: number) => input + 1,
  "boring-increment"
);

function incrementTrace(input: number, output: number): StringTrace {
  return [
    formatOp(input, { type: "Pipeline", label: "increment" }, output),
    [
      flatIncrementTrace(input, [output]),
      firstReducableTrace([output], output),
    ],
  ];
}

const decrement = ops.pure((i: number) => i - 1, "decrement");
const double = ops.pure((i: number) => i * 2, "double");

function iterateOne(
  map: ops.Arrow<number, number>
): ops.Arrow<[number[], number], number[]> {
  // extract the first value from the input
  const accumulator = ops.pure(
    (input: [number[], number]) => input[0],
    "first"
  );

  // extract the second value from the input
  const value = ops.pure((input: [number[], number]) => input[1], "second");

  // merge them back together, mapping the value over the map arrow
  const pair = ops.merge(accumulator, ops.pipeline(value, map));

  // the append function takes an [accum, input] and pushes the input
  // into the accum; yes, I know this is not really pure 🤔
  let append = ops.pure(([accum, input]: [number[], number]) => {
    accum.push(input);
    return accum;
  }, "append");

  // pipe [accum, input -> map] into append
  return ops.pipeline(pair, append, "iterate");
}

function iterate(
  arrow: ops.Arrow<number, number>
): ops.Arrow<number[], number[]> {
  // create the initial `[]`
  const inputAccumulator = ops.source(() => [] as number[], "initialize");

  // build a single iteration arrow
  // [accum: number[], in: number] -> number
  let iteration = iterateOne(arrow);

  // turn the iteration arrow into a reduce
  // [in: number[], accum: number[]] -> number[]
  let reduce = ops.reduce(iteration);

  // create the input
  let input = ops.merge(inputAccumulator, ops.input<number[]>(), "input-pair");

  // [in: number[]] -> reduce: ([in: number[], accum: number[]] -> number[])
  return ops.pipeline(input, reduce, "iteration");
}

function decrementTrace(input: number, output: number): StringTrace {
  return formatArrow(input, decrement, output);
}

function doubleTrace(input: number, output: number): StringTrace {
  return formatArrow(input, double, output);
}

@module("Arrow Evaluation")
export class ArrowEvaluationTest {
  private evaluator = new StatefulEvaluatorImpl();

  private invoke<T, U>(op: ops.Arrow<T, U>, input: T): U {
    return op.invoke(null, this.evaluator, input);
  }

  @test pure(assert: qunit.Assert) {
    assert.equal(this.invoke(increment, 1), 2);
  }

  @test zip(assert: qunit.Assert) {
    let zipped = ops.zip(increment, decrement);
    assert.deepEqual(this.invoke(zipped, [5, 5]), [6, 4]);
  }

  @test pipeline(assert: qunit.Assert) {
    let pipeline = ops.pipeline(increment, double);
    assert.deepEqual(this.invoke(pipeline, 5), 12);
  }

  @test merge(assert: qunit.Assert) {
    let concurrent = ops.merge(increment, double);
    assert.deepEqual(this.invoke(concurrent, 5), [6, 10]);
  }

  @test mergeAndThen(assert: qunit.Assert) {
    let pipeline = ops.keepAndThen(increment, double);
    assert.deepEqual(this.invoke(pipeline, 5), [6, 12]);
  }
}

type StringTrace = string | [string, StringTrace[]];

class Tracer {
  private stack: StringTrace[] = [];

  get currentChildren(): StringTrace[] {
    if (this.stack.length === 0) {
      return this.stack;
    } else {
      return this.stack[this.stack.length - 1][1] as StringTrace[];
    }
  }

  get currentName(): string | undefined {
    if (this.stack.length === 0) {
      return;
    } else {
      return this.stack[this.stack.length - 1][0] as string;
    }
  }

  get records(): StringTrace[] {
    return this.stack;
  }

  pushLeaf(leaf: string) {
    this.currentChildren.push(leaf);
  }

  preInvoke(name: string) {
    let record = [name, []] as StringTrace;
    this.currentChildren.push(record);
    this.stack.push(record);
  }

  postInvoke(desc: string) {
    let last = this.stack.pop() as [string, StringTrace[]];
    last[0] = desc;
  }
}

type JSONValue = string | number | null | boolean | JSONArray | JSONObject;
type JSONArray = JSONValue[];
interface JSONObject {
  [key: string]: JSONValue;
}

function trace(name: string, children?: StringTrace[]): StringTrace {
  if (children) {
    return [name, children];
  } else {
    return name;
  }
}

function format(op: { type: string; label?: string }): string {
  return op.label ? `${op.label}(${op.type})` : op.type;
}

function formatOp(
  input: unknown,
  op: { type: string; label?: string } | [string, string] | string,
  out: unknown
): string {
  let formattedInput = JSON.stringify(input);
  let formattedOutput = JSON.stringify(out);

  let formattedOp;

  if (typeof op === "string") {
    formattedOp = op;
  } else if (Array.isArray(op)) {
    formattedOp = format({ type: op[0], label: op[1] });
  } else {
    formattedOp = format(op);
  }

  return `${formattedOp}: ${formattedInput} -> ${formattedOutput}`;
}

function source(value: unknown, label?: string): StringTrace {
  let out = `Source: ${JSON.stringify(value)}`;

  if (label) {
    out += ` (${label})`;
  }

  return out;
}

function input(value: unknown, label?: string): StringTrace {
  return `Input: ${JSON.stringify(value)}`;
}

function formatArrow(
  input: unknown,
  op: ops.Arrow<unknown, unknown>,
  out: unknown
): string {
  return formatOp(input, op.operation, out);
}

class CollectingEvaluator extends StatefulEvaluatorImpl<Tracer> {
  private parent<T>(
    callback: () => T,
    state: Tracer,
    input: unknown,
    op: ops.Operation
  ): T {
    state.preInvoke(op.type);
    let clonedInput = JSON.parse(JSON.stringify(input));
    let out = callback();
    state.postInvoke(formatOp(clonedInput, op, out));
    return out;
  }

  Source<Out>(...args: [Tracer, unknown, ops.SourceOperation<Out>]): Out {
    let out = super.Source(...args);

    if (args[2].label) {
      args[0].pushLeaf(`Source: ${JSON.stringify(out)} (${args[2].label})`);
    } else {
      args[0].pushLeaf(`Source: ${JSON.stringify(out)}`);
    }
    return out;
  }

  Input<In>(tracer: Tracer, input: In, _op: ops.InputOperation<In>): In {
    tracer.pushLeaf(`Input: ${JSON.stringify(input)}`);
    return input;
  }

  Pure<In, Out>(
    state: Tracer,
    ...args: readonly [In, ops.PureOperation<In, Out>]
  ): Out {
    let input = JSON.parse(JSON.stringify(args[0]));
    let out = super.Pure(state, ...args);
    state.pushLeaf(formatOp(input, args[1], out));
    return out;
  }

  Zip<In1, Out1, In2, Out2>(
    ...args: [Tracer, [In1, In2], ops.ZipOperation<In1, Out1, In2, Out2>]
  ): [Out1, Out2] {
    return this.parent(() => super.Zip(...args), ...args);
  }

  Pipeline<LeftIn, Middle, RightOut>(
    ...args: [Tracer, LeftIn, ops.PipelineOperation<LeftIn, Middle, RightOut>]
  ): RightOut {
    return this.parent(() => super.Pipeline(...args), ...args);
  }

  Merge<In, LeftOut, RightOut>(
    ...args: [Tracer, In, ops.MergeOperation<In, LeftOut, RightOut>]
  ): [LeftOut, RightOut] {
    return this.parent(() => super.Merge(...args), ...args);
  }

  MapInput<ArrowIn, MapOut>(
    ...args: [Tracer, ArrowIn, ops.MapInputOperation<ArrowIn, MapOut>]
  ): MapOut {
    return this.parent(() => super.MapInput(...args), ...args);
  }

  KeepAndThen<In, LeftOut, RightOut>(
    ...args: [Tracer, In, ops.KeepAndThenOperation<In, LeftOut, RightOut>]
  ): [LeftOut, RightOut] {
    return this.parent(() => super.KeepAndThen(...args), ...args);
  }

  Reduce<In, Out>(
    ...args: [Tracer, [Out, Iterable<In>], ops.ReduceOperation<In, Out>]
  ): Out {
    return this.parent(() => super.Reduce(...args), ...args);
  }
}

interface Dict {
  [key: string]: unknown;
}

type Primitive =
  | string
  | number
  | boolean
  | undefined
  | null
  | symbol
  | bigint
  | unknown;

type RemoveUndefined<T> = {
  [P in keyof T]: T[P] extends undefined
    ? never
    : T[P] extends Primitive | unknown
    ? T[P]
    : RemoveUndefined<T>;
};

function compact<T>(o: T): RemoveUndefined<T> {
  if (Array.isArray(o)) {
    return (o.map(compact) as unknown) as RemoveUndefined<T>;
  } else if (typeof o === "object" && o !== null) {
    let out = {} as Dict;
    for (let [key, value] of Object.entries(o)) {
      if (value !== undefined) {
        out[key] = compact(value);
      }
    }
    return out as RemoveUndefined<T>;
  } else {
    return o as RemoveUndefined<T>;
  }
}

@module("Stateful Arrow Evaluation")
export class StatefulArrowEvaluationTest {
  private evaluator = new CollectingEvaluator();
  private tracer = new Tracer();

  constructor(private assert: qunit.Assert) {}

  assertInvoke<T extends JSONValue, U extends JSONValue>(
    arrow: ops.Arrow<T, U>,
    input: T,
    expectedOutput: U,
    ...expectedTraceRecords: StringTrace[]
  ) {
    let actual = this.invoke(arrow, input);
    this.assert.deepEqual(
      actual,
      expectedOutput,
      `expected output to be ${JSON.stringify(expectedOutput)}`
    );

    this.assert.deepEqual(
      `\n${printIndentedItems(this.tracer.records)}\n`,
      `\n${printIndentedItems(expectedTraceRecords)}\n`,
      "expected trace to match"
    );
  }

  private invoke<T, U>(op: ops.Arrow<T, U>, input: T): U {
    return op.invoke(this.tracer, this.evaluator, input);
  }

  @test pure() {
    this.assertInvoke(increment, 1, 2, incrementTrace(1, 2));
  }

  @test zip() {
    this.assertInvoke(
      ops.zip(increment, decrement),
      [5, 5],
      [6, 4],
      [
        formatOp([5, 5], "Zip", [6, 4]),
        [incrementTrace(5, 6), decrementTrace(5, 4)],
      ]
    );
  }

  @test pipeline() {
    this.assertInvoke(ops.pipeline(increment, double), 5, 12, [
      formatOp(5, { type: "Pipeline" }, 12),
      [incrementTrace(5, 6), doubleTrace(6, 12)],
    ]);
  }

  @test merge() {
    this.assertInvoke(
      ops.merge(increment, double),
      5,
      [6, 10],
      [
        formatOp(5, "Merge", [6, 10]),
        [incrementTrace(5, 6), doubleTrace(5, 10)],
      ]
    );
  }

  @test mergeAndThen() {
    this.assertInvoke(
      ops.keepAndThen(increment, double),
      5,
      [6, 12],
      [
        formatOp(5, "KeepAndThen", [6, 12]),
        [incrementTrace(5, 6), doubleTrace(6, 12)],
      ]
    );
  }

  @test iterate() {
    this.assertInvoke(
      iterate(boringIncrement),
      [3, 6, 9],
      [4, 7, 10],
      trace(formatOp([3, 6, 9], ["Pipeline", "iteration"], [4, 7, 10]), [
        trace(formatOp([3, 6, 9], ["Merge", "input-pair"], [[], [3, 6, 9]]), [
          source([], "initialize"),
          input([3, 6, 9]),
        ]),
        trace(formatOp([[], [3, 6, 9]], "Reduce", [4, 7, 10]), [
          iterateTrace([], 3, 4),
          iterateTrace([4], 6, 7),
          iterateTrace([4, 7], 9, 10),
        ]),
      ])
    );
  }
}

function iterateTrace(
  accum: number[],
  input: number,
  output: number
): StringTrace {
  return trace(
    formatOp([accum, input], ["Pipeline", "iterate"], [...accum, output]),
    [
      trace(formatOp([accum, input], "Merge", [accum, output]), [
        formatOp([accum, input], ["Pure", "first"], accum),
        trace(formatOp([accum, input], "Pipeline", output), [
          formatOp([accum, input], ["Pure", "second"], input),
          formatOp(input, ["Pure", "boring-increment"], output),
        ]),
      ]),
      formatOp([accum, output], ["Pure", "append"], [...accum, output]),
    ]
  );
}

function module(name: string): <T>(target: T) => T {
  qunitModule(name);

  return c => c;
}

function test(target: object, name: string) {
  qunitTest(name, assert => {
    let constructor = target.constructor as {
      new (assert: qunit.Assert): {
        [key: string]: (assert: qunit.Assert) => Promise<void> | void;
      };
    };
    let instance = new constructor(assert);
    return instance[name](assert);
  });
}
