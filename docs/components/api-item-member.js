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

    href = m => `#${m.namespace.toLowerCase()}`

    render() {
        const member = this.props;
        return (
            <div>
                <div>
                    <div className='pt60 border-b border--gray-light' style={{ marginTop: '-40px' }} id={member.namespace.toLowerCase()} />
                    <div
                        className='clearfix cursor-pointer toggle-sibling pt18'
                        onClick={(e) => {
                            this.setState({disclosed: !this.state.disclosed});
                            window.location = this.href(member);
                            e.preventDefault();
                        }}
                    >
                        <span className='txt-code truncate'>{member.name}</span>
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
        if (window.location.hash === this.href(this.props)) {
            this.setState({disclosed: true });
        }
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
