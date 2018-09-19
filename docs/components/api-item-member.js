import React from 'react';
import createFormatters from 'documentation/lib/output/util/formatters';
import LinkerStack from 'documentation/lib/output/util/linker_stack';
import docs from '../components/api.json'; // eslint-disable-line import/no-unresolved
import ApiItem from '../components/api-item';
import Icon from '@mapbox/mr-ui/icon';

const linkerStack = new LinkerStack({})
    .namespaceResolver(docs, (namespace) => {
        const slugger = new GithubSlugger();
        return `#${slugger.slug(namespace)}`;
    });

const formatters = createFormatters(linkerStack.link);

class ApiItemMember extends React.Component {
    constructor(props) {
        super(props);
        this.state = {disclosed: false};
        this.hashChange = this.hashChange.bind(this);
    }

    href = m => {
        return `#${m.namespace.toLowerCase()}`;
    }

    render() {
        const member = this.props;
        return (
            <div className='border-b border--gray-light'>
                <div id={member.namespace.toLowerCase()}
                    className='clearfix txt-s cursor-pointer toggle-sibling'
                    onClick={(e) => {
                        this.setState({disclosed: !this.state.disclosed});
                        window.location = this.href(member);
                        e.preventDefault();
                    }}>
                    <div className='py12'>
                        <span className='txt-code txt-s truncate'>{member.name}</span>
                        {member.kind === 'function' &&
                            <span className='color-gray txt-code mr12' dangerouslySetInnerHTML={{__html: formatters.parameters(member, true)}}/>}
                        <Icon name={`${this.state.disclosed ? 'caret-down' : 'caret-right'}`} themeIcon="fr" inline={true} />
                    </div>
                </div>

                {this.state.disclosed &&
                    <div className="clearfix toggle-target">
                        <ApiItem nested={true} {...member}/>
                    </div>}
            </div>
        );
    }

    hashChange() {
        this.setState({disclosed: window.location.hash === this.href(this.props)});
    }

    componentDidMount() {
        window.addEventListener("hashchange", this.hashChange);
        this.hashChange();
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.hashChange);
    }
}

export default ApiItemMember;
