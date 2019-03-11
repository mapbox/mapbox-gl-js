/*---
title: Display HTML clusters with custom properties
description: An advanced example of using Mapbox GL JS clustering with HTML markers and custom property expressions. To be able to use HTML or SVG for clusters in place of a Mapbox GL layer, we have to manually synchronize the clustered source with a pool of marker objects that we update continuously while the map view changes.
tags:
  - layers
pathname: /mapbox-gl-js/example/cluster-html/
---*/
import Example from '../../components/example';
import html from './cluster-html.html';
export default Example(html);
