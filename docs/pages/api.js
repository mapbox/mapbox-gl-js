import React from 'react';
import PageShell from '../components/page_shell';
import LeftNav from '../components/left_nav';
import TopNav from '../components/top_nav';
import {highlightJavascript} from '../components/prism_highlight.js';
import Quickstart from '../components/quickstart';
import docs from '../components/api.json'; // eslint-disable-line import/no-unresolved
import GithubSlugger from 'github-slugger';
import createFormatters from 'documentation/lib/output/util/formatters';
import LinkerStack from 'documentation/lib/output/util/linker_stack';
import ApiItem from '../components/api-item';

const meta = {
    title: 'Mapbox GL JS API',
    description: '',
    pathname: '/api'
};

const linkerStack = new LinkerStack({})
    .namespaceResolver(docs, (namespace) => {
        const slugger = new GithubSlugger();
        return `#${slugger.slug(namespace)}`;
    });

const formatters = createFormatters(linkerStack.link);

function formatType(type) {
    return <span dangerouslySetInnerHTML={{__html: formatters.type(type)}}/>;
}

function md(ast, inline) {
    if (inline && ast && ast.children.length && ast.children[0].type === 'paragraph') {
        ast = {
            type: 'root',
            children: ast.children[0].children.concat(ast.children.slice(1))
        };
    }
    return <span dangerouslySetInnerHTML={{__html: formatters.markdown(ast)}}/>;
}

function href(m) {
    return `#${m.namespace.toLowerCase()}`;
}

class Note extends React.Component {
    render() {
        const note = this.props;
        return (
            <div className='keyline-top-not py12'>
                <section className='py12 px12 mb24 clearfix prose'>
                    <h2 id={note.namespace.toLowerCase()} className='txt-bold'>{note.name}</h2>
                    {note.description && <div className='color-gray txt-l'>{md(note.description)}</div>}
                </section>
            </div>
        );
    }
}

export default class extends React.Component {
    constructor(props) {
        super(props);
        this.state = {token: '<your access token here>'};
    }

    render() {
        return (
            <PageShell meta={meta} onUser={(_, token) => this.setState({token})}>
                <h1>Mapbox GL JS API reference</h1>
                <hr />
                <div className='round doc clip mb6'>
                    {docs.map((doc, i) => doc.kind === 'note' ?
                        <Note key={i} {...doc}/> :
                        <ApiItem key={i} {...doc}/>)}
                </div>
            </PageShell>
        );
    }
}
