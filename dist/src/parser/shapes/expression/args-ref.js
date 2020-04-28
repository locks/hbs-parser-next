import "../../../read/tokens";
import * as ast from "../../nodes";
import { ParserArrow } from "../../shape";
export const ArgRefArrow = ParserArrow.start()
    .token(TokenType.Argument)
    .ifOk(ref => ast.argReference(ref))
    .label("ArgRef");
