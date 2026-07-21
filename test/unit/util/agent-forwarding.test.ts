import {describe, test, expect, afterEach, vi} from 'vitest';
import {detectAgent, agentForwardingTags, agentForwardingPlugin} from '../../integration/lib/agent-forwarding';

// `process` is stubbed rather than relying on the ambient Node global: this
// test suite runs in Vitest Browser Mode (see vitest.config.unit.ts), so
// `process` is not the real Node process from the driving CLI - stubbing it
// exercises `detectAgent`'s logic against a controlled `env` object without
// depending on (or leaking) the actual test-runner's environment.
function withEnv(env: Record<string, string>) {
    vi.stubGlobal('process', {env});
}

describe('detectAgent', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('returns null when process is unavailable', () => {
        vi.stubGlobal('process', undefined);
        expect(detectAgent()).toBeNull();
    });

    test('returns null when process.env is unavailable', () => {
        vi.stubGlobal('process', {});
        expect(detectAgent()).toBeNull();
    });

    test('returns null when nothing in the environment matches', () => {
        withEnv({PATH: '/usr/bin', SHELL: '/bin/zsh'});
        expect(detectAgent()).toBeNull();
    });

    test('detects Claude Code via CLAUDECODE', () => {
        withEnv({CLAUDECODE: '1'});
        expect(detectAgent()).toBe('claude-code');
    });

    test('detects Claude Code via CLAUDE_CODE fallback within the same entry', () => {
        withEnv({CLAUDE_CODE: 'true'});
        expect(detectAgent()).toBe('claude-code');
    });

    test('distinguishes Cowork (Claude Code wrapper) from plain Claude Code by precedence', () => {
        // cowork's entry precedes claude-code's in the allowlist, and both
        // env vars can be present simultaneously in that harness.
        withEnv({CLAUDE_CODE_IS_COWORK: '1', CLAUDECODE: '1'});
        expect(detectAgent()).toBe('cowork');
    });

    test('detects Codex via any of its three indicators', () => {
        withEnv({CODEX_SANDBOX: '1'});
        expect(detectAgent()).toBe('codex');
        withEnv({CODEX_CI: '1'});
        expect(detectAgent()).toBe('codex');
        withEnv({CODEX_THREAD_ID: 'abc123'});
        expect(detectAgent()).toBe('codex');
    });

    test('detects Cursor CLI ahead of plain Cursor by table order', () => {
        withEnv({CURSOR_AGENT: '1', CURSOR_TRACE_ID: 'trace-1'});
        expect(detectAgent()).toBe('cursor-cli');
    });

    test('detects plain Cursor when only CURSOR_TRACE_ID is present', () => {
        withEnv({CURSOR_TRACE_ID: 'trace-1'});
        expect(detectAgent()).toBe('cursor');
    });

    test('detects GitHub Copilot via any of its indicators', () => {
        withEnv({COPILOT_GITHUB_TOKEN: 'token'});
        expect(detectAgent()).toBe('github-copilot');
    });

    test('detects Replit via REPL_ID', () => {
        withEnv({REPL_ID: 'repl-123'});
        expect(detectAgent()).toBe('replit');
    });

    test('requires an exact value match for vtcode', () => {
        withEnv({VTCODE: '0'});
        expect(detectAgent()).toBeNull();
        withEnv({VTCODE: '1'});
        expect(detectAgent()).toBe('vtcode');
    });

    test('requires an exact value match for warp', () => {
        withEnv({TERM_PROGRAM: 'iTerm.app'});
        expect(detectAgent()).toBeNull();
        withEnv({TERM_PROGRAM: 'WarpTerminal'});
        expect(detectAgent()).toBe('warp');
    });

    test('treats a whitespace-only presence value as absent', () => {
        withEnv({CLAUDECODE: '   '});
        expect(detectAgent()).toBeNull();
    });

    test('falls back to AI_AGENT when nothing in the allowlist matched', () => {
        withEnv({AI_AGENT: 'my-custom-agent'});
        expect(detectAgent()).toBe('my-custom-agent');
    });

    test('falls back to AGENT when AI_AGENT is absent', () => {
        withEnv({AGENT: 'another-agent'});
        expect(detectAgent()).toBe('another-agent');
    });

    test('prefers AI_AGENT over AGENT', () => {
        withEnv({AI_AGENT: 'first', AGENT: 'second'});
        expect(detectAgent()).toBe('first');
    });

    test('allowlist entries win over the fallback vars', () => {
        withEnv({CLAUDECODE: '1', AI_AGENT: 'should-be-ignored'});
        expect(detectAgent()).toBe('claude-code');
    });

    test('rejects an empty fallback value', () => {
        withEnv({AI_AGENT: ''});
        expect(detectAgent()).toBeNull();
    });

    test('rejects a fallback value containing unsafe characters (e.g. an embedded newline)', () => {
        withEnv({AI_AGENT: 'agent\nX-Injected: true'});
        expect(detectAgent()).toBeNull();
    });

    test('rejects a fallback value exceeding the 64-character safe length', () => {
        withEnv({AI_AGENT: 'a'.repeat(65)});
        expect(detectAgent()).toBeNull();
    });

    test('accepts a fallback value with dots, dashes and underscores', () => {
        withEnv({AI_AGENT: 'my-agent_v1.2'});
        expect(detectAgent()).toBe('my-agent_v1.2');
    });

    test('falls through to AGENT when AI_AGENT is unsafe', () => {
        withEnv({AI_AGENT: 'bad value with spaces', AGENT: 'good-value'});
        expect(detectAgent()).toBe('good-value');
    });

    test('never throws when process.env access itself throws', () => {
        vi.stubGlobal('process', {
            get env() {
                throw new Error('permission denied');
            }
        });
        expect(() => detectAgent()).not.toThrow();
        expect(detectAgent()).toBeNull();
    });
});

describe('agentForwardingTags', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('injects window.__mapboxAgent as the first thing in <head> when an agent is detected', () => {
        withEnv({CLAUDECODE: '1'});
        expect(agentForwardingTags()).toEqual([{
            tag: 'script',
            injectTo: 'head-prepend',
            children: 'window.__mapboxAgent = "claude-code";'
        }]);
    });

    test('injects nothing (not "unknown") when no agent is detected', () => {
        withEnv({});
        expect(agentForwardingTags()).toEqual([]);
    });
});

describe('agentForwardingPlugin', () => {
    test('wires agentForwardingTags up as a named Vite plugin', () => {
        const plugin = agentForwardingPlugin();
        expect(plugin.name).toEqual('agent-forwarding');
        expect(plugin.transformIndexHtml).toBe(agentForwardingTags);
    });
});
