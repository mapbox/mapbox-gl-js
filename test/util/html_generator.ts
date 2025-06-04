// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-env browser */
import template from 'lodash/template.js';

const generateResultHTML = template(`
  <div class="tab tab_<%- r.status %>">
    <% if (r.status === 'failed') { %>
      <input type="checkbox" id="<%- r.id %>" checked>
    <% } else { %>
      <input type="checkbox" id="<%- r.id %>">
    <% } %>
    <label class="tab-label" style="background: <%- r.color %>" for="<%- r.id %>"><p class="status-container"><span class="status"><%- r.status %></span> - <%- r.name %> <% if (r.attempt !== 0) { %>retry <%- r.attempt + 1 %><% } %> diff: <%- r.minDiff %></p></label>
    <div class="tab-content">
      <% if (r.actual) { %>
          <img title="actual" src="<%- r.actual %>">
      <% } %>
      <% if (r.expected) { %>
          <img title="expected <%- r.expectedPath %>" src="<%- r.expected %>">
      <% } %>
      <% if (r.imgDiff) { %>
          <img title="diff" src="<%- r.imgDiff %>">
      <% } %>
      <% if (r.jsonDiff) { %>
          <details>
            <summary><strong style="color: red">JSON Diff</strong></summary>
            <pre><%- r.jsonDiff %></pre>
          </details>
      <% } %>
      <% if (r.error) { %>
          <p style="color: red">
            <strong>Error:</strong>
            <pre><%- r.error.stack %></pre>
          </p>
      <% } %>
      <% if (r.errors && r.errors.length !== 0) { %>
          <p style="color: red">
            <strong>Errors:</strong>
            <dl>
                <% r.errors.forEach(function(error) { %>
                    <dt><%- error.message %></dt>
                    <dd><pre><%- error.stack %></pre></dd>
                <% }); %>
            </dl>
          </p>
      <% } %>
    </div>
  </div>
`);

export const pageCss = `
body { font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 10px; background: #ecf0f1 }
h1 { font-size: 32px; margin-bottom: 0; }
input[id="only-failed"] { margin-top: 24px; margin-bottom: 12px; margin-right: 8px; }
input[id="only-failed"]:checked ~ .tests > .tab:not(.tab_failed) { display: none; }
img { margin: 0 10px 10px 0; border: 1px dotted #ccc; image-rendering: pixelated; }
.tab input { position: absolute; opacity: 0; z-index: -1;}
.tests { border-top: 1px dotted #bbb; margin-top: 10px; padding-top: 15px; overflow: hidden; }
.status-container { margin: 0; }
.status { text-transform: uppercase; }
.label { color: white; font-size: 18px; padding: 2px 6px 3px; border-radius: 3px; margin-right: 3px; vertical-align: bottom; display: inline-block; }
.tab { margin-bottom: 30px; width: 100%; overflow: hidden; z-index: 100; position: relative; }
.tab-label { display: flex; color: white; border-radius: 5px; justify-content: space-between; padding: 1em; font-weight: bold; cursor: pointer; }
.tab-label:hover { filter: brightness(85%); }
.tab-label::after { content: "\\276F"; width: 1em; height: 1em; text-align: center; transition: all .35s; }
.tab-content { max-height: 0; padding: 0 1em; background: white; overflow: scroll; transition: all .35s; }
.tab-content pre { font-size: 14px; margin: 0 0 10px; }
input:checked + .tab-label { filter: brightness(90%); };
input:checked + .tab-label::after { transform: rotate(90deg); }
input:checked ~ .tab-content { max-height: 100vh; padding: 1em; border: 1px solid #eee; border-top: 0; border-radius: 5px; }
iframe { pointer-events: none; opacity: 0; }
`;

const stats = {
    failed: 0,
    passed: 0,
    todo: 0
};
const colors = {
    passed: 'green',
    failed: 'red',
    todo: '#e89b00'
};

const counterDom = {
    passed: null,
    failed: null,
    todo: null,
};

let resultsContainer;

export function setupHTML() {
    // Add CSS to the page
    const style = document.createElement('style');
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(pageCss));

    // Create a container to hold test stats
    const statsContainer = document.createElement('div');
    statsContainer.id = 'stats';

    const failedTestContainer = document.createElement('h1');
    failedTestContainer.style.color = 'red';
    counterDom.failed = document.createElement('span');
    counterDom.failed.innerHTML = '0';
    const failedTests = document.createElement('span');
    failedTests.innerHTML = ' tests failed.';
    failedTestContainer.appendChild(counterDom.failed);
    failedTestContainer.appendChild(failedTests);
    statsContainer.appendChild(failedTestContainer);

    const passedTestContainer = document.createElement('h1');
    passedTestContainer.style.color = 'green';
    counterDom.passed = document.createElement('span');
    counterDom.passed.innerHTML = '0';
    const passedTests = document.createElement('span');
    passedTests.innerHTML = ' tests passed.';
    passedTestContainer.appendChild(counterDom.passed);
    passedTestContainer.appendChild(passedTests);
    statsContainer.appendChild(passedTestContainer);

    const todoTestContainer = document.createElement('h1');
    todoTestContainer.style.color = '#e89b00';
    counterDom.todo = document.createElement('span');
    counterDom.todo.innerHTML = '0';
    const todoTests = document.createElement('span');
    todoTests.innerHTML = ' tests todo.';
    todoTestContainer.appendChild(counterDom.todo);
    todoTestContainer.appendChild(todoTests);
    statsContainer.appendChild(todoTestContainer);

    document.body.appendChild(statsContainer);

    const onlyFailedCheckbox = Object.assign(document.createElement('input'), {
        type: 'checkbox',
        id: 'only-failed',
        checked: true,
    });

    const onlyFailedLabel = Object.assign(document.createElement('label'), {
        htmlFor: 'only-failed',
        innerHTML: 'Show only failed tests',
    });

    document.body.appendChild(onlyFailedCheckbox);
    document.body.appendChild(onlyFailedLabel);

    //Create a container to hold test results
    resultsContainer = document.createElement('div');
    resultsContainer.className = 'tests';
    document.body.appendChild(resultsContainer);
}

export function getStatsHTML() {
    const statsContainer = document.getElementById('stats');

    if (statsContainer) {
        return statsContainer.innerHTML;
    }

    return '';
}

const testStatus = new Map();
const testId = new Map();

export function updateHTML(testData) {
    const status = testData.status;
    if (!testStatus.has(testData.name)) {
        stats[status]++;
        testStatus.set(testData.name, testData.status);
        testId.set(testData.name, 0);
    } else if (testStatus.get(testData.name) !== status) {
        stats[testStatus.get(testData.name)]--;
        stats[status]++;
        testStatus.set(testData.name, status);
        testId.set(testData.name, testId.get(testData.name) + 1);
    } else if (testStatus.get(testData.name) === status) {
        testId.set(testData.name, testId.get(testData.name) + 1);
    }

    counterDom[status].innerHTML = stats[status];

    // skip adding passing tests to report in CI mode
    if (import.meta.env.CI && status === 'passed') return;

    testData["color"] = colors[status];
    testData["id"] = `${status}Test-${stats[status]}-${testId.get(testData.name)}`;
    testData["attempt"] = testId.get(testData.name);

    const html = generateResultHTML({r: testData});
    const resultHTMLFrag = document.createRange().createContextualFragment(html);

    resultsContainer.appendChild(resultHTMLFrag);

    return html;
}

export function getHTML(statsContent: string, testsContent: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GL JS | Render tests results</title>
          <style>
              ${pageCss}
          </style>
      </head>
      <body>
          <div id="stats">
            ${statsContent}
          </div>
          <input type="checkbox" id="only-failed" checked>
          <label for="only-failed">Show only failed tests</label>
          <div class="tests">
            ${testsContent}
          </div>
      </body>
      </html>
  `.trim();
}
