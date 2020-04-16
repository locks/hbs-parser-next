import { err, Result, Snippet } from "../../snippet";
import type { Debuggable } from "../logger";
import { AbstractCombinator } from "./base";
import type { TupleCombinators } from "./types";

export default class Any<T extends Debuggable[]> extends AbstractCombinator<
  T[number]
> {
  constructor(private desc: string, private combinators: TupleCombinators<T>) {
    super();
  }

  get name(): string {
    return `any • ${this.desc}`;
  }

  invoke(input: Snippet): Result<[Snippet, T[number]]> {
    let current = input;

    for (let item of this.combinators) {
      let result = current.invoke(item);

      if (result.kind === "ok") {
        return result;
      }

      // if there was a fatal error, don't try other variants
      if (result.kind === "err" && result.fatal) {
        return result;
      }
    }

    return err(input, "any");
  }
}
