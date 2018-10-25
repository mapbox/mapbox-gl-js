import React from 'react';
import PropTypes from 'prop-types';
import ExamplesPage from '@mapbox/dr-ui/examples-page';
import CardContainer from '@mapbox/dr-ui/card-container';
import Card from '@mapbox/dr-ui/card';
import PageShell from '../components/page_shell';
import { tags } from '../data/tags.js';
import examples from '@mapbox/batfish/data/examples';

const meta = {
    title: 'Mapbox GL JS Examples',
    description: 'Code examples for Mapbox GL JS.',
    pathname: '/examples'
};

class ExamplesLandingPage extends React.PureComponent {

  render() {
    const renderedCardContainers = Object.keys(tags).map(topic => {
      const cardsForTopic = examples
        .filter(example => {
          console.log(topic)
          return example.tags.indexOf(topic) > -1;
        })
        .map((example, index) => {
          const filename = example.pathname.split('/')[3];
          return (
            <Card
              key={index}
              title={example.title}
              description=''
              path={example.path}
              thumbnail={
                <div className="h120 w-full" style={{ backgroundImage: `url(/mapbox-gl-js/img/${filename}.png)`, backgroundSize: "cover" }} />
              }
            />
          );
        });
      return (
        <CardContainer
          title={tags[topic]}
          path={topic}
          fullWidthCards={false}
          cards={cardsForTopic}
        />
      );
    });

    const gettingStartedSection = (
      <div>
        <div className="txt-xl mb24" id='getting-started'>
          Getting started
        </div>
        <a
          className="color-gray-dark transition shadow-darken10-on-hover round clip inline-block w-full px12 py12 unprose"
          href='/mapbox-gl-js/example/simple-map/'
        >
          <div className="relative h240 mb12" style={{ backgroundImage: `url(/mapbox-gl-js/img/simple-map.png)`, backgroundSize: "cover" }} />
          <div className="px6 pb6">
            <div className="mb6 txt-m">Display a map</div>
            <div className="txt-s opacity75">Initialize a map in an HTML element with Mapbox GL JS.</div>
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
