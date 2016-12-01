import expect from 'expect'
import React, { createClass, Children, PropTypes, Component } from 'react'
import ReactDOM from 'react-dom'
import TestUtils from 'react-addons-test-utils'
import { createStore } from 'redux'
import { ally } from '../../src/index'

describe('React', () => {
  describe('ally', () => {
    class Passthrough extends Component {
      render() {
        return <div {...this.props} />
      }
    }

    class ProviderMock extends Component {
      getChildContext() {
        return { store: this.props.store }
      }

      render() {
        return Children.only(this.props.children)
      }
    }

    ProviderMock.childContextTypes = {
      store: PropTypes.object.isRequired
    }

    function stringBuilder(prev = '', action) {
      return action.type === 'APPEND'
        ? prev + action.body
        : prev
    }

    it('should receive the store in the context', () => {
      const store = createStore(() => ({}))

      @ally()
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" />
        </ProviderMock>
      )

      const container = TestUtils.findRenderedComponentWithType(tree, Container)
      expect(container.context.store).toBe(store)
    })

    it('should pass state and props to the given component', () => {
      const store = createStore(() => ({
        foo: 'bar',
        baz: 42,
        hello: 'world'
      }))

      @ally({mapStateToProps: ({ foo, baz }) => ({ foo, baz })})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.pass).toEqual('through')
      expect(stub.props.foo).toEqual('bar')
      expect(stub.props.baz).toEqual(42)
      expect(stub.props.hello).toEqual(undefined)
      expect(() =>
        TestUtils.findRenderedComponentWithType(container, Container)
      ).toNotThrow()
    })

    it('should subscribe class components to the store changes', () => {
      const store = createStore(stringBuilder)

      @ally({mapStateToProps: state => ({ string: state }) })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      const stub = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      expect(stub.props.string).toBe('')
      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(stub.props.string).toBe('a')
      store.dispatch({ type: 'APPEND', body: 'b' })
      expect(stub.props.string).toBe('ab')
    })

    it('should subscribe pure function components to the store changes', () => {
      const store = createStore(stringBuilder)

      let Container = ally({
        mapStateToProps: state => ({string: state})
      })(function Container(props) {
        return <Passthrough {...props}/>
      })

      const spy = expect.spyOn(console, 'error')
      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )
      spy.destroy()
      expect(spy.calls.length).toBe(0)

      const stub = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      expect(stub.props.string).toBe('')
      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(stub.props.string).toBe('a')
      store.dispatch({ type: 'APPEND', body: 'b' })
      expect(stub.props.string).toBe('ab')
    })

    it('should handle dispatches before componentDidMount', () => {
      const store = createStore(stringBuilder)

      @ally({mapStateToProps: state => ({ string: state }) })
      class Container extends Component {
        componentWillMount() {
          store.dispatch({ type: 'APPEND', body: 'a' })
        }

        render() {
          return <Passthrough {...this.props}/>
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      const stub = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      expect(stub.props.string).toBe('a')
    })

    it('should handle additional prop changes in addition to slice', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }))

      @ally({mapStateToProps: state => state})
      class ConnectContainer extends Component {
        render() {
          return (
            <Passthrough {...this.props} pass={this.props.bar.baz} />
          )
        }
      }

      class Container extends Component {
        constructor() {
          super()
          this.state = {
            bar: {
              baz: ''
            }
          }
        }

        componentDidMount() {
          this.setState({
            bar: Object.assign({}, this.state.bar, { baz: 'through' })
          })
        }

        render() {
          return (
            <ProviderMock store={store}>
              <ConnectContainer bar={this.state.bar} />
             </ProviderMock>
          )
        }
      }

      const container = TestUtils.renderIntoDocument(<Container />)
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.foo).toEqual('bar')
      expect(stub.props.pass).toEqual('through')
    })

    it('should handle unexpected prop changes with forceUpdate()', () => {
      const store = createStore(() => ({}))

      @ally({mapStateToDispatch: state => state})
      class ConnectContainer extends Component {
        render() {
          return (
            <Passthrough {...this.props} pass={this.props.bar} />
          )
        }
      }

      class Container extends Component {
        constructor() {
          super()
          this.bar = 'baz'
        }

        componentDidMount() {
          this.bar = 'foo'
          this.forceUpdate()
          this.c.forceUpdate()
        }

        render() {
          return (
            <ProviderMock store={store}>
              <ConnectContainer bar={this.bar} ref={c => this.c = c} />
            </ProviderMock>
          )
        }
      }

      const container = TestUtils.renderIntoDocument(<Container />)
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.bar).toEqual('foo')
    })

    it('should remove undefined props', () => {
      const store = createStore(() => ({}))
      let props = { x: true }
      let container

      @ally({mapStateToProps: () => ({}), mapDispatchToProps: () => ({})})
      class ConnectContainer extends Component {
        render() {
          return (
            <Passthrough {...this.props} />
          )
        }
      }

      class HolderContainer extends Component {
        render() {
          return (
            <ConnectContainer {...props} />
          )
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <HolderContainer ref={instance => container = instance} />
        </ProviderMock>
      )

      const propsBefore = {
        ...TestUtils.findRenderedComponentWithType(container, Passthrough).props
      }

      props = {}
      container.forceUpdate()

      const propsAfter = {
        ...TestUtils.findRenderedComponentWithType(container, Passthrough).props
      }

      expect(propsBefore.x).toEqual(true)
      expect('x' in propsAfter).toEqual(false, 'x prop must be removed')
    })

    it('should remove undefined props without mapDispatch', () => {
      const store = createStore(() => ({}))
      let props = { x: true }
      let container

      @ally({mapStateToProps: () => ({})})
      class ConnectContainer extends Component {
        render() {
          return (
            <Passthrough {...this.props} />
          )
        }
      }

      class HolderContainer extends Component {
        render() {
          return (
            <ConnectContainer {...props} />
          )
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <HolderContainer ref={instance => container = instance} />
        </ProviderMock>
      )

      const propsBefore = {
        ...TestUtils.findRenderedComponentWithType(container, Passthrough).props
      }

      props = {}
      container.forceUpdate()

      const propsAfter = {
        ...TestUtils.findRenderedComponentWithType(container, Passthrough).props
      }

      expect(propsBefore.x).toEqual(true)
      expect('x' in propsAfter).toEqual(false, 'x prop must be removed')
    })

    it('should ignore deep mutations in props', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }))

      @ally({mapStateToProps: state => state})
      class ConnectContainer extends Component {
        render() {
          return (
            <Passthrough {...this.props} pass={this.props.bar.baz} />
          )
        }
      }

      class Container extends Component {
        constructor() {
          super()
          this.state = {
            bar: {
              baz: ''
            }
          }
        }

        componentDidMount() {
          // Simulate deep object mutation
          this.state.bar.baz = 'through'
          this.setState({
            bar: this.state.bar
          })
        }

        render() {
          return (
            <ProviderMock store={store}>
              <ConnectContainer bar={this.state.bar} />
            </ProviderMock>
          )
        }
      }

      const container = TestUtils.renderIntoDocument(<Container />)
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.foo).toEqual('bar')
      expect(stub.props.pass).toEqual('')
    })

    it('should allow for merge to incorporate state and prop changes', () => {
      const store = createStore(stringBuilder)

      function doSomething(thing) {
        return {
          type: 'APPEND',
          body: thing
        }
      }

      @ally({
        mapStateToProps: state => ({stateThing: state}),
        mapDispatchToProps: dispatch => ({
          doSomething: (whatever) => dispatch(doSomething(whatever))
        }),
        mergeProps: (stateProps, actionProps, parentProps) => ({
          ...stateProps,
          ...actionProps,
          mergedDoSomething(thing) {
            const seed = stateProps.stateThing === '' ? 'HELLO ' : ''
            actionProps.doSomething(seed + thing + parentProps.extra)
          }
        })
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterContainer extends Component {
        constructor() {
          super()
          this.state = { extra: 'z' }
        }

        render() {
          return (
            <ProviderMock store={store}>
              <Container extra={this.state.extra} />
            </ProviderMock>
          )
        }
      }

      const tree = TestUtils.renderIntoDocument(<OuterContainer />)
      const stub = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      expect(stub.props.stateThing).toBe('')
      stub.props.mergedDoSomething('a')
      expect(stub.props.stateThing).toBe('HELLO az')
      stub.props.mergedDoSomething('b')
      expect(stub.props.stateThing).toBe('HELLO azbz')
      tree.setState({ extra: 'Z' })
      stub.props.mergedDoSomething('c')
      expect(stub.props.stateThing).toBe('HELLO azbzcZ')
    })

    it('should merge actionProps into WrappedComponent', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }))

      @ally({
        mapStateToProps: state => state,
        mapDispatchToProps: dispatch => ({dispatch})
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.dispatch).toEqual(store.dispatch)
      expect(stub.props.foo).toEqual('bar')
      expect(() =>
        TestUtils.findRenderedComponentWithType(container, Container)
      ).toNotThrow()
      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.isSubscribed()).toBe(true)
    })

    it('should not invoke mapState when props change if it only has one argument', () => {
      const store = createStore(stringBuilder)

      let invocationCount = 0

      /*eslint-disable no-unused-vars */
      @ally({
        mapStateToProps: (arg1) => {
          invocationCount++
          return {}
        }
      })
      /*eslint-enable no-unused-vars */
      class WithoutProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithoutProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <OuterComponent ref={c => outerComponent = c} />
        </ProviderMock>
      )
      outerComponent.setFoo('BAR')
      outerComponent.setFoo('DID')

      expect(invocationCount).toEqual(1)
    })

    it('should invoke mapState every time props are changed if it has zero arguments', () => {
      const store = createStore(stringBuilder)

      let invocationCount = 0

      @ally({
        mapStateToProps: () => {
          invocationCount++
          return {}
        }
      })
      class WithoutProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithoutProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <OuterComponent ref={c => outerComponent = c} />
        </ProviderMock>
      )
      outerComponent.setFoo('BAR')
      outerComponent.setFoo('DID')

      expect(invocationCount).toEqual(3)
    })

    it('should invoke mapState every time props are changed if it has a second argument', () => {
      const store = createStore(stringBuilder)

      let propsPassedIn
      let invocationCount = 0

      @ally({
        mapStateToProps: (state, props) => {
          invocationCount++
          propsPassedIn = props
          return {}
        }
      })
      class WithProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <OuterComponent ref={c => outerComponent = c} />
        </ProviderMock>
      )

      outerComponent.setFoo('BAR')
      outerComponent.setFoo('BAZ')

      expect(invocationCount).toEqual(3)
      expect(propsPassedIn).toEqual({
        foo: 'BAZ'
      })
    })

    it('should not invoke mapDispatch when props change if it only has one argument', () => {
      const store = createStore(stringBuilder)

      let invocationCount = 0

      /*eslint-disable no-unused-vars */
      @ally({
        mapStateToProps: null,
        mapDispatchToProps: (arg1) => {
          invocationCount++
          return {}
        }
      })
      /*eslint-enable no-unused-vars */
      class WithoutProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithoutProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <OuterComponent ref={c => outerComponent = c} />
        </ProviderMock>
      )

      outerComponent.setFoo('BAR')
      outerComponent.setFoo('DID')

      expect(invocationCount).toEqual(1)
    })

    it('should invoke mapDispatch every time props are changed if it has zero arguments', () => {
      const store = createStore(stringBuilder)

      let invocationCount = 0

      @ally({
        mapStateToProps: null,
        mapDispatchToProps: () => {
          invocationCount++
          return {}
        }
      })
      class WithoutProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithoutProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <OuterComponent ref={c => outerComponent = c} />
        </ProviderMock>
      )

      outerComponent.setFoo('BAR')
      outerComponent.setFoo('DID')

      expect(invocationCount).toEqual(3)
    })

    it('should invoke mapDispatch every time props are changed if it has a second argument', () => {
      const store = createStore(stringBuilder)

      let propsPassedIn
      let invocationCount = 0

      @ally({
        mapStateToProps: null,
        mapDispatchToProps: (dispatch, props) => {
          invocationCount++
          propsPassedIn = props
          return {}
        }
      })
      class WithProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <OuterComponent ref={c => outerComponent = c} />
        </ProviderMock>
      )

      outerComponent.setFoo('BAR')
      outerComponent.setFoo('BAZ')

      expect(invocationCount).toEqual(3)
      expect(propsPassedIn).toEqual({
        foo: 'BAZ'
      })
    })

    it('should pass dispatch and avoid subscription if arguments are falsy', () => {
      const store = createStore(() => ({
        foo: 'bar'
      }))

      function runCheck(...connectArgs) {
        @ally(...connectArgs)
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" />
          </ProviderMock>
        )
        const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
        expect(stub.props.dispatch).toEqual(store.dispatch)
        expect(stub.props.foo).toBe(undefined)
        expect(stub.props.pass).toEqual('through')
        expect(() =>
          TestUtils.findRenderedComponentWithType(container, Container)
        ).toNotThrow()
        const decorated = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decorated.isSubscribed()).toBe(false)
      }

      runCheck();
      runCheck({});
      runCheck({mapStateToProps: null, mapDispatchToProps: null, mergeProps: null});
      runCheck({mapStateToProps: false, mapDispatchToProps: false, mergeProps: false});
    })

    it('should unsubscribe before unmounting', () => {
      const store = createStore(stringBuilder)
      const subscribe = store.subscribe

      // Keep track of unsubscribe by wrapping subscribe()
      const spy = expect.createSpy(() => ({}))
      store.subscribe = (listener) => {
        const unsubscribe = subscribe(listener)
        return () => {
          spy()
          return unsubscribe()
        }
      }

      @ally({
        mapStateToProps: state => ({string: state}),
        mapDispatchToProps: dispatch => ({dispatch})
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const div = document.createElement('div')
      ReactDOM.render(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>,
        div
      )

      expect(spy.calls.length).toBe(0)
      ReactDOM.unmountComponentAtNode(div)
      expect(spy.calls.length).toBe(1)
    })

    it('should not attempt to set state after unmounting', () => {
      const store = createStore(stringBuilder)
      let mapStateToPropsCalls = 0

      @ally({
        mapStateToProps: () => ({calls: ++mapStateToPropsCalls}),
        mapDispatchToProps: dispatch => ({dispatch})
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const div = document.createElement('div')
      store.subscribe(() =>
        ReactDOM.unmountComponentAtNode(div)
      )
      ReactDOM.render(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>,
        div
      )

      expect(mapStateToPropsCalls).toBe(1)
      const spy = expect.spyOn(console, 'error')
      store.dispatch({ type: 'APPEND', body: 'a' })
      spy.destroy()
      expect(spy.calls.length).toBe(0)
      expect(mapStateToPropsCalls).toBe(1)
    })

    it('should not attempt to set state when dispatching in componentWillUnmount', () => {
      const store = createStore(stringBuilder)
      let mapStateToPropsCalls = 0

      /*eslint-disable no-unused-vars */
      @ally({
        mapStateToProps: (state) => ({calls: mapStateToPropsCalls++}),
        mapDispatchToProps: dispatch => ({dispatch})
      })
      /*eslint-enable no-unused-vars */
      class Container extends Component {
        componentWillUnmount() {
          this.props.dispatch({ type: 'APPEND', body: 'a' })
        }
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const div = document.createElement('div')
      ReactDOM.render(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>,
        div
      )
      expect(mapStateToPropsCalls).toBe(1)

      const spy = expect.spyOn(console, 'error')
      ReactDOM.unmountComponentAtNode(div)
      spy.destroy()
      expect(spy.calls.length).toBe(0)
      expect(mapStateToPropsCalls).toBe(1)
    })

    it('should shallowly compare the selected state to prevent unnecessary updates', () => {
      const store = createStore(stringBuilder)
      const spy = expect.createSpy(() => ({}))
      function render({ string }) {
        spy()
        return <Passthrough string={string}/>
      }

      @ally({
        mapStateToProps: state => ({string: state}),
        mapDispatchToProps: dispatch => ({dispatch})
      })
      class Container extends Component {
        render() {
          return render(this.props)
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      const stub = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      expect(spy.calls.length).toBe(1)
      expect(stub.props.string).toBe('')
      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(spy.calls.length).toBe(2)
      store.dispatch({ type: 'APPEND', body: 'b' })
      expect(spy.calls.length).toBe(3)
      store.dispatch({ type: 'APPEND', body: '' })
      expect(spy.calls.length).toBe(3)
    })

    it('should shallowly compare the merged state to prevent unnecessary updates', () => {
      const store = createStore(stringBuilder)
      const spy = expect.createSpy(() => ({}))
      function render({ string, pass }) {
        spy()
        return <Passthrough string={string} pass={pass} passVal={pass.val} />
      }

      @ally({
        mapStateToProps: state => ({string: state}),
        mapDispatchToProps: dispatch => ({dispatch}),
        mergeProps: (stateProps, dispatchProps, parentProps) => ({
          ...dispatchProps,
          ...stateProps,
          ...parentProps
        })
      })
      class Container extends Component {
        render() {
          return render(this.props)
        }
      }

      class Root extends Component {
        constructor(props) {
          super(props)
          this.state = { pass: '' }
        }

        render() {
          return (
            <ProviderMock store={store}>
              <Container pass={this.state.pass} />
            </ProviderMock>
          )
        }
      }

      const tree = TestUtils.renderIntoDocument(<Root />)
      const stub = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      expect(spy.calls.length).toBe(1)
      expect(stub.props.string).toBe('')
      expect(stub.props.pass).toBe('')

      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(spy.calls.length).toBe(2)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe('')

      tree.setState({ pass: '' })
      expect(spy.calls.length).toBe(2)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe('')

      tree.setState({ pass: 'through' })
      expect(spy.calls.length).toBe(3)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe('through')

      tree.setState({ pass: 'through' })
      expect(spy.calls.length).toBe(3)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe('through')

      const obj = { prop: 'val' }
      tree.setState({ pass: obj })
      expect(spy.calls.length).toBe(4)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe(obj)

      tree.setState({ pass: obj })
      expect(spy.calls.length).toBe(4)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe(obj)

      const obj2 = Object.assign({}, obj, { val: 'otherval' })
      tree.setState({ pass: obj2 })
      expect(spy.calls.length).toBe(5)
      expect(stub.props.string).toBe('a')
      expect(stub.props.pass).toBe(obj2)

      obj2.val = 'mutation'
      tree.setState({ pass: obj2 })
      expect(spy.calls.length).toBe(5)
      expect(stub.props.string).toBe('a')
      expect(stub.props.passVal).toBe('otherval')
    })

    it('should throw an error if mapState, mapDispatch, or mergeProps returns anything but a plain object', () => {
      const store = createStore(() => ({}))

      function makeContainer(mapStateToProps, mapDispatchToProps, mergeProps) {
        return React.createElement(
          @ally({
            mapStateToProps: mapStateToProps,
            mapDispatchToProps: mapDispatchToProps,
            mergeProps: mergeProps
          })
          class Container extends Component {
            render() {
              return <Passthrough />
            }
          }
        )
      }

      function AwesomeMap() { }

      let spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => 1, () => ({}), () => ({}))}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mapStateToProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => 'hey', () => ({}), () => ({}))}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mapStateToProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => new AwesomeMap(), () => ({}), () => ({}))}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mapStateToProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => ({}), () => 1, () => ({}))}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mapDispatchToProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => ({}), () => 'hey', () => ({}))}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mapDispatchToProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => ({}), () => new AwesomeMap(), () => ({}))}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mapDispatchToProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      // ALLY NOTE: computeMergedProps is called twice because of the ally function calls them to get a more
      // up to date mergedProps
      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => ({}), () => ({}), () => 1)}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(2)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mergeProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      // ALLY NOTE: computeMergedProps is called twice because of the ally function calls them to get a more
      // up to date mergedProps
      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => ({}), () => ({}), () => 'hey')}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(2)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mergeProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()

      // ALLY NOTE: computeMergedProps is called twice because of the ally function calls them to get a more
      // up to date mergedProps
      spy = expect.spyOn(console, 'error')
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          {makeContainer(() => ({}), () => ({}), () => new AwesomeMap())}
        </ProviderMock>
      )
      expect(spy.calls.length).toBe(2)
      expect(spy.calls[0].arguments[0]).toMatch(
        /mergeProps\(\) in Ally\(Container\) must return a plain object/
      )
      spy.destroy()
    })

    it('should recalculate the state and rebind the actions on hot update', () => {
      const store = createStore(() => {})

      @ally({
        mapStateToProps: null,
        mapDispatchToProps: () => ({scooby: 'doo'})
      })
      class ContainerBefore extends Component {
        render() {
          return (
            <Passthrough {...this.props} />
          )
        }
      }

      @ally({
        mapStateToProps: () => ({foo: 'baz'}),
        mapDispatchToProps: () => ({scooby: 'foo'})
      })
      class ContainerAfter extends Component {
        render() {
          return (
            <Passthrough {...this.props} />
          )
        }
      }

      @ally({
        mapStateToProps: () => ({foo: 'bar'}),
        mapDispatchToProps: () => ({scooby: 'boo'})
      })
      class ContainerNext extends Component {
        render() {
          return (
            <Passthrough {...this.props} />
          )
        }
      }

      let container
      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <ContainerBefore ref={instance => container = instance} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.foo).toEqual(undefined)
      expect(stub.props.scooby).toEqual('doo')

      function imitateHotReloading(TargetClass, SourceClass) {
        // Crude imitation of hot reloading that does the job
        Object.getOwnPropertyNames(SourceClass.prototype).filter(key =>
          typeof SourceClass.prototype[key] === 'function'
        ).forEach(key => {
          if (key !== 'render' && key !== 'constructor') {
            TargetClass.prototype[key] = SourceClass.prototype[key]
          }
        })

        container.forceUpdate()
      }

      imitateHotReloading(ContainerBefore, ContainerAfter)
      expect(stub.props.foo).toEqual('baz')
      expect(stub.props.scooby).toEqual('foo')

      imitateHotReloading(ContainerBefore, ContainerNext)
      expect(stub.props.foo).toEqual('bar')
      expect(stub.props.scooby).toEqual('boo')
    })

    it('should set the displayName correctly', () => {
      expect(ally({mapStateToProps: state => state})(
        class Foo extends Component {
          render() {
            return <div />
          }
        }
      ).displayName).toBe('Ally(Foo)')

      expect(ally({mapStateToProps: state => state})(
        createClass({
          displayName: 'Bar',
          render() {
            return <div />
          }
        })
      ).displayName).toBe('Ally(Bar)')

      expect(ally({mapStateToProps: state => state})(
        createClass({
          render() {
            return <div />
          }
        })
      ).displayName).toBe('Ally(Component)')
    })

    it('should expose the wrapped component as WrappedComponent', () => {
      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      const decorator = ally({mapStateToProps: state => state})
      const decorated = decorator(Container)

      expect(decorated.WrappedComponent).toBe(Container)
    })

    it('should hoist non-react statics from wrapped component', () => {
      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      Container.howIsRedux = () => 'Awesome!'
      Container.foo = 'bar'

      const decorator = ally({mapStateToProps: state => state})
      const decorated = decorator(Container)

      expect(decorated.howIsRedux).toBeA('function')
      expect(decorated.howIsRedux()).toBe('Awesome!')
      expect(decorated.foo).toBe('bar')
    })

    it('should use the store from the props instead of from the context if present', () => {
      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      let actualState

      const expectedState = { foos: {} }
      const decorator = ally({
        mapStateToProps: state => {
          actualState = state
          return {}
        }
      })
      const Decorated = decorator(Container)
      const mockStore = {
        dispatch: () => {},
        subscribe: () => {},
        getState: () => expectedState
      }

      TestUtils.renderIntoDocument(<Decorated store={mockStore} />)

      expect(actualState).toEqual(expectedState)
    })

    it('should throw an error if the store is not in the props or context', () => {
      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      const decorator = ally({mapStateToProps: () => {}})
      const Decorated = decorator(Container)

      expect(() =>
        TestUtils.renderIntoDocument(<Decorated />)
      ).toThrow(
        /Could not find "store"/
      )
    })

    it('should throw when trying to access the wrapped instance if withRef is not specified', () => {
      const store = createStore(() => ({}))

      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      const decorator = ally({mapStateToProps: state => state})
      const Decorated = decorator(Container)

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Decorated />
        </ProviderMock>
      )

      const decorated = TestUtils.findRenderedComponentWithType(tree, Decorated)
      expect(() => decorated.getWrappedInstance()).toThrow(
        /To access the wrapped instance, you need to specify \{ withRef: true \} as the fourth argument of the connect\(\) call\./
      )
    })

    it('should return the instance of the wrapped component for use in calling child methods', () => {
      const store = createStore(() => ({}))

      const someData = {
        some: 'data'
      }

      class Container extends Component {
        someInstanceMethod() {
          return someData
        }

        render() {
          return <Passthrough />
        }
      }

      const decorator = ally({
        mapStateToProps: state => state,
        mapDispatchToProps: null,
        mergeProps: null,
        options: { withRef: true }
      })
      const Decorated = decorator(Container)

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Decorated />
        </ProviderMock>
      )

      const decorated = TestUtils.findRenderedComponentWithType(tree, Decorated)

      expect(() => decorated.someInstanceMethod()).toThrow()
      expect(decorated.getWrappedInstance().someInstanceMethod()).toBe(someData)
      expect(decorated.refs.wrappedInstance.someInstanceMethod()).toBe(someData)
    })

    it('should wrap impure components without supressing updates', () => {
      const store = createStore(() => ({}))

      class ImpureComponent extends Component {
        render() {
          return <Passthrough statefulValue={this.context.statefulValue} />
        }
      }

      ImpureComponent.contextTypes = {
        statefulValue: React.PropTypes.number
      }

      const decorator = ally({
        mapStateToProps: state => state,
        mapDispatchToProps: null,
        mergeProps: null,
        options: { pure: false }
      })
      const Decorated = decorator(ImpureComponent)

      class StatefulWrapper extends Component {
        constructor() {
          super()
          this.state = { value: 0 }
        }

        getChildContext() {
          return {
            statefulValue: this.state.value
          }
        }

        render() {
          return <Decorated />
        }
      }

      StatefulWrapper.childContextTypes = {
        statefulValue: React.PropTypes.number
      }

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <StatefulWrapper />
        </ProviderMock>
      )

      const target = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      const wrapper = TestUtils.findRenderedComponentWithType(tree, StatefulWrapper)
      expect(target.props.statefulValue).toEqual(0)
      wrapper.setState({ value: 1 })
      expect(target.props.statefulValue).toEqual(1)
    })

    it('calls mapState and mapDispatch for impure components', () => {
      const store = createStore(() => ({
        foo: 'foo',
        bar: 'bar'
      }))

      const mapStateSpy = expect.createSpy()
      const mapDispatchSpy = expect.createSpy().andReturn({})

      class ImpureComponent extends Component {
        render() {
          return <Passthrough statefulValue={this.props.value} />
        }
      }

      const decorator = ally({
        mapStateToProps: (state, {storeGetter}) => {
          mapStateSpy()
          return {value: state[storeGetter.storeKey]}
        },
        mapDispatchToProps: mapDispatchSpy,
        mergeProps: null,
        options: {pure: false}
      })
      const Decorated = decorator(ImpureComponent)

      class StatefulWrapper extends Component {
        constructor() {
          super()
          this.state = {
            storeGetter: { storeKey: 'foo' }
          }
        }
        render() {
          return <Decorated storeGetter={this.state.storeGetter} />
        }
      }


      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <StatefulWrapper />
        </ProviderMock>
      )

      const target = TestUtils.findRenderedComponentWithType(tree, Passthrough)
      const wrapper = TestUtils.findRenderedComponentWithType(tree, StatefulWrapper)

      expect(mapStateSpy.calls.length).toBe(2)
      expect(mapDispatchSpy.calls.length).toBe(2)
      expect(target.props.statefulValue).toEqual('foo')

      // Impure update
      const storeGetter = wrapper.state.storeGetter
      storeGetter.storeKey = 'bar'
      wrapper.setState({ storeGetter })

      expect(mapStateSpy.calls.length).toBe(3)
      expect(mapDispatchSpy.calls.length).toBe(3)
      expect(target.props.statefulValue).toEqual('bar')
    })

    it('should pass state consistently to mapState', () => {
      const store = createStore(stringBuilder)

      store.dispatch({ type: 'APPEND', body: 'a' })
      let childMapStateInvokes = 0

      @ally({
        mapStateToProps: state => ({ state }),
        mapDispatchToProps: null,
        mergeProps: null,
        options: { withRef: true }
      })
      class Container extends Component {

        emitChange() {
          store.dispatch({ type: 'APPEND', body: 'b' })
        }

        render() {
          return (
            <div>
              <button ref="button" onClick={this.emitChange.bind(this)}>change</button>
              <ChildContainer parentState={this.props.state} />
            </div>
          )
        }
      }

      @ally({
        mapStateToProps: (state, parentProps) => {
        childMapStateInvokes++
        // The state from parent props should always be consistent with the current state
        expect(state).toEqual(parentProps.parentState)
        return {}
      }
      })
      class ChildContainer extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      const tree = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      expect(childMapStateInvokes).toBe(1)

      // The store state stays consistent when setState calls are batched
      ReactDOM.unstable_batchedUpdates(() => {
        store.dispatch({ type: 'APPEND', body: 'c' })
      })
      expect(childMapStateInvokes).toBe(2)

      // setState calls DOM handlers are batched
      const container = TestUtils.findRenderedComponentWithType(tree, Container)
      const node = container.getWrappedInstance().refs.button
      TestUtils.Simulate.click(node)
      expect(childMapStateInvokes).toBe(3)

      // In future all setState calls will be batched[1]. Uncomment when it
      // happens. For now redux-batched-updates middleware can be used as
      // workaround this.
      //
      // [1]: https://twitter.com/sebmarkbage/status/642366976824864768
      //
      // store.dispatch({ type: 'APPEND', body: 'd' })
      // expect(childMapStateInvokes).toBe(4)
    })

    it('should not render the wrapped component when mapState does not produce change', () => {
      const store = createStore(stringBuilder)
      let renderCalls = 0
      let mapStateCalls = 0

      @ally({
        mapStateToProps: () => {
          mapStateCalls++
          return {} // no change!
        }
      })
      class Container extends Component {
        render() {
          renderCalls++
          return <Passthrough {...this.props} />
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      expect(renderCalls).toBe(1)
      expect(mapStateCalls).toBe(1)

      store.dispatch({ type: 'APPEND', body: 'a' })

      // After store a change mapState has been called
      expect(mapStateCalls).toBe(2)
      // But render is not because it did not make any actual changes
      expect(renderCalls).toBe(1)
    })

    it('should bail out early if mapState does not depend on props', () => {
      const store = createStore(stringBuilder)
      let renderCalls = 0
      let mapStateCalls = 0

      @ally({mapStateToProps: state => {
        mapStateCalls++
        return state === 'aaa' ? { change: 1 } : {}
      }})
      class Container extends Component {
        render() {
          renderCalls++
          return <Passthrough {...this.props} />
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      expect(renderCalls).toBe(1)
      expect(mapStateCalls).toBe(1)

      const spy = expect.spyOn(Container.prototype, 'setState').andCallThrough()

      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(mapStateCalls).toBe(2)
      expect(renderCalls).toBe(1)
      expect(spy.calls.length).toBe(0)

      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(mapStateCalls).toBe(3)
      expect(renderCalls).toBe(1)
      expect(spy.calls.length).toBe(0)

      store.dispatch({ type: 'APPEND', body: 'a' })
      expect(mapStateCalls).toBe(4)
      expect(renderCalls).toBe(2)
      expect(spy.calls.length).toBe(1)

      spy.destroy()
    })

    it('should not swallow errors when bailing out early', () => {
      const store = createStore(stringBuilder)
      let renderCalls = 0
      let mapStateCalls = 0

      @ally({mapStateToProps: state => {
        mapStateCalls++
        if (state === 'a') {
          throw new Error('Oops')
        } else {
          return {}
        }
      }})
      class Container extends Component {
        render() {
          renderCalls++
          return <Passthrough {...this.props} />
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      expect(renderCalls).toBe(1)
      expect(mapStateCalls).toBe(1)
      expect(
        () => store.dispatch({ type: 'APPEND', body: 'a' })
      ).toThrow('Oops')
    })

    it('should allow providing a factory function to mapStateToProps', () => {
      let updatedCount = 0
      let memoizedReturnCount = 0
      const store = createStore(() => ({ value: 1 }))

      const mapStateFactory = () => {
        let lastProp, lastVal, lastResult
        return (state, props) => {
          if (props.name === lastProp && lastVal === state.value) {
            memoizedReturnCount++
            return lastResult
          }
          lastProp = props.name
          lastVal = state.value
          return lastResult = { someObject: { prop: props.name, stateVal: state.value } }
        }
      }

      @ally({mapStateToProps: mapStateFactory})
      class Container extends Component {
        componentWillUpdate() {
          updatedCount++
        }
        render() {
          return <Passthrough {...this.props} />
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <div>
            <Container name="a" />
            <Container name="b" />
          </div>
        </ProviderMock>
      )

      store.dispatch({ type: 'test' })
      expect(updatedCount).toBe(0)
      expect(memoizedReturnCount).toBe(2)
    })

    it('should allow providing a factory function to mapDispatchToProps', () => {
      let updatedCount = 0
      let memoizedReturnCount = 0
      const store = createStore(() => ({ value: 1 }))

      const mapDispatchFactory = () => {
        let lastProp, lastResult
        return (dispatch, props) => {
          if (props.name === lastProp) {
            memoizedReturnCount++
            return lastResult
          }
          lastProp = props.name
          return lastResult = { someObject: { dispatchFn: dispatch } }
        }
      }
      function mergeParentDispatch(stateProps, dispatchProps, parentProps) {
        return { ...stateProps, ...dispatchProps, name: parentProps.name }
      }

      @ally({
        mapStateToProps: null,
        mapDispatchToProps: mapDispatchFactory,
        mergeProps: mergeParentDispatch
      })
      class Passthrough extends Component {
        componentWillUpdate() {
          updatedCount++
        }
        render() {
          return <div {...this.props} />
        }
      }

      class Container extends Component {
        constructor(props) {
          super(props)
          this.state = { count: 0 }
        }
        componentDidMount() {
          this.setState({ count: 1 })
        }
        render() {
          const { count } = this.state
          return (
            <div>
              <Passthrough count={count} name="a" />
              <Passthrough count={count} name="b" />
            </div>
          )
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      store.dispatch({ type: 'test' })
      expect(updatedCount).toBe(0)
      expect(memoizedReturnCount).toBe(2)
    })

    it('should not call update if mergeProps return value has not changed', () => {
      let mapStateCalls = 0
      let renderCalls = 0
      const store = createStore(stringBuilder)

      @ally({
        mapStateToProps: () => ({a: ++mapStateCalls}),
        mapDispatchToProps: null,
        mergeProps: () => ({changed: false})
      })
      class Container extends Component {
        render() {
          renderCalls++
          return <Passthrough {...this.props} />
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      )

      expect(renderCalls).toBe(1)
      expect(mapStateCalls).toBe(1)

      store.dispatch({ type: 'APPEND', body: 'a' })

      expect(mapStateCalls).toBe(2)
      expect(renderCalls).toBe(1)
    })

    it('should update impure components with custom mergeProps', () => {
      let store = createStore(() => ({}))
      let renderCount = 0

      @ally({
        mapStateToProps: null,
        mapDispatchToProps: null,
        mergeProps: () => ({ a: 1 }),
        options: { pure: false }
      })
      class Container extends React.Component {
        render() {
          ++renderCount
          return <div />
        }
      }

      class Parent extends React.Component {
        componentDidMount() {
          this.forceUpdate()
        }
        render() {
          return <Container />
        }
      }

      TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Parent>
            <Container />
          </Parent>
        </ProviderMock>
      )

      expect(renderCount).toBe(2)
    })

    it('should allow to clean up child state in parent componentWillUnmount', () => {
      function reducer(state = { data: null }, action) {
        switch (action.type) {
          case 'fetch':
            return { data: { profile: { name: 'April' } } }
          case 'clean':
            return { data: null }
          default:
            return state
        }
      }

      @ally({mapStateToProps: null})
      class Parent extends React.Component {
        componentWillMount() {
          this.props.dispatch({ type: 'fetch' })
        }

        componentWillUnmount() {
          this.props.dispatch({ type: 'clean' })
        }

        render() {
          return <Child />
        }
      }

      @ally({
        mapStateToProps: state => ({
        profile: state.data.profile
      })
      })
      class Child extends React.Component {
        render() {
          return null
        }
      }

      const store = createStore(reducer)
      const div = document.createElement('div')
      ReactDOM.render(
        <ProviderMock store={store}>
          <Parent />
        </ProviderMock>,
        div
      )

      ReactDOM.unmountComponentAtNode(div)
    })

    //BEGIN ALLY-RELATED TESTS
    it('should allow for ally fields to be defined', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes',
              bar: 'no'
            }
          }
        }
      }))

      @ally({fields: {
        foo: {},
        bar: {}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKeys(['foo', 'bar']);
      expect(stub.props.foo).toEqual('yes');
      expect(stub.props.bar).toEqual('no');
    });

    it('should allow ally fields to be renamed', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes',
              bar: 'no'
            }
          }
        }
      }))

      @ally({fields: {
        foo: {name: 'Foo'},
        bar: {name: 'Bar'}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKeys(['Foo', 'Bar']);
      expect(stub.props).toExcludeKeys(['foo', 'bar']);
      expect(stub.props.Foo).toEqual('yes');
      expect(stub.props.Bar).toEqual('no');
    });

    it('should allow ally fields to have a default type of instance', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              'foo': 'bar'
            }
          }
        }
      }))

      @ally({fields: {
        foo: {}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKey('foo');
      expect(stub.props.allyFields.foo).toIncludeKey('type');
      expect(stub.props.allyFields.foo.type).toEqual('instance');
      expect(stub.props.foo).toEqual('bar');
    });

    it('should allow ally fields to have a type of component', function () {
      const store = createStore(() => ({
        'Container': {
          'foo': 'bar'
        }
      }))

      @ally({fields: {
        foo: {type: 'component'}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKey('foo');
      expect(stub.props.allyFields.foo).toIncludeKey('type');
      expect(stub.props.allyFields.foo.type).toEqual('component');
      expect(stub.props.foo).toEqual('bar');
    });

    it('should allow ally fields to have a type of shared', function () {
      const store = createStore(() => ({
        foo: 'bar'
      }))

      @ally({fields: {
        foo: {type: 'shared'}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKey('foo');
      expect(stub.props.allyFields.foo).toIncludeKey('type');
      expect(stub.props.allyFields.foo.type).toEqual('shared');
      expect(stub.props.foo).toEqual('bar');
    });

    it('should default the path of an ally field to the key name', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              'foo': 'Test'
            }
          }
        }
      }))

      @ally({fields: {
        foo: {}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('foo');
      expect(stub.props.foo).toEqual('Test');
    });

    it('should be able to configure the path to a string or array', function () {
      const store = createStore(() => ({}))

      @ally({fields: {
        foo: {path: 'foo.bar', defaultValue: 'baz'},
        bar: {path: ['bar', 'bar'], defaultValue: 'baz'}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKeys(['foo', 'bar']);
      expect(stub.props.allyFields.foo).toIncludeKey('path');
      expect(stub.props.allyFields.foo.path).toEqual('foo.bar');
      expect(stub.props.allyFields.bar).toIncludeKey('path');
      expect(stub.props.allyFields.bar.path).toEqual(['bar', 'bar']);
    });

    it('should be able to configure the path to be a function', function () {
      const store = createStore(() => ({}))

      @ally({fields: {
        foo: {path: function () { return ['foo', 'bar'] }},
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKey('foo');
      expect(stub.props.allyFields.foo).toIncludeKey('path');
      expect(stub.props.allyFields.foo.path).toBeA('function');
    })

    it('should execute the custom path function in a context that includes the props, state, and dispatch', function () {
      const store = createStore(() => ({}))

      var pathSpy = expect.createSpy();
      @ally({fields: {
        foo: {path: pathSpy},
      }, options: {
        withRef: true
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(pathSpy).toHaveBeenCalled();
      expect(pathSpy.calls[0].context.props).toBeA('object');
      expect(pathSpy.calls[0].context.state).toBeA('object');
      expect(pathSpy.calls[0].context.dispatch).toBeA('function');
    });

    it('should prepend the component name to the path if the type is component', function () {
      const store = createStore(() => ({}))

      @ally({fields: {
        foo: {type: 'component', path: function () { return ['the', 'foo'] }},
        bar: {type: 'component', path: "the.bar"},
        baz: {type: 'component', path: ["the", "baz"]}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKey('foo');

      expect(stub.props.allyFields.foo).toIncludeKey('finalPath');
      expect(stub.props.allyFields.foo.finalPath).toEqual(['Container', 'the', 'foo']);

      expect(stub.props.allyFields.bar).toIncludeKey('finalPath');
      expect(stub.props.allyFields.bar.finalPath).toEqual(['Container', 'the', 'bar']);

      expect(stub.props.allyFields.baz).toIncludeKey('finalPath');
      expect(stub.props.allyFields.baz.finalPath).toEqual(['Container', 'the', 'baz']);
    });

    it('should prepend nothing to the path if the type is shared', function () {
      const store = createStore(() => ({}))

      @ally({fields: {
        foo: {type: 'shared', path: function () { return ['the', 'foo'] }},
        bar: {type: 'shared', path: "the.bar"},
        baz: {type: 'shared', path: ["the", "baz"]}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('allyFields');
      expect(stub.props.allyFields).toIncludeKey('foo');

      expect(stub.props.allyFields.foo).toIncludeKey('finalPath');
      expect(stub.props.allyFields.foo.finalPath).toEqual(['the', 'foo']);

      expect(stub.props.allyFields.bar).toIncludeKey('finalPath');
      expect(stub.props.allyFields.bar.finalPath).toEqual(['the', 'bar']);

      expect(stub.props.allyFields.baz).toIncludeKey('finalPath');
      expect(stub.props.allyFields.baz.finalPath).toEqual(['the', 'baz']);
    });

    it('should allow default value to be set for an ally field', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              'foo': 'Test'
            }
          }
        }
      }))

      @ally({fields: {
        foo: {defaultValue: 'Not Test'},
        bar: {defaultValue: 'Baz'}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey('foo');
      expect(stub.props.foo).toEqual('Test');
      expect(stub.props.bar).toEqual('Baz');
    });

    it('should combine ally field props with the other props', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              'foo': 'Test'
            }
          }
        }
      }))

      const dispatchSpy = expect.createSpy();

      @ally({
        fields: {
          foo: {defaultValue: 'Oof'},
          bar: {defaultValue: 'Rab'}
        },
        mapStateToProps: function (state) {
          return {
            myStateProp: state.Container.instances["1"].foo
          }
        },
        mapDispatchToProps: {
          myDispatchProp: dispatchSpy
        }
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container myParentProp="here" baz={50} />
        </ProviderMock>
      )

      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKeys(['foo', 'bar', 'myParentProp', 'myStateProp', 'myDispatchProp']);
      expect(stub.props.foo).toEqual('Test');
      expect(stub.props.bar).toEqual('Rab');
      expect(stub.props.myStateProp).toEqual('Test');
      expect(stub.props.myParentProp).toEqual('here');
      expect(stub.props.myDispatchProp).toBeA('function');
    });

    it('should include set functions in the props to set the ally properties', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes',
              bar: 'no'
            }
          }
        }
      }))

      @ally({fields: {
        foo: {},
        bar: {}
      }})
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
        <ProviderMock store={store}>
          <Container pass="through" baz={50} />
        </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKeys(['setFoo', 'setBar']);
      expect(stub.props.setFoo).toBeA('function');
      expect(stub.props.setBar).toBeA('function');
    });

    it('should not include a set function in the props if the readonly flag is true', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes',
              bar: 'no'
            }
          }
        }
      }))

      @ally({
        fields: {
          foo: {readonly: true},
          bar: {readonly: true}
        }
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toExcludeKeys(['setFoo', 'setBar']);
    });

    it('should allow for custom getters that can be used to return the value', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes'
            }
          }
        }
      }))

      @ally({
        fields: {
          foo: {
            getter: function () {
              return "baz"
            }
          }
        }
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey("foo");
      expect(stub.props.foo).toEqual("baz");
    })

    it('should allow for the default getter to be accessed from the custom getter', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes'
            }
          }
        }
      }))

      @ally({
        fields: {
          foo: {
            getter: function (defaultGetter) {
              return "baz" + defaultGetter()
            }
          }
        }
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey("foo");
      expect(stub.props.foo).toEqual("bazyes");
    })

    it('should execute the custom getter in a context with access to the props, store, and dispatch', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes'
            }
          }
        }
      }))

      var context;

      @ally({
        fields: {
          foo: {
            getter: function (defaultGetter) {
              context = this;
              return "baz" + defaultGetter() + context.state.Container.instances['1'].foo;
            }
          }
        }
      })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey("foo");
      expect(stub.props.foo).toEqual("bazyesyes");
      expect(context).toIncludeKeys(["props", "state", "dispatch"]);
      expect(context.props).toBeA("object");
      expect(context.state).toBeA("object");
      expect(context.dispatch).toBeA("function");
    })

    it('should allow for a custom setter to be used instead of the default', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes'
            }
          }
        }
      }))
      
      const setterSpy = expect.createSpy();

      @ally({
        fields: {
          foo: {
            setter: function (value) {
              setterSpy(value);
            }
          }
        }
      })
      class Container extends Component {
        componentDidMount() {
          this.props.setFoo('someValue');
        }
        
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey("setFoo");
      expect(setterSpy).toHaveBeenCalledWith('someValue');
    })

    it('should allow for the default setter to be used in the custom setter', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes'
            }
          }
        }
      }))
      
      var defaultSetter;

      @ally({
        fields: {
          foo: {
            setter: function (value, _defaultSetter) {
              defaultSetter = _defaultSetter;
            }
          }
        }
      })
      class Container extends Component {
        componentDidMount() {
          this.props.setFoo();
        }
        
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props).toIncludeKey("setFoo");
      expect(defaultSetter).toBeA('function');
    })

    it('should execute the custom setter in a context with access to the props, store, and dispatch', function () {
      const store = createStore(() => ({
        'Container': {
          'instances': {
            '1': {
              foo: 'yes'
            }
          }
        }
      }))

      var context;

      @ally({
        fields: {
          foo: {
            setter: function (value, defaultGetter) {
              context = this
            }
          }
        }
      })
      class Container extends Component {
        componentDidMount() {
          this.props.setFoo('someValue');
        }
        
        render() {
          return <Passthrough {...this.props}/>;
        }
      }

      const container = TestUtils.renderIntoDocument(
          <ProviderMock store={store}>
            <Container pass="through" baz={50}/>
          </ProviderMock>
      )
      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(context).toIncludeKeys(["props", "state", "dispatch"]);
      expect(context.props).toBeA("object");
      expect(context.state).toBeA("object");
      expect(context.dispatch).toBeA("function");
    })
    //END ALLY-RELATED TESTS
  })
})
