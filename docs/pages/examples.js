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
import AppropriateImage from '../components/appropriate-image';
import imageConfig from '../img/dist/image.config.json'; // eslint-disable-line

const meta = {
    title: 'Examples',
    description: 'Code examples for Mapbox GL JS.',
    pathname: '/mapbox-gl-js/examples/',
    lanaguage: ['JavaScript']
};

class ExamplesLandingPage extends React.PureComponent {

    render() {
        const renderedCardContainers = Object.keys(tags).map((topic) => {
            const cardsForTopic = examples
                .filter(example => example.tags.indexOf(topic) > -1)
                .map((example, index) => {
                    const filename = example.pathname.split('/')[3];
                    // set default if thumbnail doesn't exist yet
                    const imageId = imageConfig[filename] ? filename : 'placeholder';
                    return (
                        <Card
                            key={index}
                            title={example.title}
                            description=''
                            path={example.path}
                            thumbnail={
                                <AppropriateImage
                                    imageId={imageId}
                                    style={{ borderRadius: '4px' }}
                                    background={true}
                                />
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
            <div>
                <div className='prose'>
                    <h1 className='mt24 mt0-mm txt-fancy'>Examples</h1>
                </div>
                <div className='mb36'>
                    <a href="#getting-started" className='unprose mb18 block color-blue-on-hover'><h2 className='txt-bold' id='getting-started'>Getting started</h2></a>
                    <a className="color-gray-dark color-blue-on-hover transition clip inline-block w-full unprose"
                        href='/mapbox-gl-js/example/simple-map/'
                    >
                        <div className='relative h240 mb6'>
                            <AppropriateImage
                                imageId='simple-map'
                                style={{ borderRadius: '4px' }}
                                background={true}
                            />

                        </div>
                        <div className="">
                            <div className="mb3 txt-m">Display a map</div>
                            <div className="color-gray">Initialize a map in an HTML element with Mapbox GL JS.</div>
                        </div>
                    </a>
                </div>
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
