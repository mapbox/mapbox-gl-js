/*---
title: 'Mapbox GL JS Examples'
description: 'Code examples for Mapbox GL JS.'
product: maps
pathname: /mapbox-gl-js/examples/
---*/

import React from 'react';
import PropTypes from 'prop-types';
import ExamplesPage from '@mapbox/dr-ui/examples-page';
import CardContainer from '@mapbox/dr-ui/card-container';
import Card from '@mapbox/dr-ui/card';
import PageShell from '../components/page_shell';
import { tags } from '../data/tags.js';
import examples from '@mapbox/batfish/data/examples'; // eslint-disable-line import/no-unresolved

const meta = {
    title: 'Mapbox GL JS Examples',
    description: 'Code examples for Mapbox GL JS.',
    pathname: '/examples'
};

class ExamplesLandingPage extends React.PureComponent {

    render() {
        const renderedCardContainers = Object.keys(tags).map((topic) => {
            const cardsForTopic = examples
                .filter(example => example.tags.indexOf(topic) > -1)
                .map((example, index) => {
                    const filename = example.pathname.split('/')[3];
                    return (
                        <Card
                            key={index}
                            title={example.title}
                            description=''
                            path={example.path}
                            thumbnail={
                                <div className="h120 w-full" style={{ backgroundImage: `url(/mapbox-gl-js/img/${filename}.png)`, backgroundSize: "cover", borderRadius: '4px' }} />
                            }
                        />
                    );
                });
            return (
                <CardContainer
                    title={tags[topic]}
                    path={`#${topic}`}
                    fullWidthCards={false}
                    cards={cardsForTopic}
                />
            );
        });

        const gettingStartedSection = (
            <div className="">
                <div className='prose'>
                    <h1 className='mt24 mt0-mm' id='getting-started'>Getting started</h1>
                </div>
                <a className="color-gray-dark color-blue-on-hover transition clip inline-block w-full unprose"
                    href='/mapbox-gl-js/example/simple-map/'
                >
                    <div className="relative h240 mb12" style={{ backgroundImage: `url(/mapbox-gl-js/img/simple-map.png)`, backgroundSize: "cover", borderRadius: '4px' }} />
                    <div className="">
                        <div className="mb6 txt-m">Display a map</div>
                        <div className="txt-s color-gray">Initialize a map in an HTML element with Mapbox GL JS.</div>
                    </div>
                </a>
            </div>
        );

        return (
            <PageShell meta={meta} frontMatter={this.props.frontMatter}>
                {gettingStartedSection}
                <ExamplesPage
                    frontMatter={meta}
                    cardContainers={renderedCardContainers}
                />
            </PageShell>
        );
    }
}

ExamplesLandingPage.propTypes = {
    frontMatter: PropTypes.shape({
        title: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        product: PropTypes.string.isRequired
    }).isRequired
};

export default ExamplesLandingPage;
