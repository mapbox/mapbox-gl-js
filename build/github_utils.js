import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const SIZE_CHECK_APP_ID = 14028;
const SIZE_CHECK_APP_INSTALLATION_ID = 229425;

const owner = 'mapbox';
const repo = 'mapbox-gl-js';

export function createOctokit() {

    const PK = process.env['SIZE_CHECK_APP_PRIVATE_KEY'];
    if (!PK) {
        return null;
        console.log('Fork PR; not computing size.');
        process.exit(0);
    }

    // Initialize github client
    const github = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            id: SIZE_CHECK_APP_ID,
            privateKey: Buffer.from(PK, 'base64').toString('binary'),
            installationId: SIZE_CHECK_APP_INSTALLATION_ID
        }
    });

    return github;
}

export async function getMergeBase() {
    const head = process.env['CIRCLE_SHA1'];
    const pr = process.env['CIRCLE_PULL_REQUEST'];
    if (pr) {
        const number = +pr.match(/\/(\d+)\/?$/)[1];
        return github.pulls.get({
            owner,
            repo,
            pull_number: number
        }).then(({data}) => {
            const base = data.base.ref;
            return execSync(`git merge-base origin/${base} ${head}`).toString().trim();
        });
    } else {
        // Walk backward through the history (maximum of 10 commits) until
        // finding a commit on either master or release-*; assume that's the
        // base branch.
        for (const sha of execSync(`git rev-list --max-count=10 ${head}`).toString().trim().split('\n')) {
            const base = execSync(`git branch -r --contains ${sha} origin/main origin/release-*`).toString().split('\n')[0].trim();
            if (base) {
                return Promise.resolve(execSync(`git merge-base ${base} ${head}`).toString().trim());
            }
        }
    }

    return Promise.resolve(null);
}
