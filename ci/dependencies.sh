# disable spotlight to ensure we waste no CPU on needless file indexing
then sudo mdutil -i off /;

if [[ ! -d ./nvm ]]; then
    git clone --depth 1 https://github.com/creationix/nvm.git ./nvm
fi

source ./nvm/nvm.sh && nvm install ${NODE_VERSION}

if [ "$CIRCLE_BRANCH" == "master" ]; then
    source ./nvm/nvm.sh && nvm use ${NODE_VERSION} && npm update
else
    source ./nvm/nvm.sh && nvm use ${NODE_VERSION} && npm install
fi
