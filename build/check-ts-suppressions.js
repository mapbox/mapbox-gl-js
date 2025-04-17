#!/usr/bin/env node

/* eslint-disable camelcase */

import {ESLint} from 'eslint';
import {Octokit} from '@octokit/rest';
import {execSync} from 'child_process';
import tseslint from 'typescript-eslint';

const owner = 'mapbox';
const repo = 'mapbox-gl-js';
const branch = process.env['CIRCLE_BRANCH'] || execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

async function getBannedTsComments() {
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

async function getTargetPR() {
    const githubReader = new Octokit({
        auth: execSync('mbx-ci github reader token').toString().trim()
    });

    const {data: pullRequests} = await githubReader.pulls.list({
        owner,
        repo,
        state: 'open'
    });

    return pullRequests.find(pr => pr.head.ref === branch);
}

async function getPriorBannedTsComments(pullRequest) {
    const githubReader = new Octokit({
        auth: execSync('mbx-ci github reader token').toString().trim()
    });

    const {data: ref} = await githubReader.checks.listForRef({
        owner,
        repo,
        ref: pullRequest.base.ref
    });

    const run = ref.check_runs.find(run => run.name === 'TypeScript suppressions');
    if (!run) return;

    const summary = JSON.parse(run.output.summary);
    return summary.current;
}

async function notifyPR(pullRequest, bannedTsComments, priorBannedTsComments) {
    const githubNotifier = new Octokit({
        auth: execSync('mbx-ci github notifier token').toString().trim()
    });

    let title = `Total ${bannedTsComments} supressions. `;
    if (!priorBannedTsComments) {
        title += 'No prior suppressions found.';
    } else if (bannedTsComments > priorBannedTsComments) {
        title += `This PR adds ${bannedTsComments - priorBannedTsComments} suppressions.`;
    } else if (bannedTsComments < priorBannedTsComments) {
        title += `This PR removes ${priorBannedTsComments - bannedTsComments} suppressions.`;
    } else if (bannedTsComments === priorBannedTsComments) {
        title += 'No changes in suppressions.';
    }

    await githubNotifier.checks.create({
        owner,
        repo,
        name: 'TypeScript suppressions',
        output: {
            title,
            summary: JSON.stringify({current: bannedTsComments, prior: priorBannedTsComments})
        },
        head_branch: pullRequest.head.ref,
        head_sha: pullRequest.head.sha,
        status: 'completed',
        conclusion: 'success',
        completed_at: new Date().toISOString()
    });
}

async function notifyBranch(bannedTsComments) {
    const githubNotifier = new Octokit({
        auth: execSync('mbx-ci github notifier token').toString().trim()
    });

    await githubNotifier.checks.create({
        owner,
        repo,
        name: 'TypeScript suppressions',
        output: {
            title: `Total ${bannedTsComments} suppressions.`,
            summary: JSON.stringify({current: bannedTsComments})
        },
        head_branch: branch,
        head_sha: execSync('git rev-parse HEAD').toString().trim(),
        status: 'completed',
        conclusion: 'success',
        completed_at: new Date().toISOString()
    });
}

const bannedTsComments = await getBannedTsComments();
if (bannedTsComments === 0) {
    console.log('No suppressed TypeScript errors found.');
    process.exit(0);
}

console.log('Suppressed TypeScript errors:', bannedTsComments);

const PK = process.env['MBX_CI_DOMAIN'];
if (!PK) {
    console.log('Skipping notification.');
    process.exit(0);
}

const pullRequest = await getTargetPR();
if (!pullRequest) {
    console.log(`No open PR found for branch "${branch}", notifying branch.`);
    await notifyBranch(bannedTsComments);
    process.exit(0);
}

const priorBannedTsComments = await getPriorBannedTsComments(pullRequest);
if (priorBannedTsComments) {
    console.log('Prior suppressed TypeScript errors:', priorBannedTsComments);
}

await notifyPR(pullRequest, bannedTsComments, priorBannedTsComments);

process.on('unhandledRejection', (/** @type {Error} */ error) => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    console.error(error.message || 'Error');
    process.exit(1);
});
