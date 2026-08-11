import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {eliminateDeadBranches, GL_NATIVE_ONLY_DEFINES} from '../../build/glsl_dead_code.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

const strip = (glsl: string): string => glsl.replace(/\s*\/\/.*$/gm, '');

const read = (file: string): string => fs.readFileSync(file, 'utf8');

// --- unit behaviour -------------------------------------------------------------------------

const NEVER = ['DEAD', 'ALSO_DEAD'];

test('drops an #ifdef on a never-defined symbol, leaving no blank line', () => {
    const out = eliminateDeadBranches('#ifdef DEAD\ngone();\n#endif\nkept();', NEVER);
    assert.equal(out, 'kept();');
});

test('unwraps an #ifndef on a never-defined symbol, keeping the body', () => {
    const out = eliminateDeadBranches('#ifndef DEAD\nkept();\n#endif', NEVER);
    assert.equal(out, 'kept();');
});

test('selects the #else branch when the #if is never taken', () => {
    const out = eliminateDeadBranches('#ifdef DEAD\ngone();\n#else\nkept();\n#endif', NEVER);
    assert.equal(out, 'kept();');
});

test('resolves #elif chains when every condition is decidable', () => {
    const source = '#ifdef DEAD\na();\n#elif defined(ALSO_DEAD)\nb();\n#else\nc();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), 'c();');
});

test('preserves a group whose condition depends on a live symbol', () => {
    const source = '#ifdef FOG\nfog();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('preserves a partially-decidable condition entirely', () => {
    // `defined(DEAD)` is false, but FOG is unknown, so the whole group must survive untouched.
    const source = '#if defined(FOG) || defined(DEAD)\nx();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('&& short-circuits to false even when the other operand is unknown', () => {
    const source = '#if defined(DEAD) && defined(FOG)\ngone();\n#endif\nkept();';
    assert.equal(eliminateDeadBranches(source, NEVER), 'kept();');
});

test('|| of two never-defined symbols is decidable', () => {
    const source = '#if defined(DEAD) || defined(ALSO_DEAD)\ngone();\n#else\nkept();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), 'kept();');
});

test('handles "defined (X)" with a space and bare "defined X"', () => {
    assert.equal(eliminateDeadBranches('#if defined (DEAD)\ngone();\n#endif', NEVER), '');
    assert.equal(eliminateDeadBranches('#if defined DEAD\ngone();\n#endif', NEVER), '');
});

test('a bare never-defined identifier in #if evaluates to 0', () => {
    assert.equal(eliminateDeadBranches('#if DEAD\ngone();\n#endif', NEVER), '');
});

test('a bare live identifier in #if is left unknown', () => {
    const source = '#if MATERIAL_TABLE_DEBUG\nx();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('resolves #if 0', () => {
    assert.equal(eliminateDeadBranches('#if 0\ngone();\n#endif\nkept();', NEVER), 'kept();');
});

test('resolves nested groups inside an undecidable group', () => {
    const source = '#ifdef FOG\nfog();\n#ifdef DEAD\ngone();\n#endif\nmore();\n#endif';
    const expected = '#ifdef FOG\nfog();\nmore();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), expected);
});

test('resolves a decidable group nested inside a decidable group', () => {
    const source = '#ifndef DEAD\nouter();\n#ifdef ALSO_DEAD\ngone();\n#endif\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), 'outer();');
});

test('preserves indented directives verbatim when undecidable', () => {
    const source = 'a();\n    #ifdef FOG\n    b();\n    #endif';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('recognises indented directives as directives', () => {
    assert.equal(eliminateDeadBranches('a();\n    #ifdef DEAD\n    b();\n    #endif', NEVER), 'a();');
});

test('does not mistake a backslash-continued #define body for a directive', () => {
    const source = '#define M(x) \\\n    #notadirective\nuse();';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('leaves #define/#include/#pragma/#version/#extension untouched', () => {
    const source = [
        '#version 300 es',
        '#extension GL_EXT_foo : require',
        '#define A 1',
        '#include "_prelude_fog.vertex.glsl"',
        '#pragma mapbox: define highp vec4 color'
    ].join('\n');
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('never eliminates driver-provided GL_* extension macros', () => {
    const source = '#if defined(GL_EXT_blend_func_extended)\nx();\n#endif';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
    for (const name of GL_NATIVE_ONLY_DEFINES) {
        assert.ok(!name.startsWith('GL_'), `${name} looks like a driver macro and must not be in the list`);
    }
});

test('fails safe on unbalanced directives rather than guessing', () => {
    const missingEndif = '#ifdef DEAD\ngone();';
    assert.equal(eliminateDeadBranches(missingEndif, NEVER), missingEndif);

    const strayEndif = 'a();\n#endif';
    assert.equal(eliminateDeadBranches(strayEndif, NEVER), strayEndif);

    const strayElse = 'a();\n#else\nb();';
    assert.equal(eliminateDeadBranches(strayElse, NEVER), strayElse);

    const elifAfterElse = '#ifdef DEAD\na();\n#else\nb();\n#elif defined(ALSO_DEAD)\nc();\n#endif';
    assert.equal(eliminateDeadBranches(elifAfterElse, NEVER), elifAfterElse);
});

test('is a no-op on source with no conditionals', () => {
    const source = 'void main() {\n    gl_FragColor = vec4(1.0);\n}';
    assert.equal(eliminateDeadBranches(source, NEVER), source);
});

test('throws if the source defines a symbol claimed to be never defined', () => {
    assert.throws(
        () => eliminateDeadBranches('#define DEAD 1\n#ifdef DEAD\nx();\n#endif', NEVER, 'fake.glsl'),
        /fake\.glsl defines "DEAD"/
    );
});

// --- the symbol list must stay true of the real sources -------------------------------------

/** Every `.glsl` in the shared corpus. */
function shaderFiles(): string[] {
    return ['src/shaders', '3d-style/shaders']
        .flatMap((dir) => fs.readdirSync(path.join(root, dir))
            .filter((f) => f.endsWith('.glsl'))
            .map((f) => path.join(root, dir, f)));
}

/**
 * Every `.ts` that could contribute a `#define`, plus tests, which is the conservative choice:
 * a symbol mentioned anywhere in TypeScript is treated as possibly-definable.
 */
function tsFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules') walk(full);
            } else if (entry.name.endsWith('.ts')) {
                out.push(full);
            }
        }
    };
    for (const dir of ['src', '3d-style', 'test']) walk(path.join(root, dir));
    return out;
}

/**
 * Re-derives, from source, the set of conditional symbols GL JS can never define:
 * referenced by a shader conditional, not `#define`d in GLSL, not produced by one of the
 * generated define prefixes, and not mentioned anywhere in the TypeScript sources.
 */
function deriveNeverDefined(): Set<string> {
    const referenced = new Set<string>();
    const glslDefined = new Set<string>();

    for (const file of shaderFiles()) {
        for (const line of strip(read(file)).split('\n')) {
            const s = line.trim();
            if (!s.startsWith('#')) continue;
            let m: RegExpExecArray | null;
            if ((m = /^#\s*(?:ifdef|ifndef)\s+([A-Za-z_]\w*)/.exec(s))) {
                referenced.add(m[1]);
            } else if ((m = /^#\s*(?:if|elif)\b(.*)/.exec(s))) {
                const re = /\bdefined\s*\(?\s*([A-Za-z_]\w*)/g;
                let d: RegExpExecArray | null;
                while ((d = re.exec(m[1])) !== null) referenced.add(d[1]);
            }
            if ((m = /^#\s*define\s+([A-Za-z_]\w*)/.exec(s))) glslDefined.add(m[1]);
        }
    }

    // Defines assembled by string concatenation rather than written as literals:
    // `#define HAS_UNIFORM_${name}` in ProgramConfiguration.defines(), the HAS_ATTRIBUTE_/
    // HAS_TEXTURE_ pragma expansion in shaders.ts, and `MAX_UBO_SIZE_VEC4 ${n}u`.
    const generatedPrefixes = ['HAS_UNIFORM_', 'HAS_ATTRIBUTE_', 'HAS_TEXTURE_', 'MAX_UBO_SIZE_VEC4', 'GL_'];

    let ts = '';
    for (const file of tsFiles()) {
        ts += `${read(file)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '')}\n`;
    }

    const never = new Set<string>();
    for (const symbol of referenced) {
        if (glslDefined.has(symbol)) continue;
        if (generatedPrefixes.some((p) => symbol.startsWith(p))) continue;
        if (new RegExp(`\\b${symbol}\\b`).test(ts)) continue;
        never.add(symbol);
    }
    return never;
}

test('every listed symbol is genuinely never defined in GL JS', () => {
    const derived = deriveNeverDefined();
    const wrong = GL_NATIVE_ONLY_DEFINES.filter((name) => !derived.has(name));
    assert.deepEqual(wrong, [], `these symbols are reachable in GL JS and must be removed from ` +
        `GL_NATIVE_ONLY_DEFINES in build/glsl_dead_code.js, or the code they guard is being ` +
        `deleted from the shipped shaders: ${wrong.join(', ')}`);

    // The other direction is an opportunity, not a defect: a newly-added gl-native-only symbol
    // simply is not eliminated yet. Report it without failing.
    const missed = [...derived].filter((name) => !GL_NATIVE_ONLY_DEFINES.includes(name)).sort();
    if (missed.length > 0) {
        console.log(`note: additional never-defined shader symbols could be eliminated: ${missed.join(', ')}`);
    }
});

test('no shader defines a symbol on the never-defined list', () => {
    for (const file of shaderFiles()) {
        assert.doesNotThrow(
            () => eliminateDeadBranches(strip(read(file)), GL_NATIVE_ONLY_DEFINES, file),
            `${path.relative(root, file)} defines a symbol listed as never defined`
        );
    }
});

test('output is directive-balanced for every shader in the corpus', () => {
    const count = (text: string, re: RegExp): number => (text.match(re) || []).length;
    for (const file of shaderFiles()) {
        const source = strip(read(file));
        const out = eliminateDeadBranches(source, GL_NATIVE_ONLY_DEFINES, file);
        const rel = path.relative(root, file);

        const opens = count(out, /^[ \t]*#[ \t]*(?:if|ifdef|ifndef)\b/gm);
        const closes = count(out, /^[ \t]*#[ \t]*endif\b/gm);
        assert.equal(opens, closes, `${rel}: ${opens} openers vs ${closes} #endif after elimination`);

        // An #else or #elif must never be left without an enclosing group.
        assert.ok(count(out, /^[ \t]*#[ \t]*(?:else|elif)\b/gm) <= opens * 8, `${rel}: stray #else/#elif`);

        // Elimination only ever removes text.
        assert.ok(out.length <= source.length, `${rel}: output grew`);

        // Nothing outside a conditional may be touched.
        for (const directive of ['#version', '#extension', '#include', '#pragma']) {
            assert.equal(count(out, new RegExp(directive, 'g')), count(source, new RegExp(directive, 'g')),
                `${rel}: ${directive} count changed`);
        }
    }
});

test('_prelude_material_table.vertex.glsl is eliminated entirely', () => {
    // The whole file sits inside `#ifdef HAS_SHADER_STORAGE_BLOCK_material_buffer`, and WebGL 2
    // has no shader-storage-buffer support at all, so none of it can ever run in GL JS.
    const file = path.join(root, 'src/shaders/_prelude_material_table.vertex.glsl');
    const source = strip(read(file));
    assert.ok(source.length > 4000, 'expected a multi-kB prelude');
    assert.equal(eliminateDeadBranches(source, GL_NATIVE_ONLY_DEFINES, file).trim(), '');
});

test('removes a meaningful amount from the corpus', () => {
    let before = 0;
    let after = 0;
    for (const file of shaderFiles()) {
        const source = strip(read(file));
        before += source.length;
        after += eliminateDeadBranches(source, GL_NATIVE_ONLY_DEFINES, file).length;
    }
    // Guards against the transform silently becoming a no-op (e.g. a regex change).
    assert.ok(before - after > 15000, `expected >15 kB removed, got ${before - after}`);
});
