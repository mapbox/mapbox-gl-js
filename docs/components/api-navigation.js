import React from 'react';
import docs from '../components/api.json'; // eslint-disable-line import/no-unresolved
import Icon from '@mapbox/mr-ui/icon';

function href(m) {
    return `#${m.namespace.toLowerCase()}`;
}

class TableOfContentsNote extends React.Component {
    render() {
        const doc = this.props;
        return (
            <li className='mt24'>
                <a className='txt-bold link link--gray' href={href(doc)}>{doc.name}</a>
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

        const empty = members => !members || members.length === 0;
        if (empty(doc.members.static) && empty(doc.members.instance) && empty(doc.members.events)) {
            return <li className="txt-s mt6"><a href={href(doc)} className='link--gray block'>{doc.name}</a></li>;
        }

        const membersList = (members, title, sigil) => members && members.length !== 0 &&
                <ul className='list-reset px6 mb6'>
                    <li className='block txt-s'>{title}</li>
                    {members.map((m, i) => <li key={i} className='ml12'>
                        <a href={href(m)} className='block txt-s truncate pre-open link--gray'>{sigil}{m.name}</a>
                    </li>)}
                </ul>;

        return (
            <li>
                <a href={href(doc)}
                    className='toggle-sibling link--gray txt-s mt6 block'
                    onClick={() => this.setState({disclosed: !this.state.disclosed})}>
                    {doc.name}
                    <Icon inline={true} name={`${this.state.disclosed ? 'caret-down' : 'caret-right'}`} />
                </a>

                {this.state.disclosed &&
                    <div className='toggle-target mb6'>
                        {membersList(doc.members.static, 'Static members', '.')}
                        {membersList(doc.members.instance, 'Instance members', '#')}
                        {membersList(doc.members.events, 'Events', 'ⓔ ')}
                    </div>}
            </li>
        );
    }
}

class ApiNavigation extends React.Component {
    render() {
        return (
            <div className='ml36'>
                <ul id='toc' className='list-reset mb3 py1-ul'>
                    {docs.map((doc, i) => (doc.kind === 'note') ?
                        <TableOfContentsNote key={i} {...doc}/> :
                        <TableOfContentsItem key={i} {...doc}/>)}
                </ul>
            </div>
        );
    }
}

export default ApiNavigation;
