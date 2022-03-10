#!/bin/bash

# run npm publish for every tag; run as part of CI on AWS CodeBuild
git tag --points-at HEAD | while read tag; do

    disttag=$(echo $tag | grep -oP '^(v|style-spec@)\d+\.\d+\.\d+-?\K(\w+)?')
    disttag=${disttag:+next}
    disttag=${disttag:-latest}

    if [[ $tag =~ ^style-spec@ ]]; then
        echo "Publishing style-spec: $tag"
        cd src/style-spec
        npm publish --tag $disttag --access public || true
        cd ../..

    elif [[ $tag =~ ^v[0-9] ]]; then
        echo "Publishing mapbox-gl: $tag"
        npm publish --tag $disttag || true

    else
        echo "Unrecognized tag: $tag"
    fi
done
