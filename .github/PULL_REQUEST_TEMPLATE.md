## Launch Checklist

 - [ ] Make sure the PR title is descriptive and preferably reflects the change from the user's perspective.
 - [ ] Add additional detail and context in the PR description (with screenshots/videos if there are visual changes).
 - [ ] Manually test the debug page.
 - [ ] Write tests for all new functionality and make sure the CI checks pass.
 - [ ] Document any changes to public APIs.
 - [ ] Post benchmark scores if the change could affect performance.
 - [ ] Tag `@mapbox/map-design-team` `@mapbox/static-apis` if this PR includes style spec API or visual changes.
 - [ ] Tag `@mapbox/gl-native` if this PR includes shader changes or needs a native port.
 - [ ] Tag `@mapbox/gl-native` if this PR disables any test because it also needs to be disabled on their side.
 - [ ] Create a ticket for `gl-native` to groom in the [MAPSNAT JIRA queue](https://mapbox.atlassian.net/jira/software/c/projects/MAPSNAT/list) if this PR includes shader changes or features not present in the native side or if it disables a test that's not disabled there.
