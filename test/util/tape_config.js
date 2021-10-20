/* eslint-disable import/no-commonjs */
/* eslint-env browser */
/* global Testem */
// This file sets up tape with the add-ons we need,
// this file also acts as the entrypoint for browserify.
const tape = require('tape');
const browserWriteFile = require('../util/browser_write_file.js');

//Add test filtering ability
const filter = getQueryVariable('filter') || '.*';
const test = require('tape-filter')(tape, filter);

module.exports = test;

// Helper method to extract query params from url
function getQueryVariable(variable) {
    let query = window.location.search.substring(1);
    query = decodeURIComponent(query);
    const vars = query.split("&");
    for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split("=");
        if (pair[0] === variable) { return pair[1]; }
    }
    return (false);
}

// Testem object is available globally in the browser test page.
// Tape outputs via `console.log` and is intercepted by testem using this function
Testem.handleConsoleMessage = function(msg) {
    // Send output over ws to testem server
    Testem.emit('tap', msg);
    // Return true and log output only when not in CI mode. (yarn run watch-render).
    return !process.env.CI;
};

// Persist the current html on the page as an artifact once tests finish
Testem.afterTests((config, data, cb) => {
    browserWriteFile(
        `test/integration/${window._suiteName}/index.html`,
        window.btoa(document.documentElement.outerHTML),
        () => cb()
    );
});
