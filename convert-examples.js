const fs = require('fs');
const matter = require('gray-matter');

fs.readdirSync(`examples`).forEach((file) => {
    if (file[0] === '.') {
        return;
    }

    const name = /\d\d\d\d-\d\d-\d\d-(.*)\.html$/.exec(file)[1];
    const example = matter(fs.readFileSync(`examples/${file}`, 'utf8'));

    fs.writeFileSync(`docs/pages/example/${name}.html`, example.content);

    delete example.data.layout;
    delete example.data.category;
    delete example.data.permalink;

    example.data.pathname = `/mapbox-gl-js/example/${name}/`;

    fs.writeFileSync(`docs/pages/example/${name}.js`,
`/*${matter.stringify('', example.data).slice(0, -2)}*/
import Example from '../../components/example';
import html from './${name}.html';
export default Example(html);
`)
});

fs.readdirSync(`redirects`).forEach((file) => {
    if (file[0] === '.') {
        return;
    }

    const name = /\d\d\d\d-\d\d-\d\d-(.*)\.html$/.exec(file)[1];
    const example = matter(fs.readFileSync(`redirects/${file}`, 'utf8'));

    fs.writeFileSync(`docs/pages/example/${name}.js`,
        `import Redirect from '../../components/redirect';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';
export default Redirect(prefixUrl('${example.data.redirect}'));
`)
});
