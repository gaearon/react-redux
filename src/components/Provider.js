import { Component, PropTypes, Children } from 'react'
import storeShape from '../utils/storeShape'
import batchedUpdates from '../utils/batchedUpdates'

let didWarnAboutReceivingStore = false
function warnAboutReceivingStore() {
  if (didWarnAboutReceivingStore) {
    return
  }
  didWarnAboutReceivingStore = true

  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(
      '<Provider> does not support changing `store` on the fly. ' +
      'It is most likely that you see this error because you updated to ' +
      'Redux 2.x and React Redux 2.x which no longer hot reload reducers ' +
      'automatically. See https://github.com/reactjs/react-redux/releases/' +
      'tag/v2.0.0 for the migration instructions.'
    )
  }
  /* eslint-disable no-console */
}

function batchListenerCalls(store) {
  let currentListeners = []
  let nextListeners = currentListeners

  const ensureCanMutateNextListeners = () => {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  let notifyListeners = () => {
    const listeners = currentListeners = nextListeners
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]()
    }
  }

  let batchListener = () => {
    batchedUpdates(notifyListeners)
  }

  let unsubscribeBatchListener

  return {
    ...store,
    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new Error('Expected listener to be a function.')
      }

      let isSubscribed = true

      ensureCanMutateNextListeners()
      nextListeners.push(listener)

      if (!unsubscribeBatchListener) {
        unsubscribeBatchListener = store.subscribe(batchListener)
      }

      return () => {
        if (!isSubscribed) {
          return
        }

        isSubscribed = false

        ensureCanMutateNextListeners()
        const index = nextListeners.indexOf(listener)
        nextListeners.splice(index, 1)

        if (!nextListeners.length && unsubscribeBatchListener) {
          unsubscribeBatchListener()
          unsubscribeBatchListener = null
        }
      }
    }
  }
}

export default class Provider extends Component {
  getChildContext() {
    return { store: this.store }
  }

  constructor(props, context) {
    super(props, context)
    this.store = batchListenerCalls(props.store)
  }

  render() {
    const { children } = this.props
    return Children.only(children)
  }
}

if (process.env.NODE_ENV !== 'production') {
  Provider.prototype.componentWillReceiveProps = function (nextProps) {
    const { store } = this
    const { store: nextStore } = nextProps

    if (store !== nextStore) {
      warnAboutReceivingStore()
    }
  }
}

Provider.propTypes = {
  store: storeShape.isRequired,
  children: PropTypes.element.isRequired
}
Provider.childContextTypes = {
  store: storeShape.isRequired
}
