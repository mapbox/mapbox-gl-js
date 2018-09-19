import React from 'react';
import PropTypes from 'prop-types';
import PageShell from './page_shell';

class MarkdownPageshell extends React.Component {
  render() {
    const { frontMatter, location, children } = this.props;
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
    return (
      <PageShell meta={meta} {...this.props}>
        <div id="docs-content" className="prose">
          {this.props.children}
        </div>
      </PageShell>
    );
  }
}

export default MarkdownPageshell;
