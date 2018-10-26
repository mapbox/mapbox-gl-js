import Prism from 'prismjs';
import React from 'react'; // eslint-disable-line no-unused-vars

import 'prismjs/components/prism-json';

function highlight(code, language) {
    return {__html: Prism.highlight(code, Prism.languages[language])};
}

export default function prismHighlight(code, language) {
    const startingIndent = code.match(/^\n( *)/);
    const dedentSize = startingIndent ? startingIndent[1].length : 0;
    if (dedentSize) {
        code = code.replace(new RegExp(`^ {0,${dedentSize}}`, 'mg'), '');
    }
    return <pre><code className={`language-${language}`} dangerouslySetInnerHTML={highlight(code.trim(), language)}/></pre>;
}

export function highlightMarkup(code) {
    return prismHighlight(code, 'markup');
}

export function highlightJavascript(code) {
    return prismHighlight(code, 'javascript');
}

export function highlightJSON(code) {
    return prismHighlight(code, 'json');
}

export function highlightShell(code) {
    return <pre><code className={`language-shell`}/>{code}</pre>;
}
