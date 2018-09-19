import React from 'react';
import createFormatters from 'documentation/lib/output/util/formatters';
import LinkerStack from 'documentation/lib/output/util/linker_stack';
import GithubSlugger from 'github-slugger';
import {highlightJavascript} from '../components/prism_highlight.js';
import docs from '../components/api.json'; // eslint-disable-line import/no-unresolved
import ApiItemMember from './api-item-member';
import Icon from '@mapbox/mr-ui/icon';

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
    formatType = type => {
        return <span dangerouslySetInnerHTML={{__html: formatters.type(type)}}/>;
    }

    render() {
        const section = this.props;

        const empty = (members) => !members || members.length === 0;

        const membersList = (members, title) => {
            return !empty(members) &&
                <div>
                    <div className='py6 color-gray mt12 txt-l'>{title}</div>
                    <div className='clearfix'>
                        {members.map((member, i) => <ApiItemMember key={i} {...member}/>)}
                    </div>
                </div>;
        };

        return (
            <section className='px12 py12 clearfix prose mb24 bg-white contain'>
                {!this.props.nested &&
                    <div className='mb24 clearfix'>
                        <h3 className='mb0' id={section.namespace.toLowerCase()}>{section.name}</h3>
                        {section.context && section.context.github &&
                            <a className='pt6 color-gray-light color-gray-on-hover txt-s txt-bold unprose' href={section.context.github.url}><Icon name="github" themeIcon='inline-block mb-neg6 mr6' /><span>{section.context.github.path}</span></a>}
                    </div>}

                {this.md(section.description)}

                {!empty(section.augments) &&
                    <p>Extends {section.augments.map((tag, i) =>
                        <span key={i} dangerouslySetInnerHTML={{__html: formatters.autolink(tag.name)}}/>)}.</p>}

                {section.kind === 'class' &&
                    !section.interface &&
                    (!section.constructorComment || section.constructorComment.access !== 'private') &&
                    <div className='txt-code px6 py6 txt-s round bg-gray-faint'
                        dangerouslySetInnerHTML={{__html: `new ${section.name}${formatters.parameters(section)}`}}/>}

                {section.version && <div>Version: {section.version}</div>}
                {section.license && <div>License: {section.license}</div>}
                {section.author && <div>Author: {section.author}</div>}
                {section.copyright && <div>Copyright: {section.copyright}</div>}
                {section.since && <div>Since: {section.since}</div>}

                {!empty(section.params) && (section.kind !== 'class' || !section.constructorComment || section.constructorComment.access !== 'private') &&
                    <div>
                        <div className='py6 color-gray mt12 txt-l'>Parameters</div>
                        <div>
                            {section.params.map((param, i) =>
                                <div key={i} className='mb0'>
                                    <div>
                                        <span className='txt-code txt-bold'>{param.name}</span>
                                        <code className='color-gray-light'>({this.formatType(param.type)})</code>
                                        {param.default && <span>{'('}default <code>{param.default}</code>{')'}</span>}
                                        {this.md(param.description, true)}
                                    </div>
                                    {param.properties &&
                                        <table className='mt6 mb12 fixed-table txt-s'>
                                            <colgroup>
                                                <col width='30%' />
                                                <col width='70%' />
                                            </colgroup>
                                            <thead>
                                                <tr className='txt-bold bg-gray-faint'>
                                                    <td>Name</td>
                                                    <td>Description</td>
                                                </tr>
                                            </thead>
                                            <tbody className='mt6'>
                                                {param.properties.map((property, i) =>
                                                    <tr key={i}>
                                                        <td>
                                                            <span className='txt-code txt-bold txt-break-word'>{property.name}</span><br />
                                                            <code className='color-gray'>{this.formatType(property.type)}</code><br />
                                                            {property.default && <span className='color-gray'>default <code>{property.default}</code></span>}
                                                        </td>
                                                        <td><span>{this.md(property.description, true)}</span></td>
                                                    </tr>)}
                                            </tbody>
                                        </table>}
                                </div>)}
                        </div>
                    </div>}

                {!empty(section.properties) &&
                    <div>
                        <div className='py6 color-gray mt12 txt-l'>Properties</div>
                        <div>
                            {section.properties.map((property, i) =>
                                <div key={i} className='mb0'>
                                    <span className='txt-code txt-bold'>{property.name}</span>
                                    <code className='color-gray-light'>({this.formatType(property.type)})</code>
                                    {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                    {property.description && <span>: {this.md(property.description, true)}</span>}
                                    {property.properties &&
                                        <ul>
                                            {property.properties.map((property, i) =>
                                                <li key={i}>
                                                    <code>{property.name}</code> {this.formatType(property.type)}
                                                    {property.default && <span>{'('}default <code>{property.default}</code>{')'}</span>}
                                                    {this.md(property.description)}
                                                </li>)}
                                        </ul>}
                                </div>)}
                        </div>
                    </div>}

                {section.returns && section.returns.map((ret, i) =>
                    <div key={i}>
                        <div className='py6 color-gray mt12 txt-l'>Returns</div>
                        <code>{this.formatType(ret.type)}</code>
                        {ret.description && <span>: {this.md(ret.description, true)}</span>}
                    </div>)}

                {!empty(section.throws) &&
                    <div>
                        <div className='py6 color-gray mt12 txt-l'>Throws</div>
                        <ul>
                            {section.throws.map((throws, i) =>
                                <li key={i}>{this.formatType(throws.type)}: {this.md(throws.description, true)}</li>)}
                        </ul>
                    </div>}

                {!empty(section.examples) &&
                    <div>
                        <div className='py6 color-gray mt12 txt-l'>Example</div>
                        {section.examples.map((example, i) =>
                            <div key={i}>
                                {example.caption && <p>{this.md(example.caption)}</p>}
                                {highlightJavascript(example.description)}
                            </div>)}
                    </div>}

                {membersList(section.members.static, 'Static Members')}
                {membersList(section.members.instance, 'Instance Members')}
                {membersList(section.members.events, 'Events')}

                {!empty(section.sees) &&
                    <div>
                        <div className='py6 color-gray mt12 txt-l'>Related</div>
                        <ul>{section.sees.map((see, i) => <li key={i}>{this.md(see)}</li>)}</ul>
                    </div>}
            </section>
        );
    }
}

export default ApiItem;