import generateFixtureJson from './integration/lib/generate-fixture-json';
import createServer from './integration/lib/server';
import runAll from 'npm-run-all';

const server = createServer();
//1. Compile fixture data into a json file, so it can be bundled
generateFixtureJson('test/integration/query-tests', {});

//2. Build test artifacts in parallel
runAll(['build-query-suite', 'build-tape', 'build-test'], {parallel: true}).then(() => {
    return new Promise((resolve, reject) => {
        server.listen((err) => {
            if(err) {
                reject(err);
            }else{
                resolve();
            }
        });
    });
//3. Once server has started start testem server
}).then(() => {
    console.log("TEST DEPENDENCIES READY");
})