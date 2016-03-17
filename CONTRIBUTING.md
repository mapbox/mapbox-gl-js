Hi, and thanks in advance for contributing to Mapbox GL. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Issue Labels

Our labeling system should be

 - **minimalistic:** Labels' usefulness are inversely proportional to how many we have.
 - **objective:** Labels should be objective enough that any two people would agree on a labeling decision.
 - **useful:** Labels should track state or capture semantic meaning that would otherwise be hard to search.

We have divided our labels into categories to make them easier to use.

 - actionable status (red)
 - non-actionable status (grey)
 - issue type (blue)
 - issue topic / project (yellow)
 - difficulty (green)
 - priority (orange)

## Code Conventions

* Our code conventions are mostly enforced with eslint, which will be run as part of `npm test`.
* In internal / private methods, we check preconditions with `assert`, helping us catch mistakes within the library. For performance, these checks are removed from the production build with [unassertify](https://www.npmjs.com/package/unassertify).
* In external / public methods, we check preconditions where appropriate and emit an error. "Emit" can mean throwing an `Error`, passing an `Error` as a first callback argument, or emitting an `error` event, as appropriate for the context. These checks remain present in production builds, helping downstream authors avoid common mistakes.

## Documentation Conventions

See [docs/README.md](https://github.com/mapbox/mapbox-gl-js/blob/master/docs/README.md).

## Git Conventions

If you have commit access to the repository, please be aware that we strive to maintain a clean, mostly-linear history. When merging a branch, please do the following:

* Rebase the branch onto the current tip of the target branch (`master` or `mb-pages`).
* Squash commits until they are self-contained, potentially down to a single commit if appropriate.
* Perform a fast-forward merge into the target branch and push the result.

In particular **do not** use the "Merge pull request" button on GitHub.

This applies when merging pull-requests from external contributors as well. If necessary, rebase and clean up the commits yourself before manually merging them. Then comment in the PR thanking the contributor and noting the final commit hash(es), and close it.

Never merge a branch that is failing CI.
