import generateFixtureJson from './integration/lib/generate-fixture-json';

// Step 1: Compile fixture data into a json file, so it can be bundled
generateFixtureJson('test/integration/render-tests', {});
