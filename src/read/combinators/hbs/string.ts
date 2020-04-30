import { ok, Result, Snippet } from "../../../snippet";
import { range } from "../../../span";
import { any, pattern, seq, tag } from "../../combinators";
import { QuoteType, StringToken, stringToken } from "../../tokens";
import { AbstractCombinator } from "../base";
import type { CombinatorType } from "../types";
import { combinator } from "../../combinator";

export default class SomeString extends AbstractCombinator<StringToken> {
  readonly name = "STRING";

  invoke(input: Snippet): Result<[Snippet, StringToken]> {
    return input.invoke(any("QUOTED_STRING", SINGLE_QUOTED, DOUBLE_QUOTED));
  }
}

export const SINGLE_QUOTED: CombinatorType<StringToken> = combinator(() =>
  seq(
    "SINGLE_QUOTED",
    tag(`'`),
    pattern(/^(\\'|[^'])*/u, "single quote body"),
    tag(`'`)
  ).map(([open, body, close]) =>
    ok(
      stringToken(
        { data: body.span, quote: QuoteType.Single },
        range(open, close)
      )
    )
  )
);

export const DOUBLE_QUOTED: CombinatorType<StringToken> = combinator(() =>
  seq(
    "DOUBLE_QUOTED",
    tag(`"`),
    pattern(/^(\\"|[^"])*/u, "double quote body"),
    tag(`"`)
  ).map(([open, body, close]) =>
    ok(
      stringToken(
        { data: body.span, quote: QuoteType.Double },
        range(open, close)
      )
    )
  )
);
