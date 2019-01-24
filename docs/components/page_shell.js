import React from 'react';
import Helmet from 'react-helmet';
import { withLocation } from '@mapbox/batfish/modules/with-location';
import ReactPageShell from '../../vendor/docs-page-shell/react-page-shell.js';
// dr-ui components
import TopbarSticker from '@mapbox/dr-ui/topbar-sticker';
import BackToTopButton from '@mapbox/dr-ui/back-to-top-button';
import ProductMenu from '@mapbox/dr-ui/product-menu/product-menu';
import PageLayout from '@mapbox/dr-ui/page-layout';
import SectionedNavigation from '@mapbox/dr-ui/sectioned-navigation';
import NavigationAccordion from '@mapbox/dr-ui/navigation-accordion';
import examples from '@mapbox/batfish/data/examples'; // eslint-disable-line import/no-unresolved
import GithubSlugger from 'github-slugger';
import ApiNavigation from './api-navigation';
import TopNavTabs from './top-nav-tabs';
import { tags } from '../data/tags.js';
import { overviewNavigation } from '../data/overview-navigation';
import { styleSpecNavigation } from '../data/style-spec-navigation';
import { plugins } from '../data/plugins';
import { routeToPrefixed } from '@mapbox/batfish/modules/route-to';


const slugger = new GithubSlugger();

class PageShell extends React.Component {

    componentDidMount() {
    // initialize analytics
        if (typeof window !== 'undefined' && window.initializeMapboxAnalytics) {
            const isProduction = /\.?mapbox\.com/.test(window.location.hostname);

            let sentryInit = {};
            if (isProduction) {
                sentryInit = { sentryDsn: 'https://581913e6cd0845d785f5b551a4986b61@sentry.io/11290' };
            } else {
                sentryInit = false;
            }
            window.initializeMapboxAnalytics({
                sentry: sentryInit
            });
        }
    }

    accordionNavProps() {
        const { frontMatter } = this.props;
        const sections = overviewNavigation.map(section => ({
            title: section.title,
            path: `/mapbox-gl-js/overview/${section.path}`
        }));
        const subtitles = overviewNavigation.filter(section => section.title === frontMatter.title).map(section => section.subnav.map(subNavItem => ({
            title: subNavItem.title,
            path: subNavItem.path
        })))[0];
        const sidebarContent = (
            <div className='mx0-mm ml-neg24 mr-neg36 relative-mm absolute right left'>
                <NavigationAccordion
                    currentPath={this.props.location.pathname}
                    contents={{
                        firstLevelItems: sections,
                        secondLevelItems: subtitles
                    }}
                    onDropdownChange={(value) => {
                        routeToPrefixed(value);
                    }}
                />
            </div>
        );
        return {
            contentType: "Overview",
            sidebarContent,
            sidebarStackedOnNarrowScreens: true
        };
    }

    getExampleSections(data) {
        return (
            Object.keys(data).map((topic) => {
                const subNavItems = examples
                    .filter(item => item.tags[0] === topic)
                    .map(item => ({
                        text: item.title,
                        url: item.path,
                        active: this.props.location.pathname === item.path
                    }));
                return {
                    title: data[topic],
                    url: `#${topic}`,
                    items: subNavItems
                };
            }).filter(topic => topic.items.length > 0)
        );
    }

    getPluginSections(data) {
        return (
            Object.keys(data).map((section) => {
                const subNavItems = Object.keys(data[section]).map(item => ({
                    text: item,
                    url: data[section][item].website
                }));
                return {
                    title: section,
                    url: `#${slugger.slug(section)}`,
                    items: subNavItems
                };
            })
        );
    }

    sectionedNavProps(activeTab, sections) {
        const contentType = activeTab.charAt(0).toUpperCase() + activeTab.substr(1).toLowerCase();
        const sidebarContent = (
            <div className='ml36 mr12'>
                <SectionedNavigation sections={sections} includeFilterBar={true} />
            </div>
        );
        return {
            contentType,
            sidebarContent,
            sidebarStackedOnNarrowScreens: false
        };
    }

    apiNavProps() {
        return {
            contentType: "API reference",
            sidebarContent: <ApiNavigation />,
            sidebarStackedOnNarrowScreens: false,
            interactiveClass: "toggle-sibling",
            sidebarColSize: 3
        };
    }

    styleSpecNavProps() {
        slugger.reset();
        const sections = styleSpecNavigation
            .map((section) => {
                let subNavItems = [];
                const sectionSlug = slugger.slug(section.title);
                if (section.subnav) {
                    subNavItems = section.subnav.map((item) => {
                        slugger.reset();
                        const itemSlug = slugger.slug(item.title);
                        return {
                            text: item.title,
                            url: `#${sectionSlug}-${itemSlug}`
                        };
                    });
                }
                return {
                    title: section.title,
                    url: `#${sectionSlug}`,
                    items: subNavItems
                };
            });
        const sidebarContent = (
            <div className='ml36 mr12'>
                <SectionedNavigation sections={sections} includeCount={false} />
            </div>
        );

        return {
            contentType: "Specification",
            sidebarContent,
            sidebarStackedOnNarrowScreens: false,
            sidebarColSize: 3
        };
    }

    getSidebarProps(activeTab) {
        if (activeTab === 'overview') {
            return this.accordionNavProps();
        } else if (activeTab === 'examples') {
            return this.sectionedNavProps(activeTab, this.getExampleSections(tags));
        } else if (activeTab === 'api') {
            return this.apiNavProps();
        } else if (activeTab === 'plugins') {
            return this.sectionedNavProps(activeTab, this.getPluginSections(plugins));
        } else if (activeTab === 'style-spec') {
            return this.styleSpecNavProps();
        }
    }

    render() {
        const { location } = this.props;

        let activeTab = location.pathname.split('/')[2];
        if (activeTab === 'example') activeTab = 'examples';

        const sidebarProps = this.getSidebarProps(activeTab);
        const topbarContent = {
            productName: "Mapbox GL JS",
            topNav: <TopNavTabs activeTab={activeTab} />
        };

        return (
            <ReactPageShell darkHeaderText={true} includeFooter={false} {...this.props}>
                <Helmet>
                    <link
                        rel="canonical"
                        href={`https://docs.mapbox.com${this.props.meta.pathname}`}
                    />
                </Helmet>
                <div className="shell-header-buffer" />
                <TopbarSticker>
                    <div className="limiter">
                        <div className="grid grid--gut36 mr-neg36 mr0-mm">
                            <div className={`col col--4-mm ${sidebarProps.sidebarColSize ? `col--${sidebarProps.sidebarColSize}-ml` : ''} col--12`}>
                                <div className="ml24-mm pt12">
                                    <ProductMenu productName={topbarContent.productName} homePage='/mapbox-gl-js/'/>
                                </div>
                            </div>
                            <div className={`col col--8-mm ${sidebarProps.sidebarColSize ? `col--${12 - sidebarProps.sidebarColSize}-ml` : ''} col--12`}>
                                <div style={{ height: '50px' }}>
                                    {topbarContent.topNav}
                                </div>
                            </div>
                        </div>
                    </div>
                </TopbarSticker>
                <div className="limiter">
                    <PageLayout
                        sidebarTitle={<div className="ml36">{sidebarProps.contentType}</div>}
                        sidebarContent={sidebarProps.sidebarContent}
                        sidebarContentStickyTop={60}
                        sidebarContentStickyTopNarrow={0}
                        currentPath={location.pathname}
                        interactiveClass={sidebarProps.interactiveClass}
                        sideBarColSize={sidebarProps.sidebarColSize || 0}
                        sidebarStackedOnNarrowScreens={sidebarProps.sidebarStackedOnNarrowScreens}
                    >
                        <div className='static-header-page prose'>
                            {this.props.children}
                        </div>
                        {activeTab !== 'overview' ? <div className="fixed block mx24 my24 z5 bottom right">
                            <BackToTopButton />
                        </div> : ''}
                    </PageLayout>
                </div>
            </ReactPageShell>
        );
    }
}

export default withLocation(PageShell);
