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

class TableOfContentsNote extends React.Component {
    render() {
        const doc = this.props;
        return (
            <li className='space-top1'>
                <a href={href(doc)} className='dark-link'>{doc.name}</a>
            </li>
        );
    }
}

class TableOfContentsItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {disclosed: false};
    }

    render() {
        const doc = this.props;

        const empty = (members) => !members || members.length === 0;
        if (empty(doc.members.static) && empty(doc.members.instance) && empty(doc.members.events)) {
            return <li><a href={href(doc)}>{doc.name}</a></li>;
        }

        const membersList = (members, title, sigil) => {
            return members && members.length !== 0 &&
                <ul className='list-reset pad1x'>
                    <li className='block small quiet truncate'>{title}</li>
                    {members.map((m, i) =>
                        <li key={i}>
                            <a href={href(m)} className='block small truncate pre-open'>{sigil}{m.name}</a>
                        </li>)}
                </ul>;
        };

        return (
            <li>
                <a href={href(doc)}
                    className={`toggle-sibling rcon tight-icon ${this.state.disclosed ? 'caret-down strong' : 'caret-right'}`}
                    onClick={() => this.setState({disclosed: !this.state.disclosed})}>{doc.name}</a>

                {this.state.disclosed &&
                    <div className='toggle-target space-bottom1'>
                        {membersList(doc.members.static, 'Static members', '.')}
                        {membersList(doc.members.instance, 'Instance members', '#')}
                        {membersList(doc.members.events, 'Events', 'ⓔ ')}
                    </div>}
            </li>
        );
    }
}

class Note extends React.Component {
    render() {
        const note = this.props;
        return (
            <div className='keyline-top-not py2'>
                <section className='pad2 space-bottom4 fill-darken0 clearfix prose'>
                    <div id={note.namespace.toLowerCase()} className='strong'>{note.name}</div>
                    {note.description && <div className='quiet'>{md(note.description)}</div>}
                </section>
            </div>
        );
    }
}

class ItemMember extends React.Component {
    constructor(props) {
        super(props);
        this.state = {disclosed: false};
        this.hashChange = this.hashChange.bind(this);
    }

    render() {
        const member = this.props;
        return (
            <div className='keyline-bottom'>
                <div id={member.namespace.toLowerCase()}
                    className='clearfix small pointer toggle-sibling'
                    onClick={(e) => {
                        this.setState({disclosed: !this.state.disclosed});
                        window.location = href(member);
                        e.preventDefault();
                    }}>
                    <div className='pad1y contain'>
                        <a className={`rcon pin-right pad1y dark-link ${this.state.disclosed ? 'caret-down strong' : 'caret-right'}`}/>
                        <span className='code strong strong truncate'>{member.name}</span>
                        {member.kind === 'function' &&
                            <span className='quiet code space-right2' dangerouslySetInnerHTML={{__html: formatters.parameters(member, true)}}/>}
                    </div>
                </div>

                {this.state.disclosed &&
                    <div className="clearfix toggle-target">
                        <Item nested={true} {...member}/>
                    </div>}
            </div>
        );
    }

    hashChange() {
        this.setState({disclosed: window.location.hash === href(this.props)});
    }

    componentDidMount() {
        window.addEventListener("hashchange", this.hashChange);
        this.hashChange();
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.hashChange);
    }
}

class Item extends React.Component {
    render() {
        const section = this.props;

        const empty = (members) => !members || members.length === 0;

        const membersList = (members, title) => {
            return !empty(members) &&
                <div>
                    <div className='pad1y quiet space-top2 prose-big'>{title}</div>
                    <div className="clearfix">
                        {members.map((member, i) => <ItemMember key={i} {...member}/>)}
                    </div>
                </div>;
        };

        return (
            <section className='pad2 clearfix prose space-bottom4 fill-white contain'>
                {!this.props.nested &&
                    <div className='clearfix'>
                        <h2 className='fl' id={section.namespace.toLowerCase()}>{section.name}</h2>
                        {section.context && section.context.github &&
                            <a className='fr fill-darken0 round round pad1x quiet small' href={section.context.github.url}><span>{section.context.github.path}</span></a>}
                    </div>}

                {md(section.description)}

                {!empty(section.augments) &&
                    <p>Extends {section.augments.map((tag, i) =>
                        <span key={i} dangerouslySetInnerHTML={{__html: formatters.autolink(tag.name)}}/>)}.</p>}

                {section.kind === 'class' &&
                    !section.interface &&
                    (!section.constructorComment || section.constructorComment.access !== 'private') &&
                    <div className='code pad1 small round fill-light'
                        dangerouslySetInnerHTML={{__html: `new ${section.name}${formatters.parameters(section)}`}}/>}

                {section.version && <div>Version: {section.version}</div>}
                {section.license && <div>License: {section.license}</div>}
                {section.author && <div>Author: {section.author}</div>}
                {section.copyright && <div>Copyright: {section.copyright}</div>}
                {section.since && <div>Since: {section.since}</div>}

                {!empty(section.params) && (section.kind !== 'class' || !section.constructorComment || section.constructorComment.access !== 'private') &&
                    <div>
                        <div className='pad1y quiet space-top2 prose-big'>Parameters</div>
                        <div>
                            {section.params.map((param, i) =>
                                <div key={i} className='space-bottom0'>
                                    <div>
                                        <span className='code strong'>{param.name}</span>
                                        <code className='quiet'>({formatType(param.type)})</code>
                                        {param.default && <span>{'('}default <code>{param.default}</code>{')'}</span>}
                                        {md(param.description, true)}
                                    </div>
                                    {param.properties &&
                                        <table className='space-top1 space-bottom2 fixed-table small'>
                                            <colgroup>
                                                <col width='30%' />
                                                <col width='70%' />
                                            </colgroup>
                                            <thead>
                                                <tr className='strong fill-light'>
                                                    <td>Name</td>
                                                    <td>Description</td>
                                                </tr>
                                            </thead>
                                            <tbody className='space-top1'>
                                                {param.properties.map((property, i) =>
                                                    <tr key={i}>
                                                        <td className='break-word'>
                                                            <span className='code strong'>{property.name}</span>
                                                            <code className='quiet'>{formatType(property.type)}</code>
                                                            {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                                        </td>
                                                        <td className='break-word'><span>{md(property.description, true)}</span></td>
                                                    </tr>)}
                                            </tbody>
                                        </table>}
                                </div>)}
                        </div>
                    </div>}

                {!empty(section.properties) &&
                    <div>
                        <div className='pad1y quiet space-top2 prose-big'>Properties</div>
                        <div>
                            {section.properties.map((property, i) =>
                                <div key={i} className='space-bottom0'>
                                    <span className='code strong'>{property.name}</span>
                                    <code className='quiet'>({formatType(property.type)})</code>
                                    {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                    {property.description && <span>: {md(property.description, true)}</span>}
                                    {property.properties &&
                                        <ul>
                                            {property.properties.map((property, i) =>
                                                <li key={i}>
                                                    <code>{property.name}</code> {formatType(property.type)}
                                                    {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                                    {md(property.description)}
                                                </li>)}
                                        </ul>}
                                </div>)}
                        </div>
                    </div>}

                {section.returns && section.returns.map((ret, i) =>
                    <div key={i}>
                        <div className='pad1y quiet space-top2 prose-big'>Returns</div>
                        <code>{formatType(ret.type)}</code>
                        {ret.description && <span>: {md(ret.description, true)}</span>}
                    </div>)}

                {!empty(section.throws) &&
                    <div>
                        <div className='pad1y quiet space-top2 prose-big'>Throws</div>
                        <ul>
                            {section.throws.map((throws, i) =>
                                <li key={i}>{formatType(throws.type)}: {md(throws.description, true)}</li>)}
                        </ul>
                    </div>}

                {!empty(section.examples) &&
                    <div>
                        <div className='pad1y quiet space-top2 prose-big'>Example</div>
                        {section.examples.map((example, i) =>
                            <div key={i}>
                                {example.caption && <p>{md(example.caption)}</p>}
                                {highlightJavascript(example.description)}
                            </div>)}
                    </div>}

                {membersList(section.members.static, 'Static Members')}
                {membersList(section.members.instance, 'Instance Members')}
                {membersList(section.members.events, 'Events')}

                {!empty(section.sees) &&
                    <div>
                        <div className='pad1y quiet space-top2 prose-big'>Related</div>
                        <ul>{section.sees.map((see, i) => <li key={i}>{md(see)}</li>)}</ul>
                    </div>}
            </section>
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
                <LeftNav>
                    <div className='space-bottom1'>
                        <span className='block truncate quiet'>API</span>
                    </div>
                    <ul id='toc' className='list-reset h5 py1-ul'>
                        {docs.map((doc, i) => doc.kind === 'note' ?
                            <TableOfContentsNote key={i} {...doc}/> :
                            <TableOfContentsItem key={i} {...doc}/>)}
                    </ul>
                </LeftNav>

                <div className='limiter clearfix'>
                    <TopNav current='api'/>

                    <div className='contain margin3 col9'>
                        <div className='round doc clip space-bottom4 fill-white'>
                            <Quickstart token={this.state.token}/>
                        </div>

                        <div className='round doc clip space-bottom'>
                            {docs.map((doc, i) => doc.kind === 'note' ?
                                <Note key={i} {...doc}/> :
                                <Item key={i} {...doc}/>)}
                        </div>
                    </div>
                </div>
            </PageShell>
        );
    }
}
