import React from 'react';
import GithubSlugger from 'github-slugger';
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
            <div className='border-b border--gray-light pb18'>
                <div className='pt60' style={{ marginTop: '-45px' }} id={member.namespace.toLowerCase()} />
                <div>
                    <div
                        className='cursor-pointer toggle-sibling color-blue-on-hover'
                        onClick={(e) => {
                            this.setState({disclosed: !this.state.disclosed});
                            window.location = this.href(member);
                            e.preventDefault();
                        }}
                    >
                        <span className='txt-code truncate bg-white'>{member.name}</span>
                        {member.kind === 'function' &&
                            <span className='color-gray txt-code mr12' dangerouslySetInnerHTML={{__html: formatters.parameters(member, true)}}/>}
                        <Icon name={`${this.state.disclosed ? 'caret-down' : 'caret-right'}`} themeIcon="fr" inline={true} />
                    </div>
                </div>

                {this.state.disclosed &&
                    <div className="toggle-target bg-gray-faint round py18 px18 my12">
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
