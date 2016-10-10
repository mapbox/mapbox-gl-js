### Updating mapbox-gl-js plugins

- Each plugin should live in a directory that matches its name + version.
- Each plugin should have an entry in `docs/_data/plugins.json` with it's directory, version number, and files.

## Testing

- `npm run test-plugin`

## Deploying

- Install [aws-cli][aws-cli] and configure it with credentials. 
- Include a directory for your plugin.
- Add entry to `docs/_data/plugins.json`.
- Update the `latest` field in `docs/_data/plugins.json`
- `mbx auth {AUTH_CODE}` 
- Finally, run `npm run plugin-deploy`.

[aws-cli]:http://aws.amazon.com/cli/