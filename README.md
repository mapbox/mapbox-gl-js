GL style migration scripts ([llmr#356](https://github.com/mapbox/llmr/issues/356)) +
possibly a place for a spec ([llmr#275](https://github.com/mapbox/llmr/issues/275)).

Migrate an existing script like this:

```bash
node index test/styles/bright-v0.js > bright-v1.js;
```

The old style needs to export the JSON node-style, with `module.exports = { ...`.
