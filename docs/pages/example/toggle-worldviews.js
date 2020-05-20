/*---
title: Change worldview of administrative boundaries
description: |
  Uses the [worldview](https://www.mapbox.com/vector-tiles/mapbox-streets-v8/#-worldview-text) value to adjust administrative boundaries based on the map's audience. You can see the worldview options within the worldviews variable in this example. They are as follows:
  - **CN**: Boundaries for a mainland Chinese audience/worldview, but not officially approved for use in the PRC.
  - **IN**: Boundaries conforming to cartographic requirements for use in India.
  - **US**: Boundaries for an American audience, & which are generally appropriate outside of China & India.
    Lines do not necessarily reflect official US foreign policy.
tags:
  - layers
  - user-interaction
pathname: /mapbox-gl-js/example/toggle-worldviews/
---*/
import Example from '../../components/example';
import html from './toggle-worldviews.html';
export default Example(html);
