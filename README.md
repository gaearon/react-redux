React Redux
=========================

Official React bindings for [Redux](https://github.com/reactjs/redux).  
Performant and flexible.

[![build status](https://img.shields.io/travis/reactjs/react-redux/master.svg?style=flat-square)](https://travis-ci.org/reactjs/react-redux) [![npm version](https://img.shields.io/npm/v/react-redux.svg?style=flat-square)](https://www.npmjs.com/package/react-redux)
[![npm downloads](https://img.shields.io/npm/dm/react-redux.svg?style=flat-square)](https://www.npmjs.com/package/react-redux)
[![redux channel on slack](https://img.shields.io/badge/slack-redux@reactiflux-61DAFB.svg?style=flat-square)](http://www.reactiflux.com)


## Installation

React Redux requires **React 0.14 or later.**

```
npm install --save react-redux
```

This assumes that you’re using [npm](http://npmjs.com/) package manager with a module bundler like [Webpack](https://webpack.js.org/) or [Browserify](http://browserify.org/) to consume [CommonJS modules](http://webpack.github.io/docs/commonjs.html).

If you don’t yet use [npm](http://npmjs.com/) or a modern module bundler, and would rather prefer a single-file [UMD](https://github.com/umdjs/umd) build that makes `ReactRedux` available as a global object, you can grab a pre-built version from [cdnjs](https://cdnjs.com/libraries/react-redux). We *don’t* recommend this approach for any serious application, as most of the libraries complementary to Redux are only available on [npm](http://npmjs.com/).

## React Native

As of React Native 0.18, React Redux 5.x should work with React Native. If you have any issues with React Redux 5.x on React Native, run `npm ls react` and make sure you don’t have a duplicate React installation in your `node_modules`. We recommend that you use `npm@3.x` which is better at avoiding these kinds of issues.

If you are on an older version of React Native, you’ll need to keep using [React Redux 3.x branch and documentation](https://github.com/reactjs/react-redux/tree/v3.1.0) because of [this problem](https://github.com/facebook/react-native/issues/2985).

## Documentation

- [Redux: Usage with React](http://redux.js.org/docs/basics/UsageWithReact.html)
- [API](docs/api.md#api)
  - [`<Provider store>`](docs/api.md#provider-store)
  - [`connect([mapStateToProps], [mapDispatchToProps], [mergeProps], [options])`](docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options)
- [Troubleshooting](docs/troubleshooting.md#troubleshooting)

## How Does It Work?

We do a deep dive on how React Redux works in [this readthesource episode](https://www.youtube.com/watch?v=VJ38wSFbM3A).  
Enjoy!

## Caveat

While peforming server-side rendering, if you dispatch actions during `componentWillMount` the resulting state will not render in the wrapped component, nor in parents or sibblings. The idiomatic approach to cover all environments is to only dispatch actions before your first render or in response to user-triggered events. During SSR use a routing mechanism based on the URL to dispatch actions on the store (and `await` on them if necessary) ***before*** calling `ReactDOMServer.renderTostring`. This is called "server-side pre-hydration."

You may want to checkout [Redux First Router](https://github.com/faceyspacey/redux-first-router) for a Redux-specific routing package that helps you resolve URL-driven *pre-hydration* on the server. Check the `thunk` option in their [server-rendering docs](https://github.com/faceyspacey/redux-first-router/blob/master/docs/server-rendering.md).

## License

MIT
