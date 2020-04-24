"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserArrow = exports.recurse = exports.source = exports.token = exports.ParserArrowEvaluateCore = exports.ParseEvaluator = exports.SOURCE = exports.mapResult = exports.isParseErr = exports.isErr = exports.isOk = exports.isResult = exports.err = exports.ok = exports.fatalError = exports.parseErr = exports.parseOk = exports.RESULT_KIND = exports.EXPAND = void 0;
const tokens_iterator_1 = require("./tokens-iterator");
exports.EXPAND = Symbol("EXPAND");
exports.RESULT_KIND = Symbol("RESULT_KIND");
function parseOk(value) {
    return {
        [exports.RESULT_KIND]: "ok",
        kind: "ok",
        value,
    };
}
exports.parseOk = parseOk;
function parseErr(token, reason) {
    return {
        [exports.RESULT_KIND]: "err",
        kind: "err",
        token,
        reason,
        fatal: false,
    };
}
exports.parseErr = parseErr;
function fatalError(token, reason) {
    return {
        [exports.RESULT_KIND]: "err",
        kind: "err",
        token,
        reason,
        fatal: true,
    };
}
exports.fatalError = fatalError;
function ok(value) {
    return { [exports.RESULT_KIND]: "ok", value };
}
exports.ok = ok;
function err(reason) {
    return {
        [exports.RESULT_KIND]: "err",
        reason,
    };
}
exports.err = err;
function isResult(input) {
    if (typeof input === "object" && input !== null) {
        return exports.RESULT_KIND in input;
    }
    else {
        return false;
    }
}
exports.isResult = isResult;
function isOk(input) {
    if (!isResult(input)) {
        throw new Error(`ASSERT: Expected Result, got something else`);
    }
    return input[exports.RESULT_KIND] === "ok";
}
exports.isOk = isOk;
function isErr(input) {
    if (!isResult(input)) {
        throw new Error(`ASSERT: Expected Result, got something else`);
    }
    return input[exports.RESULT_KIND] === "err";
}
exports.isErr = isErr;
function isParseErr(input) {
    return isErr(input);
}
exports.isParseErr = isParseErr;
function mapResult(result, callback) {
    if (isParseErr(result)) {
        return result;
    }
    return callback(result.value);
}
exports.mapResult = mapResult;
exports.SOURCE = parseOk(undefined);
class ParseEvaluator {
    constructor(state, arrow) {
        this.state = state;
        this.arrow = arrow;
    }
    evaluate(prev) {
        return this.arrow.evaluate(this, prev);
    }
    withState(callback) {
        let state = this.state;
        let [newState, result] = callback(state);
        this.state = newState;
        return result;
    }
}
exports.ParseEvaluator = ParseEvaluator;
class ParserArrowEvaluateCore {
    Id() {
        return new ParserArrow(new ParserArrowEvaluateCore(), (s, t) => [s, t]);
    }
    evalArr(callback) {
        return new ParserArrow(new ParserArrowEvaluateCore(), callback);
    }
    recurse(callback) {
        return this.evalArr((state, last) => {
            let arrow = callback();
            return arrow.invoke(state, last);
        });
    }
    Arr(callback) {
        return this.evalArr((state, last) => [state, callback(last)]);
    }
    zip(left, right) {
        return this.evalArr((state, [t, t2]) => {
            let [state2, u] = left.invoke(state, t);
            let [state3, u2] = right.invoke(state2, t2);
            return [state3, [u, u2]];
        });
    }
    andThen(left, right) {
        return this.evalArr((state, prev) => {
            let [state2, leftResult] = left.invoke(state, prev);
            return right.invoke(state2, leftResult);
        });
    }
    mergeNext(left, right) {
        return this.evalArr((state, prev) => {
            let [state2, u] = left.invoke(state, prev);
            let [state3, u2] = right.invoke(state2, prev);
            return [state3, [u, u2]];
        });
    }
    mergeAndThen(left, right) {
        return this.evalArr((state, prev) => {
            let [state2, u] = left.invoke(state, prev);
            let [state3, u2] = right.invoke(state2, u);
            return [state3, [u, u2]];
        });
    }
    iterate(arrow) {
        return this.evalArr((state, last) => {
            let currentState = state;
            let out = [];
            for (let item of last) {
                let [nextState, result] = arrow.invoke(currentState, item);
                out.push(result);
                currentState = nextState;
            }
            return [currentState, out];
        });
    }
    repeat(arrow) {
        return this.evalArr((state, input) => {
            let currentState = state;
            let [nextState, nextInput] = arrow.invoke(state, input);
            if (isErr(nextInput)) {
                return [nextState, []];
            }
            let out = [nextInput.value];
            currentState = nextState;
            loop(() => {
                let [nextState, nextInput] = arrow.invoke(currentState, input);
                if (isErr(nextInput)) {
                    return "break";
                }
                currentState = nextState;
                out.push(nextInput.value);
            });
            return [currentState, out];
        });
    }
    Reduce(callback) {
        return this.evalArr((state, last) => {
            return [state, callback(last)];
        });
    }
    FallibleArr(ok, err) {
        return this.evalArr((state, last) => {
            if (isOk(last)) {
                return [state, ok(last.value)];
            }
            else {
                return [state, err(last)];
            }
        });
    }
    BothOk(arrow) {
        return this.evalArr((state, last) => {
            let [state2, [left, right]] = arrow.invoke(state, last);
            if (isOk(left) && isOk(right)) {
                return [
                    state2,
                    parseOk([left.value, right.value]),
                ];
            }
            else if (isOk(left)) {
                return [state2, right];
            }
            else {
                return [state2, left];
            }
        });
    }
    OrElse(left, right) {
        return this.evalArr((state, last) => {
            let [state2, prev] = left.invoke(state, last);
            if (isOk(prev)) {
                return [state2, prev];
            }
            else {
                return right.invoke(state2, last);
            }
        });
    }
    fallibleInput(arrow) {
        return this.evalArr((state, last) => {
            if (isOk(last)) {
                let [state2, result] = arrow.invoke(state, last.value);
                return [state2, parseOk(result)];
            }
            else {
                return [state, last];
            }
        });
    }
    Source() {
        return this.evalArr(state => [state, state[tokens_iterator_1.ITERATOR_SOURCE]]);
    }
    Atomic(arrow) {
        return this.evalArr((state, prev) => state.atomic(state2 => arrow.invoke(state2, prev)));
    }
    label(label, arrow) {
        return this.evalArr((state, prev) => state.label(label, state2 => arrow.invoke(state2, prev)));
    }
    parent(desc, tokenType, arrow) {
        return this.evalArr(state => [state, state.parent(desc, tokenType, arrow)]);
    }
    token(tokenType) {
        return this.evalArr(state => [
            state,
            state.next(tokenType, token => {
                if (token === undefined) {
                    return parseErr("EOF", { type: "unexpected-eof" });
                }
                if (token.type === tokenType) {
                    return parseOk(token);
                }
                else {
                    return parseErr(token, {
                        type: "mismatch",
                        expected: tokenType,
                        actual: token,
                    });
                }
            }),
        ]);
    }
    lookahead() {
        return this.evalArr(state => [state, state.lookahead()]);
    }
    eof() {
        return this.evalArr(state => [
            state,
            state.next("eof", token => {
                if (token === undefined) {
                    return parseOk(undefined);
                }
                else {
                    return parseErr(token, {
                        type: "mismatch",
                        expected: "EOF",
                        actual: token,
                    });
                }
            }),
        ]);
    }
}
exports.ParserArrowEvaluateCore = ParserArrowEvaluateCore;
function token(type) {
    return ParserArrow.start().token(type);
}
exports.token = token;
function source() {
    return ParserArrow.start().source().fallible();
}
exports.source = source;
function recurse(callback) {
    return new ParserArrowEvaluateCore().recurse(callback);
}
exports.recurse = recurse;
class ParserArrow {
    constructor(core, start) {
        this.core = core;
        this.start = start;
    }
    static start() {
        return new ParserArrow(new ParserArrowEvaluateCore(), (s, t) => [
            s,
            t,
        ]);
    }
    evaluate(evaluator, prev) {
        return evaluator.withState(state => this.invoke(state, prev));
    }
    invoke(state, prev) {
        return this.start(state, prev);
    }
    iterate() {
        return this.core.iterate(this);
    }
    lift(callback) {
        return this.core.Arr(callback);
    }
    liftFallible(ifOk, ifErr) {
        return this.core.FallibleArr(ifOk, ifErr);
    }
    repeat() {
        return this.core.repeat(this.label("repeated")).label("repeat");
    }
    bothOk() {
        return this.core.BothOk(this);
    }
    andThen(arrow) {
        return this.core.andThen(this, arrow);
    }
    map(callback) {
        return this.core.andThen(this, this.core.Arr(callback));
    }
    // An adapter for cases where something assumes fallibility
    // but you have something infallible
    fallible() {
        return this.map(input => parseOk(input));
    }
    orElse(arrow) {
        return this.core.OrElse(this, arrow);
    }
    checkNext(arrow) {
        return this.mergeNext(arrow).ifOk(([left]) => left);
    }
    andCheck(arrow) {
        return this.core
            .mergeAndThen(this, arrow)
            .bothOk()
            .ifOk(([left]) => left);
    }
    ifOk(callback) {
        return this.core.andThen(this, this.core.FallibleArr(input => parseOk(callback(input)), err => err));
    }
    mergeNext(arrow) {
        return this.core.mergeNext(this, arrow).bothOk();
    }
    extend(key, arrow) {
        return this.mergeNext(arrow).ifOk(([left, right]) => {
            return {
                ...left,
                [key]: right,
            };
        });
    }
    or(value) {
        return this.andThen(this.core.FallibleArr(input => input, () => value));
    }
    // convenient
    named(name) {
        return this.ifOk(val => {
            return { [name]: val };
        });
    }
    present() {
        return this.core.andThen(this, this.core.Arr(list => list.length > 0
            ? parseOk(undefined)
            : parseErr("unknown", { type: "empty" })));
    }
    not() {
        return this.core.andThen(this, this.core.FallibleArr(input => parseErr("unknown", { type: "not", result: input }), _ => parseOk(undefined)));
    }
    // special parser combinators
    source() {
        return this.core.Source();
    }
    debug() {
        return this.core.andThen(this, this.core.Arr(input => {
            debugger;
            return input;
        }));
    }
    atomic() {
        return this.core.Atomic(this);
    }
    token(type) {
        return this.core.token(type);
    }
    eof() {
        return this.core.eof();
    }
    parent(desc, tokenType, arrow) {
        return this.core.parent(desc, tokenType, arrow);
    }
    label(label) {
        return this.core.label(label, this);
    }
    lookahead() {
        return this.core.lookahead();
    }
}
exports.ParserArrow = ParserArrow;
function loop(callback) {
    let count = 0;
    while (true) {
        count++;
        if (count > 1000) {
            throw new Error(`likely infinite loop`);
        }
        if (callback(count) === "break") {
            break;
        }
    }
}
