#!/usr/bin/env node

import {ESLint} from 'eslint';
import tseslint from 'typescript-eslint';
import {execSync} from 'child_process';
import {createCheck, getCheckSummary} from './gh-check-utils';

const CHECK_NAME = 'GL JS TypeScript Suppressions';

async function getSuppressions() {
    const config = tseslint.config(
        {
            languageOptions: {
                parser: tseslint.parser,
                parserOptions: {
                    ecmaVersion: 'latest',
                    sourceType: 'module',
                },
            },
            plugins: {
                '@typescript-eslint': tseslint.plugin,
            },
            rules: {
                '@typescript-eslint/ban-ts-comment': ['error', {
                    'ts-expect-error': true,
                    'ts-ignore': 'allow-with-description',
                    'ts-nocheck': 'allow-with-description',
                    'ts-check': 'allow-with-description',
                }],
            },
            files: ['**/*.ts', '**/*.js'],
        }
    );

    const eslint = new ESLint({
        overrideConfigFile: true,
        // @ts-expect-error - type mismatch
        overrideConfig: config
    });

    const results = await eslint.lintFiles(['src', '3d-style']);

    let tsComments = 0;
    for (const result of results) {
        for (const message of result.messages) {
            if (message.ruleId === '@typescript-eslint/ban-ts-comment') {
                tsComments++;
            }
        }
    }

    return tsComments;
}

// COMMIT_SHA and PRIOR_COMMIT_SHA are being set in the GitHub Action Workflow
const currentSha = process.env.COMMIT_SHA || execSync('git rev-parse HEAD').toString().trim();
const priorCommit = process.env.PRIOR_COMMIT_SHA;

// Fetch prior suppressions
const priorSuppressions: number | undefined = await getCheckSummary(priorCommit, CHECK_NAME).then(summary => (summary ? JSON.parse(summary) as number : undefined));

// Calculate new suppressions
const newSuppressions: number = await getSuppressions();

let message = '';
if (!priorSuppressions) {
    message = `First check (${newSuppressions} total)`;
} else if (newSuppressions > priorSuppressions) {
    const diff = newSuppressions - priorSuppressions;
    message = `+${diff} suppression${diff > 1 ? 's' : ''} (now ${newSuppressions} total)`;
} else if (newSuppressions < priorSuppressions) {
    const diff = priorSuppressions - newSuppressions;
    message = `-${diff} suppression${diff > 1 ? 's' : ''} (now ${newSuppressions} total)`;
} else {
    message = `No changes (${newSuppressions} total)`;
}

console.log(message);

const summary = JSON.stringify(newSuppressions);
await createCheck(currentSha, CHECK_NAME, message, summary, 'success');

process.on('unhandledRejection', (error: unknown) => {
    console.error((error as Error)?.message || 'Error');
    process.exit(1);
});
