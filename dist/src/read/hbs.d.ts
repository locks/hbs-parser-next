import { Snippet } from "../snippet";
import Block from "./combinators/hbs/block";
import Interpolate from "./combinators/hbs/interpolate";
import SomeNumber from "./combinators/hbs/number";
import Sexp from "./combinators/hbs/sexp";
import SimplePath from "./combinators/hbs/simple-path";
import SpacedTokens from "./combinators/hbs/spaced-tokens";
import SomeString from "./combinators/hbs/string";
import type { CombinatorType } from "./combinators/types";
import Wrap from "./combinators/wrap";
import type { Debuggable } from "./logger";
import { LeafTokenMap, TokenType, ArgumentToken } from "./tokens";
export declare const token: <T extends TokenType.Identifier | TokenType.Dot | TokenType.Eq | TokenType.WS | TokenType.Text | TokenType.AttributeName>(c: CombinatorType<Snippet>, type: T) => CombinatorType<LeafTokenMap[T]>;
export declare const wrap: <T extends Debuggable>(c: CombinatorType<T>) => Wrap<T>;
export declare const WS: CombinatorType<import("./tokens").WSToken>;
export declare const STRING: SomeString;
export declare const NUMBER: SomeNumber;
export declare const SEXP: Sexp;
export declare const ID: CombinatorType<import("./tokens").IdentifierToken>;
export declare const EQ: CombinatorType<import("./tokens").EqToken>;
export declare const NAMED: import("./combinators/seq").default<[import("./tokens").IdentifierToken, import("./tokens").EqToken, import("./tokens").SexpToken | import("./tokens").StringToken | import("./tokens").NumberToken | import("./tokens").PresentTokens]>;
export declare const SIMPLE_PATH: SimplePath;
export declare const SPACED_TOKENS: SpacedTokens;
export declare const BLOCK: Block;
export declare const INTERPOLATE: Interpolate;
export declare const DOT: CombinatorType<import("./tokens").DotToken>;
export declare const ARG: CombinatorType<ArgumentToken>;
export declare const EXPRESSION: import("./combinators/any").default<[import("./tokens").SexpToken, import("./tokens").PresentTokens, import("./tokens").StringToken, import("./tokens").NumberToken]>;
//# sourceMappingURL=hbs.d.ts.map