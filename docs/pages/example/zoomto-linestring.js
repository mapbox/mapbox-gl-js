/*---
title: Fit to the bounds of a LineString
description: >-
  Get the bounds of a LineString by passing it's first coordinates to <a
  href='https://www.mapbox.com/mapbox-gl-js/api/#LngLatBounds'>mapboxgl.LngLatBounds</a>
  and chaining <a
  href='https://www.mapbox.com/mapbox-gl-js/api/#LngLatBounds#extend'>extend</a>
  to include the last coordinates.
tags:
  - user-interaction
pathname: /mapbox-gl-js/example/zoomto-linestring/
---*/
import Example from '../../components/example';
import html from './zoomto-linestring.html';
export default Example(html);
