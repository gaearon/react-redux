import expect from 'expect';
import jsdomReact from './jsdomReact';
import React, { createClass, PropTypes, Component } from 'react/addons';
import { createStore } from 'redux';
import { connect } from '../../src/index';

const { TestUtils } = React.addons;

describe('React', () => {
  describe('connect', () => {
    jsdomReact();

    // Mock minimal Provider interface
    class Provider extends Component {
      static childContextTypes = {
        store: PropTypes.object.isRequired
      }

      getChildContext() {
        return { store: this.props.store };
      }

      render() {
        return this.props.children();
      }
    }

    function stringBuilder(prev = '', action) {
      return action.type === 'APPEND'
        ? prev + action.body
        : prev;
    }

    it('should receive the store in the context', () => {
      const store = createStore(() => ({}));

      @connect()
      class Container extends Component {
        render() {
          return <div {...this.props} />;
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => (
            <Container pass="through" />
          )}
        </Provider>
      );

      const container = TestUtils.findRenderedComponentWithType(tree, Container);
      expect(container.context.store).toBe(store);
    });

    it('should pass state and props to the given component', () => {
      const store = createStore(() => ({
        foo: 'bar',
        baz: 42,
        hello: 'world'
      }));

      @connect(({ foo, baz }) => ({ foo, baz }))
      class Container extends Component {
        render() {
          return <div {...this.props} />;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => <Container pass='through' baz={50} />}
        </Provider>
      );
      const div = TestUtils.findRenderedDOMComponentWithTag(container, 'div');
      expect(div.props.pass).toEqual('through');
      expect(div.props.foo).toEqual('bar');
      expect(div.props.baz).toEqual(42);
      expect(div.props.hello).toEqual(undefined);
      expect(() =>
        TestUtils.findRenderedComponentWithType(container, Container)
      ).toNotThrow();
    });

    it('should subscribe to the store changes', () => {
      const store = createStore(stringBuilder);

      @connect(state => ({ string: state }) )
      class Container extends Component {
        render() {
          return <div {...this.props}/>;
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => (
            <Container />
          )}
        </Provider>
      );

      const div = TestUtils.findRenderedDOMComponentWithTag(tree, 'div');

      expect(div.props.string).toBe('');
      store.dispatch({ type: 'APPEND', body: 'a'});
      expect(div.props.string).toBe('a');
      store.dispatch({ type: 'APPEND', body: 'b'});
      expect(div.props.string).toBe('ab');
    });

    it('should handle additional prop changes in addition to slice', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }));

      @connect(state => state)
      class ConnectContainer extends Component {
        render() {
          return (
              <div {...this.props} pass={this.props.bar.baz} />
          );
        }
      }

      class Container extends Component {
        constructor() {
          super();
          this.state = {
            bar: {
              baz: ''
            }
          };
        }

        componentDidMount() {
          // Simulate deep object mutation
          this.state.bar.baz = 'through';
          this.setState({
            bar: this.state.bar
          });
        }

        render() {
          return (
            <Provider store={store}>
              {() => <ConnectContainer bar={this.state.bar} />}
             </Provider>
          );
        }
      }

      const container = TestUtils.renderIntoDocument(<Container />);
      const div = TestUtils.findRenderedDOMComponentWithTag(container, 'div');
      expect(div.props.foo).toEqual('bar');
      expect(div.props.pass).toEqual('through');
    });

    it('should allow for merge to incorporate state and prop changes', () => {
      const store = createStore(stringBuilder);

      function doSomething(thing) {
        return {
          type: 'APPEND',
          body: thing
        };
      }

      @connect(
        state => ({stateThing: state}),
        dispatch => ({
          doSomething: (whatever) => dispatch(doSomething(whatever))
        }),
        (stateProps, actionProps, parentProps) => ({
          ...stateProps,
          ...actionProps,
          mergedDoSomething(thing) {
            const seed = stateProps.stateThing === '' ? 'HELLO ' : '';
            actionProps.doSomething(seed + thing + parentProps.extra);
          }
        })
      )
      class Container extends Component {
        render() {
          return <div {...this.props}/>;
        };
      }

      class OuterContainer extends Component {
        constructor() {
          super();
          this.state = { extra: 'z' };
        }

        render() {
          return (
            <Provider store={store}>
              {() => <Container extra={this.state.extra} />}
            </Provider>
          );
        }
      }

      const tree = TestUtils.renderIntoDocument(<OuterContainer />);
      const div = TestUtils.findRenderedDOMComponentWithTag(tree, 'div');

      expect(div.props.stateThing).toBe('');
      div.props.mergedDoSomething('a');
      expect(div.props.stateThing).toBe('HELLO az');
      div.props.mergedDoSomething('b');
      expect(div.props.stateThing).toBe('HELLO azbz');
      tree.setState({extra: 'Z'});
      div.props.mergedDoSomething('c');
      expect(div.props.stateThing).toBe('HELLO azbzcZ');
    });

    it('should merge actionProps into DecoratedComponent', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }));

      @connect(
        state => state,
        dispatch => ({ dispatch })
      )
      class Container extends Component {
        render() {
          return <div {...this.props} />;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => <Container pass='through' />}
        </Provider>
      );
      const div = TestUtils.findRenderedDOMComponentWithTag(container, 'div');
      expect(div.props.dispatch).toEqual(store.dispatch);
      expect(div.props.foo).toEqual('bar');
      expect(() =>
        TestUtils.findRenderedComponentWithType(container, Container)
      ).toNotThrow();
      const decorated = TestUtils.findRenderedComponentWithType(container, Container);
      expect(decorated.isSubscribed()).toBe(true);
    });

    it('should pass dispatch and avoid subscription if arguments are falsy', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }));

      function runCheck(...connectArgs) {
        @connect(...connectArgs)
        class Container extends Component {
          render() {
            return <div {...this.props} />;
          }
        }

        const container = TestUtils.renderIntoDocument(
          <Provider store={store}>
            {() => <Container pass='through' />}
          </Provider>
        );
        const div = TestUtils.findRenderedDOMComponentWithTag(container, 'div');
        expect(div.props.dispatch).toEqual(store.dispatch);
        expect(div.props.foo).toBe(undefined);
        expect(div.props.pass).toEqual('through');
        expect(() =>
          TestUtils.findRenderedComponentWithType(container, Container)
        ).toNotThrow();
        const decorated = TestUtils.findRenderedComponentWithType(container, Container);
        expect(decorated.isSubscribed()).toBe(false);
      }

      runCheck();
      runCheck(null, null, null);
      runCheck(false, false, false);
    });

    it('should unsubscribe before unmounting', () => {
      const store = createStore(stringBuilder);
      const subscribe = store.subscribe;

      // Keep track of unsubscribe by wrapping subscribe()
      const spy = expect.createSpy(() => ({}));
      store.subscribe = (listener) => {
        const unsubscribe = subscribe(listener);
        return () => {
          spy();
          return unsubscribe();
        };
      };

      @connect(
        state => ({string: state}),
        dispatch => ({ dispatch })
      )
      class Container extends Component {
        render() {
          return <div {...this.props} />;
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => (
            <Container />
          )}
        </Provider>
      );

      const connector = TestUtils.findRenderedComponentWithType(tree, Container);
      expect(spy.calls.length).toBe(0);
      connector.componentWillUnmount();
      expect(spy.calls.length).toBe(1);
    });

    it('should shallowly compare the selected state to prevent unnecessary updates', () => {
      const store = createStore(stringBuilder);
      const spy = expect.createSpy(() => ({}));
      function render({ string }) {
        spy();
        return <div string={string}/>;
      }

      @connect(
        state => ({string: state}),
        dispatch => ({ dispatch })
      )
      class Container extends Component {
        render() {
          return render(this.props);
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => (
            <Container />
          )}
        </Provider>
      );

      const div = TestUtils.findRenderedDOMComponentWithTag(tree, 'div');
      expect(spy.calls.length).toBe(1);
      expect(div.props.string).toBe('');
      store.dispatch({ type: 'APPEND', body: 'a'});
      expect(spy.calls.length).toBe(2);
      store.dispatch({ type: 'APPEND', body: 'b'});
      expect(spy.calls.length).toBe(3);
      store.dispatch({ type: 'APPEND', body: ''});
      expect(spy.calls.length).toBe(3);
    });

    it('should throw an error if mapState, mapDispatch, or mergeProps returns anything but a plain object', () => {
      const store = createStore(() => ({}));

      function makeContainer(mapState, mapDispatch, mergeProps) {
        return React.createElement(
          @connect(mapState, mapDispatch, mergeProps)
          class Container extends Component {
            render() {
              return <div />;
            }
          }
        );
      }

      function AwesomeMap() { }

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => 1, () => ({}), () => ({})) }
          </Provider>
        );
      }).toThrow(/mapState/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => 'hey', () => ({}), () => ({})) }
          </Provider>
        );
      }).toThrow(/mapState/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => new AwesomeMap(), () => ({}), () => ({})) }
          </Provider>
        );
      }).toThrow(/mapState/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => ({}), () => 1, () => ({})) }
          </Provider>
        );
      }).toThrow(/mapDispatch/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => ({}), () => 'hey', () => ({})) }
          </Provider>
        );
      }).toThrow(/mapDispatch/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => ({}), () => new AwesomeMap(), () => ({})) }
          </Provider>
        );
      }).toThrow(/mapDispatch/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => ({}), () => ({}), () => 1) }
          </Provider>
        );
      }).toThrow(/mergeProps/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => ({}), () => ({}), () => 'hey') }
          </Provider>
        );
      }).toThrow(/mergeProps/);

      expect(() => {
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            { () => makeContainer(() => ({}), () => ({}), () => new AwesomeMap()) }
          </Provider>
        );
      }).toThrow(/mergeProps/);
    });

    it('should recalculate the state and rebind the actions on hot update', () => {
      const store = createStore(() => {});

      @connect(
        null,
        () => ({ scooby: 'doo' })
      )
      class ContainerBefore extends Component {
        render() {
          return (
              <div {...this.props} />
          );
        }
      }

      @connect(
        () => ({ foo: 'baz' }),
        () => ({ scooby: 'foo' })
      )
      class ContainerAfter extends Component {
        render() {
          return (
              <div {...this.props} />
          );
        }
      }

      let container;
      TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => <ContainerBefore ref={instance => container = instance} />}
         </Provider>
      );
      const div = TestUtils.findRenderedDOMComponentWithTag(container, 'div');
      expect(div.props.foo).toEqual(undefined);
      expect(div.props.scooby).toEqual('doo');

      // Crude imitation of hot reloading that does the job
      Object.keys(ContainerAfter.prototype).filter(key =>
        typeof ContainerAfter.prototype[key] === 'function'
      ).forEach(key => {
        if (key !== 'render') {
          ContainerBefore.prototype[key] = ContainerAfter.prototype[key];
        }
      });

      container.forceUpdate();
      expect(div.props.foo).toEqual('baz');
      expect(div.props.scooby).toEqual('foo');
    });

    it('should set the displayName correctly', () => {
      expect(connect(state => state)(
        class Foo extends Component {
          render() {
            return <div />;
          }
        }
      ).displayName).toBe('Connect(Foo)');

      expect(connect(state => state)(
        createClass({
          displayName: 'Bar',
          render() {
            return <div />;
          }
        })
      ).displayName).toBe('Connect(Bar)');

      expect(connect(state => state)(
        createClass({
          render() {
            return <div />;
          }
        })
      ).displayName).toBe('Connect(Component)');
    });

    it('should expose the wrapped component as DecoratedComponent', () => {
      class Container extends Component {
        render() {
          return <div />;
        }
      }

      const decorator = connect(state => state);
      const decorated = decorator(Container);

      expect(decorated.DecoratedComponent).toBe(Container);
    });

    it('should return the instance of the wrapped component for use in calling child methods', () => {
      const store = createStore(() => ({}));

      const someData = {
        some: 'data'
      };

      class Container extends Component {
        someInstanceMethod() {
          return someData;
        }

        render() {
          return <div />;
        }
      }

      const decorator = connect(state => state);
      const Decorated = decorator(Container);

      const tree = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => (
            <Decorated />
          )}
        </Provider>
      );

      const decorated = TestUtils.findRenderedComponentWithType(tree, Decorated);

      expect(() => decorated.someInstanceMethod()).toThrow();
      expect(decorated.getUnderlyingRef().someInstanceMethod()).toBe(someData);
    });

    it('should react to dispatching within componentWillMount', () => {
      const reducer = (state = { called: false }, { type }) => type === 'ACTION' ? { called: true } : state;
      const store = createStore(reducer);
      const action = () => ({ type: 'ACTION' });

      @connect(
        state => state,
        { action }
      )
      class Container extends Component {
        componentWillMount() {
          this.props.action();
        }

        render() {
          return <div />;
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <Provider store={store}>
          {() => <Container />}
        </Provider>
      );

      const component = TestUtils.findRenderedComponentWithType(tree, Container);

      expect(store.getState().called).toBe(true);
      expect(component.getUnderlyingRef().props.called).toBe(true);
    });
  });
});
