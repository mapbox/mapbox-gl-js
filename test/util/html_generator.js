/* eslint-env browser */
import template from 'lodash.template';

const CI = process.env.CI;

const generateResultHTML = template(`
  <div class="tab">
    <% if (r.status === 'failed') { %>
      <input type="checkbox" id="<%- r.id %>" checked>
    <% } else { %>
      <input type="checkbox" id="<%- r.id %>">
    <% } %>
    <label class="tab-label" style="background: <%- r.color %>" for="<%- r.id %>"><p class="status-container"><span class="status"><%- r.status %></span> - <%- r.name %></p></label>
    <div class="tab-content">
      <% if (r.status !== 'errored') { %>
          <img src="<%- r.actual %>">
      <% } %>
      <% if (r.expected) { %>
          <img src="<%- r.expected %>">
      <% } %>
      <% if (r.imgDiff) { %>
          <img src="<%- r.imgDiff %>">
      <% } %>
      <% if (r.error) { %><p style="color: red"><strong>Error:</strong> <%- r.error.message %></p><% } %>
      <% if (r.jsonDiff) { %>
          <pre><%- r.jsonDiff.trim() %></pre>
      <% } %>
    </div>
  </div>
`);

const pageCss = `
body { font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 10px; background: #ecf0f1 }
h1 { font-size: 32px; margin-bottom: 0; }
img { margin: 0 10px 10px 0; border: 1px dotted #ccc; }
input { position: absolute; opacity: 0; z-index: -1;}
.tests { border-top: 1px dotted #bbb; margin-top: 10px; padding-top: 15px; overflow: hidden; }
.status-container { margin: 0; }
.status { text-transform: uppercase; }
.label { color: white; font-size: 18px; padding: 2px 6px 3px; border-radius: 3px; margin-right: 3px; vertical-align: bottom; display: inline-block; }
.tab { margin-bottom: 30px; width: 100%; overflow: hidden; }
.tab-label { display: flex; color: white; border-radius: 5px; justify-content: space-between; padding: 1em; font-weight: bold; cursor: pointer; }
.tab-label:hover { filter: brightness(85%); }
.tab-label::after { content: "\\276F"; width: 1em; height: 1em; text-align: center; transition: all .35s; }
.tab-content { max-height: 0; padding: 0 1em; background: white; transition: all .35s; }
.tab-content pre { font-size: 14px; margin: 0 0 10px; }
input:checked + .tab-label { filter: brightness(90%); };
input:checked + .tab-label::after { transform: rotate(90deg); }
input:checked ~ .tab-content { max-height: 100vh; padding: 1em; border: 1px solid #eee; border-top: 0; border-radius: 5px; }
iframe { pointer-events: none; }
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

    //Create a container to hold test stats
    const statsContainer = document.createElement('div');

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

    //Create a container to hold test results
    resultsContainer = document.createElement('div');
    resultsContainer.className = 'tests';
    document.body.appendChild(resultsContainer);
}

export function updateHTML(testData) {
    const status = testData.status;
    stats[status]++;

    testData["color"] = colors[status];
    testData["id"] = `${status}Test-${stats[status]}`;
    counterDom[status].innerHTML = stats[status];

    // skip adding passing tests to report in CI mode
    if (CI && status === 'passed') return;
    const resultHTMLFrag = document.createRange().createContextualFragment(generateResultHTML({r: testData}));
    resultsContainer.appendChild(resultHTMLFrag);
}
