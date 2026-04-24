/* global document */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// eslint-disable-next-line e18e/ban-dependencies
import template from 'lodash/template.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const generateResultHTML = template(`
  <div class="tab tab_<%- r.status %>">
    <% if (r.status === 'failed') { %>
      <input type="checkbox" id="<%- r.id %>" checked>
    <% } else { %>
      <input type="checkbox" id="<%- r.id %>">
    <% } %>
    <label class="tab-label" style="background: <%- r.color %>" for="<%- r.id %>"><p class="status-container"><span class="status"><%- r.status %></span> - <%- r.name %> <% if (r.attempt !== 0) { %>retry <%- r.attempt + 1 %><% } %></p></label>
    <div class="tab-content">
      <% if (r.actual || r.expected) { %>
        <span class="img-hover-container">
          <p class="img-label img-label-actual">Actual<span class="img-hover-hint"> (hover to see expected)</span></p>
          <p class="img-label img-label-expected">Expected</p>
          <% if (r.actual) { %>
            <img class="img-actual" src="<%- r.actual %>">
          <% } %>
          <% if (r.expected) { %>
            <img class="img-expected" title="<%- r.expectedPath %>" src="<%- r.expected %>">
          <% } %>
        </span>
      <% } %>
      <% if (r.imgDiff) { %>
        <span class="img-static-container">
          <p class="img-label">Diff</p>
          <img title="diff" src="<%- r.imgDiff %>">
        </span>
      <% } %>
      <% if (r.allowed !== undefined) { %>
        <p class="diff"><strong>Allowed:</strong> <%- r.allowed %></p>
      <% } %>
      <% if (r.minDiff !== undefined) { %>
        <p class="diff"><strong>Diff:</strong> <%- r.minDiff === 0 ? 'none' : r.minDiff %></p>
      <% } %>
      <% if (r.expectedPath) { %>
        <p class="diff"><strong>Expected image path:</strong> <%- r.expectedPath %></p>
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
    </div>
  </div>
`);

export const pageCss = `
body { font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 10px; background: #ecf0f1 }
h1 { font-size: 32px; margin-bottom: 0; }
input[id="only-failed"], input[id="img-hover"] { margin-top: 24px; margin-bottom: 12px; margin-right: 8px; }
input[id="img-hover"] { margin-left: 16px; }
input[id="only-failed"]:checked ~ .tests > .tab:not(.tab_failed) { display: none; }
img { margin: 0 10px 10px 0; border: 1px dotted #ccc; image-rendering: pixelated; vertical-align: top; }
.img-hover-container { position: relative; display: inline-block; vertical-align: top; text-align: center; padding-top: 22px; }
.img-hover-hint { display: none; }
input[id="img-hover"]:checked ~ .tests .img-hover-container { cursor: crosshair; }
input[id="img-hover"]:checked ~ .tests .img-hover-hint { display: inline; }
input[id="img-hover"]:checked ~ .tests .img-hover-container .img-expected { display: none; }
input[id="img-hover"]:checked ~ .tests .img-hover-container .img-label-expected { display: none; }
input[id="img-hover"]:checked ~ .tests .img-hover-container:hover .img-actual { display: none; }
input[id="img-hover"]:checked ~ .tests .img-hover-container:hover .img-label-actual { display: none; }
input[id="img-hover"]:checked ~ .tests .img-hover-container:hover .img-expected { display: inline; }
input[id="img-hover"]:checked ~ .tests .img-hover-container:hover .img-label-expected { display: block; }
.img-label { position: absolute; top: 0; left: 0; right: 0; margin: 0; font-size: 14px; font-weight: bold; }
.img-static-container { position: relative; display: inline-block; vertical-align: top; text-align: center; padding-top: 22px; }
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    counterDom.failed.innerHTML = '0';
    const failedTests = document.createElement('span');
    failedTests.innerHTML = ' tests failed.';
    failedTestContainer.appendChild(counterDom.failed);
    failedTestContainer.appendChild(failedTests);
    statsContainer.appendChild(failedTestContainer);

    const passedTestContainer = document.createElement('h1');
    passedTestContainer.style.color = 'green';
    counterDom.passed = document.createElement('span');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    counterDom.passed.innerHTML = '0';
    const passedTests = document.createElement('span');
    passedTests.innerHTML = ' tests passed.';
    passedTestContainer.appendChild(counterDom.passed);
    passedTestContainer.appendChild(passedTests);
    statsContainer.appendChild(passedTestContainer);

    const todoTestContainer = document.createElement('h1');
    todoTestContainer.style.color = '#e89b00';
    counterDom.todo = document.createElement('span');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

    const imgHoverCheckbox = Object.assign(document.createElement('input'), {
        type: 'checkbox',
        id: 'img-hover',
        checked: true,
    });

    const imgHoverLabel = Object.assign(document.createElement('label'), {
        htmlFor: 'img-hover',
        innerHTML: 'Toggle images on Hover',
    });

    document.body.appendChild(imgHoverCheckbox);
    document.body.appendChild(imgHoverLabel);

    //Create a container to hold test results
    resultsContainer = document.createElement('div');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const status = testData.status;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!testStatus.has(testData.name)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        stats[status]++;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        testStatus.set(testData.name, testData.status);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        testId.set(testData.name, 0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (testStatus.get(testData.name) !== status) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        stats[testStatus.get(testData.name)]--;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        stats[status]++;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        testStatus.set(testData.name, status);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        testId.set(testData.name, testId.get(testData.name) + 1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (testStatus.get(testData.name) === status) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        testId.set(testData.name, testId.get(testData.name) + 1);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    counterDom[status].innerHTML = stats[status];

    // skip adding passing tests to report in CI mode
    if (import.meta.env.CI && status === 'passed') return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    testData["color"] = colors[status];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    testData["id"] = `${status}Test-${stats[status]}-${testId.get(testData.name)}`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    testData["attempt"] = testId.get(testData.name);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const html = generateResultHTML({r: testData});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const resultHTMLFrag = document.createRange().createContextualFragment(html);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    resultsContainer.appendChild(resultHTMLFrag);

    return html;
}

export type DiagnosticInfo = {
    platform: string;
    generatedAt: string;
    testSuite?: string;
    configFile?: string;
    reproduceCommand?: string;
    userAgent?: string;
    os?: string;
    browser?: string;
    viewport?: {width: number; height: number};
    devicePixelRatio?: number;
    spriteFormat?: string;
    nodeVersion?: string;
    shard?: string;
    durationMs?: number;
};

const escapeHTML = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatDuration(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}min ${seconds}sec`;
    if (minutes > 0) return `${minutes}min ${seconds}sec`;
    return `${seconds}sec`;
}

export function getDiagnosticsHTML(diag: DiagnosticInfo): string {
    const rows: Array<[string, string | undefined]> = [
        ['Platform', diag.platform],
        ['Generated', diag.generatedAt],
        ['Duration', diag.durationMs !== undefined ? formatDuration(diag.durationMs) : undefined],
        ['Test suite', diag.testSuite],
        ['Config file', diag.configFile],
        ['Reproduce locally', diag.reproduceCommand],
        ['Browser', diag.browser],
        ['Operating system', diag.os],
        ['User agent', diag.userAgent],
        ['Viewport', diag.viewport ? `${diag.viewport.width} x ${diag.viewport.height}` : undefined],
        ['Device pixel ratio', diag.devicePixelRatio !== undefined ? String(diag.devicePixelRatio) : undefined],
        ['Sprite format', diag.spriteFormat],
        ['Shard', diag.shard],
        ['Node version', diag.nodeVersion],
    ];

    const items = rows
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(String(value))}</dd>`)
        .join('\n');

    return `
      <details class="diagnostics" open>
        <summary>Run diagnostics</summary>
        <dl>
          ${items}
        </dl>
      </details>
    `.trim();
}

export const diagnosticsCss = `
.diagnostics { background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 8px 12px; margin-bottom: 16px; font-size: 14px; }
.diagnostics summary { cursor: pointer; font-weight: bold; font-size: 16px; padding: 4px 0; }
.diagnostics dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 8px 0 0; }
.diagnostics dt { font-weight: bold; color: #555; }
.diagnostics dd { margin: 0; word-break: break-all; font-family: -apple-system, BlinkMacSystemFont, "SF Mono", Menlo, monospace; }
`;

export function getHTML(statsContent: string, testsContent: string, diagnosticsContent: string = '') {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GL JS | Render tests results</title>
          <style>
              ${pageCss}
              ${diagnosticsCss}
          </style>
      </head>
      <body>
          ${diagnosticsContent}
          <div id="stats">
            ${statsContent}
          </div>
          <input type="checkbox" id="only-failed" checked>
          <label for="only-failed">Show only failed tests</label>
          <input type="checkbox" id="img-hover" checked>
          <label for="img-hover">Toggle images on Hover</label>
          <div class="tests">
            ${testsContent}
          </div>
      </body>
      </html>
  `.trim();
}
