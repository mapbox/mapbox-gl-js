#!/bin/bash

dry_run=false

for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
        dry_run=true
    fi
done

# run npm publish for every tag; run as part of CI on AWS CodeBuild
git tag --points-at HEAD | while read tag; do

    disttag=$(echo $tag | grep -oP '^gl-js/(v|style-spec@)\d+\.\d+\.\d+-?\K([\w\.]+)?')

    if [[ $disttag == alpha.* ]]; then
        disttag="dev"
    elif [[ -n $disttag ]]; then
        disttag="next"
    else
        disttag="latest"
    fi

    tag=$(echo $tag | sed 's/^gl-js\///')

    if [[ $tag =~ ^style-spec@ ]]; then
        spec_version="${tag#style-spec@}"
        echo "Publishing style-spec: $spec_version"

        current_version=$(node -p "require('./src/style-spec/package.json').version")
        if [[ "$spec_version" != "$current_version" ]]; then
            echo "npm version $spec_version --no-git-tag-version -w src/style-spec"
            if [[ $dry_run == false ]]; then
                npm version "$spec_version" --no-git-tag-version -w src/style-spec
            fi
        else
            echo "Version already set to $spec_version, skipping version update"
        fi

        if [[ -z $(npm view .@$spec_version -w src/style-spec) ]]; then
            echo "npm publish --tag $disttag -w src/style-spec"
            if [[ $dry_run == false ]]; then
                npm publish --tag "$disttag" -w src/style-spec
            fi
        else
            echo "Already published."
        fi

    elif [[ $tag =~ ^v[0-9] ]]; then
        version="${tag#v}"
        echo "Publishing mapbox-gl: $version"

        current_version=$(node -p "require('./package.json').version")
        if [[ "$version" != "$current_version" ]]; then
            echo "npm version $version --no-git-tag-version"
            if [[ $dry_run == false ]]; then
                npm version "$version" --no-git-tag-version
            fi
        else
            echo "Version already set to $version, skipping version update"
        fi

        if [[ -z $(npm view .@$version) ]]; then
            echo "npm publish --tag $disttag"
            if [[ $dry_run == false ]]; then
                npm publish --tag "$disttag"
            fi

            echo "Publishing to CDN"
            if [[ $dry_run == false ]]; then
                ./build/publish_cdn.sh v$version
            else
                ./build/publish_cdn.sh v$version --dry-run
            fi
        else
            echo "Already published."
        fi

    else
        echo "Unrecognized tag: $tag"
    fi
done
