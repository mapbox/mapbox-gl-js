#!/bin/bash

if [ "$1" = "--help" ]; then
    echo "usage: $0"
    echo "Tag current commit with alpha version in format gl-js/v<semver>-alpha.<sha>."
    echo "Also tags style-spec with gl-js/style-spec@<semver>-alpha.<sha>."
    exit 0
fi

branch=$(git branch --show-current)
commit=$(git log -1 --pretty=%B)
version=$(node -e 'console.log(require("./package.json").version)')
style_spec_version=$(node -e 'console.log(require("./src/style-spec/package.json").version)')
next_version=$(npx semver $version -i minor)
style_spec_next_version=$(npx semver $style_spec_version -i minor)

if [ $branch != "main" ]; then
    echo "Alpha tagging is possible only from main!"
    exit 1
fi

tag=gl-js/v$next_version-alpha.$(git rev-parse --short HEAD)
style_spec_tag=gl-js/style-spec@$style_spec_next_version-alpha.$(git rev-parse --short HEAD)

printf "Tags $tag and $style_spec_tag will be published.\n$commit\n\n"

read -p "Proceed ? (y/n) " answer

if [ $answer = "y" ]; then
    echo "git tag $tag"
    git tag $tag
    echo "git tag $style_spec_tag"
    git tag $style_spec_tag
    echo "git push --atomic origin $tag $style_spec_tag"
    git push --atomic origin $tag $style_spec_tag
fi
