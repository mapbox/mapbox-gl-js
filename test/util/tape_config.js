/* eslint-disable import/no-commonjs */
/* eslint-env browser */
/* global Testem */
// This file sets up tape with the add-ons we need,
// this file also acts as the entrypoint for browserify.
const tape = require('tape');
const TapHtmlGenerator = require('./tap_html');

//Add test filtering ability
const filter = getQueryVariable('filter') || '.*';
const test = require('tape-filter')(tape, filter);

module.exports = test;

// Helper method to extract query params from url
function getQueryVariable(variable) {
    const query = window.location.search.substring(1);
    const vars = query.split("&");
    for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split("=");
        if (pair[0] === variable) { return pair[1]; }
    }
    return (false);
}

const tapHtmlGenerator = new TapHtmlGenerator();
// Testem object is available globally in the browser test page.
// Tape outputs via `console.log` and is intercepted by testem using this function
Testem.handleConsoleMessage = function(msg) {
    // Send output over ws to testem server
    Testem.emit('tap', msg);

    // Pipe to html generator
    tapHtmlGenerator.pushTapLine(msg);
    return false;
};

