import {compile} from 'yeahjs';

type TestStatus = 'passed' | 'failed' | 'skipped';

export type TestReportData = {
    name: string;
    status: TestStatus;
    color?: string;
    testPath?: string;
    width?: number;
    height?: number;
    actual?: string;
    expected?: string;
    imgDiff?: string;
    imageThreshold?: number;
    imageThresholdRule?: string;
    minDiff?: number;
    jsonDiff?: string;
    error?: Error;
    skippedReasons?: string[];
    matchedSkipRules?: string[];
    matchedExpectedFile?: string;
};

type DecoratedTestData = TestReportData & {
    showImages: boolean;
    domId: string;
    domIdJs: string;
    isRenderTest: boolean;
    attempts: number;
    failedAttempts: number;
    retryNote?: string;
    errorMessage?: string;
};

type Stats = Record<TestStatus, number>;

type ReportWindow = Window & {updateState?: () => void};

const renderResultHTML = compile(`
  <div class="test <%= r.status %>">
    <h2><span class="label" style="background: <%= r.color %>"><%= r.status %></span> <%= r.name %></h2>
    <% if (r.testPath) { %>
      <p class="diff"><strong>Test path:</strong> <%= r.testPath %></p>
    <% } %>
    <% if (r.showImages !== false && (!r.error || r.actual || r.expected)) { %>
      <% if (r.isRenderTest && (r.actual || r.expected)) { %>
        <span class="img-container" onmouseover="showExpected('<%= r.domIdJs %>')" onmouseout="showActual('<%= r.domIdJs %>')">
          <p class="img-label" id="<%= r.domId %>-label">Actual Result (hover mouse to show expected)</p>
          <% if (r.expected) { %>
            <img class="img-expected" title="Expected Output" id="<%= r.domId %>-exp" style="display: none"<% if (r.width) { %> width="<%= r.width %>"<% } %><% if (r.height) { %> height="<%= r.height %>"<% } %> src="<%= r.expected %>">
          <% } %>
          <% if (r.actual) { %>
            <img class="img-actual" title="Actual Result" id="<%= r.domId %>-act"<% if (r.width) { %> width="<%= r.width %>"<% } %><% if (r.height) { %> height="<%= r.height %>"<% } %> src="<%= r.actual %>">
          <% } %>
        </span>
        <% if (r.imgDiff) { %>
          <div class="img-container"><p>Diff:</p>
            <img title="diff"<% if (r.width) { %> width="<%= r.width %>"<% } %><% if (r.height) { %> height="<%= r.height %>"<% } %> src="<%= r.imgDiff %>">
          </div>
        <% } %>
      <% } else if (r.actual) { %>
        <img<% if (r.width) { %> width="<%= r.width %>"<% } %><% if (r.height) { %> height="<%= r.height %>"<% } %> src="<%= r.actual %>">
      <% } %>
    <% } %>
    <% if (r.error) { %>
      <p style="color: red"><strong>Test Error:</strong> <%= r.errorMessage %></p>
    <% } %>
    <% if (r.status !== 'skipped' && r.imageThreshold !== undefined) { %>
      <p class="diff"><strong>Image Threshold<% if (r.imageThresholdRule !== undefined) { %> (<%= r.imageThresholdRule === '' ? '""' : r.imageThresholdRule %>)<% } %>:</strong> <%= r.imageThreshold %></p>
    <% } %>
    <% if (r.status !== 'skipped' && r.minDiff !== undefined) { %>
      <p class="diff"><strong>Diff:</strong> <%= r.minDiff === 0 ? 'none' : r.minDiff %></p>
    <% } %>
    <% if (r.matchedExpectedFile) { %>
      <p class="diff"><strong>Matched expected file:</strong> <%= r.matchedExpectedFile %></p>
    <% } %>
    <% if (r.retryNote) { %>
      <p class="retry-note"><strong><%= r.retryNote %></strong></p>
    <% } %>
    <% if (r.jsonDiff) { %>
      <details>
        <summary><strong style="color: red">JSON Diff</strong></summary>
        <pre><%= r.jsonDiff %></pre>
      </details>
    <% } %>
    <% if (r.status === 'skipped') { %>
      <%
        const reasons = r.skippedReasons || [];
        const rules = r.matchedSkipRules || [];
        const count = Math.max(reasons.length, rules.length);
        for (let i = 0; i < count; i++) {
          const rule = rules[i];
          const reason = reasons[i];
      %>
        <% if (rule && reason) { %>
          <p class="ignore-reason"><strong>Skip reason:</strong> <%= rule %> - <%= reason %></p>
        <% } else if (rule) { %>
          <p class="ignore-reason"><strong>Skip reason:</strong> <%= rule %></p>
        <% } else if (reason) { %>
          <p class="ignore-reason"><strong>Skip reason:</strong> <%= reason %></p>
        <% } %>
      <% } %>
    <% } %>
  </div>
`, {locals: ['r']});

function generateResultHTML(data: {r: DecoratedTestData}): string {
    return renderResultHTML(data);
}

export const pageCss = `
body { font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 10px; }
h1 { font-size: 32px; margin-bottom: 0; }
button { vertical-align: middle; }
h2 { font-size: 24px; font-weight: normal; margin: 10px 0 10px; line-height: 1; }
img { margin: 0 10px 10px 0; border: 1px dotted #ccc; image-rendering: pixelated; }
.stats { margin-top: 10px; }
.test { border-bottom: 1px dotted #bbb; padding-bottom: 5px; }
.tests { border-top: 1px dotted #bbb; margin-top: 10px; }
.diff { color: #777; }
.retry-note { color: #b26a00; }
.ignore-reason { color: #555; font-style: italic; }
.test p, .test pre { margin: 0 0 10px; }
.test pre { font-size: 14px; }
.label { color: white; font-size: 18px; padding: 2px 6px 3px; border-radius: 3px; margin-right: 3px; vertical-align: bottom; display: inline-block; }
.hide { display: none; }
.img-container { display: inline-block; text-align: center; min-width: 375px; }
.diagnostics { background: #f7f7f7; border: 1px solid #ddd; border-radius: 5px; padding: 8px 12px; margin-bottom: 16px; font-size: 14px; }
.diagnostics summary { cursor: pointer; font-weight: bold; font-size: 16px; padding: 4px 0; }
.diagnostics dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 8px 0 0; }
.diagnostics dt { font-weight: bold; color: #555; }
.diagnostics dd { margin: 0; word-break: break-all; font-family: -apple-system, BlinkMacSystemFont, "SF Mono", Menlo, monospace; }
`;

const reportScript = `
function isPassedTest(row) {
    return row.classList.contains('passed') || row.classList.contains('passed-metrics-failed');
}
function isSkippedTest(row) {
    return row.classList.contains('skipped');
}
function isFailedTest(row) {
    return row.classList.contains('failed');
}
function updateState() {
    const showPassedCheckbox = document.getElementById('checkbox-show-passed');
    const showPassed = showPassedCheckbox ? showPassedCheckbox.checked : false;
    const showSkipped = document.getElementById('checkbox-show-skipped').checked;
    for (const row of document.querySelectorAll('.test')) {
        const show = isFailedTest(row) || (showPassed && isPassedTest(row)) || (showSkipped && isSkippedTest(row));
        row.classList.toggle('hide', !show);
    }
    const embedHint = document.getElementById('embed-passed-hint');
    if (embedHint) {
        embedHint.classList.toggle('hide', !showPassed);
    }
}
const showPassedCheckbox = document.getElementById('checkbox-show-passed');
if (showPassedCheckbox) {
    showPassedCheckbox.addEventListener('change', function (e) { updateState(); });
}
document.getElementById('checkbox-show-skipped').addEventListener('change', function (e) { updateState(); });
document.getElementById('checkbox-img-hover').addEventListener('change', function (e) {
    if (document.getElementById('checkbox-img-hover').checked == false){

        for (const img of document.querySelectorAll('.img-expected')) {
            img.style.display = 'inline-block';
        }
        for (const label of document.querySelectorAll('.img-label')) {
            label.innerText = 'Expected Output | Actual Result';
        }
    } else {
        for (const img of document.querySelectorAll('.img-expected')) {
            img.style.display = 'none';
        }
        for (const label of document.querySelectorAll('.img-label')) {
            label.innerText = 'Actual Result (hover mouse to show expected)';
        }
    }
});
function showExpected(prefixId) {
    if (document.getElementById('checkbox-img-hover').checked == false)
        return;

    const imgExp = document.getElementById(prefixId + '-exp');
    const imgAct = document.getElementById(prefixId + '-act');
    const label = document.getElementById(prefixId + '-label');
    imgExp.style.display = 'inline-block';
    imgAct.style.display = 'none';
    label.innerText = 'Showing: Expected Output';
}
function showActual(prefixId) {
    if (document.getElementById('checkbox-img-hover').checked == false)
        return;

    const imgExp = document.getElementById(prefixId + '-exp');
    const imgAct = document.getElementById(prefixId + '-act');
    const label = document.getElementById(prefixId + '-label');
    imgAct.style.display = 'inline-block';
    imgExp.style.display = 'none';
    label.innerText = 'Showing: Actual Result';
}
`.trim();

const stats: Stats = {
    passed: 0,
    skipped: 0,
    failed: 0,
};

const colors: Record<TestStatus, string> = {
    passed: 'green',
    failed: 'red',
    skipped: '#9E9E9E',
};

let resultsContainer: HTMLDivElement | undefined;
let statsFailedHeader: HTMLHeadingElement | undefined;
let statsSummary: HTMLParagraphElement | undefined;
let refreshReportFilters: () => void = () => {};
let embedPassedImagesForRun = false;

// Latest known status per test, so a test that fails then passes on retry is
// counted once, by its final outcome.
const testStatus = new Map<string, TestStatus>();
// Total runs and failed runs per test, used to annotate flaky/retried tests.
const testAttempts = new Map<string, number>();
const testFailedAttempts = new Map<string, number>();
// Stable report-fragment id per test. Reused across a test's retries so the
// final attempt's fragment overwrites earlier ones on the server side (the
// report is assembled from fragments keyed by id), yielding exactly one report
// entry per test regardless of how many times vitest reran it.
const fragmentIds = new Map<string, number>();
let nextFragmentId = 1;
// Live in-browser DOM node per test, for the optional local watch view.
const liveDomNodes = new Map<string, Element>();

export function fragmentIdFor(name: string): number {
    let id = fragmentIds.get(name);
    if (id === undefined) {
        id = nextFragmentId++;
        fragmentIds.set(name, id);
    }
    return id;
}

function failedCount(): number {
    return stats.failed;
}

function updateStatsDisplay(): void {
    if (!statsFailedHeader || !statsSummary) return;

    const unsuccessful = failedCount();
    if (unsuccessful) {
        statsFailedHeader.style.color = 'red';
        statsFailedHeader.textContent = `${unsuccessful} tests failed.`;
    } else {
        statsFailedHeader.style.color = 'green';
        statsFailedHeader.textContent = 'All tests passed!';
    }

    statsSummary.textContent = `${stats.passed} passed, ${stats.skipped} skipped, ${failedCount()} failed.`;
}

// A note surfaced on retried tests: flaky passes and all-attempts failures.
// Retries themselves are kept (they smooth over genuinely flaky rendering);
// this just makes the retrying visible instead of leaving a stale failed entry.
function retryNote(status: TestStatus, attempts: number, failedAttempts: number): string | undefined {
    if (status === 'passed' && failedAttempts > 0) {
        const plural = failedAttempts === 1 ? 'attempt' : 'attempts';
        return `Flaky: passed after ${failedAttempts} failed ${plural} (${attempts} runs total).`;
    }
    if (status === 'failed' && attempts > 1) {
        return `Failed on all ${attempts} attempts.`;
    }
    return undefined;
}

function shouldShowImages(testData: TestReportData): boolean {
    if (testData.status === 'skipped') return false;
    return true;
}

function escapeJsString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeHTML(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decorateTestData(testData: TestReportData, attempts: number, failedAttempts: number): DecoratedTestData {
    const status = testData.status;
    const decorated: DecoratedTestData = {
        ...testData,
        color: testData.color || colors[status],
        showImages: shouldShowImages(testData),
        domId: testData.name,
        domIdJs: escapeJsString(testData.name),
        isRenderTest: testData.imageThreshold !== undefined,
        attempts,
        failedAttempts,
        retryNote: retryNote(status, attempts, failedAttempts),
    };
    if (testData.error) {
        decorated.errorMessage = escapeHTML(testData.error.stack || testData.error.message || String(testData.error));
    }
    return decorated;
}

// Passed tests are always included now (hidden behind the "Show passed tests"
// checkbox), so the checkbox is always rendered.
function getFilterCheckboxesHTML(embedPassedImages: boolean): string {
    const hint = embedPassedImages ? '' : `
<p id="embed-passed-hint" class="hide" style="color: red; font-weight: bold;">Passed-test images are not embedded in this report. Re-run with EMBED_PASSED_IMAGES=true to include them.</p>`;
    return `<label><input type="checkbox" id="checkbox-show-passed">Show passed tests</label>
<label><input type="checkbox" id="checkbox-show-skipped">Show skipped tests</label>
<label><input type="checkbox" id="checkbox-img-hover" checked>Toggle images on Hover</label>${hint}`;
}

function runReportUpdateState(): void {
    (window as ReportWindow).updateState?.();
}

export function registerSkipped(name: string, testPath?: string, skippedReasons?: string[], matchedSkipRules?: string[]): string {
    return updateHTML({
        name,
        status: 'skipped',
        color: colors.skipped,
        testPath,
        skippedReasons,
        matchedSkipRules,
    });
}

export function setupHTML(embedPassedImages: boolean): void {
    embedPassedImagesForRun = embedPassedImages;

    const style = document.createElement('style');
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(pageCss));

    statsFailedHeader = document.createElement('h1');
    statsFailedHeader.textContent = 'All tests passed!';
    document.body.appendChild(statsFailedHeader);

    const filterFragment = document.createRange().createContextualFragment(getFilterCheckboxesHTML(embedPassedImages));
    document.body.appendChild(filterFragment);

    statsSummary = document.createElement('p');
    statsSummary.className = 'stats';
    document.body.appendChild(statsSummary);
    updateStatsDisplay();

    const script = document.createElement('script');
    script.appendChild(document.createTextNode(reportScript));
    document.body.appendChild(script);

    resultsContainer = document.createElement('div');
    resultsContainer.className = 'tests';
    document.body.appendChild(resultsContainer);

    document.body.onload = () => {
        runReportUpdateState();
    };

    installReportFilterHandlers();
}

function installReportFilterHandlers(): void {
    refreshReportFilters = () => {
        runReportUpdateState();
    };
    refreshReportFilters();
}

export function getStatsHTML(): string {
    if (statsFailedHeader && statsSummary) {
        return `${statsFailedHeader.outerHTML}\n${getFilterCheckboxesHTML(embedPassedImagesForRun)}\n${statsSummary.outerHTML}`;
    }

    return '';
}

// Records one run of a test and returns the HTML fragment for its (single)
// report entry. On a retry this is called again for the same name; the caller
// sends the result under the test's stable fragmentIdFor(name), so the latest
// run's fragment replaces earlier ones -- a flaky test that eventually passes
// ends up as one passed entry (annotated with its failed attempts), and a test
// that fails every attempt ends up as one failed entry (annotated with the
// attempt count). Always returns a non-empty fragment so the overwrite happens.
export function updateHTML(testData: TestReportData): string {
    const status = testData.status;
    const name = testData.name;

    const attempts = (testAttempts.get(name) ?? 0) + 1;
    testAttempts.set(name, attempts);
    if (status === 'failed') {
        testFailedAttempts.set(name, (testFailedAttempts.get(name) ?? 0) + 1);
    }

    // Tally each test once, by its latest status.
    const previousStatus = testStatus.get(name);
    if (previousStatus === undefined) {
        stats[status]++;
    } else if (previousStatus !== status) {
        stats[previousStatus]--;
        stats[status]++;
    }
    testStatus.set(name, status);

    updateStatsDisplay();

    const failedAttempts = testFailedAttempts.get(name) ?? 0;
    const html = generateResultHTML({r: decorateTestData(testData, attempts, failedAttempts)});

    // Mirror into the live in-browser DOM for local watching. Replace any prior
    // entry for this test rather than appending a duplicate on retries.
    if (resultsContainer) {
        const frag = document.createRange().createContextualFragment(html);
        const node = frag.firstElementChild;
        const existing = liveDomNodes.get(name);
        if (existing && node) {
            resultsContainer.replaceChild(node, existing);
        } else if (node) {
            resultsContainer.appendChild(node);
        }
        if (node) liveDomNodes.set(name, node);
        refreshReportFilters();
    }

    return html;
}

export type DiagnosticInfo = {
    platformTag?: string;
    generatedAt: string;
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

function formatDuration(ms: number): string {
    if (ms <= 0) return '0sec';
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}min ${seconds}sec`;
    if (minutes > 0) return `${minutes}min ${seconds}sec`;
    return `${seconds}sec`;
}

export function getDiagnosticsHTML(diag: DiagnosticInfo): string {
    const rows: Array<[string, string | undefined]> = [
        ['Platform-Tag', diag.platformTag],
        ['Generated', diag.generatedAt],
        ['Duration', diag.durationMs !== undefined ? formatDuration(diag.durationMs) : undefined],
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

export function getHTML(statsContent: string, testsContent: string, diagnosticsContent: string = ''): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
          <title>GL JS | Render tests results</title>
          <style>${pageCss}</style>
      </head>
      <body onload="updateState()">
          ${diagnosticsContent}
          ${statsContent}
          <script>${reportScript}</script>
          <div class="tests">
            ${testsContent}
          </div>
      </body>
      </html>
  `.trim();
}
