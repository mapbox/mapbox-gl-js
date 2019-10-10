/* eslint-disable import/no-commonjs */
/* eslint-env browser */
const Parser = require('tap-parser');
const {template} = require('lodash');

const generateResultHTML = template(`
<div class="test <%- r.status %>">
    <h2><span class="label" style="background: <%- r.color %>"><%- r.status %></span> <%- r.name %></h2>
    <% if (r.status !== 'errored') { %>
        <img src="<%- r.actual %>">
    <% } %>
    <% if (r.error) { %><p style="color: red"><strong>Error:</strong> <%- r.error.message %></p><% } %>
    <% if (r.difference) { %>
        <pre><%- r.difference.trim() %></pre>
    <% } %>
</div>`);

const generateStatsHTML = template(`
<h1 style="color: red;">
<%- failedTests %> tests failed.
</h1>
<h1 style="color: green;">
<%- passedTests %> tests passed.
</h1>
`);

const pageCss = `
body { font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 10px; }
h1 { font-size: 32px; margin-bottom: 0; }
button { vertical-align: middle; }
h2 { font-size: 24px; font-weight: normal; margin: 10px 0 10px; line-height: 1; }
img { margin: 0 10px 10px 0; border: 1px dotted #ccc; }
.stats { margin-top: 10px; }
.test { border-bottom: 1px dotted #bbb; padding-bottom: 5px; }
.tests { border-top: 1px dotted #bbb; margin-top: 10px; }
.diff { color: #777; }
.test p, .test pre { margin: 0 0 10px; }
.test pre { font-size: 14px; }
.label { color: white; font-size: 18px; padding: 2px 6px 3px; border-radius: 3px; margin-right: 3px; vertical-align: bottom; display: inline-block; }
.hide { display: none; }
`;

/**
 * A class that can be used to incrementally generate prettified HTML output from tap output.
 *
 * @class TapHtmlGenerator
 */
class TapHtmlGenerator {

    constructor() {
        // Add CSS to the page
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.appendChild(document.createTextNode(pageCss));

        //Create a container to hold test stats
        this.statsContainer = document.createElement('div');
        document.body.appendChild(this.statsContainer);

        //Create a container to hold test results
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'tests';
        document.body.appendChild(this.resultsContainer);

        this.stats = {
            failedTests: 0,
            passedTests: 0
        };

        this.tapParser = new Parser();
        this.tapParser.on('pass', this._onTestPassed.bind(this));
        this.tapParser.on('fail', this._onTestFailed.bind(this));
    }

    /**
     * Pushes a line of tap output into the html generaor.
     *
     * @param {string} tapLine
     * @memberof TapHtmlGenerator
     */
    pushTapLine(tapLine) {
        this.tapParser.write(`${tapLine}\n`);
    }

    _onTestPassed(assert) {
        this.stats.passedTests++;

        const metaData = JSON.parse(assert.name);
        metaData["status"] = "passed";
        metaData["color"] = "green";

        this.resultsContainer.innerHTML += generateResultHTML({r: metaData});
        this._updateStatsContainer();
    }

    _onTestFailed(assert) {
        this.stats.failedTests++;

        const metaData = JSON.parse(assert.name);
        metaData["status"] = "failed";
        metaData["color"] = "red";

        this.resultsContainer.innerHTML += generateResultHTML({r: metaData});
        this._updateStatsContainer();
    }

    _updateStatsContainer() {
        this.statsContainer.innerHTML = generateStatsHTML(this.stats);
    }
}

module.exports = TapHtmlGenerator;
