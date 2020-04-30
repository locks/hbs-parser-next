import "../../read/tokens";
import * as ast from "../nodes";
import { ParserArrow } from "../shape";
export const TextArrow = ParserArrow.start()
    .token("Text" /* Text */)
    .ifOk(text => ast.text(text))
    .label("Text");
