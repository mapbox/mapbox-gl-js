import React from 'react';
import createFormatters from 'documentation/lib/output/util/formatters';
import LinkerStack from 'documentation/lib/output/util/linker_stack';
import GithubSlugger from 'github-slugger';
import {highlightJavascript} from '../components/prism_highlight.js';
import docs from '../components/api.json'; // eslint-disable-line import/no-unresolved
import ApiItemMember from './api-item-member';
import IconText from '@mapbox/mr-ui/icon-text';


const linkerStack = new LinkerStack({})
    .namespaceResolver(docs, (namespace) => {
        const slugger = new GithubSlugger();
        return `#${slugger.slug(namespace)}`;
    });

const formatters = createFormatters(linkerStack.link);

class ApiItem extends React.Component {

    md = (ast, inline) => {
        if (inline && ast && ast.children.length && ast.children[0].type === 'paragraph') {
            ast = {
                type: 'root',
                children: ast.children[0].children.concat(ast.children.slice(1))
            };
        }
        return <span dangerouslySetInnerHTML={{__html: formatters.markdown(ast)}}/>;
    }
    formatType = type => <span dangerouslySetInnerHTML={{__html: formatters.type(type)}}/>

    render() {
        const section = this.props;

        const empty = members => !members || members.length === 0;

        const membersList = (members, title) => !empty(members) &&
                <div>
                    <div className='py6 mt12 txt-m txt-bold'>{title}</div>
                    <div className='mb18'>
                        {members.map((member, i) => <ApiItemMember key={i} {...member}/>)}
                    </div>
                </div>;

        return (
            <section className='prose mb24'>
                {!this.props.nested &&
                    <div className='mb24'>
                        <h3 className='mb12' id={section.namespace.toLowerCase()}><a className="unprose color-blue-on-hover" href={`#${section.namespace.toLowerCase()}`}>{section.name}</a></h3>
                        {section.context && section.context.github &&
                            <a className='pt6 link--gray txt-s unprose' href={section.context.github.url}><IconText iconBefore="github" >{section.context.github.path}</IconText></a>}
                    </div>}

                {this.md(section.description)}

                {!empty(section.augments) &&
                    <p>Extends {section.augments.map((tag, i) => <span key={i} dangerouslySetInnerHTML={{__html: formatters.autolink(tag.name)}}/>)}.</p>}

                {section.kind === 'class' &&
                    !section.interface &&
                    (!section.constructorComment || section.constructorComment.access !== 'private') &&
                    <div className='txt-code px6 py6 txt-s round bg-gray-faint my18'
                        dangerouslySetInnerHTML={{__html: `new ${section.name}${formatters.parameters(section)}`}}/>}

                {section.version && <div>Version: {section.version}</div>}
                {section.license && <div>License: {section.license}</div>}
                {section.author && <div>Author: {section.author}</div>}
                {section.copyright && <div>Copyright: {section.copyright}</div>}
                {section.since && <div>Since: {section.since}</div>}

                {!empty(section.params) && (section.kind !== 'class' || !section.constructorComment || section.constructorComment.access !== 'private') &&
                    <div>
                        <div className='py6 mt12 txt-m txt-bold'>Parameters</div>
                        <div>
                            {section.params.map((param, i) => <div key={i} className='mb6'>
                                <div>
                                    <span className='txt-code bg-transparent ml-neg3 txt-bold'>{param.name}</span>
                                    <code className='color-gray'>({this.formatType(param.type)})</code>
                                    {param.default && <span>{'('}default <code>{param.default}</code>{')'}</span>}
                                    {this.md(param.description, true)}
                                </div>
                                {param.properties &&
                                <div className='mt6 mb12 scroll-auto'>
                                    <table className='fixed-table'>
                                        <colgroup>
                                            <col width='30%' />
                                            <col width='70%' />
                                        </colgroup>
                                        <thead>
                                            <tr className='txt-bold bg-gray-faint'>
                                                <td style={{borderTopLeftRadius: '4px'}}>Name</td>
                                                <td style={{borderTopRightRadius: '4px'}}>Description</td>
                                            </tr>
                                        </thead>
                                        <tbody className='mt6'>
                                            {param.properties.map((property, i) => <tr key={i}>
                                                <td>
                                                    <span className='txt-code txt-bold txt-break-word bg-white ml-neg3'>{property.name}</span><br />
                                                    <code className='color-gray txt-break-word'>{this.formatType(property.type)}</code><br />
                                                    {property.default && <span className='color-gray txt-break-word'>default <code>{property.default}</code></span>}
                                                </td>
                                                <td><span>{this.md(property.description, true)}</span></td>
                                            </tr>)}
                                        </tbody>
                                    </table>
                                </div>}
                            </div>)}
                        </div>
                    </div>}

                {!empty(section.properties) &&
                    <div>
                        <div className='py6 mt12 txt-m txt-bold'>Properties</div>
                        <div>
                            {section.properties.map((property, i) => <div key={i} className='mb6'>
                                <span className='txt-code txt-bold bg-white mr3 ml-neg3'>{property.name}</span>
                                <code className='color-gray'>({this.formatType(property.type)})</code>
                                {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                {property.description && <span>: {this.md(property.description, true)}</span>}
                                {property.properties &&
                                        <ul>
                                            {property.properties.map((property, i) => <li key={i}>
                                                <code>{property.name}</code> {this.formatType(property.type)}
                                                {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                                {this.md(property.description)}
                                            </li>)}
                                        </ul>}
                            </div>)}
                        </div>
                    </div>}

                {section.returns && section.returns.map((ret, i) => <div key={i}>
                    <div className='py6 mt12 txt-m txt-bold'>Returns</div>
                    <code>{this.formatType(ret.type)}</code>
                    {ret.description && <span>: {this.md(ret.description, true)}</span>}
                </div>)}

                {!empty(section.throws) &&
                    <div>
                        <div className='py6 mt12 txt-m txt-bold'>Throws</div>
                        <ul>
                            {section.throws.map((throws, i) => <li key={i}>{this.formatType(throws.type)}: {this.md(throws.description, true)}</li>)}
                        </ul>
                    </div>}

                {!empty(section.examples) &&
                    <div>
                        <div className='py6 mt12 txt-m txt-bold'>Example</div>
                        {section.examples.map((example, i) => <div key={i}>
                            {example.caption && <p>{this.md(example.caption)}</p>}
                            {highlightJavascript(example.description)}
                        </div>)}
                    </div>}

                {membersList(section.members.static, 'Static Members')}
                {membersList(section.members.instance, 'Instance Members')}
                {membersList(section.members.events, 'Events')}

                {!empty(section.sees) &&
                    <div>
                        <div className='py6 mt12 txt-m txt-bold'>Related</div>
                        <ul>{section.sees.map((see, i) => <li key={i}>{this.md(see, true)}</li>)}</ul>
                    </div>}
            </section>
        );
    }
}

export default ApiItem;
