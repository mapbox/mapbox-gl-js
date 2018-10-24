import React from 'react';
import { withLocation } from '@mapbox/batfish/modules/with-location';
import Helmet from 'react-helmet';
import ReactPageShell from '../../vendor/dotcom-page-shell/react-page-shell.js';
// dr-ui components
import TopbarSticker from '@mapbox/dr-ui/topbar-sticker';
import BackToTopButton from '@mapbox/dr-ui/back-to-top-button';
import ProductMenu from '@mapbox/dr-ui/product-menu/product-menu';
import ProductMenuDropdown from '@mapbox/dr-ui/product-menu-dropdown';
import { ProductMenuItems } from '../data/product-menu-items';
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

const slugger = new GithubSlugger();

class PageShell extends React.Component {

    render() {
        const { frontMatter, location, children } = this.props;

        let activeTab = location.pathname.split('/')[2];
        if (activeTab === 'example') activeTab = 'examples';
        let topNavContent = (
            <TopNavTabs 
                activeTab={activeTab}
            />
        );
        let productName = 'Mapbox GL JS';

        let sidebarContent = <div />;
        let sidebarStackedOnNarrowScreens = false;
        if (location.pathname.indexOf('overview') > -1) {
            sidebarStackedOnNarrowScreens = true;
            const sections = overviewNavigation.map(section => {
                return {
                    title: section.title,
                    path: `/mapbox-gl-js/overview/${section.path}`
                }
            });
            const subtitles = overviewNavigation.filter(section => {
                return section.title === frontMatter.title;
            }).map(section => {
                return section.subnav.map(subNavItem => {
                    return {
                        title: subNavItem.title,
                        path: `#${subNavItem.path}`
                    } 
                });
            })[0];
            sidebarContent = (
                <div className="mx0-mm ml-neg24 mr-neg36 relative-mm absolute right left">
                    <NavigationAccordion
                        currentPath={location.pathname}
                        contents={{
                            firstLevelItems: sections,
                            secondLevelItems: subtitles
                        }}
                        onDropdownChange={value => {
                            routeToPrefixed(value);
                        }}
                    />
                </div>
            );
        } else if (location.pathname.indexOf('example') > -1) {
            const allTopics = Object.keys(tags);
            const sections = allTopics
              .map(topic => {
                const examplesForTopic = examples
                  .filter(example => {
                    return example.tags[0] === topic;
                  })
                  .map(example => {
                    console.log(location.pathname, example.path)
                    return {
                      text: example.title,
                      url: example.path,
                      active: location.pathname === example.path
                    };
                  });

                return {
                  title: tags[topic],
                  url: topic,
                  items: examplesForTopic
                };
              })
              .filter(topic => {
                return topic.items.length > 0;
              });
            sidebarContent = (
                <div className="ml36 mr12">
                    <SectionedNavigation sections={sections} />
                </div>
            );
        } else if (location.pathname.indexOf('style-spec') > -1) {
            slugger.reset();
            const sections = styleSpecNavigation
              .map(section => {
                let subNavItems = [];
                const sectionSlug = slugger.slug(section.title);
                if (section.subnav) {
                    subNavItems = section.subnav.map(item => {
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
            sidebarContent = (
                <div className="ml36 mr12">
                    <SectionedNavigation sections={sections} includeCount={false} />
                </div>
            );
            productName = 'Mapbox Style Spec';
            topNavContent = '';
        } else if (location.pathname.indexOf('plugins') > -1) {
            const sections = Object.keys(plugins)
              .map((section, i) => {
                const subNavItems = Object.keys(plugins[section]).map(item => {
                    return {
                        text: item,
                        url: plugins[section][item].website
                    };
                 });
                return {
                    title: section,
                    url: i,
                    items: subNavItems
                };
            });
            sidebarContent = (
                <div className="ml36 mr12">
                    <SectionedNavigation sections={sections} includeCount={false} />
                </div>
            );
        } else {
            sidebarContent = <ApiNavigation />;
        }
        return (
            <ReactPageShell darkHeaderText={true} includeFooter={true} {...this.props}>
                <div className="shell-header-buffer" />
                <TopbarSticker>
                    <div className="limiter">
                        <div className="grid grid--gut36 mr-neg36 mr0-mm">
                              <div className="col col--4-mm col--12">
                                <div className="ml24 pt12">
                                      <ProductMenu productName={productName}>
                                            <ProductMenuDropdown categories={ProductMenuItems} />
                                      </ProductMenu>
                                </div>
                            </div>
                            <div className="col col--8-mm col--12">
                                <div style={{ height: '50px' }}>{topNavContent}</div>
                            </div>
                        </div>
                    </div>
                </TopbarSticker>
                <div className="limiter">
                    <PageLayout
                        sidebarTitle={<div className="ml36">API</div>}
                        sidebarContent={sidebarContent}
                        sidebarContentStickyTop={60}
                        sidebarContentStickyTopNarrow={0}
                        currentPath={location.pathname}
                        sidebarStackedOnNarrowScreens={sidebarStackedOnNarrowScreens}
                    >
                            <div id="docs-content" className='static-header-page prose'>
                                {this.props.children}
                            </div>
                        <div className="fixed block none-mm mx24 my24 z5 bottom right">
                            <BackToTopButton />
                        </div>
                    </PageLayout>
                </div>
            </ReactPageShell>
        );
    }
}

export default withLocation(PageShell);
