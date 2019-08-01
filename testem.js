var generateFixtureJson = require('./test/integration/lib/generate-fixture-json');
var createServer = require('./test/integration/lib/server');
var runAll = require('npm-run-all');

let beforeHookInvoked = false;
let afterHookInvoked = false;
let server;

module.exports =  {
    "framework": "tap",
    "src_files": [
        "test/dist/*.js"
    ],
    "serve_files": [
        "test/dist/tape.js",
        "test/dist/mapbox-gl-test.js",
        "test/dist/query-test.js"
    ],
    "launch_in_dev": [ "Chrome" ],
    "launch_in_ci": [ "Chrome" ],
    "browser_args": {
      "Chrome": {
        "mode": "ci",
        "args": [ "--headless", "--disable-gpu", "--remote-debugging-port=9222" ]
      }
    },
    "proxies": {
        "/tiles":{
           "target": "http://localhost:2900"
        },
        "/glyphs":{
           "target": "http://localhost:2900"
        },
        "/tilesets":{
           "target": "http://localhost:2900"
        },
        "/sprites":{
           "target": "http://localhost:2900"
        },
        "/data":{
           "target": "http://localhost:2900"
        }
    },
    "before_tests": function(config, data, callback) {
       if(!beforeHookInvoked){
         server = createServer();
         //1. Compile fixture data into a json file, so it can be bundled
         generateFixtureJson('test/integration/query-tests', {});

         //2. Build test artifacts in parallel
         runAll(['build-query-suite', 'build-tape', 'build-test'], {parallel: true}).then(() => {
             server.listen(callback);
         }).catch((e) => {
             callback(e);
         });

         beforeHookInvoked = true;
       }
    },
    "after_tests": function(config, data, callback) {
       if(!afterHookInvoked){
         server.close(callback);
         afterHookInvoked = true;
       }
    }
}