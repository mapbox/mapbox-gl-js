// Test-only tooling. Detects the AI coding agent (if any) driving the
// Node process that runs this repo's own test suite (Playwright/Cypress via
// Vitest Browser Mode), and forwards the detected id into the browser page
// as `window.__mapboxAgent` before any page script runs, so that
// `TelemetryEvent.postEvent` (src/util/mapbox.ts) can tag the events/v2
// request it fires during an agent-driven verification run of this repo.
//
// This module must never be imported by production GL JS code or bundled
// into the shipped library - it is wired in only from the Vitest browser
// config files (vitest.config.render.ts, vitest.config.query.ts).
//
// Ported from mapbox-sdk-js's `lib/helpers/agent-detect.js` (merged as
// mapbox/mapbox-sdk-js#509) - kept in sync with that implementation and with
// the Python sibling `agent_detect.py` in mapbox/tilesets-cli. Same
// allowlist, same precedence order.

import type {Plugin, HtmlTagDescriptor} from 'vite';

// A safe charset for an agent id that ends up in a header/inline script: env
// vars are not validated by whoever sets them, so a value like
// "foo\nbar: injected" must be rejected here rather than being handed to the
// page as an unvalidated string.
const SAFE_FALLBACK_ID = /^[\w.-]{1,64}$/;

type EnvCondition = [envVar: string, expectedValue: string | null];
type AllowlistEntry = [agentId: string, conditions: EnvCondition[]];

// (agentId, [[envVar, expectedValueOrNull], ...]) - table order is
// precedence order; the first entry with any matching condition wins.
// expectedValue null means a presence check (the key exists in
// process.env with a non-empty, non-whitespace value); otherwise an exact
// equality check.
//
// Keep this table in sync with mapbox-sdk-js's `lib/helpers/agent-detect.js`
// and tilesets-cli's `agent_detect.py`. Canonical origin: HuggingFace's
// public `agent-harnesses.ts` registry.
const ALLOWLIST: AllowlistEntry[] = [
    ['antigravity', [['ANTIGRAVITY_AGENT', null]]],
    ['augment-cli', [['AUGMENT_AGENT', null]]],
    ['cline', [['CLINE_ACTIVE', null]]],
    ['cowork', [['CLAUDE_CODE_IS_COWORK', null]]],
    ['claude-code', [['CLAUDECODE', null], ['CLAUDE_CODE', null]]],
    ['codex', [['CODEX_SANDBOX', null], ['CODEX_CI', null], ['CODEX_THREAD_ID', null]]],
    ['crush', [['CRUSH', null]]],
    ['gemini-cli', [['GEMINI_CLI', null]]],
    ['github-copilot', [['COPILOT_MODEL', null], ['COPILOT_ALLOW_ALL', null], ['COPILOT_GITHUB_TOKEN', null]]],
    ['goose', [['GOOSE_TERMINAL', null]]],
    ['hermes-agent', [['HERMES_SESSION_ID', null]]],
    ['kilo-code', [['KILOCODE_FEATURE', null]]],
    ['kiro', [['AGENT_CONTEXT_OUT', null]]],
    ['openclaw', [['OPENCLAW_SHELL', null]]],
    ['opencode', [['OPENCODE_CLIENT', null]]],
    ['pi', [['PI_CODING_AGENT', null]]],
    ['replit', [['REPL_ID', null]]],
    ['trae', [['TRAE_AI_SHELL_ID', null]]],
    ['vtcode', [['VTCODE', '1']]],
    ['warp', [['TERM_PROGRAM', 'WarpTerminal']]],
    ['zed', [['ZED_TERM', null]]],
    ['cursor-cli', [['CURSOR_AGENT', null]]],
    ['cursor', [['CURSOR_TRACE_ID', null]]]
];

// Checked only if nothing in ALLOWLIST matched. First one with a non-empty
// (after trimming) value matching SAFE_FALLBACK_ID wins; an unsafe or empty
// value falls through to the next var rather than being returned as-is.
const FALLBACK_VARS = ['AI_AGENT', 'AGENT'];

// Scans `env` for a matching agent indicator. Split out from `detectAgent`
// so the individual key reads below (which could throw in an environment
// where `process.env` is a permission-gated Proxy) are covered by a single
// try/catch there, rather than one bare `typeof process` guard that only
// checks the top-level object.
function scanEnv(env: NodeJS.ProcessEnv): string | null {
    for (const [agentId, conditions] of ALLOWLIST) {
        for (const [envVar, expected] of conditions) {
            if (expected === null) {
                if ((env[envVar] || '').trim()) {
                    return agentId;
                }
            } else if (env[envVar] === expected) {
                return agentId;
            }
        }
    }

    for (const fallbackVar of FALLBACK_VARS) {
        const value = (env[fallbackVar] || '').trim();
        if (value && SAFE_FALLBACK_ID.test(value)) {
            return value;
        }
    }

    return null;
}

/**
 * Detect the AI coding agent (if any) driving this process, from
 * `process.env`. Node-only.
 *
 * Never reads or logs the full environment - only the matched id is used.
 * Never throws: any error while reading `process.env` is treated as "no
 * agent detected" rather than propagating out and breaking the test run.
 *
 * There is no `'unknown'` sentinel: when nothing matches, this returns
 * `null` so that callers can omit any agent tagging entirely rather than
 * emitting a misleading placeholder value.
 */
export function detectAgent(): string | null {
    // The `process.env` accesses below (including the guard itself) must
    // all be inside this try: in an environment where `process.env` is a
    // permission-gated Proxy, even reading `process.env` to check it can
    // throw, not just reading an individual key.
    try {
        if (typeof process === 'undefined' || !process.env) {
            return null;
        }
        return scanEnv(process.env);
    } catch (error) {
        return null;
    }
}

/**
 * The HTML tags to inject into the Vitest Browser Mode tester page for the
 * detected agent (if any). Equivalent to a raw Playwright test's
 * `page.addInitScript(() => { window.__mapboxAgent = '<id>' })` called
 * before navigation: `agentForwardingPlugin` injects the returned script at
 * the very start of `<head>` so `window.__mapboxAgent` is set before any
 * other page script (including the GL JS bundle under test) runs.
 *
 * When no agent is detected, this returns an empty array: no script tag is
 * injected and `window.__mapboxAgent` is never set, so `postEvent`'s
 * behavior is unchanged from today. Split out from `agentForwardingPlugin`
 * so it can be unit-tested directly, without going through Vite's plugin
 * machinery.
 */
export function agentForwardingTags(): HtmlTagDescriptor[] {
    const agentId = detectAgent();
    if (!agentId) return [];

    return [{
        tag: 'script',
        injectTo: 'head-prepend',
        children: `window.__mapboxAgent = ${JSON.stringify(agentId)};`
    }];
}

/**
 * Vite plugin that forwards the detected agent id into the Vitest Browser
 * Mode tester page. See `agentForwardingTags` for the injected content.
 */
export function agentForwardingPlugin(): Plugin {
    return {
        name: 'agent-forwarding',
        transformIndexHtml: agentForwardingTags
    };
}
