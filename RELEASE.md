# Release Procedure

## Check for "Release Blocker" issues or PRs

If there are any [open "Release Blocker" issues or PRs](https://github.com/mapbox/mapbox-gl-js/labels/release%20blocker), we cannot do a release.

## Get the latest `master`

```bash
git checkout master &&
git fetch &&
git reset origin/master --hard
```

## Merge `mb-pages` into `master`

```bash
git merge origin/mb-pages --no-edit
```

## Make sure your environment is in a good state

```bash
npm install &&
npm test &&
npm run test-suite
```

## Test examples

Start the docs server by running

```bash
npm run start-docs
```

Test at least the following examples before continuing

 - [Add GeoJSON markers](http://127.0.0.1:4000/mapbox-gl-js/example/geojson-markers/)
 - [Animate a point](http://127.0.0.1:4000/mapbox-gl-js/example/animate-point-along-line/)
 - [Get features under the mouse pointer](http://127.0.0.1:4000/mapbox-gl-js/example/featuresat/)
 - [Fly to a location based on scroll position](http://127.0.0.1:4000/mapbox-gl-js/example/scroll-fly-to/)
 - [Display markers with popups](http://127.0.0.1:4000/mapbox-gl-js/example/marker-popup/)
 - [Highlight features under the mouse pointer](http://127.0.0.1:4000/mapbox-gl-js/example/hover-styles/)
 - [Dispay driving directions](http://127.0.0.1:4000/mapbox-gl-js/example/mapbox-gl-directions/)
 - [Set a point after Geocoder result](http://127.0.0.1:4000/mapbox-gl-js/example/point-from-geocoder-result/)
 - [Display a satellite map](http://127.0.0.1:4000/mapbox-gl-js/example/satellite-map/) (stress test with rapid zooming & panning)


## Update `CHANGELOG.md`

Update `CHANGELOG.md` with all changes since the last release. A list of commits is available on the [GitHub Releases page](https://github.com/mapbox/mapbox-gl-js/releases) through a link that says "X commits to master since this release"

The changelog is a valuable document that many people read. Use editorial judgement when writing the changelog, phrasing things in terms of their impact on end users.

 - Some commits have no impact on end users and can be left out of the changelog.
 - Some commit messages are describe the underlying problem fixed instead of the surface bug. Their changelog message should describe the surface bug. This might require some research.
 - All changelog entires should reference an issue # or pull request #.
 - Breaking changes should be clearly labeled.

Look over the changes and choose a new version number, respecting [semver](http://semver.org/) ("patch" if there are no new features, "minor" if there are new features).

## Update version number

Update the version number in `package.json`, `README.md`, `bench/fps/site.js`, `_config.yml`, and `_config.mb-pages.yml`.

## Commit and tag release

After **carefully inspecting the diff**, commit and tag the release.

The [CI server](https://circleci.com/gh/mapbox/mapbox-gl-js) will automatically publish tagged builds to the Mapbox CDN. **There is no going back once you execute these commands! A published version tag is forever on our CDN.**

```bash
VERSION=vX.Y.Z && # UPDATE ME
git commit -am $VERSION &&
git tag $VERSION &&
git push origin &&
git push origin --tags
```

**Wait for the [CI server](https://circleci.com/gh/mapbox/mapbox-gl-js) build to finish successfully before proceeding.**

## Create a GitHub release

Create a [GitHub release](https://github.com/mapbox/mapbox-gl-js/releases/new) using the tag you just pushed and the text in `CHANGELOG.md`.

## Merge `master` into `mb-pages`

Merge `master` into `mb-pages` and publish the updated documentation.

```bash
git checkout mb-pages &&
git merge master --no-edit &&
git push origin mb-pages
```

## Publish to npm

Publish the release to npm. **There is no going back once you execute this command! A published npm package is forever.**

```bash
git checkout master &&
npm install &&
npm publish
```
