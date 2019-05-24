import { test } from 'mapbox-gl-js-test';
import fs from 'fs';
import path from 'path';
import jsyaml from 'js-yaml';
import { tags } from '../../../docs/data/tags.js';

const listTags = Object.keys(tags);

const readPost = filename => {
    const buffer = fs.readFileSync(filename),
        file = buffer.toString('utf8');

    try {
        const parts = file.split(/---\s*[\*\n^]/g),
            frontmatter = parts[1];
        return {
            name: filename,
            file,
            metadata: frontmatter ? jsyaml.safeLoad(frontmatter) : null,
            content: parts[2]
        };
    } catch (err) {
        return new Error(
      `\nCould not read metadata, check the syntax of the metadata and front matter: ${
          filename}`
        );
    }
};

const listExamples = dir => {
    const files = fs.readdirSync(`${dir}`);
    return files.reduce((arr, file) => {
        if (path.extname(file) === '.js') {
            arr.push(`${dir}${file}`);
        }
        return arr;
    }, []);
};

listExamples('./docs/pages/example/').forEach((example) => {
    const file = readPost(example);
    const metadata = file.metadata;

    if (metadata) {
        test(`Example metatdata: ${example}`, (t) => {
            t.ok(metadata.title, 'has title');
            t.notOk((metadata.title).trim().endsWith('.'), `title must not end with a period`);
            t.ok(metadata.description, 'has description');
            t.ok((metadata.description).trim().endsWith('.'), `description must end with a period`);
            t.ok(metadata.pathname, 'has pathname');
            t.ok(metadata.pathname.startsWith('/mapbox-gl-js/example/'), 'pathname starts with /mapbox-gl-js/example/');
            t.ok(metadata.pathname.endsWith('/'), 'pathname ends with /');
            t.ok(metadata.tags, 'has tags');
            metadata.tags.forEach(tag => {
                t.notEqual(listTags.indexOf(tag), -1, `tag "${tag}" must match an item in docs/data/tags.js: ${listTags.join(', ')}`);
            });
            t.end();
        });

        test(`Example image: ${example}`, (t) => {
            // check that they saved an image for the example
            const imagePathSrc = example.replace('./docs/pages/example/', './docs/img/src/').replace('.js', '.png');
            t.ok(fs.existsSync(imagePathSrc), `example must have an image located at: ${imagePathSrc}`);
            t.end();
        });
    }
});
