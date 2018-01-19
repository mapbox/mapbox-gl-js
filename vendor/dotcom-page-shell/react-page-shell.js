/* eslint-disable */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = _interopDefault(require('react'));
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
      return React.createElement(
        "div",
        {
          className: "shell-wrapper",
          id: "page-shell-compatibility-warning",
          style: { display: 'none' }
        },
        React.createElement(
          "div",
          { className: "shell-py12 shell-px24 shell-bg-pink shell-color-white shell-align-left" },
          React.createElement(
            "button",
            {
              className: "shell-absolute shell-top shell-right shell-p12",
              id: "page-shell-compatibility-dismiss"
            },
            React.createElement(
              "svg",
              { className: "shell-icon", viewBox: "0 0 18 18" },
              React.createElement("path", { d: "M5.8,5C5.4,5,5,5.4,5,5.8C5,6,5.1,6.2,5.3,6.3l0,0L7.9,9l-2.6,2.6C5.1,11.8,5,12,5,12.2C5,12.6,5.4,13,5.8,13 c0.2,0,0.4-0.1,0.6-0.3L9,10.1l2.6,2.6c0.1,0.2,0.4,0.3,0.6,0.3c0.4,0,0.8-0.4,0.8-0.8c0-0.2-0.1-0.4-0.2-0.6L10.1,9l2.6-2.7 C12.9,6.2,13,6,13,5.8C13,5.4,12.6,5,12.2,5c-0.2,0-0.4,0.1-0.6,0.2L9,7.8L6.4,5.2C6.2,5.1,6,5,5.8,5L5.8,5z" })
            )
          ),
          React.createElement(
            "div",
            { className: "limiter shell-block shell-relative" },
            React.createElement(
              "div",
              { className: "compatibility-warning-copy shell-mb6 shell-mb0-mm shell-align-center shell-align-left-mm shell-txt-bold" },
              "You are using an outdated browser and will encounter some problems with our website. Please consider upgrading."
            ),
            React.createElement(
              "div",
              { className: "compatibility-warning-action shell-align-center" },
              React.createElement(
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
}(React.Component);

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
      return React.createElement(
        Helmet.Helmet,
        null,
        React.createElement('meta', { charSet: 'utf-8' }),
        React.createElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
        React.createElement('link', { rel: 'shortcut icon', href: '/favicon.ico', type: 'image/x-icon' }),
        React.createElement('meta', {
          name: 'p:domain_verify',
          content: '57838af58c8045c2c024bc2f9d1577f9'
        }),
        React.createElement('meta', { name: 'twitter:site', content: '@Mapbox' }),
        React.createElement('meta', { property: 'og:site_name', content: 'Mapbox' })
      );
    }
  }]);
  return PageHelmet;
}(React.Component);

var shellStyles = {
  // Header names
  headerMenuName: 'shell-txt-s shell-txt-s-mxl shell-txt-bold shell-txt-nowrap shell-py6',

  // Mobile navigation popover
  mobilePopoverContainer: 'shell-absolute shell-z5',

  // Medium to X-large navigation
  navigationMenu: 'shell-relative shell-mx6 shell-mx12-ml shell-mx18-mxl',

  // Medium to X-large navigation popover
  popoverContainer: 'shell-absolute shell-w-full shell-z2 shell-disable-text-size-adjust',
  popoverBody: 'shell-shadow-darken10-bold shell-bg-white',
  popoverTriangle: 'shell-triangle-wide shell-triangle-wide--u shell-color-white shell-z5',

  popoverNavHeading: 'shell-txt-uppercase shell-txt-s shell-txt-spacing1 shell-txt-fancy shell-color-darken50',

  // Left blue highlight section
  popoverNavLinkHighlight: 'shell-inline-block shell-color-blue shell-color-gray-dark-on-hover shell-txt-s shell-txt-bold',

  // Right navigation, use menu, footer links seciton
  popoverNavLink: 'shell-inline-block shell-color-gray-dark shell-color-blue-on-hover',
  popoverNavLinkDescription: 'shell-inline-block shell-color-darken50 shell-txt-s',

  // User menu popovers
  userNavLink: 'shell-align-middle shell-color-gray-dark shell-color-blue-on-hover shell-txt-s shell-mx12 shell-mx12-ml shell-mx24-mxl shell-my12',
  userAvatar: 'shell-border shell-border--2 shell-border--white shell-h30 shell-w30 shell-bg-darken25 shell-clip shell-round-full'
};

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

      return React.createElement(
        'span',
        { className: 'shell-txt-bold' },
        textWithoutLastWord,
        ' ',
        React.createElement(
          'span',
          { className: 'shell-txt-nowrap' },
          lastWord,
          React.createElement(
            'span',
            { className: 'shell-icon-inliner' },
            React.createElement(
              'svg',
              { className: 'shell-icon' },
              React.createElement('use', { xlinkHref: '#shell-icon-chevron-right' })
            )
          )
        )
      );
    }
  }]);
  return NavigationHighlightLink;
}(React.Component);

NavigationHighlightLink.propTypes = {
  label: PropTypes.string.isRequired
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
        React.createElement(
          'div',
          null,
          React.createElement(
            'div',
            { className: 'shell-relative', style: { width: 66 } },
            React.createElement(
              'div',
              { 'data-show-unauthenticated': true, style: { visibility: 'hidden' } },
              React.createElement(
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
            React.createElement(
              'div',
              {
                'data-show-authenticated': true,
                style: { visibility: 'hidden' },
                className: 'clearfix shell-absolute shell-top shell-right'
              },
              React.createElement(
                'div',
                { id: 'user-menu', className: 'shell-fr' },
                React.createElement(
                  'button',
                  {
                    id: 'user-menu-trigger',
                    'data-test': 'user-menu-trigger',
                    'aria-haspopup': 'true',
                    'aria-controls': 'user-menu-body',
                    'aria-expanded': 'false',
                    'aria-label': 'User menu',
                    className: 'shell-flex-parent shell-flex-parent--center-cross ' + userButtonColorClasses
                  },
                  React.createElement('span', {
                    'data-user-avatar': true,
                    className: 'shell-flex-child shell-flex-child--no-shrink ' + shellStyles.userAvatar
                  })
                )
              )
            )
          ),
          React.createElement(
            'div',
            {
              id: 'user-menu-body',
              'data-test': 'user-menu',
              role: 'group',
              'aria-labelledby': 'user-menu-trigger',
              className: shellStyles.popoverContainer + ' shell-align-center shell-animated-menu',
              style: {
                right: 0,
                top: '100%',
                marginTop: '14px'
              }
            },
            React.createElement('div', {
              id: 'user-menu-pointer',
              className: shellStyles.popoverTriangle + ' shell-animated-menu__pointer',
              style: {
                position: 'absolute',
                top: 0
              }
            }),
            React.createElement(
              'div',
              { className: shellStyles.popoverBody + ' shell-py24' },
              React.createElement(
                'a',
                { href: '/studio/account/', className: shellStyles.userNavLink },
                'Account'
              ),
              React.createElement(
                'a',
                { href: '/studio/', className: shellStyles.userNavLink },
                'Studio'
              ),
              React.createElement(
                'a',
                { href: '/help/', className: shellStyles.userNavLink },
                'Help'
              ),
              React.createElement(
                'button',
                {
                  'data-sign-out': true,
                  'data-test': 'signout-button',
                  className: shellStyles.userNavLink
                },
                React.createElement(NavigationHighlightLink, { label: 'Sign out' })
              )
            )
          )
        )
      );
    }
  }]);
  return UserMenu;
}(React.Component);

UserMenu.propTypes = {
  darkText: PropTypes.bool
};

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

      return React.createElement(
        'div',
        {
          className: 'shell-flex-child shell-mx6 shell-mx12-ml shell-mx18-mxl',
          style: { lineHeight: 1 }
        },
        React.createElement(
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
}(React.Component);

var NavigationItemWithMenu = function (_React$PureComponent) {
  inherits(NavigationItemWithMenu, _React$PureComponent);

  function NavigationItemWithMenu() {
    classCallCheck(this, NavigationItemWithMenu);
    return possibleConstructorReturn(this, (NavigationItemWithMenu.__proto__ || Object.getPrototypeOf(NavigationItemWithMenu)).apply(this, arguments));
  }

  createClass(NavigationItemWithMenu, [{
    key: 'render',
    value: function render() {
      var menuNameClasses = shellStyles.headerMenuName;
      menuNameClasses += this.props.darkText ? ' shell-navigation-menu-button shell-transition shell-color-gray-dark shell-color-blue-on-hover' : ' shell-navigation-menu-button shell-link shell-link--white';

      return React.createElement(
        'div',
        { style: { lineHeight: 1 } },
        React.createElement(
          'div',
          { className: shellStyles.navigationMenu },
          React.createElement(
            'button',
            {
              className: menuNameClasses,
              'data-nav-trigger': this.props.name,
              'data-test': 'nav-menu-trigger-' + this.props.name,
              'aria-haspopup': 'true',
              'aria-expanded': 'false',
              'aria-controls': this.props.menuID
            },
            this.props.children
          )
        )
      );
    }
  }]);
  return NavigationItemWithMenu;
}(React.PureComponent);

var HowMapboxWorksImg = function (_React$Component) {
  inherits(HowMapboxWorksImg, _React$Component);

  function HowMapboxWorksImg() {
    classCallCheck(this, HowMapboxWorksImg);
    return possibleConstructorReturn(this, (HowMapboxWorksImg.__proto__ || Object.getPrototypeOf(HowMapboxWorksImg)).apply(this, arguments));
  }

  createClass(HowMapboxWorksImg, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React.createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          className: this.props.className,
          viewBox: '0 0 110 66'
        },
        React.createElement(
          'g',
          { 'data-name': 'svg' },
          React.createElement('path', {
            d: 'M37.58 22.37h-6.43a7.37 7.37 0 1 0 0 2h6.43z',
            fill: '#1078bf'
          }),
          React.createElement('path', {
            d: 'M26.87 22.78a3 3 0 0 0-3.1-3 3 3 0 0 0-2.93 3.11 3 3 0 0 0 1.88 2.69l.89 1.54a.3.3 0 0 0 .52 0l.9-1.56a3 3 0 0 0 1.84-2.78z',
            fill: '#fff'
          }),
          React.createElement('circle', { cx: '23.86', cy: '22.78', r: '1.34', fill: '#62baed' }),
          React.createElement('path', {
            d: 'M37.25 40.54h-6.09a7.37 7.37 0 1 0 0 2h6.09z',
            fill: '#1078bf'
          }),
          React.createElement('path', {
            d: 'M29.27 41.65A2.57 2.57 0 0 0 26 39.19a3.18 3.18 0 0 0-5.53.64 2.2 2.2 0 0 0 .25 4.39h6.12a2.57 2.57 0 0 0 2.43-2.57z',
            fill: '#fff'
          }),
          React.createElement('path', {
            d: 'M25.92 41.6L24 39.22a.38.38 0 0 0-.58 0l-1.95 2.38a.38.38 0 0 0 .29.61h1.09v2h1.67v-2h1.1a.38.38 0 0 0 .3-.61z',
            fill: '#62baed'
          }),
          React.createElement('path', {
            d: 'M91.83 13.74H69.06a1.68 1.68 0 0 0-1.68 1.68v17.07a1.68 1.68 0 0 0 1.68 1.68h10.89v7.61a4.69 4.69 0 0 1-.83 3 2 2 0 0 1-1.52.59H61v2h16.6a4 4 0 0 0 3-1.22 6.52 6.52 0 0 0 1.36-4.47v-7.51h9.88a1.68 1.68 0 0 0 1.68-1.68V15.42a1.68 1.68 0 0 0-1.69-1.68z',
            fill: '#1078bf'
          }),
          React.createElement('rect', {
            x: '39.26',
            y: '10.73',
            width: '23.45',
            height: '44.55',
            rx: '4.19',
            ry: '4.19',
            fill: '#1078bf'
          }),
          React.createElement('rect', {
            x: '36.58',
            y: '10.73',
            width: '23.45',
            height: '44.55',
            rx: '4.19',
            ry: '4.19',
            fill: '#62baed'
          }),
          React.createElement('path', { fill: '#fff', d: 'M39.26 15.75h18.76v32.16H39.26z' }),
          React.createElement('path', {
            d: 'M49 47.91h-2V27.48a5.49 5.49 0 0 1 1.27-3.72 4.35 4.35 0 0 1 3.32-1.3H58v2h-6.45a2.41 2.41 0 0 0-1.86.67 3.5 3.5 0 0 0-.69 2.28z',
            fill: '#1078bf'
          }),
          React.createElement('circle', { cx: '47.97', cy: '34.19', r: '3.35', fill: '#2d9bdf' }),
          React.createElement('path', {
            d: 'M47.65 32.8l-1.22 2.44a.27.27 0 0 0 .4.35l1-.73 1.26.81a.27.27 0 0 0 .39-.35l-1.2-2.52a.35.35 0 0 0-.63 0z',
            fill: '#fff'
          }),
          React.createElement('path', {
            d: 'M79.11 20.52h-4a.75.75 0 0 1 0-1.5h4a.75.75 0 0 1 0 1.5z',
            fill: '#f7f8f9'
          }),
          React.createElement('path', {
            d: 'M71.4 20.52a.75.75 0 0 1-.5-1.3l.71-.64-.69-.58a.75.75 0 0 1 1-1.15l1.3 1.15a.75.75 0 0 1 0 1.13l-1.34 1.22a.74.74 0 0 1-.48.17z',
            fill: '#fff'
          }),
          React.createElement('path', {
            d: 'M80.78 27.89H71.4a.75.75 0 0 1 0-1.5h9.38a.75.75 0 0 1 0 1.5zM90.83 27.89h-6.7a.75.75 0 0 1 0-1.5h6.7a.75.75 0 0 1 0 1.5zM86.48 31.24H71.4a.75.75 0 0 1 0-1.5h15.08a.75.75 0 0 1 0 1.5zM85.47 24.54H71.4a.75.75 0 0 1 0-1.5h14.07a.75.75 0 0 1 0 1.5z',
            fill: '#62baed'
          })
        )
      );
    }
  }]);
  return HowMapboxWorksImg;
}(React.Component);

HowMapboxWorksImg.propTypes = {
  className: PropTypes.string
};

var TutorialsImg = function (_React$Component) {
  inherits(TutorialsImg, _React$Component);

  function TutorialsImg() {
    classCallCheck(this, TutorialsImg);
    return possibleConstructorReturn(this, (TutorialsImg.__proto__ || Object.getPrototypeOf(TutorialsImg)).apply(this, arguments));
  }

  createClass(TutorialsImg, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React.createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          className: this.props.className,
          viewBox: '0 0 110 66'
        },
        React.createElement(
          'g',
          { 'data-name': 'svg' },
          React.createElement('path', {
            d: 'M24.57 17.68h-4.2a2.1 2.1 0 0 0-2.09 2.1v2.79h8.38v-2.79a2.1 2.1 0 0 0-2.09-2.1zM57.12 44.23H38a4.83 4.83 0 0 0-4.76 3.84 4.54 4.54 0 0 0-.08.65 4.72 4.72 0 0 0 4.71 4.94h19.78a4.19 4.19 0 0 0 4.19-4.19v-10a4.71 4.71 0 0 1-4.72 4.76z',
            fill: '#269561'
          }),
          React.createElement('rect', {
            x: '38.44',
            y: '16.99',
            width: '26.19',
            height: '30.04',
            rx: '6.06',
            ry: '6.06',
            fill: '#afdec5'
          }),
          React.createElement('path', {
            d: 'M57.12 44.23a4.71 4.71 0 0 0 4.71-4.71V13.46A3.46 3.46 0 0 0 58.38 10H36.66a3.46 3.46 0 0 0-3.46 3.46v34.61h.09A4.83 4.83 0 0 1 38 44.23z',
            fill: '#fcfcfc'
          }),
          React.createElement('path', {
            d: 'M43.51 55.85L40.88 54l-3 1.91a.55.55 0 0 1-.84-.46v-5a1.66 1.66 0 0 1 1.66-1.66h4a1.66 1.66 0 0 1 1.66 1.66v5a.55.55 0 0 1-.85.4z',
            fill: '#afdec5'
          }),
          React.createElement('rect', {
            x: '37.39',
            y: '14.19',
            width: '20.61',
            height: '11.87',
            rx: '1.73',
            ry: '1.73',
            fill: '#33c377'
          }),
          React.createElement('path', {
            d: 'M52.41 18.78H41.23a.75.75 0 0 1 0-1.5h11.18a.75.75 0 0 1 0 1.5zM47.17 21.93h-5.94a.75.75 0 0 1 0-1.5h5.94a.75.75 0 0 1 0 1.5z',
            fill: '#f7f8f9'
          }),
          React.createElement('path', {
            d: 'M26.66 48.07l-1.5-1a.71.71 0 0 0-.93 0l-1.19 1a.64.64 0 0 1-.81 0L20.87 47a.71.71 0 0 0-.87 0l-1.7 1V22.57h8.38z',
            fill: '#afdec5'
          }),
          React.createElement('path', {
            d: 'M24.23 47.07l-1.19 1a.64.64 0 0 1-.81 0L20.87 47a.71.71 0 0 0-.87 0l-1.7 1v.18a1.49 1.49 0 0 0 .33.93l3.37 4.3a.61.61 0 0 0 1 0l3.39-4.23a1.49 1.49 0 0 0 .33-.93v-.18l-1.5-1a.71.71 0 0 0-.99 0z',
            fill: '#fff'
          }),
          React.createElement('path', {
            d: 'M26.34 49.17l-3.39 4.23a.61.61 0 0 1-1 0l-3.35-4.23a1.49 1.49 0 0 1-.33-.93v-4h8.38v4a1.49 1.49 0 0 1-.31.93z',
            fill: '#fcfcfc'
          }),
          React.createElement('path', {
            d: 'M22.47 51.56a3.47 3.47 0 0 0-1.63.41L22 53.41a.61.61 0 0 0 1 0L24.1 52a3.47 3.47 0 0 0-1.63-.44z',
            fill: '#269561'
          }),
          React.createElement('rect', {
            x: '70.42',
            y: '15.59',
            width: '21.3',
            height: '37.72',
            rx: '4.19',
            ry: '4.19',
            fill: '#269561'
          }),
          React.createElement('circle', { cx: '81.07', cy: '48.94', r: '1.92', fill: '#33c377' }),
          React.createElement('path', { fill: '#afdec5', d: 'M73.73 21.53H88.4v23.05H73.73z' })
        )
      );
    }
  }]);
  return TutorialsImg;
}(React.Component);

TutorialsImg.propTypes = {
  className: PropTypes.string
};

var navigationMenuData = {
  headerMainMenuOrder: ['products', 'documentation'],
  headerMainMenus: {
    products: {
      name: 'Products',
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
      }],
      highlightedLinks: [{
        name: 'More products',
        to: '/products/'
      }, {
        name: 'Pricing',
        to: '/pricing/'
      }]
    },
    documentation: {
      name: 'Documentation',
      links: [{
        name: 'GL JS',
        to: '/mapbox-gl-js/api/',
        hideInHeader: true
      }, {
        name: 'Maps SDK - iOS',
        to: '/ios-sdk/',
        hideInHeader: true
      }, {
        name: 'Maps SDK - Android',
        to: '/android-docs/map-sdk/overview/',
        hideInHeader: true
      }, {
        name: 'Maps SDK - Unity',
        to: '/unity-sdk/',
        hideInHeader: true
      }, {
        name: 'Maps SDK - Qt',
        to: '/qt/',
        hideInHeader: true
      }, {
        name: 'Navigation SDK',
        to: '/navigation-sdk/',
        hideInHeader: true
      }],
      highlightedLinks: [{
        name: 'More documentation',
        to: '/developers/',
        hideInFooter: true
      }, {
        name: 'API Documentation',
        to: '/api-documentation/',
        hideInHeader: true
      }, {
        name: 'Help',
        to: '/help/',
        hideInHeader: true
      }]
    }
  },
  sdkDocumentationMenu: {
    name: 'SDK & Plugin Documentation',
    links: [{
      name: 'GL JS',
      to: '/mapbox-gl-js/api/'
    }, {
      name: 'Maps SDK - iOS',
      to: '/ios-sdk/'
    }, {
      name: 'Maps SDK - Android',
      to: '/android-docs/map-sdk/overview/'
    }, {
      name: 'Maps SDK - Unity',
      to: '/unity-sdk/'
    }, {
      name: 'Maps SDK - Qt',
      to: '/qt/'
    }, {
      name: 'Navigation SDK',
      to: '/navigation-sdk/'
    }],
    highlightedLinks: []
  },
  apiDocumentationMenu: {
    name: 'API Documentation',
    links: [{
      name: 'Directions API',
      to: '/api-documentation/#directions'
    }, {
      name: 'Geocoding API',
      to: '/api-documentation/#geocoding'
    }, {
      name: 'Uploads API',
      to: '/api-documentation/#uploads'
    }, {
      name: 'Static API',
      to: '/api-documentation/#static'
    }, {
      name: 'Matrix API',
      to: '/api-documentation/#matrix'
    }, {
      name: 'Map Matching API',
      to: '/api-documentation/#map-matching'
    }, {
      name: 'Styles API',
      to: '/api-documentation/#styles'
    }, {
      name: 'Maps API',
      to: '/api-documentation/#maps'
    }, {
      name: 'Datasets API',
      to: '/api-documentation/#datasets'
    }, {
      name: 'Optimization API',
      to: '/api-documentation/#optimization'
    }],
    highlightedLinks: []
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
    highlightedLinks: [{
      name: 'Customer showcase',
      to: '/showcase/'
    }, {
      name: 'Talk to sales',
      to: '/contact/sales/',
      hideInHeader: true
    }]
  },
  helpMenu: {
    name: 'Help',
    links: [{
      name: 'How Mapbox works',
      description: 'Learn how the Mapbox platform works',
      to: '/help/how-mapbox-works/',
      displayBackgroundColor: 'shell-bg-blue-light',
      displayImage: HowMapboxWorksImg
    }, {
      name: 'Tutorials',
      description: 'Start with a guide or explore project ideas',
      to: '/help/tutorials/',
      displayBackgroundColor: 'shell-bg-green-light',
      displayImage: TutorialsImg
    }],
    highlightedLinks: [{
      name: 'More help',
      to: '/help/'
    }]
  },
  companyMenu: {
    name: 'Company',
    links: [{
      name: 'About',
      to: '/about/'
    }, {
      name: 'Jobs',
      to: '/jobs/'
    }, {
      name: 'Team',
      to: '/about/team/'
    }, {
      name: 'Blog',
      to: '/blog/'
    }, {
      name: 'Events',
      to: '/events/'
    }, {
      name: 'Press',
      to: '/about/press/'
    }, {
      name: 'Open source',
      to: '/about/open/'
    }],
    highlightedLinks: [{
      name: 'Contact',
      to: '/contact/'
    }]
  },
  mobileCombinationMenu: {
    links: [{
      name: 'Customer showcase',
      to: '/showcase/'
    }, {
      name: 'Documentation',
      to: '/developers/'
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
      name: 'Jobs',
      to: '/jobs/'
    }, {
      name: 'Team',
      to: '/about/team/'
    }, {
      name: 'Blog',
      to: '/blog/'
    }]
  }
};

var PopoverWrapper = function (_React$Component) {
  inherits(PopoverWrapper, _React$Component);

  function PopoverWrapper() {
    classCallCheck(this, PopoverWrapper);
    return possibleConstructorReturn(this, (PopoverWrapper.__proto__ || Object.getPrototypeOf(PopoverWrapper)).apply(this, arguments));
  }

  createClass(PopoverWrapper, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React.createElement(
        'div',
        {
          id: this.props.menuID,
          role: 'group',
          'aria-labelledby': this.props.triggerID,
          'data-nav-menu': this.props.name,
          'data-test': 'nav-menu-' + this.props.name,
          className: shellStyles.popoverContainer + ' shell-w-full shell-left shell-animated-menu',
          style: {
            top: '100%',
            marginTop: '14px'
          }
        },
        React.createElement('div', {
          id: this.props.pointerID,
          'data-nav-pointer': this.props.name,
          className: shellStyles.popoverTriangle + ' shell-animated-menu__pointer',
          style: {
            position: 'absolute',
            top: 0
          }
        }),
        React.createElement(
          'div',
          { className: shellStyles.popoverBody },
          this.props.children
        )
      );
    }
  }]);
  return PopoverWrapper;
}(React.Component);

var PopoverContentProducts = function (_React$Component) {
  inherits(PopoverContentProducts, _React$Component);

  function PopoverContentProducts() {
    classCallCheck(this, PopoverContentProducts);
    return possibleConstructorReturn(this, (PopoverContentProducts.__proto__ || Object.getPrototypeOf(PopoverContentProducts)).apply(this, arguments));
  }

  createClass(PopoverContentProducts, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React.createElement(
        PopoverWrapper,
        this.props,
        React.createElement(
          'div',
          { className: 'limiter shell-grid' },
          React.createElement(
            'div',
            { className: 'shell-col shell-col--offl1 shell-col--10 shell-col--offr1 shell-py30' },
            React.createElement(
              'div',
              {
                className: shellStyles.popoverNavHeading + ' shell-pb6 shell-border-b shell-border--gray-light'
              },
              navigationMenuData.headerMainMenus.products.name
            ),
            React.createElement(
              'div',
              { className: 'shell-grid' },
              React.createElement(
                'div',
                { className: 'shell-col shell-col--3 shell-col--2-mxl shell-mt18' },
                navigationMenuData.headerMainMenus.products.highlightedLinks.map(function (highlightedLink, i) {
                  if (highlightedLink.hideInHeader) return;
                  return React.createElement(
                    'div',
                    {
                      key: i,
                      className: 'shell-block shell-pr6 shell-mb6',
                      style: { lineHeight: 1 }
                    },
                    React.createElement(
                      'a',
                      {
                        href: highlightedLink.to,
                        className: shellStyles.popoverNavLinkHighlight,
                        'data-nav-link': highlightedLink.name,
                        'data-test': 'nav-link-' + highlightedLink.name
                      },
                      React.createElement(NavigationHighlightLink, {
                        label: highlightedLink.name
                      })
                    )
                  );
                })
              ),
              React.createElement(
                'div',
                { className: 'shell-col shell-col--9 shell-col--10-mxl' },
                React.createElement(
                  'ul',
                  { className: 'shell-grid shell-grid--gut12 shell-grid--gut18-ml shell-grid--gut24-mxl' },
                  navigationMenuData.headerMainMenus.products.links.map(function (link, i) {
                    return React.createElement(
                      'li',
                      {
                        className: 'shell-col shell-col--4 shell-col--3-mxl',
                        key: i,
                        style: { lineHeight: 1 }
                      },
                      React.createElement(
                        'a',
                        {
                          className: 'shell-link shell-color-gray-dark shell-color-blue-on-hover',
                          href: link.to,
                          'data-nav-link': true,
                          'data-test': 'nav-link-' + link.name
                        },
                        React.createElement(
                          'p',
                          { className: 'shell-txt-bold shell-txt-s shell-mb3 shell-mt18' },
                          link.name
                        ),
                        React.createElement(
                          'p',
                          { className: 'shell-color-darken50 shell-txt-s shell-my0' },
                          link.description
                        )
                      )
                    );
                  })
                )
              )
            )
          ),
          React.createElement(
            'div',
            { className: 'shell-col shell-col--offl1 shell-col--10 shell-col--offr1 shell-py30' },
            React.createElement(
              'div',
              {
                className: shellStyles.popoverNavHeading + ' shell-pb6 shell-border-b shell-border--gray-light'
              },
              navigationMenuData.useCaseMenu.name
            ),
            React.createElement(
              'div',
              { className: 'shell-grid' },
              React.createElement(
                'div',
                { className: 'shell-col shell-col--3 shell-col--2-mxl shell-mt18' },
                navigationMenuData.useCaseMenu.highlightedLinks.map(function (highlightedLink, i) {
                  if (highlightedLink.hideInHeader) return;
                  return React.createElement(
                    'div',
                    {
                      key: i,
                      className: 'shell-block',
                      style: { lineHeight: 1 }
                    },
                    React.createElement(
                      'a',
                      {
                        href: highlightedLink.to,
                        className: shellStyles.popoverNavLinkHighlight + ' shell-mb3 shell-pr6',
                        'data-nav-link': highlightedLink.name,
                        'data-test': 'nav-link-' + highlightedLink.name
                      },
                      React.createElement(NavigationHighlightLink, {
                        label: highlightedLink.name
                      })
                    )
                  );
                })
              ),
              React.createElement(
                'div',
                { className: 'shell-col shell-col--9 shell-col--10-mxl' },
                React.createElement(
                  'ul',
                  { className: 'shell-grid shell-grid--gut12 shell-grid--gut18-ml shell-grid--gut24-mxl' },
                  navigationMenuData.useCaseMenu.links.map(function (link, i) {
                    return React.createElement(
                      'li',
                      {
                        className: 'shell-col shell-col--4 shell-col--3-mxl',
                        key: i
                      },
                      React.createElement(
                        'a',
                        {
                          className: 'shell-link shell-color-gray-dark shell-color-blue-on-hover',
                          href: link.to,
                          'data-nav-link': true,
                          'data-test': 'nav-link-' + link.name
                        },
                        React.createElement(
                          'p',
                          { className: 'shell-txt-bold shell-txt-s shell-mt18' },
                          link.name
                        )
                      )
                    );
                  })
                )
              )
            )
          )
        )
      );
    }
  }]);
  return PopoverContentProducts;
}(React.Component);

var PopoverSectionSecondary = function (_React$Component) {
  inherits(PopoverSectionSecondary, _React$Component);

  function PopoverSectionSecondary() {
    classCallCheck(this, PopoverSectionSecondary);
    return possibleConstructorReturn(this, (PopoverSectionSecondary.__proto__ || Object.getPrototypeOf(PopoverSectionSecondary)).apply(this, arguments));
  }

  createClass(PopoverSectionSecondary, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      // Special case for help menu in documentation menu; limiters are added
      // per section due to an added background color
      return React.createElement(
        'div',
        { className: 'shell-col shell-col--offl1 shell-col--10 shell-col--offr1 shell-py30' },
        React.createElement(
          'div',
          {
            className: shellStyles.popoverNavHeading + ' shell-pb6 shell-border-b shell-border--gray-light'
          },
          navigationMenuData[this.props.id].name
        ),
        React.createElement(
          'div',
          { className: 'shell-grid shell-mt18' },
          React.createElement(
            'div',
            { className: 'shell-col shell-col--3 shell-col--2-mxl' },
            navigationMenuData[this.props.id].highlightedLinks.map(function (highlightedLink, i) {
              if (highlightedLink.hideInHeader) return;
              return React.createElement(
                'div',
                {
                  key: i,
                  className: 'shell-block shell-mb6 shell-pr6',
                  style: { lineHeight: 1 }
                },
                React.createElement(
                  'a',
                  {
                    href: highlightedLink.to,
                    className: shellStyles.popoverNavLinkHighlight,
                    'data-nav-link': highlightedLink.name,
                    'data-test': 'nav-link-' + highlightedLink.name
                  },
                  React.createElement(NavigationHighlightLink, { label: highlightedLink.name })
                )
              );
            })
          ),
          React.createElement(
            'div',
            { className: 'shell-col shell-col--9 shell-col--10-mxl' },
            React.createElement(
              'ul',
              { className: 'shell-grid shell-grid--gut12 shell-grid--gut18-ml shell-grid--gut24-mxl' },
              navigationMenuData[this.props.id].links.map(function (link, i) {
                if (link.hideInHeader) return;
                return React.createElement(
                  'li',
                  { className: 'shell-col shell-col--6', key: i },
                  React.createElement(
                    'a',
                    {
                      href: link.to,
                      className: 'shell-grid shell-grid--gut12 shell-grid--gut18-ml shell-grid--gut24-mxl shell-link shell-color-gray-dark shell-color-blue-on-hover',
                      'data-nav-link': true,
                      'data-test': 'nav-link-' + link.name
                    },
                    React.createElement(
                      'div',
                      { className: 'shell-col shell-col--4' },
                      React.createElement(
                        'div',
                        {
                          className: link.displayBackgroundColor + ' shell-relative shell-illustration-container'
                        },
                        React.createElement(link.displayImage, { className: 'shell-flex-child shell-absolute shell-w-full shell-h-full' })
                      )
                    ),
                    React.createElement(
                      'div',
                      { className: 'shell-col shell-col--8' },
                      React.createElement(
                        'p',
                        { className: 'shell-txt-bold shell-txt-s shell-mb3' },
                        link.name
                      ),
                      React.createElement(
                        'p',
                        { className: 'shell-color-darken50 shell-txt-s shell-my0' },
                        link.description
                      )
                    )
                  )
                );
              })
            )
          )
        )
      );
    }
  }]);
  return PopoverSectionSecondary;
}(React.Component);

var PopoverContentDocumentation = function (_React$Component) {
  inherits(PopoverContentDocumentation, _React$Component);

  function PopoverContentDocumentation() {
    classCallCheck(this, PopoverContentDocumentation);
    return possibleConstructorReturn(this, (PopoverContentDocumentation.__proto__ || Object.getPrototypeOf(PopoverContentDocumentation)).apply(this, arguments));
  }

  createClass(PopoverContentDocumentation, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate() {
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      return React.createElement(
        PopoverWrapper,
        this.props,
        React.createElement(
          'div',
          { className: 'limiter shell-grid' },
          React.createElement(
            'div',
            { className: 'shell-col shell-col--offl1 shell-col--10 shell-col--offr1 shell-py30' },
            React.createElement(
              'div',
              { className: 'shell-grid shell-grid--gut24' },
              React.createElement(
                'div',
                { className: 'shell-col shell-col--6' },
                React.createElement(
                  'div',
                  {
                    className: shellStyles.popoverNavHeading + ' shell-pb6 shell-border-b shell-border--gray-light'
                  },
                  navigationMenuData.sdkDocumentationMenu.name
                ),
                React.createElement(
                  'ul',
                  { className: 'shell-grid shell-grid--gut12' },
                  navigationMenuData.sdkDocumentationMenu.links.map(function (link, i) {
                    return React.createElement(
                      'li',
                      {
                        className: 'shell-col shell-col--6 shell-col--4-mxl',
                        key: i
                      },
                      React.createElement(
                        'a',
                        {
                          href: link.to,
                          'data-nav-link': true,
                          'data-test': 'nav-link-' + link.name
                        },
                        React.createElement(
                          'p',
                          {
                            className: shellStyles.popoverNavLink + ' shell-txt-bold shell-txt-s shell-mt18 shell-mb0'
                          },
                          link.name
                        )
                      )
                    );
                  })
                )
              ),
              React.createElement(
                'div',
                { className: 'shell-col shell-col--6' },
                React.createElement(
                  'div',
                  {
                    className: shellStyles.popoverNavHeading + ' shell-pb6 shell-border-b shell-border--gray-light'
                  },
                  navigationMenuData.apiDocumentationMenu.name
                ),
                React.createElement(
                  'ul',
                  { className: 'shell-grid shell-grid--gut12' },
                  navigationMenuData.apiDocumentationMenu.links.map(function (link, i) {
                    return React.createElement(
                      'li',
                      {
                        className: 'shell-col shell-col--6 shell-col--4-mxl',
                        key: i
                      },
                      React.createElement(
                        'a',
                        {
                          href: link.to,
                          'data-nav-link': true,
                          'data-test': 'nav-link-' + link.name
                        },
                        React.createElement(
                          'p',
                          {
                            className: shellStyles.popoverNavLink + ' shell-txt-bold shell-txt-s shell-mt18 shell-mb0'
                          },
                          link.name
                        )
                      )
                    );
                  })
                )
              ),
              React.createElement(
                'ul',
                { className: 'shell-col shell-col--12' },
                navigationMenuData.headerMainMenus.documentation.highlightedLinks.map(function (highlightedLink, i) {
                  if (highlightedLink.hideInHeader) return;
                  return React.createElement(
                    'li',
                    { key: i, className: 'shell-block shell-pr6' },
                    React.createElement(
                      'a',
                      {
                        href: highlightedLink.to,
                        className: shellStyles.popoverNavLinkHighlight + ' shell-mb3',
                        'data-nav-link': highlightedLink.name,
                        'data-test': 'nav-link-' + highlightedLink.name
                      },
                      React.createElement(NavigationHighlightLink, {
                        label: highlightedLink.name
                      })
                    )
                  );
                })
              )
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'shell-bg-gray-faint' },
          React.createElement(
            'div',
            { className: 'limiter shell-grid' },
            React.createElement(PopoverSectionSecondary, { id: 'helpMenu' })
          )
        )
      );
    }
  }]);
  return PopoverContentDocumentation;
}(React.Component);

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
      return React.createElement(
        'button',
        {
          id: 'mobile-nav-trigger-toggle',
          'aria-label': 'Toggle navigation',
          className: extraMenuButtonClasses + ' shell-p6y shell-p3x',
          'data-test': 'mobile-nav-trigger-toggle'
        },
        React.createElement(
          'svg',
          {
            id: 'mobile-nav-trigger-menu',
            viewBox: '0 0 18 18',
            className: 'shell-mobile-nav__trigger shell-icon shell-transition shell-icon--l'
          },
          React.createElement(
            'g',
            null,
            React.createElement('path', {
              className: 'shell-mobile-nav__trigger__bar--top',
              d: 'M4.2,6h9.6C14.5,6,15,5.6,15,5s-0.5-1-1.2-1H4.2C3.5,4,3,4.4,3,5S3.5,6,4.2,6z'
            }),
            React.createElement('path', {
              className: 'shell-mobile-nav__trigger__bar--middle',
              d: 'M13.8,8H4.2C3.5,8,3,8.4,3,9s0.5,1,1.2,1h9.6c0.7,0,1.2-0.4,1.2-1S14.5,8,13.8,8z'
            }),
            React.createElement('path', {
              className: 'shell-mobile-nav__trigger__bar--bottom',
              d: 'M13.8,12H4.2C3.5,12,3,12.4,3,13s0.5,1,1.2,1h9.6c0.7,0,1.2-0.4,1.2-1S14.5,12,13.8,12z'
            })
          )
        )
      );
    }
  }]);
  return MobileMenuButton;
}(React.Component);

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
        return React.createElement(
          'div',
          { key: i, className: 'shell-mb0 shell-mt12' },
          React.createElement(
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
        return React.createElement(
          'div',
          { key: i, className: 'shell-mb0 shell-mt12' },
          React.createElement(
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
      var items = React.createElement(
        'div',
        { className: 'shell-grid shell-grid--gut24' },
        React.createElement(
          'div',
          { className: 'shell-col shell-col--6' },
          firstColumnItems
        ),
        React.createElement(
          'div',
          { className: 'shell-col shell-col--6' },
          secondColumnItems
        )
      );

      // Special case: the custom combination menu doesn't need a heading
      var showNavHeading = this.props.name ? React.createElement(
        'div',
        { className: shellStyles.popoverNavHeading },
        this.props.name
      ) : '';
      return React.createElement(
        'div',
        null,
        showNavHeading,
        items
      );
    }
  }]);
  return NavigationDividedLinkList;
}(React.Component);

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
      var linkFontSize = this.props.name && this.props.navigationType === 'mobile-navigation' ? 'shell-txt-l' : 'shell-txt-m';

      // Special case: the custom combination menu doesn't need a heading
      var navigationHeading = this.props.name ? React.createElement(
        'div',
        { className: shellStyles.popoverNavHeading },
        this.props.name
      ) : '';

      var linkListItems = React.createElement(
        'ul',
        null,
        this.props.links.map(function (link, i) {
          return React.createElement(
            'li',
            { key: i },
            React.createElement(
              'a',
              {
                href: link.to,
                'data-nav-link': true,
                'data-test': _this2.props.navigationType + '-link-' + link.name
              },
              React.createElement(
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

      return React.createElement(
        'div',
        { className: 'shell-pt24 shell-col shell-col--6' },
        navigationHeading,
        linkListItems
      );
    }
  }]);
  return NavigationLinkList;
}(React.Component);

NavigationLinkList.propTypes = {
  name: PropTypes.string,
  navigationType: PropTypes.string.isRequired,
  links: PropTypes.arrayOf(PropTypes.shape({
    to: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    hideInHeader: PropTypes.bool
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
      return React.createElement(
        'div',
        { className: this.props.className },
        React.createElement(
          'div',
          { 'data-display-block-authenticated': true, style: { display: 'none' } },
          React.createElement(
            'div',
            {
              'data-test': 'mobile-user-menu',
              className: 'shell-grid shell-grid--gut12 shell-mt-neg12'
            },
            React.createElement(
              'div',
              { className: 'shell-col shell-col--6' },
              React.createElement(
                'a',
                {
                  href: '/studio/account/',
                  className: shellStyles.popoverNavLink + ' shell-txt-m shell-mb0 shell-mt12'
                },
                'Account'
              )
            ),
            React.createElement(
              'div',
              { className: 'shell-col shell-col--6' },
              React.createElement(
                'a',
                {
                  href: '/studio/',
                  className: shellStyles.popoverNavLink + ' shell-txt-m shell-mb0 shell-mt12'
                },
                'Studio'
              )
            ),
            React.createElement(
              'div',
              { className: 'shell-col shell-col--6' },
              React.createElement(
                'button',
                {
                  'data-sign-out': true,
                  'data-test': 'mobile-signout-button',
                  className: shellStyles.popoverNavLink + ' shell-txt-m shell-mb0 shell-mt12'
                },
                React.createElement(NavigationHighlightLink, { label: 'Sign out' })
              )
            )
          )
        ),
        React.createElement(
          'div',
          { 'data-display-block-unauthenticated': true, style: { display: 'none' } },
          React.createElement(
            'a',
            {
              href: '/signin/',
              className: shellStyles.popoverNavLink + ' shell-txt-m shell-w-full',
              'data-test': 'mobile-signin-button'
            },
            React.createElement(NavigationHighlightLink, { label: 'Sign in' })
          )
        )
      );
    }
  }]);
  return MobileUserMenu;
}(React.Component);

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
      return React.createElement(
        'div',
        { className: 'shell-mr-neg6 shell-flex-child shell-flex-parent shell-flex-parent--end-main shell-z1 shell-absolute shell-top shell-left shell-w-full' },
        React.createElement('div', {
          id: 'mobile-nav-backdrop',
          'data-test': 'mobile-nav-backdrop',
          className: 'shell-absolute shell-bottom shell-left shell-right shell-mobile-nav__backdrop',
          style: {
            top: MOBILE_HEADER_HEIGHT,
            backgroundImage: 'linear-gradient(to bottom, transparent, rgba(31, 51, 73, .5))'
          }
        }),
        React.createElement(
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
          React.createElement(
            'div',
            {
              className: shellStyles.popoverBody + ' shell-clip shell-px24',
              style: { paddingTop: MOBILE_HEADER_HEIGHT }
            },
            React.createElement(
              'div',
              { className: 'shell-grid shell-grid--gut12' },
              React.createElement(NavigationLinkList, _extends({}, navigationMenuData.headerMainMenus.products, {
                navigationType: 'mobile-navigation'
              })),
              React.createElement(NavigationLinkList, _extends({}, navigationMenuData.useCaseMenu, {
                navigationType: 'mobile-navigation'
              }))
            ),
            React.createElement(
              'div',
              { className: 'shell-relative shell-mt30 shell-pt18 shell-pb30' },
              React.createElement('div', { className: 'shell-border-t shell-border--gray-light shell-absolute shell-top shell-left shell-right' }),
              React.createElement(NavigationDividedLinkList, _extends({}, navigationMenuData.mobileCombinationMenu, {
                navigationType: 'mobile-navigation'
              }))
            ),
            React.createElement(MobileUserMenu, { className: 'shell-bg-gray-faint shell-py24 shell-px24 shell-mr-neg24 shell-ml-neg24' })
          )
        )
      );
    }
  }]);
  return MobileNavigation;
}(React.Component);

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
    key: 'render',
    value: function render() {
      var logoClasses = 'shell-mb-logo';
      var logoOverlay = null;
      if (!this.props.darkText) {
        logoClasses += ' shell-mb-logo--white';
        // When we're rendering the white logo, we also need to render a blue logo to display
        // when the mobile navigation opens.
        logoOverlay = React.createElement('a', {
          className: 'shell-mb-logo shell-mobile-nav__logo--overlay shell-absolute shell-top shell-left',
          href: '/',
          'aria-label': 'Mapbox'
        });
      }

      var headerClasses = 'relative';
      if (this.props.position === 'absolute') {
        headerClasses = 'shell-absolute shell-w-full shell-z1';
      }

      var productsMenuID = this.getMenuID('products');
      var productsTriggerID = this.getTriggerID(productsMenuID);
      var productsPointerID = this.getPointerID(productsMenuID);
      var documentationMenuID = this.getMenuID('documentation');
      var documentationTriggerID = this.getTriggerID(documentationMenuID);
      var documentationTriggerIDAuthenticated = documentationTriggerID + '-authenticated';
      var documentationPointerID = this.getPointerID(documentationMenuID);

      return React.createElement(
        'header',
        { className: headerClasses, 'data-swiftype-index': 'false' },
        React.createElement(
          'div',
          { className: 'shell-none limiter shell-mt24 shell-flex-parent-mm shell-flex-parent--center-cross' },
          React.createElement('a', {
            className: 'shell-flex-child shell-flex-child--no-shrink ' + logoClasses,
            href: '/',
            'aria-label': 'Mapbox',
            'data-test': 'logo-link'
          }),
          React.createElement(
            'div',
            { className: 'shell-flex-child shell-flex-child--grow shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main' },
            React.createElement(
              'div',
              {
                className: 'shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--end-main',
                'data-unauthenticated-menu': true,
                'data-test': 'menu-unauthenticated'
              },
              React.createElement(
                NavigationItemWithMenu,
                {
                  darkText: this.props.darkText,
                  menuID: productsMenuID,
                  name: 'Products'
                },
                'Products'
              ),
              React.createElement(
                NavigationItemWithMenu,
                {
                  darkText: this.props.darkText,
                  menuID: documentationMenuID,
                  name: 'Documentation'
                },
                'Documentation'
              ),
              React.createElement(
                NavigationItem,
                {
                  darkText: this.props.darkText,
                  href: '/about/',
                  name: 'About'
                },
                'About'
              ),
              React.createElement(
                NavigationItem,
                {
                  darkText: this.props.darkText,
                  href: '/pricing/',
                  name: 'Pricing'
                },
                'Pricing'
              ),
              React.createElement(
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
          React.createElement(
            'div',
            { className: 'shell-flex-child shell-ml6 shell-ml12-ml shell-ml18-mxl' },
            React.createElement(UserMenu, { darkText: this.props.darkText })
          )
        ),
        React.createElement(
          'div',
          {
            id: 'page-header-content',
            className: 'shell-none-mm limiter shell-py12 shell-flex-parent shell-flex-parent--center-cross shell-flex-parent--space-between-main shell-relative shell-z2'
          },
          React.createElement(
            'div',
            { className: 'shell-mb-logo__wrapper shell-flex-child shell-relative' },
            React.createElement('a', {
              className: logoClasses,
              href: '/',
              'aria-label': 'Mapbox',
              'data-test': 'mobile-logo-link'
            }),
            logoOverlay
          ),
          React.createElement(MobileMenuButton, { darkText: this.props.darkText })
        ),
        React.createElement(MobileNavigation, null),
        React.createElement(PopoverContentProducts, {
          menuID: productsMenuID,
          name: 'Products',
          triggerID: productsTriggerID,
          pointerID: productsPointerID
        }),
        React.createElement(PopoverContentDocumentation, {
          menuID: documentationMenuID,
          name: 'Documentation',
          triggerID: documentationTriggerID + ' ' + documentationTriggerIDAuthenticated,
          pointerID: documentationPointerID
        })
      );
    }
  }]);
  return PageHeader;
}(React.Component);

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
      return React.createElement(
        'div',
        { className: this.props.className },
        React.createElement(
          'span',
          { className: 'shell-mr18' },
          '\xA9 Mapbox'
        ),
        React.createElement(
          'a',
          {
            className: 'shell-link shell-color-darken50 shell-color-blue-on-hover shell-mr18',
            href: '/tos/'
          },
          'Terms'
        ),
        React.createElement(
          'a',
          {
            className: 'shell-link shell-color-darken50 shell-color-blue-on-hover shell-mr18',
            href: '/privacy/'
          },
          'Privacy'
        ),
        React.createElement(
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
}(React.Component);

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
      return React.createElement(
        'div',
        { className: this.props.className },
        React.createElement(
          'a',
          {
            'aria-label': 'Github',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://github.com/mapbox'
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 1790 1790',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React.createElement('path', { d: 'M704 1216q0 40-12.5 82t-43 76-72.5 34-72.5-34-43-76-12.5-82 12.5-82 43-76 72.5-34 72.5 34 43 76 12.5 82zm640 0q0 40-12.5 82t-43 76-72.5 34-72.5-34-43-76-12.5-82 12.5-82 43-76 72.5-34 72.5 34 43 76 12.5 82zm160 0q0-120-69-204t-187-84q-41 0-195 21-71 11-157 11t-157-11q-152-21-195-21-118 0-187 84t-69 204q0 88 32 153.5t81 103 122 60 140 29.5 149 7h168q82 0 149-7t140-29.5 122-60 81-103 32-153.5zm224-176q0 207-61 331-38 77-105.5 133t-141 86-170 47.5-171.5 22-167 4.5q-78 0-142-3t-147.5-12.5-152.5-30-137-51.5-121-81-86-115q-62-123-62-331 0-237 136-396-27-82-27-170 0-116 51-218 108 0 190 39.5t189 123.5q147-35 309-35 148 0 280 32 105-82 187-121t189-39q51 102 51 218 0 87-27 168 136 160 136 398z' })
          )
        ),
        React.createElement(
          'a',
          {
            'aria-label': 'Twitter',
            className: 'shell-color-blue shell-color-gray-dark-on-hover ',
            href: 'https://twitter.com/mapbox/'
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React.createElement(
              'g',
              { id: '77744030-a5d8-4d71-88ad-2c70d4dcad7b', 'data-name': 'svg' },
              React.createElement('path', { d: 'M15.72,45.31c18.87,0,29.19-15.63,29.19-29.19,0-.44,0-.89,0-1.33A20.87,20.87,0,0,0,50,9.49a20.48,20.48,0,0,1-5.89,1.61,10.29,10.29,0,0,0,4.51-5.67A20.56,20.56,0,0,1,42.1,7.92a10.27,10.27,0,0,0-17.48,9.36A29.12,29.12,0,0,1,3.48,6.56,10.27,10.27,0,0,0,6.66,20.25,10.18,10.18,0,0,1,2,19v.13a10.26,10.26,0,0,0,8.23,10.06,10.24,10.24,0,0,1-4.63.18,10.27,10.27,0,0,0,9.58,7.12,20.58,20.58,0,0,1-12.74,4.4A20.88,20.88,0,0,1,0,40.71a29,29,0,0,0,15.72,4.6' })
            )
          )
        ),
        React.createElement(
          'a',
          {
            'aria-label': 'LinkedIn',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://www.linkedin.com/company/mapbox'
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React.createElement(
              'g',
              { id: '875e301f-501b-48d2-a663-a3a855ad9d70', 'data-name': 'svg' },
              React.createElement('rect', { x: '1.32', y: '13.16', width: '10.53', height: '36.84' }),
              React.createElement('path', { d: 'M36.84,13.16c-7.34,0-8.61,2.68-9.21,5.26V13.16H17.11V50H27.63V28.95c0-3.41,1.85-5.26,5.26-5.26s5.26,1.81,5.26,5.26V50H48.68V31.58C48.68,21.05,47.31,13.16,36.84,13.16Z' }),
              React.createElement('circle', { cx: '6.58', cy: '5.26', r: '5.26' })
            )
          )
        ),
        React.createElement(
          'a',
          {
            'aria-label': 'Facebook',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://www.facebook.com/Mapbox'
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React.createElement(
              'g',
              { id: '38f48a9c-03c5-4a1e-8aed-38100e1cd6a4', 'data-name': 'svg' },
              React.createElement('path', {
                id: 'c5d5da0e-6004-406b-ad77-825ffd134c21',
                'data-name': 'f',
                d: 'M28.87,50V27.19h7.65l1.15-8.89h-8.8V12.63c0-2.57.71-4.33,4.41-4.33H38v-8A63.78,63.78,0,0,0,31.13,0C24.34,0,19.69,4.14,19.69,11.75V18.3H12v8.89h7.68V50Z'
              })
            )
          )
        ),
        React.createElement(
          'a',
          {
            'aria-label': 'Dribbble',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://dribbble.com/mapbox'
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 216 216',
              className: 'shell-mr18 shell-icon shell-icon--s shell-inline'
            },
            React.createElement(
              'g',
              { id: 'bce6e84c-15aa-4744-93d1-a9e4a673398a', 'data-name': 'ball' },
              React.createElement(
                'g',
                { id: '99079e24-a239-40f3-bf61-84ebc8f0b2ce', 'data-name': 'ball' },
                React.createElement('path', { d: 'M108,15.78a92.16,92.16,0,1,0,92.16,92.16A92.27,92.27,0,0,0,108,15.78ZM169,58.28a78.31,78.31,0,0,1,17.78,49c-2.6-.55-28.62-5.83-54.81-2.54-.55-1.35-1.12-2.7-1.7-4.06-1.63-3.84-3.39-7.65-5.22-11.4C154.1,77.44,167.29,60.53,169,58.28ZM108,29.34A78.41,78.41,0,0,1,160.2,49.18c-1.41,2-13.26,17.94-41.25,28.43A421.91,421.91,0,0,0,89.58,31.53,79,79,0,0,1,108,29.34ZM74.56,36.82a503.63,503.63,0,0,1,29.18,45.53A293.82,293.82,0,0,1,31,91.94,79,79,0,0,1,74.56,36.82ZM29.31,108.06c0-.8,0-1.61,0-2.41,3.44.08,41.59.57,80.9-11.2,2.25,4.41,4.4,8.89,6.38,13.36-1,.29-2.08.61-3.1.94-40.6,13.12-62.2,48.89-64,51.94A78.39,78.39,0,0,1,29.31,108.06ZM108,186.78a78.29,78.29,0,0,1-48.31-16.62c1.41-2.9,17.35-33.69,61.75-49.16l.52-.17a326.92,326.92,0,0,1,16.79,59.69A78.19,78.19,0,0,1,108,186.78Zm44-13.47a338.31,338.31,0,0,0-15.29-56.12c24.67-4,46.34,2.51,49,3.36A78.84,78.84,0,0,1,152,173.31Z' })
              )
            )
          )
        ),
        React.createElement(
          'a',
          {
            'aria-label': 'Instagram',
            className: 'shell-color-blue shell-color-gray-dark-on-hover',
            href: 'https://www.instagram.com/Mapbox'
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 50 50',
              className: 'shell-icon shell-icon--s shell-inline'
            },
            React.createElement(
              'g',
              { id: 'fb2f6c01-da64-4dee-86ea-29fec95d4f45', 'data-name': 'svg' },
              React.createElement('path', { d: 'M25,0c-6.79,0-7.64,0-10.31.15A18.35,18.35,0,0,0,8.62,1.31,12.25,12.25,0,0,0,4.2,4.2,12.25,12.25,0,0,0,1.31,8.62,18.35,18.35,0,0,0,.15,14.69C0,17.36,0,18.21,0,25s0,7.64.15,10.31a18.35,18.35,0,0,0,1.16,6.07A12.26,12.26,0,0,0,4.2,45.8a12.25,12.25,0,0,0,4.43,2.88,18.35,18.35,0,0,0,6.07,1.16C17.36,50,18.21,50,25,50s7.64,0,10.31-.15a18.35,18.35,0,0,0,6.07-1.16,12.78,12.78,0,0,0,7.31-7.31,18.35,18.35,0,0,0,1.16-6.07C50,32.64,50,31.79,50,25s0-7.64-.15-10.31a18.35,18.35,0,0,0-1.16-6.07A12.25,12.25,0,0,0,45.8,4.2a12.26,12.26,0,0,0-4.43-2.88A18.35,18.35,0,0,0,35.31.15C32.64,0,31.79,0,25,0Zm0,4.5c6.68,0,7.47,0,10.1.15a13.83,13.83,0,0,1,4.64.86,7.75,7.75,0,0,1,2.87,1.87,7.75,7.75,0,0,1,1.87,2.87,13.83,13.83,0,0,1,.86,4.64c.12,2.64.15,3.43.15,10.1s0,7.47-.15,10.1a13.83,13.83,0,0,1-.86,4.64,8.28,8.28,0,0,1-4.74,4.74,13.83,13.83,0,0,1-4.64.86c-2.64.12-3.43.15-10.1.15s-7.47,0-10.1-.15a13.83,13.83,0,0,1-4.64-.86,7.74,7.74,0,0,1-2.87-1.87,7.75,7.75,0,0,1-1.87-2.87,13.83,13.83,0,0,1-.86-4.64C4.53,32.47,4.5,31.68,4.5,25s0-7.47.15-10.1a13.83,13.83,0,0,1,.86-4.64A7.75,7.75,0,0,1,7.38,7.38a7.75,7.75,0,0,1,2.87-1.87,13.83,13.83,0,0,1,4.64-.86c2.64-.12,3.43-.15,10.1-.15' }),
              React.createElement('path', { d: 'M25,33.33A8.33,8.33,0,1,1,33.33,25,8.33,8.33,0,0,1,25,33.33Zm0-21.17A12.84,12.84,0,1,0,37.84,25,12.84,12.84,0,0,0,25,12.16Z' }),
              React.createElement('path', { d: 'M41.35,11.65a3,3,0,1,1-3-3,3,3,0,0,1,3,3Z' })
            )
          )
        )
      );
    }
  }]);
  return FooterSocialMediaStrip;
}(React.Component);

FooterSocialMediaStrip.propTypes = {
  className: PropTypes.string
};

var PageFooter = function (_React$Component) {
  inherits(PageFooter, _React$Component);

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
    key: 'render',
    value: function render() {
      // see ids from navigation-menu-data
      var footerColumnItemsIds = ['products', 'useCaseMenu', 'documentation', 'companyMenu'];

      // Render expected menu links with concatenate-able highlighted links
      var renderMenuLinks = function renderMenuLinks(menuData) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var linkClasses = 'shell-txt-s shell-color-gray-dark shell-color-blue-on-hover shell-mt6';
        if (options.linkClasses) linkClasses += ' ' + options.linkClasses;
        var menuLinks = menuData.links;
        var linkEls = menuLinks.map(function (link) {
          if (link.hideInFooter) return;
          return React.createElement(
            'div',
            { className: linkClasses, key: link.name },
            React.createElement(
              'a',
              { href: link.to, className: 'shell-inline-block' },
              link.name
            )
          );
        });
        var highlightedLinkEls = void 0;
        if (menuData.highlightedLinks) {
          highlightedLinkEls = menuData.highlightedLinks.map(function (link) {
            if (link.hideInFooter) return;
            // Special case: don't bold API Documentation in footer
            var isBold = link.name === 'API Documentation' ? '' : 'shell-txt-bold';
            return React.createElement(
              'div',
              { className: linkClasses, key: link.name },
              React.createElement(
                'a',
                { href: link.to, className: 'shell-inline-block ' + isBold },
                link.name
              )
            );
          });
        }
        return linkEls.concat(highlightedLinkEls);
      };

      var columnClassList = 'shell-footer-column shell-flex-child shell-mt24 shell-mt0-mm';
      return React.createElement(
        'footer',
        {
          id: 'page-footer',
          className: 'shell-py12 shell-py48-ml',
          'data-swiftype-index': 'false'
        },
        React.createElement(
          'div',
          { className: 'limiter' },
          React.createElement(
            'div',
            {
              id: 'page-footer-nav',
              className: 'shell-grid shell-mt24 shell-flex-parent shell-flex-parent--space-between-main'
            },
            React.createElement(
              'div',
              { className: columnClassList + ' shell-none shell-block-ml' },
              React.createElement('a', {
                className: 'shell-mb-logo-m',
                href: '/',
                'aria-label': 'Mapbox',
                'data-test': 'logo-link'
              })
            ),
            footerColumnItemsIds.map(function (columnId, i) {
              var columnClasses = columnClassList;
              if (i === footerColumnItemsIds.length - 1) columnClasses += ' mb0-mm mb24';
              var columnData = columnId in navigationMenuData.headerMainMenus ? navigationMenuData.headerMainMenus[columnId] : navigationMenuData[columnId];
              return React.createElement(
                'div',
                { key: columnId, className: columnClasses },
                React.createElement(
                  'div',
                  {
                    className: shellStyles.popoverNavHeading + ' shell-mb3 shell-pr12'
                  },
                  columnData.name
                ),
                React.createElement(
                  'div',
                  { className: 'shell-grid' },
                  renderMenuLinks(columnData, {
                    linkClasses: 'shell-col shell-col--6 shell-col--12-mm'
                  })
                )
              );
            })
          ),
          React.createElement(
            'div',
            {
              id: 'page-footer-legal-social',
              className: 'shell-grid shell-txt-s shell-color-darken50 shell-py12 shell-py0-ml shell-mt42-ml'
            },
            React.createElement(FooterLegalStrip, { className: 'shell-col shell-col--12 shell-col--6-mm shell-my12' }),
            React.createElement(FooterSocialMediaStrip, { className: 'shell-col shell-col--12 shell-col--6-mm shell-my12 shell-footer-fr' })
          )
        ),
        React.createElement(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            xmlnsXlink: 'http://www.w3.org/1999/xlink',
            className: 'shell-none'
          },
          React.createElement(
            'symbol',
            { id: 'shell-icon-chevron-right', viewBox: '0 0 18 18' },
            React.createElement('path', { d: 'M7.5 13.105a.806.806 0 0 1-.537-1.407l3.055-2.724-3.08-2.997a.806.806 0 1 1 1.124-1.155l3.7 3.6a.805.805 0 0 1-.025 1.18l-3.7 3.3a.803.803 0 0 1-.537.204z' })
          )
        )
      );
    }
  }]);
  return PageFooter;
}(React.Component);

var DEFAULT_SOCIAL_IMAGE_URL = 'https://www.mapbox.com/social-1200x630.png';
var DEFAULT_SOCIAL_IMAGE_THUMBNAIL_URL = 'https://www.mapbox.com/social-120x120.png';

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

      if (process.env.DEPLOY_ENV !== 'production') {
        metaItems.push({ name: 'robots', content: 'noindex' });
      }

      return React.createElement(Helmet__default, { title: suffixedTitle, meta: metaItems });
    }
  }]);
  return MetaTagger;
}(React.PureComponent);

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
        footer = React.createElement(PageFooter, null);
      }

      var nonFooterClasses = 'shell-flex-child shell-flex-child--grow';
      if (this.props.nonFooterBgClass) {
        nonFooterClasses += ' ' + this.props.nonFooterBgClass;
      }

      var header = void 0;
      if (this.props.includeHeader) {
        header = React.createElement(PageHeader, { darkText: this.props.darkHeaderText });
      }

      return React.createElement(
        'div',
        null,
        React.createElement(BrowserCompatibilityWarning, null),
        React.createElement(
          'div',
          {
            id: 'page-shell',
            className: 'shell-flex-parent shell-flex-parent--column',
            style: { minHeight: '100vh', overflowX: 'hidden' }
          },
          React.createElement(PageHelmet, null),
          React.createElement(MetaTagger, this.props.meta),
          React.createElement(
            'div',
            { className: nonFooterClasses },
            React.createElement(
              'div',
              { className: 'shell-wrapper' },
              header
            ),
            React.createElement(
              'main',
              { style: { position: 'relative', display: 'block' } },
              this.props.children
            )
          ),
          React.createElement(
            'div',
            { className: 'shell-flex-child shell-wrapper' },
            footer
          )
        )
      );
    }
  }]);
  return ReactPageShell;
}(React.Component);

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
