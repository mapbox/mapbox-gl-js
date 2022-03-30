import * as core from '@actions/core';
import * as github from '@actions/github';

try {
    const prBody = core.getInput('pr-body');
    const changelogEntry = prBody.match(/\<changelog\>(.+)<\/changelog>/);
    // Should create a standard of at least # characters long ("I am" is shortest English sentence).
    if (changelogEntry && changelogEntry[1].length > 3) {
        core.setOutput('Changelog entry requirement is completed');
    } else {
        core.setFailed('Changelog entry is not completed or does not pass basic requirements');
    }
} catch (error) {
    core.setFailed(error.message);
}
