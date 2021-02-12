import fs from 'fs';

const script = fs.readFileSync(new URL('../debug/access_token.js', import.meta.url), 'utf-8')
    .replace('process.env.MapboxAccessToken',
        JSON.stringify(process.env.MapboxAccessToken))
    .replace('process.env.MAPBOX_ACCESS_TOKEN',
        JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN));

fs.writeFileSync(new URL('../debug/access_token_generated.js', import.meta.url), script);
