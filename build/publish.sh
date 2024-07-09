#!/bin/bash

# run npm publish for every tag; run as part of CI on AWS CodeBuild
git tag --points-at HEAD | while read tag; do

    disttag=$(echo $tag | grep -oP '^(v|style-spec@)\d+\.\d+\.\d+-?\K(\w+)?')
    disttag=${disttag:+next}
    disttag=${disttag:-latest}

    if [[ $tag =~ ^style-spec@ ]]; then
        cd src/style-spec
        spec_version=$(node -p "require('./package.json').version")
        echo "Publishing style-spec: $spec_version"

        if [[ -z $(npm view .@$spec_version) ]]; then
            echo "npm publish --tag $disttag"
            npm publish --tag $disttag
        else
            echo "Already published."
        fi
        cd ../..

    elif [[ $tag =~ ^v[0-9] ]]; then
        version=$(node -p "require('./package.json').version")
        echo "Publishing mapbox-gl: $version"

        if [[ -z $(npm view .@$version) ]]; then
            echo "npm publish --tag $disttag"
            npm publish --tag $disttag
        else
            echo "Already published."
        fi

    else
        echo "Unrecognized tag: $tag"
    fi
done

if [ -n "$(git tag --points-at HEAD)" ]; then
    node build/generate-release-list.js &&
    aws s3 cp --acl public-read --content-type application/json dist/versions.json s3://mapbox-gl-js/versions.json &&
    aws s3 cp --acl public-read --content-type application/javascript dist/versions.jsonp s3://mapbox-gl-js/versions.jsonp
fi
