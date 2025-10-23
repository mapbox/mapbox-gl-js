# Release testing

This directory contains an HTML file that allows easier and faster access to test pages for smoke testing. It contains a list of examples from our documentation and allows paging through them quickly, as well as comparing it with older releases.

To load this page, execute `npm run start-release` to build the required files, and to start the testing server. You can then access the page at http://localhost:9966/test/release/index.html. It will also be available on your local network. Scan the QR code printed to the console on a mobile device that is on the same network to access the test page.

To add new pages to the list from our online documentation, add them to the `pages` object at the beginning of `index.js`. By default, it will load the HTML from https://docs.mapbox.com/mapbox-gl-js/example/ using the `key`. You can override this by specifying a custom `url` property next to the `title`.

To add new pages from our `debug/` folder, add entries to the `pages` array in `index.js` with `"url": "./debug/filename.html"`. The entire `debug/` directory is symlinked during `prepare-release-pages`, so all debug HTML files are automatically available.
