import React from 'react';
import PageShell from './page_shell';
import Feedback from '@mapbox/dr-ui/feedback';
import constants from '../constants';

class MarkdownPageshell extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            userName: undefined
        };
    }

    componentDidMount() {
        MapboxPageShell.afterUserCheck(() => {
            // fetches username so we can identify them in segment
            this.setState({
                userName: MapboxPageShell.getUser() ?
                    MapboxPageShell.getUser().id :
                    undefined
            });
        });
    }
    render() {
        const { frontMatter, location } = this.props;
        const meta = this.props.meta || {};
        if (!meta.title && frontMatter.title) {
            meta.title = frontMatter.title;
        }
        if (!meta.description && frontMatter.description) {
            meta.description = frontMatter.description;
        }
        if (!meta.pathname) {
            meta.pathname = location.pathname;
        }
        if (frontMatter.contentType) meta.contentType = frontMatter.contentType;
        if (frontMatter.language) meta.language = frontMatter.language;
        if (frontMatter.level) meta.level = frontMatter.level;
        return (
            <PageShell meta={meta} {...this.props}>
                <div className="prose">
                    {this.props.children}
                </div>
                <div className="mt18">
                    <Feedback
                        site="Mapbox GL JS"
                        location={this.props.location}
                        userName={this.state.userName}
                        webhook={constants.FORWARD_EVENT_WEBHOOK}
                    />
                </div>
            </PageShell>
        );
    }
}

export default MarkdownPageshell;
