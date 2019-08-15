import {State} from './State'
import {StateUpdater} from './StateUpdater'

export class ElementSize {
  constructor (element, causalDomain) {
    this.element = element
    this.width = 0
    this.height = 0
    this.sizeState = new State('ElementSize:Size', (state) => { this.updateSize(state) })
    this.widthState = new State('ElementSize:Width')
    this.heightState = new State('ElementSize:Height')
    this.widthState.input(this.sizeState)
    this.heightState.input(this.sizeState)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => { this.onSizeChange(entries[0].contentRect) })
      this.resizeObserver.observe(element)
    } else {
      this.resizeListener = () => { this.onSizeChange(element.getBoundingClientRect()) }
      window.addEventListener('resize', this.resizeListener)
    }
    this.updater = StateUpdater.updater(causalDomain)
  }
  invalidate () {
    this.sizeState.invalidate()
  }
  disconnect () {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    } else {
      window.removeEventListener('resize', this.resizeListener)
    }
  }
  onSizeChange (rect) {
    const width = rect.width
    const height = rect.height
    if (width !== this.width || height !== this.height) {
      this.sizeState.invalidate()
      this.updater.update(1000, 100)
    }
  }
  updateSize (state) {
    const rect = this.element.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    let changed = false
    if (width !== this.width) {
      this.width = width
      changed = true
    } else {
      this.widthState.cancel()
    }
    if (height !== this.height) {
      this.height = height
      changed = true
    } else {
      this.heightState.cancel()
    }
    if (!changed) {
      state.cancel()
    }
  }
}
