import { LoggingType } from "../read/read";
import type * as tokens from "../read/tokens";
import * as ast from "./nodes";
import { ParseResult } from "./shape";
export interface ParseOptions {
    input: tokens.RootToken;
    source: string;
    logging: LoggingType;
}
export default function parse({ input, source, logging, }: ParseOptions): ParseResult<ast.RootNode>;
//# sourceMappingURL=parse.d.ts.map