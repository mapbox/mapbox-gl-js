const tabOrder = {
  overview: {
    title: 'Overview'
  },
  examples: {
    title: 'Examples'
  },
  'help': {
    title: 'Help'
  },
  api: {
    title: 'API Reference'
  },
  reference: {
    title: 'Reference'
  },
  'plugins': {
    title: 'Plugins'
  }
};

export function listTabs(arrayOfFolders) {
  let alltheTabs = arrayOfFolders
    .filter(folder => {
      return (
        folder.path.indexOf('404') < 0 &&
        folder.path.indexOf('style-spec') < 0
      );
    })
    .map(tab => {
      const tabId = tab.path.split('/')[2];
        return {
          label: tabOrder[tabId].title,
          id: tabId,
          href: tab.path
        };
    });
  let orderedTabs = [];
  Object.keys(tabOrder).forEach(function(key) {
    var found = false;
    alltheTabs = alltheTabs.filter(function(item) {
      if (!found && item.id == key) {
        orderedTabs.push(item);
        found = true;
        return false;
      } else return true;
    });
  });

  return orderedTabs;
}
