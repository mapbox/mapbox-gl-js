window.vertical_style = {
    "version": 8,
    "name": "Streets",
    "center": [ 0, 0 ],
    "zoom": 0,
    "bearing": 0,
    "pitch": 0,
    "sources": {
        "point": {
            "type": "geojson",
            "data": {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "properties": {
                    "color": "red",
                    "id": "1",
                    "text": "I must be placed vertically!"
                  },
                  "geometry": {
                    "type": "Point",
                    "coordinates": [ 0.003, 0.003 ]
                  }
                },
                {
                    "type": "Feature",
                    "properties": {
                      "color": "green",
                      "id": "2",
                      "text": "垂直ラLatベ(ツ)ル"
                    },
                    "geometry": {
                      "type": "Point",
                      "coordinates": [ 0.002, 0.003 ]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {
                      "color": "blue",
                      "id": "3",
                      "text": "垂直ラLatベ(ツ)ル"
                    },
                    "geometry": {
                      "type": "Point",
                      "coordinates": [ 0.003, 0.002 ]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {
                      "color": "black",
                      "id": "4",
                      "text": "垂直ラLatベ(ツ)ル"
                    },
                    "geometry": {
                      "type": "Point",
                      "coordinates": [ 0.0025, 0.0025 ]
                    }
                },
                {
                  "type": "Feature",
                  "properties": {
                    "color": "orange",
                    "id": "5",
                    "text": "垂直ラLatベ(ツ)ル"
                  },
                  "geometry": {
                    "type": "Point",
                    "coordinates": [ 0.00256, 0.0027 ]
                  }
              }
              ]
            }
          },
          "line": {
            "type": "geojson",
            "data": {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "geometry": {
                    "coordinates": [
                      [
                        0.9447418261176495,
                        -1.124929934156114
                      ],
                      [
                        0.8904489329661942,
                        -1.0977042312443217
                      ],
                      [
                        0.8716182292066321,
                        -1.0356419470821123
                      ],
                      [
                        0.8725200595256695,
                        -0.9528339134441808
                      ],
                      [
                        0.9123232394824754,
                        -0.8535630234365499
                      ],
                      [
                        0.9886035408646876,
                        -0.7599268603102445
                      ],
                      [
                        1.0824177548147418,
                        -0.7003953867802863
                      ],
                      [
                        1.1785999444282709,
                        -0.6640333488290935
                      ],
                      [
                        1.3061851923036443,
                        -0.6447526893532682
                      ],
                      [
                        1.4332067216780047,
                        -0.650502608779945
                      ],
                      [
                        1.5364928383189351,
                        -0.6836508278859981
                      ],
                      [
                        1.670900153952715,
                        -0.7463952060760732
                      ],
                      [
                        1.725926119887248,
                        -0.826614568416943
                      ],
                      [
                        1.7686615905514032,
                        -0.9393023383787096
                      ],
                      [
                        1.780557721454727,
                        -1.009878389837695
                      ],
                      [
                        1.729253371448749,
                        -1.1493349736771847
                      ],
                      [
                        1.6476734002200715,
                        -1.2216537577532876
                      ],
                      [
                        1.5306874920561881,
                        -1.2835432481119824
                      ],
                      [
                        1.401467341170985,
                        -1.3326367743030545
                      ],
                      [
                        1.2570250008324422,
                        -1.4160538408377192
                      ],
                      [
                        1.2838052093896977,
                        -1.5100629934635634
                      ],
                      [
                        1.335392015150859,
                        -1.5718880603010348
                      ],
                      [
                        1.4595462417016734,
                        -1.576639056550917
                      ],
                      [
                        1.613994559057005,
                        -1.583050058598218
                      ],
                      [
                        1.765808449598154,
                        -1.5326735646734306
                      ],
                      [
                        1.9384102448999272,
                        -1.515041176684349
                      ],
                      [
                        2.0261432387167417,
                        -1.6598128045897766
                      ],
                      [
                        2.0024352149940228,
                        -1.8001095510321363
                      ],
                      [
                        1.9119541233846746,
                        -1.9076003661277383
                      ],
                      [
                        1.7340840803354354,
                        -2.028762929488366
                      ],
                      [
                        1.6180045495731576,
                        -2.056462725749327
                      ],
                      [
                        1.422667901550625,
                        -2.0843339485468277
                      ]
                    ],
                    "type": "LineString"
                  }
                }
              ]
            }
          }
    },
    "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    "layers": [
        {
            "id": "land",
            "type": "background",
            "layout": {},
            "paint": {
                "background-color": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    11,
                    "hsl(35, 32%, 91%)",
                    13,
                    "hsl(35, 12%, 89%)"
                ]
            }
        },
        {
            "id": "test-points",
            "type": "symbol",
            "source": "point",
            "layout": {
                "text-size": 24,
                "text-max-angle": 30,
                "text-font": [
                    "DIN Offc Pro Regular",
                    "Arial Unicode MS Regular"
                ],
                "symbol-placement": "point",
                "text-padding": 1,
                "text-rotation-alignment": "viewport",
                "text-pitch-alignment": "viewport",
                "text-writing-mode": ["vertical", "horizontal"],
                "text-radial-offset": 1,
                "text-variable-anchor": ["top","bottom", "center"],
                "text-field": ["format", ["concat",["get", "text"],["get", "id"]], {"text-color": ["get", "color"]}],
                "text-letter-spacing": 0.01
            },
            "paint": {
                "text-color": "hsl(0, 0%, 0%)",
                "text-halo-color": "hsl(0, 0%, 100%)",
                "text-halo-width": 1,
                "text-halo-blur": 1
            }
        },
        {
          "id": "test-lines",
          "type": "symbol",
          "source": "line",
          "layout": {
              "text-size": 24,
              "text-max-angle": 30,
              "text-font": [
                  "DIN Offc Pro Regular",
                  "Arial Unicode MS Regular"
              ],
              "symbol-placement": "line",
              "text-field": "垂直ラLatinベル"
          },
          "paint": {
              "text-color": "hsl(0, 0%, 0%)",
              "text-halo-color": "hsl(0, 0%, 100%)",
              "text-halo-width": 1,
              "text-halo-blur": 1
          }
      },
      {
        "id": "lines",
        "type": "line",
        "source": "line",
        "paint": {
            "line-opacity": 0.25
        }
      }
    ]
};
