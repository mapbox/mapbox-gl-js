# Release testing

This directory contains an HTML file that allows easier and faster access to test pages for smoke testing. It contains a list of examples from our documentation and allows paging through them quickly, as well as comparing it with older releases.

To load this page, execute `npm run start-release` to build the required files, and to start the testing server. You can then access the page at http://localhost:9966/test/release/index.html. It will also be available on your local network. Scan the QR code printed to the console on a mobile device that is on the same network to access the test page.

Alternatively, you can also access the test page on Circle CI. Find a job named `build`, click the "Artifacts" tab, and navigate to the `mapbox-gl-js/test/release/index.html` page. You'll have to enter your own access token there. Before sharing the URL, be aware that it will be stored in the hash of the URL.

To add new pages to the list, add them to the `pages` object at the beginning of `index.js`. By default, it will load the HTML sample from https://github.com/mapbox/mapbox-gl-js-docs/tree/publisher-production/docs/pages/example using the ID. You can override this by specifying a custom `url` property next to the `title`.
