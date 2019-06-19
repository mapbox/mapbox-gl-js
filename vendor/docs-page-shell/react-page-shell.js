/* eslint-disable */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = _interopDefault(require('react'));
var PropTypes = _interopDefault(require('prop-types'));
var Helmet = require('react-helmet');
var Helmet__default = _interopDefault(Helmet);

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  if (superClass) _setPrototypeOf(subClass, superClass);
}

function _getPrototypeOf(o) {
  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
    return o.__proto__ || Object.getPrototypeOf(o);
  };
  return _getPrototypeOf(o);
}

function _setPrototypeOf(o, p) {
  _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };

  return _setPrototypeOf(o, p);
}

function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return self;
}

function _possibleConstructorReturn(self, call) {
  if (call && (typeof call === "object" || typeof call === "function")) {
    return call;
  }

  return _assertThisInitialized(self);
}

function BrowserCompatibilityWarning() {
  return React.createElement("div", {
    className: "shell-wrapper",
    id: "page-shell-compatibility-warning",
    style: {
      display: 'none'
    },
    "data-swiftype-index": "false"
  }, React.createElement("div", {
    className: "shell-py12 shell-px24 shell-bg-pink shell-color-white shell-align-l"
  }, React.createElement("button", {
    className: "shell-absolute shell-top shell-right shell-p12",
    id: "page-shell-compatibility-dismiss"
  }, React.createElement("svg", {
    className: "shell-icon",
    viewBox: "0 0 18 18"
  }, React.createElement("path", {
    d: "M5.8,5C5.4,5,5,5.4,5,5.8C5,6,5.1,6.2,5.3,6.3l0,0L7.9,9l-2.6,2.6C5.1,11.8,5,12,5,12.2C5,12.6,5.4,13,5.8,13 c0.2,0,0.4-0.1,0.6-0.3L9,10.1l2.6,2.6c0.1,0.2,0.4,0.3,0.6,0.3c0.4,0,0.8-0.4,0.8-0.8c0-0.2-0.1-0.4-0.2-0.6L10.1,9l2.6-2.7 C12.9,6.2,13,6,13,5.8C13,5.4,12.6,5,12.2,5c-0.2,0-0.4,0.1-0.6,0.2L9,7.8L6.4,5.2C6.2,5.1,6,5,5.8,5L5.8,5z"
  }))), React.createElement("div", {
    className: "limiter shell-block shell-relative"
  }, React.createElement("div", {
    className: "compatibility-warning-copy shell-mb6 shell-mb0-mm shell-align-center shell-align-l-mm shell-txt-bold"
  }, "You are using an outdated browser and will encounter some problems with our website. Please consider upgrading."), React.createElement("div", {
    className: "compatibility-warning-action shell-align-center"
  }, React.createElement("a", {
    className: "shell-btn shell-btn--white shell-color-pink shell-txt-nowrap",
    href: "http://outdatedbrowser.com"
  }, "Upgrade Now")))));
}

function PageHelmet() {
  return React.createElement(Helmet.Helmet, null, React.createElement("meta", {
    charSet: "utf-8"
  }), React.createElement("meta", {
    name: "viewport",
    content: "width=device-width, initial-scale=1"
  }), React.createElement("link", {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: "https://static-assets.mapbox.com/branding/favicon/v1/apple-touch-icon.png?v=gAd4JjrGWl"
  }), React.createElement("link", {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "https://static-assets.mapbox.com/branding/favicon/v1/favicon-32x32.png?v=gAd4JjrGWl"
  }), React.createElement("link", {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "https://static-assets.mapbox.com/branding/favicon/v1/favicon-16x16.png?v=gAd4JjrGWl"
  }), React.createElement("link", {
    rel: "manifest",
    href: "https://static-assets.mapbox.com/branding/favicon/v1/site.webmanifest?v=gAd4JjrGWl"
  }), React.createElement("link", {
    rel: "mask-icon",
    href: "https://static-assets.mapbox.com/branding/favicon/v1/safari-pinned-tab.svg?v=gAd4JjrGWl",
    color: "#4264fb"
  }), React.createElement("link", {
    rel: "shortcut icon",
    href: "https://static-assets.mapbox.com/branding/favicon/v1/favicon.ico?v=gAd4JjrGWl"
  }), React.createElement("meta", {
    name: "msapplication-TileColor",
    content: "#ffffff"
  }), React.createElement("meta", {
    name: "msapplication-config",
    content: "https://static-assets.mapbox.com/branding/favicon/v1/browserconfig.xml?v=gAd4JjrGWl"
  }), React.createElement("meta", {
    name: "theme-color",
    content: "#ffffff"
  }), React.createElement("meta", {
    name: "p:domain_verify",
    content: "57838af58c8045c2c024bc2f9d1577f9"
  }), React.createElement("meta", {
    name: "google-site-verification",
    content: "umPiCFUc_EX8CJ7xWQDPgQwApDxNi59w6riFZPNZj4w"
  }), React.createElement("meta", {
    name: "twitter:site",
    content: "@Mapbox"
  }), React.createElement("meta", {
    property: "og:site_name",
    content: "Mapbox"
  }));
}

var shellStyles = {
  // Header names
  headerMenuName: 'shell-txt-s shell-txt-s-mxl shell-txt-bold shell-txt-nowrap shell-py6',
  // Medium to X-large navigation
  navigationItem: 'shell-mx6 shell-mx9-ml shell-mx18-mxl',
  // Medium to X-large navigation popup menu
  popupMenuBody: 'shell-shadow-darken10-bold shell-bg-white shell-absolute shell-inline-block shell-round shell-txt-s',
  popupMenuNavHeading: 'shell-txt-uppercase shell-txt-s shell-txt-spacing1 shell-txt-fancy shell-color-light-blue',
  popupMenuLink: 'shell-txt-bold shell-color-blue-on-hover shell-color-gray-dark',
  // User menu popup
  userNavLink: 'shell-color-gray-dark shell-color-blue-on-hover shell-txt-s shell-txt-bold shell-my12 shell-block',
  userAvatar: 'shell-border shell-border--2 shell-border--white shell-h30 shell-w30 shell-bg-darken25 shell-clip shell-round-full'
};

function PopupMenu(props) {
  var name = props.name,
      darkText = props.darkText,
      children = props.children;
  var menuNameClasses = shellStyles.headerMenuName;
  menuNameClasses += darkText ? ' shell-navigation-menu-button shell-transition shell-color-gray-dark shell-color-blue-on-hover' : ' shell-navigation-menu-button shell-link shell-link--white';
  return React.createElement("div", {
    style: {
      lineHeight: 1
    }
  }, React.createElement("div", {
    id: "".concat(name, "-menu"),
    className: "shell-relative ".concat(shellStyles.navigationItem)
  }, React.createElement("button", {
    id: "".concat(name, "-menu-trigger"),
    "data-nav-trigger": name,
    "data-test": "nav-menu-trigger-".concat(name),
    "aria-haspopup": "true",
    "aria-controls": "".concat(name, "-menu-container"),
    "aria-expanded": "false",
    "aria-label": "".concat(name, " menu"),
    className: menuNameClasses
  }, name)), React.createElement("div", {
    id: "".concat(name, "-menu-container"),
    "data-nav-menu": name,
    "data-test": "nav-menu-".concat(name),
    role: "group",
    "aria-labelledby": "".concat(name, "-menu-trigger"),
    className: "shell-absolute shell-z2 shell-disable-text-size-adjust shell-w-full shell-animated-menu",
    style: {
      right: 0,
      top: '100%',
      marginTop: '14px'
    }
  }, React.createElement("div", {
    "data-nav-pointer": name,
    className: "shell-triangle-wide shell-triangle-wide--u shell-color-white shell-z5 shell-animated-menu__pointer",
    style: {
      position: 'absolute',
      top: 0
    }
  }), React.createElement("div", {
    className: shellStyles.popupMenuBody,
    "data-nav-menu-body": name
  }, children)));
}

PopupMenu.propTypes = {
  darkText: PropTypes.bool,
  name: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};
PopupMenu.defaultProps = {
  darkText: true
};

var immutable = extend;
var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
  var target = {};

  for (var i = 0; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
}

var nonMobile = {
  maps: {
    sdks: {
      title: 'Maps SDKs',
      links: [{
        name: 'for iOS',
        to: 'https://docs.mapbox.com/ios/maps/overview/'
      }, {
        name: 'for Android',
        to: 'https://docs.mapbox.com/android/maps/overview/'
      }, {
        name: 'for Unity',
        to: 'https://docs.mapbox.com/unity/maps/overview/'
      }]
    },
    links: [{
      name: 'Mapbox GL JS',
      to: 'https://docs.mapbox.com/mapbox-gl-js/'
    }, {
      name: 'Mapbox Studio',
      to: 'https://docs.mapbox.com/studio-manual/overview/'
    }, {
      name: 'Mapbox Style Spec',
      to: 'https://docs.mapbox.com/mapbox-gl-js/style-spec/'
    }, {
      name: 'Vector tiles',
      to: 'https://docs.mapbox.com/vector-tiles/'
    }, {
      name: 'Maps APIs',
      to: 'https://docs.mapbox.com/api/maps/'
    }]
  },
  navigation: {
    sdks: {
      title: 'Navigation SDKs',
      links: [{
        name: 'for iOS',
        to: 'https://docs.mapbox.com/ios/navigation/overview/'
      }, {
        name: 'for Android',
        to: 'https://docs.mapbox.com/android/navigation/overview/'
      }]
    },
    links: [{
      name: 'Directions APIs',
      to: 'https://docs.mapbox.com/api/navigation/'
    }]
  },
  search: {
    links: [{
      name: 'Geocoding API',
      to: 'https://docs.mapbox.com/api/search/'
    }]
  },
  help: {
    links: [{
      name: 'How Mapbox works',
      to: 'https://docs.mapbox.com/help/how-mapbox-works/'
    }, {
      name: 'Tutorials',
      to: 'https://docs.mapbox.com/help/tutorials/'
    }, {
      name: 'Troubleshooting',
      to: 'https://docs.mapbox.com/help/troubleshooting/'
    }, {
      name: 'Glossary',
      to: 'https://docs.mapbox.com/help/glossary/'
    }, {
      name: 'Account FAQ',
      to: 'https://docs.mapbox.com/help/account-faq/'
    }, {
      name: 'API playground',
      to: 'https://docs.mapbox.com/api-playground/'
    }]
  }
};
var mobile = {
  maps: {
    links: nonMobile.maps.sdks.links.map(function (item) {
      return immutable(item, {
        name: "SDK ".concat(item.name)
      });
    }).concat(nonMobile.maps.links)
  },
  navigation: {
    links: nonMobile.navigation.sdks.links.map(function (item) {
      return immutable(item, {
        name: "SDK ".concat(item.name)
      });
    }).concat(nonMobile.navigation.links)
  },
  search: nonMobile.search,
  help: nonMobile.help
};
var navigationMenuData = {
  nonMobile: nonMobile,
  mobile: mobile
};

function LinkList(props) {
  var title = props.title,
      links = props.links,
      bullets = props.bullets;
  var navigationHeading = !title ? null : React.createElement("div", {
    className: "".concat(shellStyles.popupMenuNavHeading, " shell-mb12")
  }, title);
  var ulClasses = bullets ? 'shell-txt-ul shell-ml24' : '';
  var linkListItems = React.createElement("ul", {
    className: ulClasses
  }, links.map(function (link, i) {
    var liClasses = i === 0 ? '' : 'shell-mt12';
    if (bullets) liClasses += ' shell-txt-li';
    return React.createElement("li", {
      key: i,
      className: liClasses
    }, React.createElement("a", {
      href: link.to,
      "data-nav-link": true,
      className: shellStyles.popupMenuLink
    }, link.name));
  }));
  return React.createElement("div", null, navigationHeading, linkListItems);
}

LinkList.propTypes = {
  title: PropTypes.string,
  links: PropTypes.arrayOf(PropTypes.shape({
    to: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  })).isRequired,
  bullets: PropTypes.bool
};
LinkList.defaultProps = {
  bullets: false
};

var navItems = navigationMenuData.nonMobile.search.links;

function SearchMenu(props) {
  return React.createElement(PopupMenu, _extends({}, props, {
    name: "Search"
  }), React.createElement("div", {
    className: "shell-py30 shell-px30"
  }, React.createElement(LinkList, {
    links: navItems
  })));
}

var navItems$1 = navigationMenuData.nonMobile.help.links;

function HelpMenu(props) {
  return React.createElement(PopupMenu, _extends({}, props, {
    name: "Help"
  }), React.createElement("div", {
    className: "shell-py30 shell-px30"
  }, React.createElement(LinkList, {
    links: navItems$1
  })));
}

var menuData = navigationMenuData.nonMobile.maps;
var standardLinks = menuData.links;

function MapsMenu(props) {
  var sdkEls = React.createElement(LinkList, {
    title: menuData.sdks.title,
    links: menuData.sdks.links,
    bullets: true
  });
  var standardLinkEls = React.createElement(LinkList, {
    links: standardLinks
  });
  return React.createElement(PopupMenu, _extends({}, props, {
    name: "Maps"
  }), React.createElement("div", {
    className: "shell-py30 shell-px30 w360"
  }, React.createElement("div", {
    className: "shell-grid shell-grid--gut24"
  }, React.createElement("div", {
    className: "shell-col shell-col--6"
  }, sdkEls), React.createElement("div", {
    className: "shell-col shell-col--6"
  }, standardLinkEls))));
}

var menuData$1 = navigationMenuData.nonMobile.navigation;
var standardLinks$1 = menuData$1.links;

function NavigationMenu(props) {
  var sdkEls = React.createElement(LinkList, {
    title: menuData$1.sdks.title,
    links: menuData$1.sdks.links,
    bullets: true
  });
  var standardLinkEls = React.createElement(LinkList, {
    links: standardLinks$1
  });
  return React.createElement(PopupMenu, _extends({}, props, {
    name: "Navigation"
  }), React.createElement("div", {
    className: "shell-py30 shell-px30 w360"
  }, React.createElement("div", {
    className: "shell-grid shell-grid--gut24"
  }, React.createElement("div", {
    className: "shell-col shell-col--6"
  }, sdkEls), React.createElement("div", {
    className: "shell-col shell-col--6"
  }, standardLinkEls))));
}

function NavigationItem(props) {
  var colorBasedClasses = props.darkText ? 'shell-navigation-menu-button shell-color-gray-dark shell-color-blue-on-hover' : 'shell-navigation-menu-button shell-link shell-link--white';
  return React.createElement("div", {
    className: "shell-flex-child ".concat(shellStyles.navigationItem),
    style: {
      lineHeight: 1
    }
  }, React.createElement("a", {
    className: "shell-py6 shell-txt-s shell-txt-bold ".concat(colorBasedClasses),
    "data-test": "nav-menu-item-".concat(props.name),
    href: props.href
  }, props.children));
}

NavigationItem.propTypes = {
  darkText: PropTypes.bool,
  name: PropTypes.string.isRequired,
  href: PropTypes.string.isRequired,
  children: PropTypes.string.isRequired
};

function MobileMenuButton(props) {
  var menuButtonClasses = 'shell-block';

  if (!props.darkText) {
    menuButtonClasses += ' shell-link shell-link--white';
  } else {
    menuButtonClasses += ' shell-color-blue';
  }

  return React.createElement("button", {
    id: "mobile-nav-trigger-toggle",
    "aria-label": "Toggle navigation",
    className: menuButtonClasses,
    "data-test": "mobile-nav-trigger-toggle"
  }, React.createElement("svg", {
    id: "mobile-nav-trigger-menu",
    viewBox: "0 0 18 18",
    className: "shell-mobile-nav__trigger shell-icon shell-transition shell-icon--l"
  }, React.createElement("g", null, React.createElement("path", {
    className: "shell-mobile-nav__trigger__bar--top",
    d: "M4.2,6h9.6C14.5,6,15,5.6,15,5s-0.5-1-1.2-1H4.2C3.5,4,3,4.4,3,5S3.5,6,4.2,6z"
  }), React.createElement("path", {
    className: "shell-mobile-nav__trigger__bar--middle",
    d: "M13.8,8H4.2C3.5,8,3,8.4,3,9s0.5,1,1.2,1h9.6c0.7,0,1.2-0.4,1.2-1S14.5,8,13.8,8z"
  }), React.createElement("path", {
    className: "shell-mobile-nav__trigger__bar--bottom",
    d: "M13.8,12H4.2C3.5,12,3,12.4,3,13s0.5,1,1.2,1h9.6c0.7,0,1.2-0.4,1.2-1S14.5,12,13.8,12z"
  }))));
}

MobileMenuButton.propTypes = {
  darkText: PropTypes.bool
};

function MobileLinkList(props) {
  var title = props.title,
      links = props.links;
  var navigationHeading = !title ? null : React.createElement("div", {
    className: "".concat(shellStyles.popupMenuNavHeading)
  }, title);
  var ulClasses = 'shell-txt-s shell-grid shell-grid--gut12';
  if (navigationHeading) ulClasses += ' shell-mb6';
  var linkListItems = React.createElement("div", {
    className: ulClasses
  }, links.map(function (link, i) {
    return React.createElement("div", {
      key: i,
      className: "shell-col shell-col--6 shell-mt6"
    }, React.createElement("a", {
      href: link.to,
      "data-nav-link": true,
      className: "shell-color-gray-dark"
    }, link.name));
  }));
  return React.createElement("div", null, navigationHeading, linkListItems);
}

MobileLinkList.propTypes = {
  title: PropTypes.string,
  links: PropTypes.arrayOf(PropTypes.shape({
    to: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  })).isRequired
};

var ORIGIN_DOCS_PRODUCTION = 'https://docs.mapbox.com';
var DEFAULT_SOCIAL_IMAGE_URL = 'https://static-assets.mapbox.com/branding/social/social-1200x630.v1.png';
var DEFAULT_SOCIAL_IMAGE_THUMBNAIL_URL = 'https://static-assets.mapbox.com/branding/social/social-120x120.v1.png';

var MOBILE_HEADER_HEIGHT = 72;

function MobileNavigation() {
  return React.createElement("div", {
    className: "shell-z1 shell-absolute shell-top shell-left shell-right shell-w-full"
  }, React.createElement("div", {
    id: "mobile-nav-backdrop",
    "data-test": "mobile-nav-backdrop",
    className: "shell-absolute shell-bottom shell-left shell-right shell-mobile-nav__backdrop",
    style: {
      top: MOBILE_HEADER_HEIGHT,
      backgroundImage: "linear-gradient(to bottom, transparent, rgba(31, 51, 73, .5))"
    }
  }), React.createElement("div", {
    id: "mobile-nav-menu",
    "data-test": "mobile-nav-menu",
    className: "shell-absolute shell-z5 shell-w-full shell-animated-menu",
    style: {
      top: 0,
      right: 0
    }
  }, React.createElement("div", {
    className: "shell-shadow-darken10-bold shell-bg-white shell-clip shell-px24",
    style: {
      paddingTop: MOBILE_HEADER_HEIGHT
    }
  }, React.createElement("div", {
    className: "shell-pb24"
  }, React.createElement(MobileLinkList, {
    title: "Maps",
    links: navigationMenuData.mobile.maps.links
  }), React.createElement("div", {
    className: "shell-mt24"
  }, React.createElement(MobileLinkList, {
    title: "Navigation",
    links: navigationMenuData.mobile.navigation.links
  })), React.createElement("div", {
    className: "shell-mt24"
  }, React.createElement(MobileLinkList, {
    title: "Search",
    links: navigationMenuData.mobile.search.links
  })), React.createElement("div", {
    className: "shell-mt24"
  }, React.createElement(MobileLinkList, {
    title: "Help",
    links: navigationMenuData.mobile.help.links
  }))), React.createElement("div", {
    className: "shell-border-t shell-border--gray-light shell-py24"
  }, React.createElement("a", {
    href: ORIGIN_DOCS_PRODUCTION,
    className: "shell-color-blue"
  }, "All docs")))));
}

function Logo(props) {
  var darkText = props.darkText,
      mini = props.mini;
  var logoClasses = 'shell-flex-child shell-mb-logo';

  if (!darkText) {
    logoClasses += ' shell-mb-logo--white';
  }

  var logoStyles = {};

  if (mini) {
    logoStyles.width = 30;
  }

  var border = null;

  if (!mini) {
    var borderClasses = 'shell-flex-child shell-h24 shell-mx12';
    borderClasses += darkText ? ' shell-bg-blue' : ' shell-bg-white';
    border = React.createElement("div", {
      className: borderClasses,
      style: {
        width: 2
      },
      "data-subtitle-bar-dark": darkText
    });
  }

  var nameClasses = 'shell-flex-child shell-txt-bold shell-txt-l ';
  nameClasses += darkText ? ' shell-color-blue shell-color-blue-dark-on-hover' : ' shell-link shell-link--white';

  if (mini) {
    nameClasses += ' shell-ml6';
  }

  return React.createElement("div", {
    className: "shell-flex-parent shell-flex-parent--center-cross"
  }, React.createElement("a", {
    href: "https://www.mapbox.com",
    "aria-label": "Mapbox",
    className: logoClasses,
    style: logoStyles
  }), border, React.createElement("a", {
    href: ORIGIN_DOCS_PRODUCTION,
    className: nameClasses,
    style: {
      marginBottom: 2
    },
    "data-subtitle-dark": darkText
  }, "Docs"));
}

Logo.propTypes = {
  darkText: PropTypes.bool,
  mini: PropTypes.bool
};
Logo.defaultProps = {
  darkText: false,
  mini: false
};

var USER_MENU_WIDTH = 66;

function PageHeader(props) {
  var logoOverlay = null;

  if (!props.darkText) {
    logoOverlay = React.createElement("div", {
      className: "shell-mobile-nav__logo--overlay shell-absolute shell-top shell-left"
    }, React.createElement(Logo, {
      darkText: true,
      mini: true
    }));
  }

  return React.createElement("header", {
    className: "shell-absolute shell-w-full shell-z1",
    "data-swiftype-index": "false"
  }, React.createElement("div", {
    className: "shell-none limiter shell-mt24 shell-flex-parent-mm shell-flex-parent--center-cross"
  }, React.createElement(Logo, {
    darkText: props.darkText
  }), React.createElement("div", {
    className: "shell-flex-child shell-flex-child--grow shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main"
  }, React.createElement("div", {
    className: "shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main"
  }, React.createElement(MapsMenu, {
    darkText: props.darkText
  }), React.createElement(NavigationMenu, {
    darkText: props.darkText
  }), React.createElement(SearchMenu, {
    darkText: props.darkText
  }), React.createElement(NavigationItem, {
    href: ORIGIN_DOCS_PRODUCTION,
    darkText: props.darkText,
    name: "all"
  }, "All docs"), React.createElement(HelpMenu, {
    darkText: props.darkText
  }))), React.createElement("div", {
    className: "shell-flex-child shell-ml6 shell-ml12-ml shell-ml18-mxl"
  }, React.createElement("div", {
    id: "mbx-user-menu",
    style: {
      width: USER_MENU_WIDTH
    },
    "data-user-menu-trigger": true
  }))), React.createElement("div", {
    id: "page-header-content",
    className: "shell-none-mm limiter shell-py12 shell-z2 shell-relative"
  }, React.createElement("div", {
    className: "shell-flex-parent shell-flex-parent--center-cross"
  }, React.createElement("div", {
    className: "shell-flex-child shell-flex-child--no-shrink shell-ml-neg6"
  }, React.createElement(MobileMenuButton, {
    darkText: props.darkText
  })), React.createElement("div", {
    className: "shell-flex-child shell-flex-child--grow shell-relative shell-mb-logo__wrapper shell-ml12"
  }, React.createElement(Logo, {
    darkText: props.darkText,
    mini: true
  }), logoOverlay), React.createElement("div", {
    className: "shell-flex-child shell-flex-child--no-shrink"
  }, React.createElement("div", {
    id: "mbx-user-menu-mobile",
    style: {
      width: USER_MENU_WIDTH
    },
    "data-user-menu-trigger": true
  })))), React.createElement(MobileNavigation, null));
}

PageHeader.propTypes = {
  darkText: PropTypes.bool
};
PageHeader.defaultProps = {
  darkText: false
};

function FooterLegalStrip(props) {
  return React.createElement("div", {
    className: props.className
  }, React.createElement("a", {
    className: "shell-link shell-color-gray shell-color-gray-dark-on-hover shell-mr18",
    href: "https://www.mapbox.com/"
  }, "\xA9 Mapbox"), React.createElement("a", {
    className: "shell-link shell-color-gray shell-color-gray-dark-on-hover shell-mr18",
    href: "https://www.mapbox.com/tos/"
  }, "Terms"), React.createElement("a", {
    className: "shell-link shell-color-gray shell-color-gray-dark-on-hover shell-mr18",
    href: "https://www.mapbox.com/privacy/"
  }, "Privacy"), React.createElement("a", {
    className: "shell-link shell-color-gray shell-color-gray-dark-on-hover",
    href: "https://www.mapbox.com/platform/security/"
  }, "Security"));
}

FooterLegalStrip.propTypes = {
  className: PropTypes.string
};

function FooterSocialMediaStrip(props) {
  return React.createElement("div", {
    className: props.className
  }, React.createElement("a", {
    "aria-label": "Github",
    className: "shell-color-blue shell-color-blue-dark-on-hover",
    href: "https://github.com/mapbox"
  }, React.createElement("svg", {
    viewBox: "0 0 1790 1790",
    className: "shell-mr18 shell-icon shell-icon--s shell-inline"
  }, React.createElement("path", {
    d: "M704 1216q0 40-12.5 82t-43 76-72.5 34-72.5-34-43-76-12.5-82 12.5-82 43-76 72.5-34 72.5 34 43 76 12.5 82zm640 0q0 40-12.5 82t-43 76-72.5 34-72.5-34-43-76-12.5-82 12.5-82 43-76 72.5-34 72.5 34 43 76 12.5 82zm160 0q0-120-69-204t-187-84q-41 0-195 21-71 11-157 11t-157-11q-152-21-195-21-118 0-187 84t-69 204q0 88 32 153.5t81 103 122 60 140 29.5 149 7h168q82 0 149-7t140-29.5 122-60 81-103 32-153.5zm224-176q0 207-61 331-38 77-105.5 133t-141 86-170 47.5-171.5 22-167 4.5q-78 0-142-3t-147.5-12.5-152.5-30-137-51.5-121-81-86-115q-62-123-62-331 0-237 136-396-27-82-27-170 0-116 51-218 108 0 190 39.5t189 123.5q147-35 309-35 148 0 280 32 105-82 187-121t189-39q51 102 51 218 0 87-27 168 136 160 136 398z"
  }))), React.createElement("a", {
    "aria-label": "Twitter",
    className: "shell-color-blue shell-color-blue-dark-on-hover ",
    href: "https://twitter.com/mapbox/"
  }, React.createElement("svg", {
    viewBox: "0 0 50 50",
    className: "shell-mr18 shell-icon shell-icon--s shell-inline"
  }, React.createElement("g", {
    id: "77744030-a5d8-4d71-88ad-2c70d4dcad7b",
    "data-name": "svg"
  }, React.createElement("path", {
    d: "M15.72,45.31c18.87,0,29.19-15.63,29.19-29.19,0-.44,0-.89,0-1.33A20.87,20.87,0,0,0,50,9.49a20.48,20.48,0,0,1-5.89,1.61,10.29,10.29,0,0,0,4.51-5.67A20.56,20.56,0,0,1,42.1,7.92a10.27,10.27,0,0,0-17.48,9.36A29.12,29.12,0,0,1,3.48,6.56,10.27,10.27,0,0,0,6.66,20.25,10.18,10.18,0,0,1,2,19v.13a10.26,10.26,0,0,0,8.23,10.06,10.24,10.24,0,0,1-4.63.18,10.27,10.27,0,0,0,9.58,7.12,20.58,20.58,0,0,1-12.74,4.4A20.88,20.88,0,0,1,0,40.71a29,29,0,0,0,15.72,4.6"
  })))), React.createElement("a", {
    "aria-label": "LinkedIn",
    className: "shell-color-blue shell-color-blue-dark-on-hover",
    href: "https://www.linkedin.com/company/mapbox"
  }, React.createElement("svg", {
    viewBox: "0 0 50 50",
    className: "shell-mr18 shell-icon shell-icon--s shell-inline"
  }, React.createElement("g", {
    id: "875e301f-501b-48d2-a663-a3a855ad9d70",
    "data-name": "svg"
  }, React.createElement("rect", {
    x: "1.32",
    y: "13.16",
    width: "10.53",
    height: "36.84"
  }), React.createElement("path", {
    d: "M36.84,13.16c-7.34,0-8.61,2.68-9.21,5.26V13.16H17.11V50H27.63V28.95c0-3.41,1.85-5.26,5.26-5.26s5.26,1.81,5.26,5.26V50H48.68V31.58C48.68,21.05,47.31,13.16,36.84,13.16Z"
  }), React.createElement("circle", {
    cx: "6.58",
    cy: "5.26",
    r: "5.26"
  })))), React.createElement("a", {
    "aria-label": "Facebook",
    className: "shell-color-blue shell-color-blue-dark-on-hover",
    href: "https://www.facebook.com/Mapbox"
  }, React.createElement("svg", {
    viewBox: "0 0 50 50",
    className: "shell-mr18 shell-icon shell-icon--s shell-inline"
  }, React.createElement("g", {
    id: "38f48a9c-03c5-4a1e-8aed-38100e1cd6a4",
    "data-name": "svg"
  }, React.createElement("path", {
    id: "c5d5da0e-6004-406b-ad77-825ffd134c21",
    "data-name": "f",
    d: "M28.87,50V27.19h7.65l1.15-8.89h-8.8V12.63c0-2.57.71-4.33,4.41-4.33H38v-8A63.78,63.78,0,0,0,31.13,0C24.34,0,19.69,4.14,19.69,11.75V18.3H12v8.89h7.68V50Z"
  })))), React.createElement("a", {
    "aria-label": "Dribbble",
    className: "shell-color-blue shell-color-blue-dark-on-hover",
    href: "https://dribbble.com/mapbox"
  }, React.createElement("svg", {
    viewBox: "0 0 216 216",
    className: "shell-mr18 shell-icon shell-icon--s shell-inline"
  }, React.createElement("g", {
    id: "bce6e84c-15aa-4744-93d1-a9e4a673398a",
    "data-name": "ball"
  }, React.createElement("g", {
    id: "99079e24-a239-40f3-bf61-84ebc8f0b2ce",
    "data-name": "ball"
  }, React.createElement("path", {
    d: "M108,15.78a92.16,92.16,0,1,0,92.16,92.16A92.27,92.27,0,0,0,108,15.78ZM169,58.28a78.31,78.31,0,0,1,17.78,49c-2.6-.55-28.62-5.83-54.81-2.54-.55-1.35-1.12-2.7-1.7-4.06-1.63-3.84-3.39-7.65-5.22-11.4C154.1,77.44,167.29,60.53,169,58.28ZM108,29.34A78.41,78.41,0,0,1,160.2,49.18c-1.41,2-13.26,17.94-41.25,28.43A421.91,421.91,0,0,0,89.58,31.53,79,79,0,0,1,108,29.34ZM74.56,36.82a503.63,503.63,0,0,1,29.18,45.53A293.82,293.82,0,0,1,31,91.94,79,79,0,0,1,74.56,36.82ZM29.31,108.06c0-.8,0-1.61,0-2.41,3.44.08,41.59.57,80.9-11.2,2.25,4.41,4.4,8.89,6.38,13.36-1,.29-2.08.61-3.1.94-40.6,13.12-62.2,48.89-64,51.94A78.39,78.39,0,0,1,29.31,108.06ZM108,186.78a78.29,78.29,0,0,1-48.31-16.62c1.41-2.9,17.35-33.69,61.75-49.16l.52-.17a326.92,326.92,0,0,1,16.79,59.69A78.19,78.19,0,0,1,108,186.78Zm44-13.47a338.31,338.31,0,0,0-15.29-56.12c24.67-4,46.34,2.51,49,3.36A78.84,78.84,0,0,1,152,173.31Z"
  }))))), React.createElement("a", {
    "aria-label": "Instagram",
    className: "shell-color-blue shell-color-blue-dark-on-hover",
    href: "https://www.instagram.com/Mapbox"
  }, React.createElement("svg", {
    viewBox: "0 0 50 50",
    className: "shell-icon shell-icon--s shell-inline"
  }, React.createElement("g", {
    id: "fb2f6c01-da64-4dee-86ea-29fec95d4f45",
    "data-name": "svg"
  }, React.createElement("path", {
    d: "M25,0c-6.79,0-7.64,0-10.31.15A18.35,18.35,0,0,0,8.62,1.31,12.25,12.25,0,0,0,4.2,4.2,12.25,12.25,0,0,0,1.31,8.62,18.35,18.35,0,0,0,.15,14.69C0,17.36,0,18.21,0,25s0,7.64.15,10.31a18.35,18.35,0,0,0,1.16,6.07A12.26,12.26,0,0,0,4.2,45.8a12.25,12.25,0,0,0,4.43,2.88,18.35,18.35,0,0,0,6.07,1.16C17.36,50,18.21,50,25,50s7.64,0,10.31-.15a18.35,18.35,0,0,0,6.07-1.16,12.78,12.78,0,0,0,7.31-7.31,18.35,18.35,0,0,0,1.16-6.07C50,32.64,50,31.79,50,25s0-7.64-.15-10.31a18.35,18.35,0,0,0-1.16-6.07A12.25,12.25,0,0,0,45.8,4.2a12.26,12.26,0,0,0-4.43-2.88A18.35,18.35,0,0,0,35.31.15C32.64,0,31.79,0,25,0Zm0,4.5c6.68,0,7.47,0,10.1.15a13.83,13.83,0,0,1,4.64.86,7.75,7.75,0,0,1,2.87,1.87,7.75,7.75,0,0,1,1.87,2.87,13.83,13.83,0,0,1,.86,4.64c.12,2.64.15,3.43.15,10.1s0,7.47-.15,10.1a13.83,13.83,0,0,1-.86,4.64,8.28,8.28,0,0,1-4.74,4.74,13.83,13.83,0,0,1-4.64.86c-2.64.12-3.43.15-10.1.15s-7.47,0-10.1-.15a13.83,13.83,0,0,1-4.64-.86,7.74,7.74,0,0,1-2.87-1.87,7.75,7.75,0,0,1-1.87-2.87,13.83,13.83,0,0,1-.86-4.64C4.53,32.47,4.5,31.68,4.5,25s0-7.47.15-10.1a13.83,13.83,0,0,1,.86-4.64A7.75,7.75,0,0,1,7.38,7.38a7.75,7.75,0,0,1,2.87-1.87,13.83,13.83,0,0,1,4.64-.86c2.64-.12,3.43-.15,10.1-.15"
  }), React.createElement("path", {
    d: "M25,33.33A8.33,8.33,0,1,1,33.33,25,8.33,8.33,0,0,1,25,33.33Zm0-21.17A12.84,12.84,0,1,0,37.84,25,12.84,12.84,0,0,0,25,12.16Z"
  }), React.createElement("path", {
    d: "M41.35,11.65a3,3,0,1,1-3-3,3,3,0,0,1,3,3Z"
  })))));
}

FooterSocialMediaStrip.propTypes = {
  className: PropTypes.string
};

function PageFooter() {
  return React.createElement("footer", {
    id: "page-footer",
    className: "shell-py12 shell-py48-ml",
    "data-swiftype-index": "false"
  }, React.createElement("div", {
    className: "limiter"
  }, React.createElement("div", {
    id: "page-footer-legal-social",
    className: "shell-grid shell-txt-s shell-color-gray shell-py12 shell-py0-ml"
  }, React.createElement(FooterLegalStrip, {
    className: "shell-col shell-col--12 shell-col--6-mm shell-my12"
  }), React.createElement(FooterSocialMediaStrip, {
    className: "shell-col shell-col--12 shell-col--6-mm shell-my12 shell-align-r-mm"
  }))));
}

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var titleGenerator_1 = createCommonjsModule(function (module, exports) {

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.titleGenerator = titleGenerator;

function titleGenerator(title, subsite, site) {
  // create array for formatted title: {title} | {subsite} | {site}
  var titleArr = []; // do not push a title that is "Introduction"

  if (title && title !== 'Introduction' && (subsite || site)) titleArr.push(title); // push subsite, if same value doesn't exist yet, strip "for (Product)" from name

  if (subsite && titleArr.indexOf(subsite) === -1) titleArr.push(subsite.replace(/\sfor\s(iOS|Android|Vision|Unity)/, '')); // push site, if same value doesn't exist yet

  if (site && titleArr.indexOf(site) === -1) titleArr.push(site);
  return titleArr;
}
});

unwrapExports(titleGenerator_1);
var titleGenerator_2 = titleGenerator_1.titleGenerator;

var removeMarkdown = function (md, options) {
  options = options || {};
  options.listUnicodeChar = options.hasOwnProperty('listUnicodeChar') ? options.listUnicodeChar : false;
  options.stripListLeaders = options.hasOwnProperty('stripListLeaders') ? options.stripListLeaders : true;
  options.gfm = options.hasOwnProperty('gfm') ? options.gfm : true;
  options.useImgAltText = options.hasOwnProperty('useImgAltText') ? options.useImgAltText : true;
  var output = md || ''; // Remove horizontal rules (stripListHeaders conflict with this rule, which is why it has been moved to the top)

  output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, '');

  try {
    if (options.stripListLeaders) {
      if (options.listUnicodeChar) output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, options.listUnicodeChar + ' $1');else output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1');
    }

    if (options.gfm) {
      output = output // Header
      .replace(/\n={2,}/g, '\n') // Fenced codeblocks
      .replace(/~{3}.*\n/g, '') // Strikethrough
      .replace(/~~/g, '') // Fenced codeblocks
      .replace(/`{3}.*\n/g, '');
    }

    output = output // Remove HTML tags
    .replace(/<[^>]*>/g, '') // Remove setext-style headers
    .replace(/^[=\-]{2,}\s*$/g, '') // Remove footnotes?
    .replace(/\[\^.+?\](\: .*?$)?/g, '').replace(/\s{0,2}\[.*?\]: .*?$/g, '') // Remove images
    .replace(/\!\[(.*?)\][\[\(].*?[\]\)]/g, options.useImgAltText ? '$1' : '') // Remove inline links
    .replace(/\[(.*?)\][\[\(].*?[\]\)]/g, '$1') // Remove blockquotes
    .replace(/^\s{0,3}>\s?/g, '') // Remove reference-style links?
    .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '') // Remove atx-style headers
    .replace(/^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm, '$1$2$3') // Remove emphasis (repeat the line to remove double emphasis)
    .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2').replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2') // Remove code blocks
    .replace(/(`{3,})(.*?)\1/gm, '$2') // Remove inline code
    .replace(/`(.+?)`/g, '$1') // Replace two or more newlines with exactly two? Not entirely sure this belongs here...
    .replace(/\n{2,}/g, '\n\n');
  } catch (e) {
    console.error(e);
    return md;
  }

  return output;
};

function MetaTagger(props) {
  var title = titleGenerator_2(props.title, props.subsite, props.site).join(' | ');
  var suffixedTitle = "".concat(title, " | Mapbox");
  var preppedDescription = props.description.replace(/\s+/g, ' ');
  var prodUrl = 'https://www.mapbox.com';
  if (props.pathname[0] !== '/') prodUrl += '/';
  prodUrl += props.pathname;
  var metaItems = [{
    name: 'description',
    content: removeMarkdown(preppedDescription)
  }];
  metaItems.push({
    name: 'twitter:title',
    content: props.title
  }, {
    property: 'og:title',
    content: props.title
  }, {
    name: 'twitter:description',
    content: removeMarkdown(preppedDescription)
  }, {
    property: 'og:description',
    content: removeMarkdown(preppedDescription)
  }, {
    property: 'og:url',
    content: prodUrl
  }, {
    property: 'og:type',
    content: 'website'
  }, {
    class: 'swiftype',
    name: 'title',
    'data-type': 'string',
    content: props.title
  }, {
    class: 'swiftype',
    name: 'excerpt',
    'data-type': 'string',
    content: removeMarkdown(props.description)
  }, {
    name: 'twitter:image:alt',
    content: props.imageAlt
  }, {
    property: 'og:image',
    content: props.imageUrl
  }, {
    class: 'swiftype',
    name: 'image',
    'data-type': 'enum',
    content: props.imageUrl
  }, {
    class: 'swiftype',
    name: 'site',
    'data-type': 'string',
    content: props.site
  });

  if (props.subsite) {
    metaItems.push({
      class: 'swiftype',
      name: 'subsite',
      'data-type': 'string',
      content: props.subsite
    });
  }

  if (props.contentType) {
    metaItems.push({
      class: 'swiftype',
      name: 'contentType',
      'data-type': 'string',
      content: props.contentType
    });
  }

  if (props.language) {
    props.language.forEach(function (language) {
      metaItems.push({
        class: 'swiftype',
        name: 'codeLanguage',
        'data-type': 'string',
        content: language
      });
    });
  }

  if (props.level) {
    metaItems.push({
      class: 'swiftype',
      name: 'level',
      'data-type': 'string',
      content: props.level
    });
  }

  if (props.largeImage) {
    metaItems.push({
      name: 'twitter:card',
      content: 'summary_large_image'
    }, {
      name: 'twitter:image',
      content: props.imageUrl
    });
  } else {
    metaItems.push({
      name: 'twitter:card',
      content: 'summary'
    }, {
      name: 'twitter:image',
      content: props.imageUrlThumbnail
    });
  }

  if (props.hideFromSearchEngines) {
    metaItems.push({
      name: 'robots',
      content: 'noindex, nofollow'
    });
  }

  return React.createElement(Helmet__default, {
    title: suffixedTitle,
    meta: metaItems
  });
}

MetaTagger.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  pathname: PropTypes.string.isRequired,
  site: PropTypes.string.isRequired,
  subsite: PropTypes.string,
  contentType: PropTypes.string,
  imageUrl: PropTypes.string,
  imageUrlThumbnail: PropTypes.string,
  imageAlt: PropTypes.string,
  largeImage: PropTypes.bool,
  language: PropTypes.array,
  level: PropTypes.number,
  hideFromSearchEngines: PropTypes.bool
};
MetaTagger.defaultProps = {
  imageUrl: DEFAULT_SOCIAL_IMAGE_URL,
  imageUrlThumbnail: DEFAULT_SOCIAL_IMAGE_THUMBNAIL_URL,
  imageAlt: 'Mapbox',
  largeImage: true
};

var lastUrl;

var ReactPageShell =
/*#__PURE__*/
function (_React$Component) {
  _inherits(ReactPageShell, _React$Component);

  function ReactPageShell() {
    _classCallCheck(this, ReactPageShell);

    return _possibleConstructorReturn(this, _getPrototypeOf(ReactPageShell).apply(this, arguments));
  }

  _createClass(ReactPageShell, [{
    key: "componentDidMount",
    value: function componentDidMount() {
      if (!window.MapboxPageShell) throw new Error('MapboxPageShell not loaded');
      this.initialize();
    }
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate() {
      var currentUrl = window.location.href;
      if (currentUrl === lastUrl) return;
      lastUrl = currentUrl;
      this.initialize();
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      MapboxPageShell.removeNavigation();
    }
  }, {
    key: "initialize",
    value: function initialize() {
      var _this = this;

      MapboxPageShell.initialize();
      MapboxPageShell.afterUserCheck(function () {
        if (_this.props.onUser) {
          _this.props.onUser(MapboxPageShell.getUser(), MapboxPageShell.getUserPublicAccessToken());
        }

        MapboxPageShell.loadUserMenu({
          dark: _this.props.darkHeaderText
        });
      });
    }
  }, {
    key: "render",
    value: function render() {
      var nonFooterClasses = 'shell-flex-child shell-flex-child--grow shell-flex-child--no-shrink';

      if (this.props.nonFooterBgClass) {
        nonFooterClasses += " ".concat(this.props.nonFooterBgClass);
      }

      return React.createElement("div", {
        id: "page-shell"
      }, React.createElement(BrowserCompatibilityWarning, null), React.createElement("div", {
        className: "shell-flex-parent shell-flex-parent--column",
        style: {
          minHeight: '100vh',
          overflowX: 'hidden'
        }
      }, React.createElement(PageHelmet, null), React.createElement(MetaTagger, _extends({}, this.props.meta, {
        site: this.props.site,
        subsite: this.props.subsite
      })), React.createElement("div", {
        className: nonFooterClasses
      }, React.createElement("div", {
        className: "shell-wrapper"
      }, React.createElement(PageHeader, {
        darkText: this.props.darkHeaderText
      })), React.createElement("main", {
        style: {
          zIndex: 0,
          position: 'relative',
          display: 'block'
        }
      }, this.props.children)), React.createElement("div", {
        className: "shell-flex-child shell-flex-child--no-shrink shell-wrapper"
      }, React.createElement(PageFooter, null))));
    }
  }]);

  return ReactPageShell;
}(React.Component);

ReactPageShell.propTypes = {
  meta: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    contentType: PropTypes.string,
    pathname: PropTypes.string,
    level: PropTypes.number,
    codeLanguage: PropTypes.array,
    hideFromSearchEngines: PropTypes.bool
  }).isRequired,
  children: PropTypes.node.isRequired,
  site: PropTypes.string.isRequired,
  subsite: PropTypes.string,
  darkHeaderText: PropTypes.bool,
  nonFooterBgClass: PropTypes.string,
  onUser: PropTypes.func
};
ReactPageShell.defaultProps = {
  darkHeaderText: false
};

module.exports = ReactPageShell;
