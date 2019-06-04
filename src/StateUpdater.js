import {State} from './State'

export class StateUpdater {
  constructor (state) {
    this.state = state
    this.timeoutState = new State('StateUpdater::Timeout', (state) => {
      if (this.timeoutId) {
        window.clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
      state.cancel()
    })
    state.input(this.timeoutState)
  }
  update (delay, tolerance) {
    const timeoutTime = window.performance.now() + delay
    if (this.timeoutId) {
      if (timeoutTime < this.timeoutTime + tolerance) {
        return
      }
      window.clearTimeout(this.timeoutId)
    } else {
      this.timeoutState.invalidate()
    }
    this.timeoutTime = timeoutTime
    this.timeoutId = window.setTimeout(() => {
      this.state.update()
    }, delay)
  }
  static updater (state) {
    let updater = state.updater
    if (!updater) {
      updater = state.updater = new StateUpdater(state)
    }
    return updater
  }
}
