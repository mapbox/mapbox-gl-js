/**
 * GLSL Dead-branch elimination
 *
 * `src/shaders/*.glsl` and `3d-style/shaders/*.glsl` are the shared source of truth for both
 * GL JS and gl-native. A number of preprocessor symbols are therefore referenced by
 * `#ifdef`/`#if` in that shared GLSL but are only ever defined by a native backend (Metal,
 * Vulkan) or a native-only feature. GL JS can never define them, so every branch guarded by
 * one is unreachable.
 *
 * This module removes those branches at build time. It is deliberately conservative, only code that
 * is provably not reachable in gl-js is removed.
 * @see test/build/glsl_dead_code.test.js — This test re-derives the symbol list from source and
 * WILL fails if this list and the code disagree.
 */

/**
 * Preprocessor symbols referenced by the shared GLSL that GL JS can never define.
 *
 * Every entry is verified by `test/build/glsl_dead_code.test.js`
 */
export const GL_NATIVE_ONLY_DEFINES: ReadonlyArray<string> = Object.freeze([
    // Metal renders with a top-left viewport origin; Vulkan flips Y. WebGL is bottom-left, so
    // neither is ever set here. See the comment at src/shaders/_prelude.fragment.glsl.
    'VIEWPORT_ORIGIN_TOP_LEFT',
    'FLIP_Y',
    // Metal-only shadow-map Y flip. Explicitly documented as such in
    // 3d-style/shaders/_prelude_shadow.fragment.glsl ("Vulkan and GL do not define ...").
    'SHADOW_MAP_FLIP_Y',
    // Shader storage buffer objects. WebGL 2 has no SSBO support at all, and
    // src/shaders/_prelude.vertex.glsl already provides the #ifndef fallback macros.
    'HAS_SHADER_STORAGE_BLOCK_material_buffer',
    // Feature cutout is gl-native only; src/shaders/shaders.ts says so and substitutes a
    // comment stub for the two _prelude_feature_cutout includes.
    'FEATURE_CUTOUT',
    'FEATURE_CUTOUT_VERTEX',
    'ROUTE_CORRIDOR',
    // Native-only depth/occlusion and render-target capabilities.
    'CLIP_ZERO_TO_ONE',
    'FLOAT_RENDER_TARGET',
    'OCCLUSION_QUERIES',
    'Z_TEST_OCCLUSION',
    'TERRAIN_FRAGMENT_OCCLUSION',
    'ZERO_EXAGGERATION',
    // Native-only line rendering variant.
    'RENDER_LINE_CURVE',
    // Native-only indicator cutout.
    'INDICATOR_CUTOUT',
    // Guards native-specific code paths in shared GLSL.
    'NATIVE'
]);

type Directive = {kind: string; expression: string};
type TextNode = {type: 'text'; text: string};
type GroupNode = {type: 'group'; branches: Branch[]; endifText: string};
type Node = TextNode | GroupNode;
type Branch = {directiveText: string; condition: Directive | null; body: Node[]};
type Token = {type: string; value: string};

type Tristate = boolean | undefined; // `undefined` means "cannot decide".

const DIRECTIVE_REGEX = /^#\s*(ifdef|ifndef|elif|else|endif|if)\b(.*)$/;
const IDENTIFIER_REGEX = /^[A-Za-z_]\w*$/;
// Matches tokens in priority order. \S at the end catches any unhandled character.
const TOKEN_REGEX = /&&|\|\||[()!]|[A-Za-z_]\w*|\d+[uU]?[lL]*|\S/g;
const LINE_CONT_RE = /\\[ \t]*$/;

/** Marker thrown by the expression parser when it meets syntax it does not model. */
const UNSUPPORTED = Symbol('unsupported');

const IF_KINDS = new Set(['if', 'ifdef', 'ifndef']);
const BRANCH_KINDS = new Set(['elif', 'else', 'endif']);

/**
 * Joins backslash-continued physical lines into single logical lines, so a multi-line `#define`
 * body can never be mistaken for a directive.
 *
 * Each returned line retains its original text, including inner newlines.
 */
function toLogicalLines(source: string): string[] {
    const raw = source.split('\n');
    const lines: string[] = [];
    for (let i = 0; i < raw.length;) {
        let text = raw[i++];
        while (LINE_CONT_RE.test(text) && i < raw.length) text += `\n${raw[i++]}`;
        lines.push(text);
    }
    return lines;
}

/**
 * Classifies a logical line as a conditional directive, if it is one.
 *
 * Only conditional directives are recognised: `#define`, `#include`, `#pragma`, `#version`,
 * `#extension` and `#line` are deliberately treated as opaque text.
 */
function directiveOf(logicalLine: string): Directive | null {
    const nl = logicalLine.indexOf('\n');
    const first = (nl === -1 ? logicalLine : logicalLine.slice(0, nl)).trim();
    if (first.charCodeAt(0) !== 0x23 /* # */) return null;
    const match = DIRECTIVE_REGEX.exec(first);
    if (!match) return null;
    // Strip a trailing line comment (`#endif // FOG`). The caller usually strips comments
    // first, but this keeps the module correct when used standalone.
    return {kind: match[1], expression: match[2].replace(/\/\/.*$/, '').trim()};
}

function tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    for (const match of expression.matchAll(TOKEN_REGEX)) {
        const v = match[0];
        if (v === '&&' || v === '||' || v === '(' || v === ')' || v === '!') {
            tokens.push({type: v, value: v});
        } else if (/^[A-Za-z_]/.test(v)) {
            tokens.push({type: 'id', value: v});
        } else if (/^\d/.test(v)) {
            tokens.push({type: 'num', value: v});
        } else {
            // Comparison, arithmetic, bitwise — anything we do not model.
            throw UNSUPPORTED;
        }
    }
    return tokens;
}

const and = (a: Tristate, b: Tristate): Tristate => (a === false || b === false ? false : (a === true && b === true ? true : undefined));
const or = (a: Tristate, b: Tristate): Tristate => (a === true || b === true ? true : (a === false && b === false ? false : undefined));
const not = (a: Tristate): Tristate => (a === undefined ? undefined : !a);

/**
 * Evaluates a preprocessor condition against the never-defined set.
 *
 * Returns `undefined` whenever the result depends on a symbol GL JS might define, so an
 * unknown result always preserves the branch.
 */
function evaluateExpression(expression: string, neverDefined: Set<string>): Tristate {
    let tokens: Token[];
    try {
        tokens = tokenize(expression);
    } catch {
        return undefined;
    }
    if (tokens.length === 0) return undefined;

    let pos = 0;
    /** True when the next token has this type. */
    const at = (type: string): boolean => tokens[pos]?.type === type;
    const take = (type: string): Token => {
        const token = tokens[pos];
        if (!token || token.type !== type) throw UNSUPPORTED;
        pos++;
        return token;
    };

    function parsePrimary(): Tristate {
        if (at('(')) {
            pos++;
            const value = parseOr();
            take(')');
            return value;
        }
        if (at('num')) {
            return parseInt(tokens[pos++].value, 10) !== 0;
        }
        if (at('id')) {
            const name = tokens[pos++].value;
            if (name === 'defined') {
                // `defined(X)`, `defined (X)` and `defined X` are all legal.
                let id: string;
                if (at('(')) {
                    pos++;
                    id = take('id').value;
                    take(')');
                } else {
                    id = take('id').value;
                }
                // We can prove "never defined"; we can never prove "defined".
                return neverDefined.has(id) ? false : undefined;
            }
            // A bare identifier in `#if` is macro-expanded; an undefined macro evaluates to 0.
            // So a never-defined symbol is provably falsy. Anything else is unknown, because a
            // `#define` elsewhere could give it any value.
            return neverDefined.has(name) ? false : undefined;
        }
        throw UNSUPPORTED;
    }

    function parseUnary(): Tristate {
        if (at('!')) {
            pos++;
            return not(parseUnary());
        }
        return parsePrimary();
    }

    function parseAnd(): Tristate {
        let value = parseUnary();
        while (at('&&')) {
            pos++;
            value = and(value, parseUnary());
        }
        return value;
    }

    function parseOr(): Tristate {
        let value = parseAnd();
        while (at('||')) {
            pos++;
            value = or(value, parseAnd());
        }
        return value;
    }

    try {
        const value = parseOr();
        if (pos !== tokens.length) return undefined; // trailing junk we do not model
        return value;
    } catch {
        return undefined;
    }
}

/**
 * Evaluates the condition of a single branch directive.
 *
 * `#else` is not passed here — it is represented by a `null` condition on the branch instead.
 */
function evaluateDirective(directive: Directive, neverDefined: Set<string>): Tristate {
    if (directive.kind === 'ifdef' || directive.kind === 'ifndef') {
        if (!IDENTIFIER_REGEX.test(directive.expression)) return undefined;
        const defined = neverDefined.has(directive.expression) ? false : undefined;
        return directive.kind === 'ifdef' ? defined : not(defined);
    }
    return evaluateExpression(directive.expression, neverDefined);
}

/**
 * Reads the logical line at `i`.
 *
 * An out-of-range index means the directive structure was not what the parser assumed, so it is
 * treated as a structural anomaly: {@link UNSUPPORTED} propagates to `eliminateDeadBranches`,
 * which returns the source unchanged. That is the same fail-safe as unbalanced directives, and is
 * why this is preferable to a non-null assertion.
 */
function lineAt(lines: string[], i: number): string {
    const line = lines[i];
    if (line === undefined) throw UNSUPPORTED;
    return line;
}

/**
 * Parses logical lines into a tree of text nodes and conditional groups.
 */
function parseBlock(
    lines: string[],
    start: number,
    nested: boolean
): {nodes: Node[]; index: number; terminator: Directive | null} {
    const nodes: Node[] = [];
    let i = start;
    while (i < lines.length) {
        const directive = directiveOf(lineAt(lines, i));
        if (directive && IF_KINDS.has(directive.kind)) {
            const group = parseGroup(lines, i);
            nodes.push(group.node);
            i = group.index;
            continue;
        }
        if (directive && BRANCH_KINDS.has(directive.kind)) {
            if (!nested) throw UNSUPPORTED; // stray branch/terminator at top level
            return {nodes, index: i, terminator: directive};
        }
        nodes.push({type: 'text', text: lineAt(lines, i)});
        i++;
    }
    if (nested) throw UNSUPPORTED; // unterminated group
    return {nodes, index: i, terminator: null};
}

/**
 * Parses one `#if … [#elif …] [#else] #endif` group starting at `start`.
 */
function parseGroup(lines: string[], start: number): {node: GroupNode; index: number} {
    const branches: Branch[] = [];
    let i = start;
    let sawElse = false;
    for (;;) {
        const directive = directiveOf(lineAt(lines, i));
        if (!directive) throw UNSUPPORTED;
        const isElse = directive.kind === 'else';
        if (isElse) {
            if (sawElse) throw UNSUPPORTED; // two #else in one group
            sawElse = true;
        }
        const branch: Branch = {
            directiveText: lineAt(lines, i),
            condition: isElse ? null : directive,
            body: []
        };
        const block = parseBlock(lines, i + 1, true);
        branch.body = block.nodes;
        branches.push(branch);
        i = block.index;
        const terminator = block.terminator;
        if (!terminator) throw UNSUPPORTED;
        if (terminator.kind === 'endif') {
            return {node: {type: 'group', branches, endifText: lineAt(lines, i)}, index: i + 1};
        }
        if (terminator.kind === 'elif' && sawElse) throw UNSUPPORTED; // #elif after #else
        // `i` currently points at the #elif/#else, which begins the next branch.
    }
}

function render(nodes: Node[], neverDefined: Set<string>, out: string[]): void {
    for (const node of nodes) {
        if (node.type === 'text') {
            out.push(node.text);
            continue;
        }
        // Single pass: check decidability and find the first taken branch simultaneously.
        let fullyDecidable = true;
        let taken: Branch | undefined;
        for (const branch of node.branches) {
            const value = branch.condition === null ? true : evaluateDirective(branch.condition, neverDefined);
            if (value === undefined) { fullyDecidable = false; break; }
            if (value && taken === undefined) taken = branch;
        }
        if (fullyDecidable) {
            // Keep only the first taken branch and drop every directive. A group with no taken
            // branch and no #else disappears entirely.
            if (taken) render(taken.body, neverDefined, out);
            continue;
        }
        // Not decidable: preserve this group's directives verbatim, but still resolve any
        // nested groups, whose decidability does not depend on this condition.
        for (const branch of node.branches) {
            out.push(branch.directiveText);
            render(branch.body, neverDefined, out);
        }
        out.push(node.endifText);
    }
}

export function eliminateDeadBranches(
    source: string,
    neverDefined: Iterable<string> = GL_NATIVE_ONLY_DEFINES,
    id = '<glsl>'
): string {
    const never = new Set<string>(neverDefined);

    // Guard the transform's central assumption. If a shader starts defining one of these, every
    // branch we deleted elsewhere may have been live.
    const defineRegex = /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)/gm;
    let defineMatch: RegExpExecArray | null;
    while ((defineMatch = defineRegex.exec(source)) !== null) {
        // Capture group 1 is non-optional in defineRegex, so a match guarantees it.
        const defined = defineMatch[1];
        if (never.has(defined)) {
            throw new Error(
                `${id} defines "${defined}", which build/glsl_dead_code.ts lists as never ` +
                `defined in GL JS. Remove it from GL_NATIVE_ONLY_DEFINES (and re-run ` +
                `npm run test-build) or stop defining it in GLSL.`
            );
        }
    }

    if (!/^[ \t]*#[ \t]*(if|ifdef|ifndef)\b/m.test(source)) return source;

    const lines = toLogicalLines(source);
    let nodes: Node[];
    try {
        nodes = parseBlock(lines, 0, false).nodes;
    } catch (error) {
        if (error === UNSUPPORTED) return source; // unbalanced or unexpected — leave it alone
        throw error;
    }

    const out: string[] = [];
    render(nodes, never, out);
    return out.join('\n');
}
