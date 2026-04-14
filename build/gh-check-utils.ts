/* eslint-disable camelcase */

import {Octokit} from '@octokit/rest';

const owner = 'mapbox';
const repo = process.env.REPO_NAME;

/**
 * Create a GitHub check run.
 */
export async function createCheck(sha: string, checkName: string, title: string, summary: string, conclusion: 'success' | 'failure' = 'success') {
    const githubNotifier = new Octokit({auth: process.env.GITHUB_NOTIFIER_TOKEN});

    try {
        await githubNotifier.checks.create({
            owner,
            repo,
            name: checkName,
            head_sha: sha,
            output: {title, summary},
            status: 'completed' as const,
            conclusion,
            completed_at: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Failed to create check "${checkName}" for ${sha}: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * Get the summary of a specific check run for a given ref.
 */
export async function getCheckSummary(sha: string, checkName: string): Promise<string | undefined> {
    const githubReader = new Octokit({auth: process.env.GITHUB_READER_TOKEN});
    const {data: checks} = await githubReader.checks.listForRef({owner, repo, ref: sha, check_name: checkName});
    const run = checks.check_runs[0];
    if (!run) return undefined;
    return run.output.summary;
}
