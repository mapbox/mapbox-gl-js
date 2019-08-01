/* eslint-disable import/no-commonjs */
/* eslint-env browser */
// This file sets up tape with the add-ons we need,
// this file also acts as the entrypoint for browserify.
const tape = require('tape');

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
