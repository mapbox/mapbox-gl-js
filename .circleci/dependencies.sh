# disable spotlight to ensure we waste no CPU on needless file indexing
if [[ $(uname -s) == 'Darwin' ]]; then sudo mdutil -i off /; fi;

if [[ ! -d ~/.yarn ]]; then
    curl -o- -L https://yarnpkg.com/install.sh | bash
fi

PATH="~/.yarn/bin:$PATH"

yarn

if [ "$CIRCLE_BRANCH" == "master" ] || [ -n "$CIRCLE_TAG" ]; then
    pip install --user --upgrade awscli
fi
