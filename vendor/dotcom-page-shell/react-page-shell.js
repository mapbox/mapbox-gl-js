/* eslint-disable */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = require('react');
var React__default = _interopDefault(React);
var PropTypes = _interopDefault(require('prop-types'));
var Helmet = require('react-helmet');
var Helmet__default = _interopDefault(Helmet);

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
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



var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var BrowserCompatibilityWarning = function (_React$Component) {
  inherits(BrowserCompatibilityWarning, _React$Component);

  function BrowserCompatibilityWarning() {
    classCallCheck(this, BrowserCompatibilityWarning);
    return possibleConstructorReturn(this, (BrowserCompatibilityWarning.__proto__ || Object.getPrototypeOf(BrowserCompatibilityWarning)).apply(this, arguments));
  }

  createClass(BrowserCompatibilityWarning, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: "render",
    value: function render() {
      return React__default.createElement(
        "div",
        {
          className: "shell-wrapper",
          id: "page-shell-compatibility-warning",
          style: { display: 'none' }
        },
        React__default.createElement(
          "div",
          { className: "shell-py12 shell-px24 shell-bg-pink shell-color-white shell-align-left" },
          React__default.createElement(
            "button",
            {
              className: "shell-absolute shell-top shell-right shell-p12",
              id: "page-shell-compatibility-dismiss"
            },
            React__default.createElement(
              "svg",
              { className: "shell-icon", viewBox: "0 0 18 18" },
              React__default.createElement("path", { d: "M5.8,5C5.4,5,5,5.4,5,5.8C5,6,5.1,6.2,5.3,6.3l0,0L7.9,9l-2.6,2.6C5.1,11.8,5,12,5,12.2C5,12.6,5.4,13,5.8,13 c0.2,0,0.4-0.1,0.6-0.3L9,10.1l2.6,2.6c0.1,0.2,0.4,0.3,0.6,0.3c0.4,0,0.8-0.4,0.8-0.8c0-0.2-0.1-0.4-0.2-0.6L10.1,9l2.6-2.7 C12.9,6.2,13,6,13,5.8C13,5.4,12.6,5,12.2,5c-0.2,0-0.4,0.1-0.6,0.2L9,7.8L6.4,5.2C6.2,5.1,6,5,5.8,5L5.8,5z" })
            )
          ),
          React__default.createElement(
            "div",
            { className: "limiter shell-block shell-relative" },
            React__default.createElement(
              "div",
              { className: "compatibility-warning-copy shell-mb6 shell-mb0-mm shell-align-center shell-align-left-mm shell-txt-bold" },
              "You are using an outdated browser and will encounter some problems with our website. Please consider upgrading."
            ),
            React__default.createElement(
              "div",
              { className: "compatibility-warning-action shell-align-center" },
              React__default.createElement(
                "a",
                {
                  className: "shell-btn shell-btn--white shell-color-pink shell-txt-nowrap",
                  href: "http://outdatedbrowser.com"
                },
                "Upgrade Now"
              )
            )
          )
        )
      );
    }
  }]);
  return BrowserCompatibilityWarning;
}(React__default.Component);

var PageHelmet = function (_React$Component) {
  inherits(PageHelmet, _React$Component);

  function PageHelmet() {
    classCallCheck(this, PageHelmet);
    return possibleConstructorReturn(this, (PageHelmet.__proto__ || Object.getPrototypeOf(PageHelmet)).apply(this, arguments));
  }

  createClass(PageHelmet, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React__default.createElement(
        Helmet.Helmet,
        null,
        React__default.createElement('meta', { charSet: 'utf-8' }),
        React__default.createElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
        React__default.createElement('link', { rel: 'shortcut icon', href: '/favicon.ico', type: 'image/x-icon' }),
        React__default.createElement('meta', {
          name: 'p:domain_verify',
          content: '57838af58c8045c2c024bc2f9d1577f9'
        }),
        React__default.createElement('meta', {
          name: 'google-site-verification',
          content: 'umPiCFUc_EX8CJ7xWQDPgQwApDxNi59w6riFZPNZj4w'
        }),
        React__default.createElement('meta', { name: 'twitter:site', content: '@Mapbox' }),
        React__default.createElement('meta', { property: 'og:site_name', content: 'Mapbox' })
      );
    }
  }]);
  return PageHelmet;
}(React__default.Component);

var shellStyles = {
  // Header names
  headerMenuName: 'shell-txt-s shell-txt-s-mxl shell-txt-bold shell-txt-nowrap shell-py6',

  // Mobile navigation popover
  mobilePopoverContainer: 'shell-absolute shell-z5',

  // Medium to X-large navigation
  navigationItem: 'shell-mx6 shell-mx9-ml shell-mx18-mxl',

  // Medium to X-large navigation popup menu
  popupMenuContainer: 'shell-absolute shell-z2 shell-disable-text-size-adjust',
  popupMenuBody: 'shell-shadow-darken10-bold shell-bg-white shell-absolute shell-inline-block shell-round shell-txt-s',
  popupMenuNavHeading: 'shell-txt-uppercase shell-txt-s shell-txt-spacing1 shell-txt-fancy shell-color-light-blue',
  popupMenuLink: 'shell-txt-bold shell-color-blue-on-hover shell-color-gray-dark',
  popupTriangle: 'shell-triangle-wide shell-triangle-wide--u shell-color-white shell-z5',

  // Right navigation, user menu, footer links section
  popoverNavLink: 'shell-inline-block shell-color-gray-dark shell-color-blue-on-hover',

  // User menu popup
  userNavLink: 'shell-color-gray-dark shell-color-blue-on-hover shell-txt-s shell-txt-bold shell-my12 shell-block',
  userAvatar: 'shell-border shell-border--2 shell-border--white shell-h30 shell-w30 shell-bg-darken25 shell-clip shell-round-full'
};

var UserMenu = function (_React$Component) {
  inherits(UserMenu, _React$Component);

  function UserMenu() {
    classCallCheck(this, UserMenu);
    return possibleConstructorReturn(this, (UserMenu.__proto__ || Object.getPrototypeOf(UserMenu)).apply(this, arguments));
  }

  createClass(UserMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var signInButtonColorClasses = this.props.darkText ? 'shell-btn--stroke shell-color-gray-dark shell-color-blue-on-hover' : 'shell-btn--lighten25';
      var userButtonColorClasses = this.props.darkText ? 'shell-color-gray-dark shell-color-blue-on-hover' : 'shell-link shell-link--white';

      // Very special case: If we are on the sign-up page with a route-to query param,
      // we need that param to persist when the user clicks the sign-in button in
      // the page header.
      var signInQuery = '';
      if (typeof window !== 'undefined' && window.location.search) {
        var match = window.location.search.match(/^\?.*?(?:.&)?(route-to=[^&]*).*$/);
        if (match) {
          signInQuery = '?' + match[1];
        }
      }
      return (
        // Hard-coded width matches the width of the sign-in button, which is slightly
        // wider than the user-menu trigger. By hard-coding this value we can prevent
        // horizontal bounce when the session API response comes back.
        // **Be careful changing this value!** The width varies based on browser,
        // so you need to accommodate the browser with the fattest fonts.
        React__default.createElement(
          'div',
          null,
          React__default.createElement(
            'div',
            { className: 'shell-relative', style: { width: 66 } },
            React__default.createElement(
              'div',
              { 'data-show-unauthenticated': true, style: { visibility: 'hidden' } },
              React__default.createElement(
                'a',
                {
                  className: 'shell-btn shell-w-full shell-py6 shell-round-full shell-txt-s ' + signInButtonColorClasses,
                  href: '/signin/' + signInQuery,
                  id: 'signin-button',
                  'data-test': 'signin-button'
                },
                'Sign in'
              )
            ),
            React__default.createElement(
              'div',
              {
                'data-show-authenticated': true,
                style: { visibility: 'hidden' },
                className: 'clearfix shell-absolute shell-top shell-right'
              },
              React__default.createElement(
                'div',
                {
                  id: 'user-menu',
                  className: 'shell-flex-parent shell-flex-parent--center-cross',
                  style: { paddingRight: 16 }
                },
                React__default.createElement(
                  'button',
                  {
                    id: 'user-menu-trigger',
                    'data-test': 'user-menu-trigger',
                    'aria-haspopup': 'true',
                    'aria-controls': 'user-menu-container',
                    'aria-expanded': 'false',
                    'aria-label': 'User menu',
                    className: userButtonColorClasses + ' shell-relative'
                  },
                  React__default.createElement(
                    'svg',
                    {
                      viewBox: '0 0 18 18',
                      className: 'shell-icon shell-absolute shell-mt-neg12 shell-h24 shell-w24',
                      style: { left: '100%', top: '50%' }
                    },
                    React__default.createElement('path', { d: 'M12,7L6,7l3,4L12,7z' })
                  ),
                  React__default.createElement('span', {
                    'data-user-avatar': true,
                    className: 'shell-flex-child shell-flex-child--no-shrink ' + shellStyles.userAvatar
                  })
                )
              )
            )
          ),
          React__default.createElement(
            'div',
            {
              id: 'user-menu-container',
              'data-test': 'user-menu',
              role: 'group',
              'aria-labelledby': 'user-menu-trigger',
              className: shellStyles.popupMenuContainer + ' shell-w-full shell-animated-menu',
              style: {
                right: 0,
                top: '100%',
                marginTop: '14px'
              }
            },
            React__default.createElement('div', {
              id: 'user-menu-pointer',
              className: shellStyles.popupTriangle + ' shell-animated-menu__pointer',
              style: {
                position: 'absolute',
                top: 0
              }
            }),
            React__default.createElement(
              'div',
              {
                className: 'shell-shadow-darken10-bold shell-bg-white shell-absolute shell-py30 shell-px24 shell-round shell-w-full shell-w210-mm',
                id: 'user-menu-body',
                style: {
                  right: 10
                }
              },
              React__default.createElement(
                'div',
                { className: 'shell-mt-neg12', 'data-generic-user-menu': true },
                React__default.createElement(
                  'a',
                  { href: '/studio/', className: shellStyles.userNavLink },
                  'Studio'
                ),
                React__default.createElement(
                  'a',
                  { href: '/account/', className: shellStyles.userNavLink },
                  'Account'
                ),
                React__default.createElement(
                  'a',
                  {
                    'data-user-staff-generic': true,
                    href: '/admin/',
                    className: 'shell-color-gray-dark shell-color-blue-on-hover shell-txt-s shell-txt-bold shell-my12',
                    style: { display: 'none' }
                  },
                  'Admin'
                ),
                React__default.createElement(
                  'a',
                  { href: '/account/settings', className: shellStyles.userNavLink },
                  'Settings'
                ),
                React__default.createElement(
                  'a',
                  { href: '/help/', className: shellStyles.userNavLink },
                  'Help'
                )
              ),
              React__default.createElement(
                'div',
                { className: 'shell-mt-neg12', 'data-app-specific-user-menu': true },
                React__default.createElement(
                  'a',
                  {
                    'data-user-staff-specific': true,
                    href: '/admin/',
                    className: 'shell-color-gray-dark shell-color-blue-on-hover shell-txt-s shell-txt-bold shell-my12',
                    style: { display: 'none' }
                  },
                  'Admin'
                ),
                React__default.createElement(
                  'a',
                  { href: '/account/settings/', className: shellStyles.userNavLink },
                  'Settings'
                ),
                React__default.createElement(
                  'a',
                  { href: '/help/', className: shellStyles.userNavLink },
                  'Help'
                )
              ),
              React__default.createElement(
                'div',
                { className: 'shell-pt24 shell-mt24 shell-border-t shell-border--gray-light' },
                React__default.createElement('div', { 'data-user-name': true, className: 'shell-txt-s shell-color-gray' }),
                React__default.createElement(
                  'button',
                  {
                    'data-sign-out': true,
                    'data-test': 'signout-button',
                    className: 'shell-color-gray-dark shell-color-blue-on-hover shell-txt-s shell-txt-bold shell-mt6 shell-block shell-w-full'
                  },
                  React__default.createElement(
                    'div',
                    { className: 'shell-flex-parent shell-flex-parent--center-cross shell-txt-bold' },
                    React__default.createElement(
                      'svg',
                      { className: 'shell-icon shell-mr3', viewBox: '0 0 18 18' },
                      React__default.createElement('path', { d: 'M4,4c0,0-1,0-1,1v8c0,1,1,1,1,1h4c0.6,0,1-0.4,1-1s-0.4-1-1-1H5V6h3c0.6,0,1-0.4,1-1S8.6,4,8,4H4z M11,5 c-0.3,0-0.5,0.1-0.7,0.3c-0.4,0.4-0.4,1,0,1.4L11.6,8H7C6.5,8,6,8.5,6,9s0.5,1,1,1h4.6l-1.3,1.3c-0.4,0.4-0.4,1,0,1.4s1,0.4,1.4,0 l2.8-2.9c0.2-0.2,0.4-0.5,0.4-0.9c0-0.3-0.2-0.6-0.4-0.9l-2.8-2.9C11.5,5.1,11.3,5,11,5L11,5z' })
                    ),
                    React__default.createElement(
                      'span',
                      { className: 'shell-flex-child' },
                      'Sign out'
                    )
                  )
                )
              )
            )
          )
        )
      );
    }
  }]);
  return UserMenu;
}(React__default.Component);

UserMenu.propTypes = {
  darkText: PropTypes.bool
};

var PopupMenu = function (_React$Component) {
  inherits(PopupMenu, _React$Component);

  function PopupMenu() {
    classCallCheck(this, PopupMenu);
    return possibleConstructorReturn(this, (PopupMenu.__proto__ || Object.getPrototypeOf(PopupMenu)).apply(this, arguments));
  }

  createClass(PopupMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'renderName',
    value: function renderName() {
      var _props = this.props,
          name = _props.name,
          shortName = _props.shortName;

      if (shortName) {
        return React__default.createElement(
          'span',
          null,
          React__default.createElement(
            'span',
            { className: 'shell-none-ml' },
            shortName
          ),
          React__default.createElement(
            'span',
            { className: 'shell-none shell-block-ml' },
            name
          )
        );
      }

      return name;
    }
  }, {
    key: 'render',
    value: function render() {
      var menuNameClasses = shellStyles.headerMenuName;
      menuNameClasses += this.props.darkText ? ' shell-navigation-menu-button shell-transition shell-color-gray-dark shell-color-blue-on-hover' : ' shell-navigation-menu-button shell-link shell-link--white';

      var _props2 = this.props,
          name = _props2.name,
          children = _props2.children;


      return React__default.createElement(
        'div',
        { style: { lineHeight: 1 } },
        React__default.createElement(
          'div',
          {
            id: name + '-menu',
            className: 'shell-relative ' + shellStyles.navigationItem
          },
          React__default.createElement(
            'button',
            {
              id: name + '-menu-trigger',
              'data-nav-trigger': name,
              'data-test': 'nav-menu-trigger-' + name,
              'aria-haspopup': 'true',
              'aria-controls': name + '-menu-container',
              'aria-expanded': 'false',
              'aria-label': name + ' menu',
              className: menuNameClasses
            },
            this.renderName()
          )
        ),
        React__default.createElement(
          'div',
          {
            id: name + '-menu-container',
            'data-nav-menu': name,
            'data-test': 'nav-menu-' + name,
            role: 'group',
            'aria-labelledby': name + '-menu-trigger',
            className: shellStyles.popupMenuContainer + ' shell-w-full shell-animated-menu',
            style: {
              right: 0,
              top: '100%',
              marginTop: '14px'
            }
          },
          React__default.createElement('div', {
            'data-nav-pointer': name,
            className: shellStyles.popupTriangle + ' shell-animated-menu__pointer',
            style: {
              position: 'absolute',
              top: 0
            }
          }),
          React__default.createElement(
            'div',
            { className: shellStyles.popupMenuBody, 'data-nav-menu-body': name },
            children
          )
        )
      );
    }
  }]);
  return PopupMenu;
}(React__default.Component);

PopupMenu.propTypes = {
  darkText: PropTypes.bool,
  name: PropTypes.string.isRequired,
  shortName: PropTypes.string,
  children: PropTypes.node.isRequired
};

PopupMenu.defaultProps = {
  darkText: true,
  shortName: null
};

var SmallMapsIcon = function (_React$Component) {
  inherits(SmallMapsIcon, _React$Component);

  function SmallMapsIcon() {
    classCallCheck(this, SmallMapsIcon);
    return possibleConstructorReturn(this, (SmallMapsIcon.__proto__ || Object.getPrototypeOf(SmallMapsIcon)).apply(this, arguments));
  }

  createClass(SmallMapsIcon, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: "render",
    value: function render() {
      return React__default.createElement(
        "svg",
        _extends({}, this.props, {
          width: "12",
          height: "12",
          xmlns: "http://www.w3.org/2000/svg"
        }),
        React__default.createElement("path", {
          d: "M4 10.5V0l4 1.5V12l-4-1.5zM3 0L.6.8c-.4.1-.6.5-.6.9v9c0 .4.5.6.9.5l2.1-.7V0zm8.4 11.2c.4-.1.6-.5.6-.9v-9c0-.4-.4-.7-.9-.5L9 1.5V12l2.4-.8z",
          fill: "#4264FB",
          fillRule: "nonzero"
        })
      );
    }
  }]);
  return SmallMapsIcon;
}(React__default.Component);

var SmallNavigationIcon = function (_React$Component) {
  inherits(SmallNavigationIcon, _React$Component);

  function SmallNavigationIcon() {
    classCallCheck(this, SmallNavigationIcon);
    return possibleConstructorReturn(this, (SmallNavigationIcon.__proto__ || Object.getPrototypeOf(SmallNavigationIcon)).apply(this, arguments));
  }

  createClass(SmallNavigationIcon, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: "render",
    value: function render() {
      return React__default.createElement(
        "svg",
        _extends({}, this.props, {
          width: "12",
          height: "12",
          xmlns: "http://www.w3.org/2000/svg"
        }),
        React__default.createElement("path", {
          d: "M2.5 11.2c-.9.8-1.9 0-1.5-1l4-9c.2-.4.6-.8 1-.8s.8.4 1 .8l4 9c.4 1-.6 1.8-1.5 1L6 8.2l-3.5 3z",
          fill: "#4264FB",
          fillRule: "nonzero"
        })
      );
    }
  }]);
  return SmallNavigationIcon;
}(React__default.Component);

var SmallStudioIcon = function (_React$Component) {
  inherits(SmallStudioIcon, _React$Component);

  function SmallStudioIcon() {
    classCallCheck(this, SmallStudioIcon);
    return possibleConstructorReturn(this, (SmallStudioIcon.__proto__ || Object.getPrototypeOf(SmallStudioIcon)).apply(this, arguments));
  }

  createClass(SmallStudioIcon, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: "render",
    value: function render() {
      return React__default.createElement(
        "svg",
        _extends({}, this.props, {
          width: "14",
          height: "14",
          xmlns: "http://www.w3.org/2000/svg"
        }),
        React__default.createElement("path", {
          d: "M6.99.5C3.595.5.5 3.2.5 7c0 3.4 2.995 6.5 6.29 6.5.7 0 1.298-.5 1.298-1.1 0-.4-.2-.8-.499-1.1-.6-.5-.6-1.1-.6-1.1 0-.8.4-1.2 1-1.2h1.997c1.497 0 3.494.4 3.494-2.1 0-2.6-2.196-6.4-6.49-6.4zm0 1.5c.599 0 .998.4.998 1S7.59 4 6.99 4c-.6 0-.999-.4-.999-1s.4-1 .999-1zM3.994 4c.6 0 .999.4.999 1s-.4 1-.999 1-.998-.4-.998-1 .4-1 .998-1zm6.091 0c.6 0 .999.4.999 1s-.4 1-.999 1-.998-.4-.998-1 .4-1 .998-1z",
          fill: "#4264FB",
          fillRule: "nonzero"
        })
      );
    }
  }]);
  return SmallStudioIcon;
}(React__default.Component);

var SmallServicesIcon = function (_React$Component) {
  inherits(SmallServicesIcon, _React$Component);

  function SmallServicesIcon() {
    classCallCheck(this, SmallServicesIcon);
    return possibleConstructorReturn(this, (SmallServicesIcon.__proto__ || Object.getPrototypeOf(SmallServicesIcon)).apply(this, arguments));
  }

  createClass(SmallServicesIcon, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: "render",
    value: function render() {
      return React__default.createElement(
        "svg",
        _extends({}, this.props, {
          width: "14",
          height: "14",
          xmlns: "http://www.w3.org/2000/svg"
        }),
        React__default.createElement("path", {
          d: "M4.4.4l-1.8 1 .5 2.4c-.3.5-.6.9-.8 1.4L0 6v2l2.3.8c.2.5.5.9.8 1.3l-.5 2.4 1.8 1 1.8-1.6c.3.1.5.1.8.1.3 0 .5 0 .8-.1l1.8 1.6 1.8-1-.5-2.4c.3-.4.6-.8.8-1.3L14 8V6l-2.3-.8c-.2-.5-.5-.9-.8-1.3l.5-2.4-1.8-1-1.8 1.6C7.5 2 7.3 2 7 2c-.3 0-.5 0-.8.1L4.4.4zM7 5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z",
          fill: "#4264FB",
          fillRule: "nonzero"
        })
      );
    }
  }]);
  return SmallServicesIcon;
}(React__default.Component);

var navigationMenuData = {
  headerMainMenus: {
    products: {
      products: {
        title: 'Products',
        links: [{
          name: 'Maps',
          description: 'Smooth, fast, real-time maps',
          to: '/maps/'
        }, {
          name: 'Search',
          description: 'Turn addresses into coordinates',
          to: '/geocoding/'
        }, {
          name: 'Navigation',
          description: 'Turn-by-turn routing',
          to: '/navigation/'
        }, {
          name: 'Studio',
          description: 'Design custom maps',
          to: '/mapbox-studio/'
        }, {
          name: 'Atlas',
          description: 'Maps and location on-premise',
          to: '/atlas/'
        }],
        more: {
          title: 'View all products',
          to: '/products/'
        }
      },
      platforms: {
        title: 'Platforms',
        links: [{
          name: 'Web',
          to: '/help/how-web-apps-work/',
          hideInMobile: true
        }, {
          name: 'Mobile',
          to: '/mobile/'
        }, {
          name: 'AR',
          to: '/augmented-reality/'
        }, {
          name: 'Auto',
          to: '/automotive/',
          hideInMobile: true
        }]
      }
    },
    solutions: {
      industries: {
        title: 'Industries',
        links: [{
          name: 'Consumer apps (B2C)',
          to: '/industries/consumer/'
        }, {
          name: 'Logistics',
          to: '/industries/logistics/'
        }, {
          name: 'Business intelligence',
          to: '/industries/business-intelligence/'
        }, {
          name: 'Government',
          to: '/industries/government/'
        }]
      },
      useCases: {
        title: 'Use Cases',
        links: [{
          name: 'Store locator',
          to: '/use-cases/store-locator/'
        }, {
          name: 'Turn-by-turn navigation',
          to: '/use-cases/turn-by-turn-navigation/'
        }, {
          name: 'On-demand logistics',
          to: '/use-cases/on-demand-logistics/'
        }, {
          name: 'Asset tracking',
          to: '/use-cases/asset-tracking/'
        }, {
          name: 'Data visualization',
          to: '/use-cases/data-visualization/'
        }],
        more: {
          title: 'Built with Mapbox blog',
          to: 'https://blog.mapbox.com/tagged/built-with-mapbox/'
        }
      }
    },
    documentation: {
      documentation: {
        title: 'Documentation',
        sections: {
          maps: {
            title: 'Maps',
            icon: SmallMapsIcon,
            links: [{
              name: 'Mapbox GL JS',
              to: '/mapbox-gl-js/api/'
            }],
            subsections: {
              mapsSdks: {
                title: 'Maps SDKs',
                links: [{
                  name: 'iOS',
                  showFor: true,
                  to: '/ios-sdk/'
                }, {
                  name: 'Android',
                  showFor: true,
                  to: '/android-docs/map-sdk/overview/'
                }, {
                  name: 'Unity',
                  showFor: true,
                  to: '/unity-sdk/'
                }, {
                  name: 'React Native',
                  showFor: true,
                  to: '/help/first-steps-react-native-sdk/'
                }, {
                  name: 'Qt',
                  showFor: true,
                  to: '/qt/'
                }]
              }
            }
          },
          navigation: {
            title: 'Navigation',
            icon: SmallNavigationIcon,
            subsections: {
              sdks: {
                title: 'Navigation SDKs',
                links: [{
                  name: 'iOS',
                  showFor: true,
                  to: '/ios-sdk/navigation/'
                }, {
                  name: 'Android',
                  showFor: true,
                  to: '/android-docs/navigation/'
                }]
              }
            }
          },
          studio: {
            title: 'Studio',
            icon: SmallStudioIcon,
            links: [{
              name: 'Mapbox Studio manual',
              to: '/help/studio-manual/'
            }]
          },
          services: {
            title: 'Mapbox services',
            icon: SmallServicesIcon,
            links: [{
              name: 'Maps APIs',
              to: '/api-documentation/#maps'
            }, {
              name: 'Directions APIs',
              to: '/api-documentation/#directions'
            }, {
              name: 'Geocoding API',
              to: '/api-documentation/#geocoding'
            }]
          }
        },
        more: {
          title: 'More documentation',
          to: '/documentation/'
        }
      },
      help: {
        title: 'Help',
        links: [{
          name: 'How Mapbox works',
          subTitle: 'Learn how the Mapbox platform works',
          to: '/help/how-mapbox-works/'
        }, {
          name: 'Tutorials',
          subTitle: 'Start with a guide or explore project ideas',
          to: '/help/tutorials/'
        }],
        more: {
          title: 'More help',
          to: '/help/'
        }
      }
    },
    company: {
      name: 'Company',
      links: [{
        name: 'About',
        to: '/about/'
      }, {
        name: 'Customers',
        to: '/showcase/'
      }, {
        name: 'Careers',
        to: '/jobs/'
      }, {
        name: 'Diversity & Inclusion',
        to: '/diversity-inclusion/'
      }]
    }
  },
  productsMenu: {
    name: 'Products',
    links: [{
      name: 'Maps',
      to: '/maps/'
    }, {
      name: 'Search',
      to: '/geocoding/'
    }, {
      name: 'Navigation',
      to: '/navigation/'
    }, {
      name: 'Studio',
      to: '/mapbox-studio/'
    }, {
      name: 'Atlas',
      to: '/atlas/'
    }],
    highlightedLinks: [{
      name: 'Pricing',
      to: '/pricing/'
    }]
  },
  useCaseMenu: {
    name: 'Use cases',
    links: [{
      name: 'Store locator',
      to: '/use-cases/store-locator/'
    }, {
      name: 'Turn-by-turn navigation',
      to: '/use-cases/turn-by-turn-navigation/'
    }, {
      name: 'On-demand logistics',
      to: '/use-cases/on-demand-logistics/'
    }, {
      name: 'Data visualization',
      to: '/use-cases/data-visualization/'
    }, {
      name: 'Asset tracking',
      to: '/use-cases/asset-tracking/'
    }],
    highlightedLinks: []
  },
  resourcesMenu: {
    name: 'Resources',
    links: [{
      name: 'Documentation',
      to: '/documentation/'
    }, {
      name: 'Help',
      to: '/help/'
    }, {
      name: 'Events',
      to: '/events/'
    }, {
      name: 'Live sessions',
      to: '/live/'
    }, {
      name: 'Open source',
      to: '/about/open/'
    }],
    highlightedLinks: []
  },
  companyMenu: {
    name: 'Company',
    links: [{
      name: 'About',
      to: '/about/'
    }, {
      name: 'Customers',
      to: '/showcase/'
    }, {
      name: 'Community',
      to: '/community/'
    }, {
      name: 'Careers',
      to: '/careers/'
    }, {
      name: 'Diversity & Inclusion',
      to: '/diversity-inclusion/'
    }, {
      name: 'Team',
      to: '/about/team/'
    }, {
      name: 'Blog',
      to: '/blog/'
    }, {
      name: 'Press',
      to: '/about/press/'
    }, {
      name: 'Contact',
      to: '/contact/'
    }],
    highlightedLinks: []
  },
  mobileCombinationMenu: {
    links: [{
      name: 'Customers',
      to: '/showcase/'
    }, {
      name: 'Documentation',
      to: '/documentation/'
    }, {
      name: 'Pricing',
      to: '/pricing/'
    }, {
      name: 'Contact',
      to: '/contact/'
    }, {
      name: 'About',
      to: '/about/'
    }, {
      name: 'Careers',
      to: '/careers/'
    }, {
      name: 'Team',
      to: '/about/team/'
    }, {
      name: 'Blog',
      to: '/blog/'
    }]
  }
};

var CompanyMenu = function (_React$Component) {
  inherits(CompanyMenu, _React$Component);

  function CompanyMenu() {
    classCallCheck(this, CompanyMenu);
    return possibleConstructorReturn(this, (CompanyMenu.__proto__ || Object.getPrototypeOf(CompanyMenu)).apply(this, arguments));
  }

  createClass(CompanyMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var navItems = navigationMenuData.headerMainMenus.company.links;

      return React__default.createElement(
        PopupMenu,
        _extends({}, this.props, { name: 'Company' }),
        React__default.createElement(
          'div',
          { className: 'shell-py30 shell-px30' },
          React__default.createElement(
            'ul',
            null,
            navItems.map(function (navItem, i) {
              return React__default.createElement(
                'li',
                { key: navItem.name, className: i === 0 ? '' : 'shell-mt18' },
                React__default.createElement(
                  'a',
                  {
                    href: navItem.to,
                    className: shellStyles.popupMenuLink,
                    'data-nav-link': true,
                    'data-test': 'nav-link-' + navItem.name
                  },
                  navItem.name
                )
              );
            })
          )
        )
      );
    }
  }]);
  return CompanyMenu;
}(React__default.Component);

var NavigationHighlightLink = function (_React$Component) {
  inherits(NavigationHighlightLink, _React$Component);

  function NavigationHighlightLink() {
    classCallCheck(this, NavigationHighlightLink);
    return possibleConstructorReturn(this, (NavigationHighlightLink.__proto__ || Object.getPrototypeOf(NavigationHighlightLink)).apply(this, arguments));
  }

  createClass(NavigationHighlightLink, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var splitText = this.props.label.split(' ');
      var lastWord = splitText.pop();
      var textWithoutLastWord = splitText.join(' ');

      return React__default.createElement(
        'span',
        { className: 'shell-color-blue shell-txt-bold shell-color-gray-dark-on-hover' },
        textWithoutLastWord,
        ' ',
        React__default.createElement(
          'span',
          { className: 'shell-txt-nowrap' },
          lastWord,
          React__default.createElement(
            'span',
            { className: 'shell-icon-inliner' },
            React__default.createElement(
              'svg',
              { className: 'shell-icon' },
              React__default.createElement('use', { xlinkHref: '#shell-icon-chevron-right' })
            )
          )
        )
      );
    }
  }]);
  return NavigationHighlightLink;
}(React__default.Component);

NavigationHighlightLink.propTypes = {
  label: PropTypes.string.isRequired
};

var DocumentationMenu = function (_React$Component) {
  inherits(DocumentationMenu, _React$Component);

  function DocumentationMenu() {
    classCallCheck(this, DocumentationMenu);
    return possibleConstructorReturn(this, (DocumentationMenu.__proto__ || Object.getPrototypeOf(DocumentationMenu)).apply(this, arguments));
  }

  createClass(DocumentationMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'renderAnchorLi',
    value: function renderAnchorLi(linkItem) {
      return React__default.createElement(
        'li',
        { key: linkItem.name, className: 'shell-mb12' },
        React__default.createElement(
          'a',
          {
            href: linkItem.to,
            className: shellStyles.popupMenuLink,
            'data-nav-link': true,
            'data-test': 'nav-link-' + linkItem.name
          },
          linkItem.showFor && React__default.createElement(
            'span',
            { className: 'shell-txt-normal' },
            'for '
          ),
          linkItem.name,
          linkItem.subTitle && React__default.createElement(
            'p',
            { className: 'shell-txt-xs shell-txt-normal shell-color-light-blue' },
            linkItem.subTitle
          )
        )
      );
    }
  }, {
    key: 'renderSubsectionNav',
    value: function renderSubsectionNav(subKey, subsection) {
      return React__default.createElement(
        'div',
        { key: subKey },
        React__default.createElement(
          'div',
          { className: 'shell-color-light-blue shell-txt-bold shell-pb12' },
          subsection.title
        ),
        React__default.createElement(
          'div',
          { className: 'shell-ml6' },
          React__default.createElement(
            'ul',
            null,
            subsection.links.map(this.renderAnchorLi)
          )
        )
      );
    }
  }, {
    key: 'renderSectionNav',
    value: function renderSectionNav(section) {
      var _this2 = this;

      var subKeys = section.subsections ? Object.keys(section.subsections) : null;

      return React__default.createElement(
        'div',
        null,
        React__default.createElement(
          'div',
          { className: 'shell-border-b shell-border--gray-light shell-pb6 shell-mb12' },
          React__default.createElement(section.icon, { className: 'shell-align-middle shell-mb3' }),
          React__default.createElement(
            'span',
            { className: 'shell-txt-bold shell-ml6 shell-color-light-blue' },
            section.title
          )
        ),
        section.links && React__default.createElement(
          'ul',
          null,
          section.links.map(this.renderAnchorLi)
        ),
        subKeys && React__default.createElement(
          'div',
          null,
          subKeys.map(function (subKey) {
            return _this2.renderSubsectionNav(subKey, section.subsections[subKey]);
          })
        )
      );
    }
  }, {
    key: 'render',
    value: function render() {
      var navSections = navigationMenuData.headerMainMenus.documentation;
      var docNavSection = navSections.documentation;
      var helpNavSection = navSections.help;

      return React__default.createElement(
        PopupMenu,
        _extends({}, this.props, { name: 'Documentation', shortName: 'Docs' }),
        React__default.createElement(
          'div',
          { style: { width: 540 } },
          React__default.createElement(
            'div',
            { className: 'shell-grid' },
            React__default.createElement(
              'div',
              { className: 'shell-col shell-col--8 shell-pt30 shell-px30' },
              React__default.createElement(
                'div',
                { className: shellStyles.popupMenuNavHeading + ' shell-pb12' },
                docNavSection.title
              ),
              React__default.createElement(
                'div',
                { className: 'shell-grid' },
                React__default.createElement(
                  'div',
                  { className: 'shell-col shell-col--6 shell-pr24' },
                  this.renderSectionNav(docNavSection.sections.maps)
                ),
                React__default.createElement(
                  'div',
                  { className: 'shell-col shell-col--6' },
                  React__default.createElement(
                    'div',
                    { className: 'shell-mb24' },
                    this.renderSectionNav(docNavSection.sections.navigation)
                  ),
                  React__default.createElement(
                    'div',
                    { className: 'shell-mb24' },
                    this.renderSectionNav(docNavSection.sections.studio)
                  ),
                  React__default.createElement(
                    'div',
                    { className: 'shell-mb24' },
                    this.renderSectionNav(docNavSection.sections.services)
                  )
                )
              )
            ),
            React__default.createElement(
              'div',
              { className: 'shell-col shell-col--4 shell-bg-gray-faint shell-round shell-pt30 shell-px30' },
              React__default.createElement(
                'div',
                { className: shellStyles.popupMenuNavHeading + ' shell-pb12' },
                helpNavSection.title
              ),
              React__default.createElement(
                'ul',
                null,
                helpNavSection.links.map(this.renderAnchorLi)
              )
            )
          ),
          React__default.createElement(
            'div',
            { className: 'shell-grid' },
            React__default.createElement(
              'div',
              { className: 'shell-col shell-col--8 shell-px30 shell-pb30' },
              React__default.createElement(
                'a',
                {
                  href: docNavSection.more.to,
                  className: shellStyles.popoverNavLinkHighlight,
                  'data-nav-link': true,
                  'data-test': 'nav-link-' + docNavSection.more.title
                },
                React__default.createElement(NavigationHighlightLink, { label: docNavSection.more.title })
              )
            ),
            React__default.createElement(
              'div',
              { className: 'shell-col shell-col--4 shell-bg-gray-faint shell-round shell-px30 shell-pb30' },
              React__default.createElement(
                'a',
                {
                  href: helpNavSection.more.to,
                  className: shellStyles.popoverNavLinkHighlight,
                  'data-nav-link': true,
                  'data-test': 'nav-link-' + helpNavSection.more.title
                },
                React__default.createElement(NavigationHighlightLink, { label: helpNavSection.more.title })
              )
            )
          )
        )
      );
    }
  }]);
  return DocumentationMenu;
}(React__default.Component);

var ProductsNavItem = function (_React$Component) {
  inherits(ProductsNavItem, _React$Component);

  function ProductsNavItem() {
    classCallCheck(this, ProductsNavItem);
    return possibleConstructorReturn(this, (ProductsNavItem.__proto__ || Object.getPrototypeOf(ProductsNavItem)).apply(this, arguments));
  }

  createClass(ProductsNavItem, [{
    key: 'render',
    value: function render() {
      var link = this.props.link;

      var lowerName = link.name.toLowerCase();

      return React__default.createElement(
        'a',
        {
          href: link.to,
          className: 'shell-products-nav-item shell-icon--' + lowerName + ' shell-block shell-mr6 shell-color-blue-on-hover',
          'data-nav-link': true,
          'data-test': 'nav-link-' + link.name
        },
        React__default.createElement(
          'div',
          { className: 'shell-mb0 shell-pt3' },
          React__default.createElement(
            'span',
            { className: 'shell-txt-bold' },
            link.name
          ),
          React__default.createElement(
            'p',
            { className: 'shell-txt-xs shell-color-light-blue' },
            link.description
          )
        )
      );
    }
  }]);
  return ProductsNavItem;
}(React__default.Component);

ProductsNavItem.propTypes = {
  link: PropTypes.shape({
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    to: PropTypes.string.isRequired
  }).isRequired
};

var PlatformsNavItem = function (_React$Component) {
  inherits(PlatformsNavItem, _React$Component);

  function PlatformsNavItem() {
    classCallCheck(this, PlatformsNavItem);
    return possibleConstructorReturn(this, (PlatformsNavItem.__proto__ || Object.getPrototypeOf(PlatformsNavItem)).apply(this, arguments));
  }

  createClass(PlatformsNavItem, [{
    key: 'render',
    value: function render() {
      var link = this.props.link;

      var lowerName = link.name.toLowerCase();

      return React__default.createElement(
        'a',
        {
          href: link.to,
          'data-nav-link': true,
          'data-test': 'nav-link-' + link.name,
          className: 'shell-platforms-nav-item shell-h30 shell-py6 shell-icon--' + lowerName + ' shell-block shell-color-blue-on-hover shell-txt-bold'
        },
        link.name
      );
    }
  }]);
  return PlatformsNavItem;
}(React__default.Component);

PlatformsNavItem.propTypes = {
  link: PropTypes.shape({
    name: PropTypes.string.isRequired,
    to: PropTypes.string.isRequired
  }).isRequired
};

var ProductsMenu = function (_React$Component) {
  inherits(ProductsMenu, _React$Component);

  function ProductsMenu() {
    classCallCheck(this, ProductsMenu);
    return possibleConstructorReturn(this, (ProductsMenu.__proto__ || Object.getPrototypeOf(ProductsMenu)).apply(this, arguments));
  }

  createClass(ProductsMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var navSections = navigationMenuData.headerMainMenus.products;
      var productsNavSection = navSections.products;
      var platformsNavSection = navSections.platforms;

      return React__default.createElement(
        PopupMenu,
        _extends({}, this.props, { name: 'Products' }),
        React__default.createElement(
          'div',
          { style: { width: 500 }, className: 'shell-px30 shell-py30' },
          React__default.createElement(
            'div',
            { className: 'shell-border-b shell-border--gray-light shell-pb12' },
            React__default.createElement(
              'div',
              { className: shellStyles.popupMenuNavHeading },
              productsNavSection.title
            ),
            React__default.createElement(
              'div',
              { className: 'shell-grid' },
              productsNavSection.links.map(function (link) {
                return React__default.createElement(
                  'div',
                  {
                    key: link.name,
                    className: 'shell-col shell-col--6 shell-my12'
                  },
                  React__default.createElement(ProductsNavItem, { link: link })
                );
              })
            )
          ),
          React__default.createElement(
            'div',
            { className: 'shell-py24' },
            React__default.createElement(
              'div',
              { className: shellStyles.popupMenuNavHeading + ' shell-pb12' },
              platformsNavSection.title
            ),
            React__default.createElement(
              'div',
              { className: 'shell-flex-parent shell-flex-parent--space-between-main' },
              platformsNavSection.links.map(function (link) {
                return React__default.createElement(
                  'div',
                  { key: link.name, className: 'shell-flex-child' },
                  React__default.createElement(PlatformsNavItem, { link: link })
                );
              })
            )
          ),
          React__default.createElement(
            'div',
            null,
            React__default.createElement(
              'a',
              {
                href: productsNavSection.more.to,
                className: shellStyles.popoverNavLinkHighlight,
                'data-nav-link': true,
                'data-test': 'nav-link-' + productsNavSection.more.title
              },
              React__default.createElement(NavigationHighlightLink, { label: productsNavSection.more.title })
            )
          )
        )
      );
    }
  }]);
  return ProductsMenu;
}(React__default.Component);

var SolutionsMenu = function (_React$Component) {
  inherits(SolutionsMenu, _React$Component);

  function SolutionsMenu() {
    classCallCheck(this, SolutionsMenu);
    return possibleConstructorReturn(this, (SolutionsMenu.__proto__ || Object.getPrototypeOf(SolutionsMenu)).apply(this, arguments));
  }

  createClass(SolutionsMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'renderMenuSideNavSection',
    value: function renderMenuSideNavSection(navSection) {
      return React__default.createElement(
        'div',
        { className: 'shell-pb12' },
        React__default.createElement(
          'div',
          { className: shellStyles.popupMenuNavHeading + ' shell-pb12' },
          navSection.title
        ),
        React__default.createElement(
          'ul',
          null,
          navSection.links.map(function (link) {
            return React__default.createElement(
              'li',
              { key: link.name, className: 'shell-mb12' },
              React__default.createElement(
                'a',
                {
                  href: link.to,
                  className: shellStyles.popupMenuLink,
                  'data-nav-link': true,
                  'data-test': 'nav-link-' + link.name
                },
                link.name
              )
            );
          })
        )
      );
    }
  }, {
    key: 'render',
    value: function render() {
      var navSections = navigationMenuData.headerMainMenus.solutions;
      var useCasesNavSection = navSections.useCases;
      var industriesNavSection = navSections.industries;

      return React__default.createElement(
        PopupMenu,
        _extends({}, this.props, { name: 'Solutions' }),
        React__default.createElement(
          'div',
          { style: { width: 380 }, className: 'shell-py30 shell-px30' },
          React__default.createElement(
            'div',
            { className: 'shell-flex-parent shell-flex-parent--space-between-main' },
            React__default.createElement(
              'div',
              { className: 'shell-flex-child' },
              this.renderMenuSideNavSection(industriesNavSection)
            ),
            React__default.createElement(
              'div',
              { className: 'shell-flex-child' },
              this.renderMenuSideNavSection(useCasesNavSection)
            )
          ),
          React__default.createElement(
            'div',
            null,
            React__default.createElement(
              'a',
              {
                href: useCasesNavSection.more.to,
                className: shellStyles.popoverNavLinkHighlight,
                'data-nav-link': true,
                'data-test': 'nav-link-' + useCasesNavSection.more.title
              },
              React__default.createElement(NavigationHighlightLink, { label: useCasesNavSection.more.title })
            )
          )
        )
      );
    }
  }]);
  return SolutionsMenu;
}(React__default.Component);

var NavigationItem = function (_React$Component) {
  inherits(NavigationItem, _React$Component);

  function NavigationItem() {
    classCallCheck(this, NavigationItem);
    return possibleConstructorReturn(this, (NavigationItem.__proto__ || Object.getPrototypeOf(NavigationItem)).apply(this, arguments));
  }

  createClass(NavigationItem, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var colorBasedClasses = this.props.darkText ? 'shell-navigation-menu-button shell-color-gray-dark shell-color-blue-on-hover' : 'shell-navigation-menu-button shell-link shell-link--white';

      return React__default.createElement(
        'div',
        {
          className: 'shell-flex-child ' + shellStyles.navigationItem,
          style: { lineHeight: 1 }
        },
        React__default.createElement(
          'a',
          {
            className: 'shell-py6 shell-txt-s shell-txt-bold ' + colorBasedClasses,
            'data-test': 'nav-menu-item-' + this.props.name,
            href: this.props.href
          },
          this.props.children
        )
      );
    }
  }]);
  return NavigationItem;
}(React__default.Component);

var MobileMenuButton = function (_React$Component) {
  inherits(MobileMenuButton, _React$Component);

  function MobileMenuButton() {
    classCallCheck(this, MobileMenuButton);
    return possibleConstructorReturn(this, (MobileMenuButton.__proto__ || Object.getPrototypeOf(MobileMenuButton)).apply(this, arguments));
  }

  createClass(MobileMenuButton, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var extraMenuButtonClasses = void 0;
      if (!this.props.darkText) {
        extraMenuButtonClasses = 'shell-link shell-link--white';
      } else {
        extraMenuButtonClasses = 'shell-color-blue';
      }
      return React__default.createElement(
        'button',
        {
          id: 'mobile-nav-trigger-toggle',
          'aria-label': 'Toggle navigation',
          className: extraMenuButtonClasses + ' shell-mr-neg6',
          'data-test': 'mobile-nav-trigger-toggle'
        },
        React__default.createElement(
          'svg',
          {
            id: 'mobile-nav-trigger-menu',
            viewBox: '0 0 18 18',
            className: 'shell-mobile-nav__trigger shell-icon shell-transition shell-icon--l'
          },
          React__default.createElement(
            'g',
            null,
            React__default.createElement('path', {
              className: 'shell-mobile-nav__trigger__bar--top',
              d: 'M4.2,6h9.6C14.5,6,15,5.6,15,5s-0.5-1-1.2-1H4.2C3.5,4,3,4.4,3,5S3.5,6,4.2,6z'
            }),
            React__default.createElement('path', {
              className: 'shell-mobile-nav__trigger__bar--middle',
              d: 'M13.8,8H4.2C3.5,8,3,8.4,3,9s0.5,1,1.2,1h9.6c0.7,0,1.2-0.4,1.2-1S14.5,8,13.8,8z'
            }),
            React__default.createElement('path', {
              className: 'shell-mobile-nav__trigger__bar--bottom',
              d: 'M13.8,12H4.2C3.5,12,3,12.4,3,13s0.5,1,1.2,1h9.6c0.7,0,1.2-0.4,1.2-1S14.5,12,13.8,12z'
            })
          )
        )
      );
    }
  }]);
  return MobileMenuButton;
}(React__default.Component);

MobileMenuButton.propTypes = {
  darkText: PropTypes.bool
};

// This is currently used in the bottom half of the mobile navigation

var NavigationDividedLinkList = function (_React$Component) {
  inherits(NavigationDividedLinkList, _React$Component);

  function NavigationDividedLinkList() {
    classCallCheck(this, NavigationDividedLinkList);
    return possibleConstructorReturn(this, (NavigationDividedLinkList.__proto__ || Object.getPrototypeOf(NavigationDividedLinkList)).apply(this, arguments));
  }

  createClass(NavigationDividedLinkList, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      // Font size is larger for items with a heading in mobile
      var linkFontSize = this.props.navigationType === 'mobile-navigation' ? 'shell-txt-m' : 'shell-txt-s';

      // Calculate even column breaks
      var firstColumnLength = Math.ceil(this.props.links.length / 2);
      var firstColumnItems = this.props.links.slice(0, firstColumnLength).map(function (link, i) {
        return React__default.createElement(
          'div',
          { key: i, className: 'shell-mb0 shell-mt12' },
          React__default.createElement(
            'a',
            {
              href: link.to,
              className: shellStyles.popoverNavLink + ' ' + linkFontSize,
              'data-nav-link': link.name,
              'data-test': 'mobile-nav-link-' + link.name
            },
            link.name
          )
        );
      });
      var secondColumnItems = this.props.links.slice(firstColumnLength).map(function (link, i) {
        return React__default.createElement(
          'div',
          { key: i, className: 'shell-mb0 shell-mt12' },
          React__default.createElement(
            'a',
            {
              href: link.to,
              className: shellStyles.popoverNavLink + ' ' + linkFontSize,
              'data-nav-link': link.name,
              'data-test': 'mobile-nav-link-' + link.name
            },
            link.name
          )
        );
      });
      var items = React__default.createElement(
        'div',
        { className: 'shell-grid shell-grid--gut12' },
        React__default.createElement(
          'div',
          { className: 'shell-col shell-col--6' },
          firstColumnItems
        ),
        React__default.createElement(
          'div',
          { className: 'shell-col shell-col--6' },
          secondColumnItems
        )
      );

      // Special case: the custom combination menu doesn't need a heading
      var showNavHeading = this.props.name ? React__default.createElement(
        'div',
        { className: shellStyles.popoverNavHeading },
        this.props.name
      ) : '';
      return React__default.createElement(
        'div',
        null,
        showNavHeading,
        items
      );
    }
  }]);
  return NavigationDividedLinkList;
}(React__default.Component);

NavigationDividedLinkList.propTypes = {
  name: PropTypes.string,
  navigationType: PropTypes.string.isRequired,
  links: PropTypes.arrayOf(PropTypes.shape({
    to: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    hideInHeader: PropTypes.bool
  })).isRequired
};

// This is currently used in the top half of the mobile navigation

var NavigationLinkList = function (_React$Component) {
  inherits(NavigationLinkList, _React$Component);

  function NavigationLinkList() {
    classCallCheck(this, NavigationLinkList);
    return possibleConstructorReturn(this, (NavigationLinkList.__proto__ || Object.getPrototypeOf(NavigationLinkList)).apply(this, arguments));
  }

  createClass(NavigationLinkList, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      // Font size is larger for items with a heading in mobile
      var linkFontSize = this.props.title && this.props.navigationType === 'mobile-navigation' ? 'shell-txt-l' : 'shell-txt-m';

      // Special case: the custom combination menu doesn't need a heading
      var navigationHeading = this.props.title ? React__default.createElement(
        'div',
        { className: shellStyles.popupMenuNavHeading },
        this.props.title
      ) : '';

      var linkListItems = React__default.createElement(
        'ul',
        null,
        this.props.links.map(function (link, i) {
          if (link.hideInMobile) {
            return;
          }
          return React__default.createElement(
            'li',
            { key: i },
            React__default.createElement(
              'a',
              {
                href: link.to,
                'data-nav-link': true,
                'data-test': _this2.props.navigationType + '-link-' + link.name
              },
              React__default.createElement(
                'p',
                {
                  className: shellStyles.popoverNavLink + ' ' + linkFontSize + ' shell-mb0 shell-mt12'
                },
                link.name
              )
            )
          );
        })
      );

      return React__default.createElement(
        'div',
        { className: 'shell-pt24' },
        navigationHeading,
        linkListItems
      );
    }
  }]);
  return NavigationLinkList;
}(React__default.Component);

NavigationLinkList.propTypes = {
  title: PropTypes.string,
  navigationType: PropTypes.string.isRequired,
  links: PropTypes.arrayOf(PropTypes.shape({
    to: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    hideInHeader: PropTypes.bool,
    hideInMobile: PropTypes.bool
  })).isRequired
};

var MobileUserMenu = function (_React$Component) {
  inherits(MobileUserMenu, _React$Component);

  function MobileUserMenu() {
    classCallCheck(this, MobileUserMenu);
    return possibleConstructorReturn(this, (MobileUserMenu.__proto__ || Object.getPrototypeOf(MobileUserMenu)).apply(this, arguments));
  }

  createClass(MobileUserMenu, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React__default.createElement(
        'div',
        null,
        React__default.createElement(
          'div',
          {
            className: 'shell-border-t shell-border--gray-light shell-mb30 shell-pt30',
            'data-test': 'mobile-user-menu',
            'data-generic-navigation': true,
            style: { display: 'none' }
          },
          React__default.createElement(
            'div',
            { className: 'shell-flex-child shell-flex-child--grow' },
            React__default.createElement(
              'div',
              { className: 'shell-grid shell-grid--gut12' },
              React__default.createElement(
                'div',
                { className: 'shell-col shell-col--6' },
                React__default.createElement(
                  'a',
                  {
                    href: '/account/',
                    className: shellStyles.popoverNavLink + ' shell-txt-m shell-mb0'
                  },
                  'Account'
                )
              ),
              React__default.createElement(
                'div',
                { className: 'shell-col shell-col--6' },
                React__default.createElement(
                  'a',
                  {
                    href: '/studio/',
                    className: shellStyles.popoverNavLink + ' shell-txt-m shell-mb0'
                  },
                  'Studio'
                )
              )
            )
          )
        ),
        React__default.createElement(
          'div',
          { className: 'shell-bg-gray-faint shell-py24 shell-px24 shell-ml-neg24 shell-mr-neg24 shell-mb-neg24' },
          React__default.createElement(
            'div',
            { 'data-display-block-authenticated': true },
            React__default.createElement(
              'div',
              { className: 'shell-flex-parent shell-flex-parent--space-center-main shell-flex-parent--space-between-main' },
              React__default.createElement('div', {
                'data-user-name': true,
                className: 'shell-flex-child shell-txt-s shell-color-gray'
              }),
              React__default.createElement(
                'div',
                { className: 'shell-flex-child' },
                React__default.createElement(
                  'button',
                  {
                    'data-sign-out': true,
                    'data-test': 'mobile-signout-button',
                    className: shellStyles.popoverNavLink + ' shell-txt-s shell-mb0'
                  },
                  React__default.createElement(
                    'div',
                    { className: 'shell-flex-parent shell-flex-parent--center-cross shell-txt-bold' },
                    React__default.createElement(
                      'svg',
                      { className: 'shell-icon shell-mr3', viewBox: '0 0 18 18' },
                      React__default.createElement('path', { d: 'M4,4c0,0-1,0-1,1v8c0,1,1,1,1,1h4c0.6,0,1-0.4,1-1s-0.4-1-1-1H5V6h3c0.6,0,1-0.4,1-1S8.6,4,8,4H4z M11,5 c-0.3,0-0.5,0.1-0.7,0.3c-0.4,0.4-0.4,1,0,1.4L11.6,8H7C6.5,8,6,8.5,6,9s0.5,1,1,1h4.6l-1.3,1.3c-0.4,0.4-0.4,1,0,1.4s1,0.4,1.4,0 l2.8-2.9c0.2-0.2,0.4-0.5,0.4-0.9c0-0.3-0.2-0.6-0.4-0.9l-2.8-2.9C11.5,5.1,11.3,5,11,5L11,5z' })
                    ),
                    React__default.createElement(
                      'span',
                      { className: 'shell-flex-child' },
                      'Sign out'
                    )
                  )
                )
              )
            )
          ),
          React__default.createElement(
            'div',
            { 'data-display-block-unauthenticated': true, style: { display: 'none' } },
            React__default.createElement(
              'a',
              {
                href: '/signin/',
                className: shellStyles.popoverNavLink + ' shell-txt-m shell-w-full',
                'data-test': 'mobile-signin-button'
              },
              React__default.createElement(NavigationHighlightLink, { label: 'Sign in' })
            )
          )
        )
      );
    }
  }]);
  return MobileUserMenu;
}(React__default.Component);

MobileUserMenu.propTypes = {
  className: PropTypes.string
};

var MOBILE_HEADER_HEIGHT = 72; // This number should match the actual height of the mobile header!

var MobileNavigation = function (_React$Component) {
  inherits(MobileNavigation, _React$Component);

  function MobileNavigation() {
    classCallCheck(this, MobileNavigation);
    return possibleConstructorReturn(this, (MobileNavigation.__proto__ || Object.getPrototypeOf(MobileNavigation)).apply(this, arguments));
  }

  createClass(MobileNavigation, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var menuItemClasses = shellStyles.popoverNavLink + ' txt-l';

      return React__default.createElement(
        'div',
        { className: 'shell-mr-neg6 shell-flex-child shell-flex-parent shell-flex-parent--end-main shell-z1 shell-absolute shell-top shell-left shell-w-full' },
        React__default.createElement('div', {
          id: 'mobile-nav-backdrop',
          'data-test': 'mobile-nav-backdrop',
          className: 'shell-absolute shell-bottom shell-left shell-right shell-mobile-nav__backdrop',
          style: {
            top: MOBILE_HEADER_HEIGHT,
            backgroundImage: 'linear-gradient(to bottom, transparent, rgba(31, 51, 73, .5))'
          }
        }),
        React__default.createElement(
          'div',
          {
            id: 'mobile-nav-menu',
            'data-test': 'mobile-nav-menu',
            className: shellStyles.mobilePopoverContainer + ' shell-w-full shell-animated-menu',
            style: {
              top: 0,
              right: 0
            }
          },
          React__default.createElement(
            'div',
            {
              className: 'shell-shadow-darken10-bold shell-bg-white shell-clip shell-px24',
              style: { paddingTop: MOBILE_HEADER_HEIGHT }
            },
            React__default.createElement(
              'div',
              { className: 'shell-flex-parent--column', 'data-generic-navigation': true },
              React__default.createElement(
                'div',
                { className: 'shell-grid shell-grid--gut12' },
                React__default.createElement(
                  'div',
                  { className: 'shell-col shell-col--6' },
                  React__default.createElement(NavigationLinkList, _extends({}, navigationMenuData.headerMainMenus.products.products, {
                    navigationType: 'mobile-navigation'
                  })),
                  React__default.createElement(NavigationLinkList, _extends({}, navigationMenuData.headerMainMenus.products.platforms, {
                    navigationType: 'mobile-navigation'
                  }))
                ),
                React__default.createElement(
                  'div',
                  { className: 'shell-col shell-col--6' },
                  React__default.createElement(NavigationLinkList, _extends({}, navigationMenuData.headerMainMenus.solutions.industries, {
                    navigationType: 'mobile-navigation'
                  }))
                )
              ),
              React__default.createElement(
                'div',
                { className: 'shell-relative shell-mt30 shell-pt18 shell-pb30' },
                React__default.createElement('div', { className: 'shell-border-t shell-border--gray-light shell-absolute shell-top shell-left shell-right' }),
                React__default.createElement(NavigationDividedLinkList, _extends({}, navigationMenuData.mobileCombinationMenu, {
                  navigationType: 'mobile-navigation'
                }))
              )
            ),
            React__default.createElement(
              'div',
              {
                className: 'shell-flex-parent--column shell-mb24',
                'data-app-specific-navigation': true
              },
              React__default.createElement(
                'a',
                { href: '/studio/', className: menuItemClasses + ' shell-mb12' },
                'Studio'
              ),
              React__default.createElement(
                'a',
                { href: '/account/', className: menuItemClasses + ' shell-mb12' },
                'Account'
              ),
              React__default.createElement(
                'a',
                {
                  'data-user-staff-mobile': true,
                  href: '/admin/',
                  className: 'shell-color-gray-dark shell-color-blue-on-hover txt-l shell-mb12',
                  style: { display: 'none' }
                },
                'Admin'
              ),
              React__default.createElement(
                'a',
                {
                  href: '/account/settings/',
                  className: menuItemClasses + ' shell-mb12'
                },
                'Settings'
              ),
              React__default.createElement(
                'a',
                { href: '/help/', className: menuItemClasses },
                'Help'
              )
            ),
            React__default.createElement(MobileUserMenu, null)
          )
        )
      );
    }
  }]);
  return MobileNavigation;
}(React__default.Component);

var PageHeader = function (_React$Component) {
  inherits(PageHeader, _React$Component);

  function PageHeader() {
    classCallCheck(this, PageHeader);
    return possibleConstructorReturn(this, (PageHeader.__proto__ || Object.getPrototypeOf(PageHeader)).apply(this, arguments));
  }

  createClass(PageHeader, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'getMenuID',
    value: function getMenuID(menuName) {
      return menuName.replace(/\s+/g, '').toLowerCase() + '-menu';
    }
  }, {
    key: 'getTriggerID',
    value: function getTriggerID(menuID) {
      return menuID + '-trigger';
    }
  }, {
    key: 'getPointerID',
    value: function getPointerID(menuID) {
      return menuID + '-pointer';
    }
  }, {
    key: 'renderIconReference',
    value: function renderIconReference() {
      // Reference shell specific icon for chevron-right
      return React__default.createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          xmlnsXlink: 'http://www.w3.org/1999/xlink',
          className: 'shell-none'
        },
        React__default.createElement(
          'symbol',
          { id: 'shell-icon-chevron-right', viewBox: '0 0 18 18' },
          React__default.createElement('path', { d: 'M7.5 13.105a.806.806 0 0 1-.537-1.407l3.055-2.724-3.08-2.997a.806.806 0 1 1 1.124-1.155l3.7 3.6a.805.805 0 0 1-.025 1.18l-3.7 3.3a.803.803 0 0 1-.537.204z' })
        )
      );
    }
  }, {
    key: 'render',
    value: function render() {
      var logoClasses = 'shell-mb-logo';
      var logoOverlay = null;
      if (!this.props.darkText) {
        logoClasses += ' shell-mb-logo--white';
        // When we're rendering the white logo, we also need to render a blue logo to display
        // when the mobile navigation opens.
        logoOverlay = React__default.createElement('a', {
          className: 'shell-mb-logo shell-mobile-nav__logo--overlay shell-absolute shell-top shell-left',
          href: '/',
          'aria-label': 'Mapbox'
        });
      }

      var headerClasses = 'relative';
      if (this.props.position === 'absolute') {
        headerClasses = 'shell-absolute shell-w-full shell-z1';
      }

      return React__default.createElement(
        'header',
        { className: headerClasses, 'data-swiftype-index': 'false' },
        React__default.createElement(
          'div',
          { className: 'shell-none limiter shell-mt24 shell-flex-parent-mm shell-flex-parent--center-cross' },
          React__default.createElement('a', {
            className: 'shell-flex-child shell-flex-child--no-shrink ' + logoClasses,
            href: '/',
            'aria-label': 'Mapbox',
            'data-test': 'logo-link'
          }),
          React__default.createElement(
            'div',
            { className: 'shell-flex-child shell-flex-child--grow shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main' },
            React__default.createElement(
              'div',
              {
                className: 'shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main',
                'data-app-specific-navigation': true,
                'data-test': 'app-specific-navigation',
                style: { display: 'none' }
              },
              React__default.createElement(
                NavigationItem,
                {
                  darkText: this.props.darkText,
                  href: '/studio/',
                  name: 'Studio'
                },
                'Studio'
              ),
              React__default.createElement(
                NavigationItem,
                {
                  darkText: this.props.darkText,
                  href: '/account/',
                  name: 'Account'
                },
                'Account'
              )
            ),
            React__default.createElement(
              'div',
              {
                className: 'shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main',
                'data-generic-navigation': true,
                'data-test': 'generic-navigation',
                style: { display: 'none' }
              },
              React__default.createElement(ProductsMenu, { darkText: this.props.darkText }),
              React__default.createElement(SolutionsMenu, { darkText: this.props.darkText }),
              React__default.createElement(DocumentationMenu, { darkText: this.props.darkText }),
              React__default.createElement(CompanyMenu, { darkText: this.props.darkText }),
              React__default.createElement(
                NavigationItem,
                {
                  darkText: this.props.darkText,
                  href: '/pricing/',
                  name: 'Pricing'
                },
                'Pricing'
              ),
              React__default.createElement(
                NavigationItem,
                {
                  darkText: this.props.darkText,
                  href: '/blog/',
                  name: 'Blog'
                },
                'Blog'
              )
            )
          ),
          React__default.createElement(
            'div',
            { className: 'shell-flex-child shell-ml6 shell-ml12-ml shell-ml18-mxl' },
            React__default.createElement(UserMenu, { darkText: this.props.darkText })
          )
        ),
        React__default.createElement(
          'div',
          {
            id: 'page-header-content',
            className: 'shell-none-mm limiter shell-py12 shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--space-between-main shell-relative shell-z2'
          },
          React__default.createElement(
            'div',
            { className: 'shell-mb-logo__wrapper shell-flex-child shell-relative' },
            React__default.createElement('a', {
              className: logoClasses,
              href: '/',
              'aria-label': 'Mapbox',
              'data-test': 'mobile-logo-link'
            }),
            logoOverlay
          ),
          React__default.createElement(MobileMenuButton, { darkText: this.props.darkText })
        ),
        React__default.createElement(MobileNavigation, null),
        this.renderIconReference()
      );
    }
  }]);
  return PageHeader;
}(React__default.Component);

PageHeader.propTypes = {
  darkText: PropTypes.bool,
  position: PropTypes.oneOf(['absolute', 'static'])
};

PageHeader.defaultProps = {
  darkText: false,
  position: 'absolute'
};

var FooterLegalStrip = function (_React$Component) {
  inherits(FooterLegalStrip, _React$Component);

  function FooterLegalStrip() {
    classCallCheck(this, FooterLegalStrip);
    return possibleConstructorReturn(this, (FooterLegalStrip.__proto__ || Object.getPrototypeOf(FooterLegalStrip)).apply(this, arguments));
  }

  createClass(FooterLegalStrip, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React__default.createElement(
        'div',
        { className: this.props.className },
        React__default.createElement(
          'span',
          { className: 'shell-mr18' },
          '\xA9 Mapbox'
        ),
        React__default.createElement(
          'a',
          {
            className: 'shell-link shell-color-darken50 shell-color-blue-on-hover shell-mr18',
            href: '/tos/'
          },
          'Terms'
        ),
        React__default.createElement(
          'a',
          {
            className: 'shell-link shell-color-darken50 shell-color-blue-on-hover shell-mr18',
            href: '/privacy/'
          },
          'Privacy'
        ),
        React__default.createElement(
          'a',
          {
            className: 'shell-link shell-color-darken50 shell-color-blue-on-hover',
            href: '/platform/security/'
          },
          'Security'
        )
      );
    }
  }]);
  return FooterLegalStrip;
}(React__default.Component);

FooterLegalStrip.propTypes = {
  className: PropTypes.string
};

var FooterSocialMediaStrip = function (_React$Component) {
  inherits(FooterSocialMediaStrip, _React$Component);

  function FooterSocialMediaStrip() {
    classCallCheck(this, FooterSocialMediaStrip);
    return possibleConstructorReturn(this, (FooterSocialMediaStrip.__proto__ || Object.getPrototypeOf(FooterSocialMediaStrip)).apply(this, arguments));
  }

  createClass(FooterSocialMediaStrip, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React__default.createElement(
        'div',
        { className: this.props.className },
        React__default.createElement(
          'a',
          {
            'aria-label': 'Github',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://github.com/mapbox'
          },
          React__default.createElement(
            'svg',
            {
              viewBox: '0 0 1790 1790',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React__default.createElement('path', { d: 'M704 1216q0 40-12.5 82t-43 76-72.5 34-72.5-34-43-76-12.5-82 12.5-82 43-76 72.5-34 72.5 34 43 76 12.5 82zm640 0q0 40-12.5 82t-43 76-72.5 34-72.5-34-43-76-12.5-82 12.5-82 43-76 72.5-34 72.5 34 43 76 12.5 82zm160 0q0-120-69-204t-187-84q-41 0-195 21-71 11-157 11t-157-11q-152-21-195-21-118 0-187 84t-69 204q0 88 32 153.5t81 103 122 60 140 29.5 149 7h168q82 0 149-7t140-29.5 122-60 81-103 32-153.5zm224-176q0 207-61 331-38 77-105.5 133t-141 86-170 47.5-171.5 22-167 4.5q-78 0-142-3t-147.5-12.5-152.5-30-137-51.5-121-81-86-115q-62-123-62-331 0-237 136-396-27-82-27-170 0-116 51-218 108 0 190 39.5t189 123.5q147-35 309-35 148 0 280 32 105-82 187-121t189-39q51 102 51 218 0 87-27 168 136 160 136 398z' })
          )
        ),
        React__default.createElement(
          'a',
          {
            'aria-label': 'Twitter',
            className: 'shell-color-blue shell-color-gray-dark-on-hover ',
            href: 'https://twitter.com/mapbox/'
          },
          React__default.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React__default.createElement(
              'g',
              { id: '77744030-a5d8-4d71-88ad-2c70d4dcad7b', 'data-name': 'svg' },
              React__default.createElement('path', { d: 'M15.72,45.31c18.87,0,29.19-15.63,29.19-29.19,0-.44,0-.89,0-1.33A20.87,20.87,0,0,0,50,9.49a20.48,20.48,0,0,1-5.89,1.61,10.29,10.29,0,0,0,4.51-5.67A20.56,20.56,0,0,1,42.1,7.92a10.27,10.27,0,0,0-17.48,9.36A29.12,29.12,0,0,1,3.48,6.56,10.27,10.27,0,0,0,6.66,20.25,10.18,10.18,0,0,1,2,19v.13a10.26,10.26,0,0,0,8.23,10.06,10.24,10.24,0,0,1-4.63.18,10.27,10.27,0,0,0,9.58,7.12,20.58,20.58,0,0,1-12.74,4.4A20.88,20.88,0,0,1,0,40.71a29,29,0,0,0,15.72,4.6' })
            )
          )
        ),
        React__default.createElement(
          'a',
          {
            'aria-label': 'LinkedIn',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://www.linkedin.com/company/mapbox'
          },
          React__default.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React__default.createElement(
              'g',
              { id: '875e301f-501b-48d2-a663-a3a855ad9d70', 'data-name': 'svg' },
              React__default.createElement('rect', { x: '1.32', y: '13.16', width: '10.53', height: '36.84' }),
              React__default.createElement('path', { d: 'M36.84,13.16c-7.34,0-8.61,2.68-9.21,5.26V13.16H17.11V50H27.63V28.95c0-3.41,1.85-5.26,5.26-5.26s5.26,1.81,5.26,5.26V50H48.68V31.58C48.68,21.05,47.31,13.16,36.84,13.16Z' }),
              React__default.createElement('circle', { cx: '6.58', cy: '5.26', r: '5.26' })
            )
          )
        ),
        React__default.createElement(
          'a',
          {
            'aria-label': 'Facebook',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://www.facebook.com/Mapbox'
          },
          React__default.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React__default.createElement(
              'g',
              { id: '38f48a9c-03c5-4a1e-8aed-38100e1cd6a4', 'data-name': 'svg' },
              React__default.createElement('path', {
                id: 'c5d5da0e-6004-406b-ad77-825ffd134c21',
                'data-name': 'f',
                d: 'M28.87,50V27.19h7.65l1.15-8.89h-8.8V12.63c0-2.57.71-4.33,4.41-4.33H38v-8A63.78,63.78,0,0,0,31.13,0C24.34,0,19.69,4.14,19.69,11.75V18.3H12v8.89h7.68V50Z'
              })
            )
          )
        ),
        React__default.createElement(
          'a',
          {
            'aria-label': 'Dribbble',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://dribbble.com/mapbox'
          },
          React__default.createElement(
            'svg',
            {
              viewBox: '0 0 216 216',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React__default.createElement(
              'g',
              { id: 'bce6e84c-15aa-4744-93d1-a9e4a673398a', 'data-name': 'ball' },
              React__default.createElement(
                'g',
                { id: '99079e24-a239-40f3-bf61-84ebc8f0b2ce', 'data-name': 'ball' },
                React__default.createElement('path', { d: 'M108,15.78a92.16,92.16,0,1,0,92.16,92.16A92.27,92.27,0,0,0,108,15.78ZM169,58.28a78.31,78.31,0,0,1,17.78,49c-2.6-.55-28.62-5.83-54.81-2.54-.55-1.35-1.12-2.7-1.7-4.06-1.63-3.84-3.39-7.65-5.22-11.4C154.1,77.44,167.29,60.53,169,58.28ZM108,29.34A78.41,78.41,0,0,1,160.2,49.18c-1.41,2-13.26,17.94-41.25,28.43A421.91,421.91,0,0,0,89.58,31.53,79,79,0,0,1,108,29.34ZM74.56,36.82a503.63,503.63,0,0,1,29.18,45.53A293.82,293.82,0,0,1,31,91.94,79,79,0,0,1,74.56,36.82ZM29.31,108.06c0-.8,0-1.61,0-2.41,3.44.08,41.59.57,80.9-11.2,2.25,4.41,4.4,8.89,6.38,13.36-1,.29-2.08.61-3.1.94-40.6,13.12-62.2,48.89-64,51.94A78.39,78.39,0,0,1,29.31,108.06ZM108,186.78a78.29,78.29,0,0,1-48.31-16.62c1.41-2.9,17.35-33.69,61.75-49.16l.52-.17a326.92,326.92,0,0,1,16.79,59.69A78.19,78.19,0,0,1,108,186.78Zm44-13.47a338.31,338.31,0,0,0-15.29-56.12c24.67-4,46.34,2.51,49,3.36A78.84,78.84,0,0,1,152,173.31Z' })
              )
            )
          )
        ),
        React__default.createElement(
          'a',
          {
            'aria-label': 'Instagram',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://www.instagram.com/Mapbox'
          },
          React__default.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-icon shell-icon--s shell-inline'
            },
            React__default.createElement(
              'g',
              { id: 'fb2f6c01-da64-4dee-86ea-29fec95d4f45', 'data-name': 'svg' },
              React__default.createElement('path', { d: 'M25,0c-6.79,0-7.64,0-10.31.15A18.35,18.35,0,0,0,8.62,1.31,12.25,12.25,0,0,0,4.2,4.2,12.25,12.25,0,0,0,1.31,8.62,18.35,18.35,0,0,0,.15,14.69C0,17.36,0,18.21,0,25s0,7.64.15,10.31a18.35,18.35,0,0,0,1.16,6.07A12.26,12.26,0,0,0,4.2,45.8a12.25,12.25,0,0,0,4.43,2.88,18.35,18.35,0,0,0,6.07,1.16C17.36,50,18.21,50,25,50s7.64,0,10.31-.15a18.35,18.35,0,0,0,6.07-1.16,12.78,12.78,0,0,0,7.31-7.31,18.35,18.35,0,0,0,1.16-6.07C50,32.64,50,31.79,50,25s0-7.64-.15-10.31a18.35,18.35,0,0,0-1.16-6.07A12.25,12.25,0,0,0,45.8,4.2a12.26,12.26,0,0,0-4.43-2.88A18.35,18.35,0,0,0,35.31.15C32.64,0,31.79,0,25,0Zm0,4.5c6.68,0,7.47,0,10.1.15a13.83,13.83,0,0,1,4.64.86,7.75,7.75,0,0,1,2.87,1.87,7.75,7.75,0,0,1,1.87,2.87,13.83,13.83,0,0,1,.86,4.64c.12,2.64.15,3.43.15,10.1s0,7.47-.15,10.1a13.83,13.83,0,0,1-.86,4.64,8.28,8.28,0,0,1-4.74,4.74,13.83,13.83,0,0,1-4.64.86c-2.64.12-3.43.15-10.1.15s-7.47,0-10.1-.15a13.83,13.83,0,0,1-4.64-.86,7.74,7.74,0,0,1-2.87-1.87,7.75,7.75,0,0,1-1.87-2.87,13.83,13.83,0,0,1-.86-4.64C4.53,32.47,4.5,31.68,4.5,25s0-7.47.15-10.1a13.83,13.83,0,0,1,.86-4.64A7.75,7.75,0,0,1,7.38,7.38a7.75,7.75,0,0,1,2.87-1.87,13.83,13.83,0,0,1,4.64-.86c2.64-.12,3.43-.15,10.1-.15' }),
              React__default.createElement('path', { d: 'M25,33.33A8.33,8.33,0,1,1,33.33,25,8.33,8.33,0,0,1,25,33.33Zm0-21.17A12.84,12.84,0,1,0,37.84,25,12.84,12.84,0,0,0,25,12.16Z' }),
              React__default.createElement('path', { d: 'M41.35,11.65a3,3,0,1,1-3-3,3,3,0,0,1,3,3Z' })
            )
          )
        )
      );
    }
  }]);
  return FooterSocialMediaStrip;
}(React__default.Component);

FooterSocialMediaStrip.propTypes = {
  className: PropTypes.string
};

var PageFooter = function (_Component) {
  inherits(PageFooter, _Component);

  function PageFooter() {
    classCallCheck(this, PageFooter);
    return possibleConstructorReturn(this, (PageFooter.__proto__ || Object.getPrototypeOf(PageFooter)).apply(this, arguments));
  }

  createClass(PageFooter, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'renderLogo',
    value: function renderLogo() {
      return React__default.createElement(
        'div',
        { className: 'shell-footer-column shell-col shell-col--6 shell-flex-child shell-mt24 shell-mt0-mm shell-none shell-block-ml' },
        React__default.createElement('a', {
          className: 'shell-mb-logo-m',
          href: '/',
          'aria-label': 'Mapbox',
          'data-test': 'logo-link'
        })
      );
    }
  }, {
    key: 'renderMenuLinkList',
    value: function renderMenuLinkList(menuData) {
      if (!menuData.links || menuData.links.length === 0) return null;
      return menuData.links.map(function (link, index) {
        if (link.hideInFooter) return;
        return React__default.createElement(
          'div',
          { className: 'shell-block', key: index },
          React__default.createElement(
            'a',
            {
              href: link.to,
              className: 'shell-txt-s shell-color-gray-dark shell-color-blue-on-hover'
            },
            link.name
          )
        );
      });
    }
  }, {
    key: 'renderMenuHighlightedLinkList',
    value: function renderMenuHighlightedLinkList(menuData) {
      if (!menuData.highlightedLinks || menuData.highlightedLinks.length === 0) return null;
      var firstVisibleHighlightedLink = false;
      return menuData.highlightedLinks.map(function (link, index) {
        if (link.hideInFooter) return;
        if (!firstVisibleHighlightedLink) {
          firstVisibleHighlightedLink = true;
          return React__default.createElement(
            'div',
            { className: 'shell-block shell-mt24', key: index },
            React__default.createElement(
              'div',
              { className: 'shell-inline shell-pt12 shell-border-t shell-border--gray-light' },
              React__default.createElement(
                'a',
                {
                  className: 'shell-txt-s shell-color-gray-dark shell-color-blue-on-hover',
                  href: link.to
                },
                link.name
              )
            )
          );
        }
        return React__default.createElement(
          'div',
          { className: 'shell-inline-block shell-mt6', key: index },
          React__default.createElement(
            'a',
            {
              className: 'shell-txt-s shell-color-gray-dark shell-color-blue-on-hover',
              href: link.to
            },
            link.name
          )
        );
      });
    }
  }, {
    key: 'renderMenus',
    value: function renderMenus() {
      var _this2 = this;

      var footerColumnItemsIds = ['productsMenu', 'useCaseMenu', 'resourcesMenu', 'companyMenu'];
      return footerColumnItemsIds.map(function (columnId, index) {
        var columnClasses = 'shell-footer-column shell-col shell-col--6 shell-flex-child shell-mt24 shell-mt0-mm';
        if (index === footerColumnItemsIds.length - 1) columnClasses += ' mb0-mm mb24';
        var columnData = columnId in navigationMenuData.headerMainMenus ? navigationMenuData.headerMainMenus[columnId] : navigationMenuData[columnId];
        return React__default.createElement(
          'div',
          { key: index, className: columnClasses },
          React__default.createElement(
            'div',
            { className: shellStyles.popupMenuNavHeading + ' shell-mb3' },
            columnData.name
          ),
          _this2.renderMenuLinkList(columnData),
          _this2.renderMenuHighlightedLinkList(columnData)
        );
      });
    }
  }, {
    key: 'renderLegalAndSocialMedia',
    value: function renderLegalAndSocialMedia() {
      return React__default.createElement(
        'div',
        {
          id: 'page-footer-legal-social',
          className: 'shell-grid shell-txt-s shell-color-darken50 shell-py12 shell-py0-ml shell-mt42-ml'
        },
        React__default.createElement(FooterLegalStrip, { className: 'shell-col shell-col--12 shell-col--6-mm shell-my12' }),
        React__default.createElement(FooterSocialMediaStrip, { className: 'shell-col shell-col--12 shell-col--6-mm shell-my12 shell-footer-fr' })
      );
    }
  }, {
    key: 'render',
    value: function render() {
      return React__default.createElement(
        'footer',
        {
          id: 'page-footer',
          className: 'shell-py12 shell-py48-ml',
          'data-swiftype-index': 'false'
        },
        React__default.createElement(
          'div',
          { className: 'limiter' },
          React__default.createElement(
            'div',
            {
              id: 'page-footer-nav',
              className: 'shell-grid shell-mt24 shell-flex-parent-mm shell-flex-parent--space-between-main-mm'
            },
            this.renderLogo(),
            this.renderMenus()
          ),
          this.renderLegalAndSocialMedia()
        )
      );
    }
  }]);
  return PageFooter;
}(React.Component);

var DEFAULT_SOCIAL_IMAGE_URL = 'https://www.mapbox.com/static/social-media/social-1200x630.png';
var DEFAULT_SOCIAL_IMAGE_THUMBNAIL_URL = 'https://www.mapbox.com/static/social-media/social-120x120.png';

var MetaTagger = function (_React$PureComponent) {
  inherits(MetaTagger, _React$PureComponent);

  function MetaTagger() {
    classCallCheck(this, MetaTagger);
    return possibleConstructorReturn(this, (MetaTagger.__proto__ || Object.getPrototypeOf(MetaTagger)).apply(this, arguments));
  }

  createClass(MetaTagger, [{
    key: 'render',
    value: function render() {
      var props = this.props;

      var suffixedTitle = /^Mapbox/.test(props.title) ? props.title : props.title + ' | Mapbox';
      var preppedDescription = props.description.replace(/\s+/g, ' ');
      var prodUrl = 'https://www.mapbox.com';
      if (props.pathname[0] !== '/') prodUrl += '/';
      prodUrl += props.pathname;

      var metaItems = [{ name: 'description', content: preppedDescription }];

      metaItems.push({ name: 'twitter:title', content: props.title }, { property: 'og:title', content: props.title }, { name: 'twitter:description', content: preppedDescription }, { property: 'og:description', content: preppedDescription }, { property: 'og:url', content: prodUrl }, { property: 'og:type', content: 'website' }, {
        class: 'swiftype',
        name: 'title',
        'data-type': 'string',
        content: props.title
      }, {
        class: 'swiftype',
        name: 'excerpt',
        'data-type': 'string',
        content: props.description
      }, { name: 'twitter:image:alt', content: props.imageAlt }, { property: 'og:image', content: props.imageUrl }, {
        class: 'swiftype',
        name: 'image',
        'data-type': 'enum',
        content: props.imageUrl
      },
      // https://developers.google.com/web/updates/2014/11/Support-for-theme-color-in-Chrome-39-for-Android
      { name: 'theme-color', content: '#4264fb' });

      if (props.largeImage) {
        metaItems.push({ name: 'twitter:card', content: 'summary_large_image' }, { name: 'twitter:image', content: props.imageUrl });
      } else {
        metaItems.push({ name: 'twitter:card', content: 'summary' }, { name: 'twitter:image', content: props.imageUrlThumbnail });
      }

      return React__default.createElement(Helmet__default, { title: suffixedTitle, meta: metaItems });
    }
  }]);
  return MetaTagger;
}(React__default.PureComponent);

MetaTagger.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  pathname: PropTypes.string.isRequired,
  imageUrl: PropTypes.string,
  imageUrlThumbnail: PropTypes.string,
  imageAlt: PropTypes.string,
  largeImage: PropTypes.bool
};

MetaTagger.defaultProps = {
  imageUrl: DEFAULT_SOCIAL_IMAGE_URL,
  imageUrlThumbnail: DEFAULT_SOCIAL_IMAGE_THUMBNAIL_URL,
  imageAlt: 'Mapbox',
  largeImage: true
};

/* globals MapboxPageShell */
var pageShellInitialized = false;
var lastUrl = void 0;

var ReactPageShell = function (_React$Component) {
  inherits(ReactPageShell, _React$Component);

  function ReactPageShell() {
    classCallCheck(this, ReactPageShell);
    return possibleConstructorReturn(this, (ReactPageShell.__proto__ || Object.getPrototypeOf(ReactPageShell)).apply(this, arguments));
  }

  createClass(ReactPageShell, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      if (!window.MapboxPageShell) throw new Error('MapboxPageShell not loaded');

      if (!pageShellInitialized) {
        this.initialize();
      } else {
        MapboxPageShell.initialize();
      }
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate() {
      // Avoid reinitializing if we're actually on the same page.
      var currentUrl = window.location.href;
      if (currentUrl === lastUrl) return;
      lastUrl = currentUrl;
      MapboxPageShell.initialize();
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      MapboxPageShell.removeNavigation();
    }
  }, {
    key: 'initialize',
    value: function initialize() {
      var _this2 = this;

      // On the dev-server, navigation elements weren't mounted when
      // MapboxPageShell first initialized the nav.
      MapboxPageShell.initialize();
      MapboxPageShell.afterUserCheck(function () {
        if (_this2.props.onUser) {
          _this2.props.onUser(MapboxPageShell.getUser(), MapboxPageShell.getUserPublicAccessToken());
        }
      });
      pageShellInitialized = true;
    }
  }, {
    key: 'render',
    value: function render() {
      var footer = void 0;
      if (this.props.includeFooter) {
        footer = React__default.createElement(PageFooter, null);
      }

      var nonFooterClasses = 'shell-flex-child shell-flex-child--grow';
      if (this.props.nonFooterBgClass) {
        nonFooterClasses += ' ' + this.props.nonFooterBgClass;
      }

      var header = void 0;
      if (this.props.includeHeader) {
        header = React__default.createElement(PageHeader, { darkText: this.props.darkHeaderText });
      }

      return React__default.createElement(
        'div',
        null,
        React__default.createElement(BrowserCompatibilityWarning, null),
        React__default.createElement(
          'div',
          {
            id: 'page-shell',
            className: 'shell-flex-parent shell-flex-parent--column',
            style: { minHeight: '100vh', overflowX: 'hidden' }
          },
          React__default.createElement(PageHelmet, null),
          React__default.createElement(MetaTagger, this.props.meta),
          React__default.createElement(
            'div',
            { className: nonFooterClasses },
            React__default.createElement(
              'div',
              { className: 'shell-wrapper' },
              header
            ),
            React__default.createElement(
              'main',
              { style: { zIndex: 0, position: 'relative', display: 'block' } },
              this.props.children
            )
          ),
          React__default.createElement(
            'div',
            { className: 'shell-flex-child shell-wrapper' },
            footer
          )
        )
      );
    }
  }]);
  return ReactPageShell;
}(React__default.Component);

ReactPageShell.propTypes = {
  meta: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    pathname: PropTypes.string
  }).isRequired,
  onUser: PropTypes.func,
  darkHeaderText: PropTypes.bool,
  includeHeader: PropTypes.bool,
  includeFooter: PropTypes.bool,
  children: PropTypes.node,
  nonFooterBgClass: PropTypes.string
};

ReactPageShell.defaultProps = {
  darkHeaderText: false,
  includeHeader: true,
  includeFooter: true
};

module.exports = ReactPageShell;
