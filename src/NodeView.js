import {State} from './State'
import {StateUpdater} from './StateUpdater'

export class NodeView {
  constructor (causalDomain) {
    this.state = new State('NodeView::State')
    this.causalDomain = causalDomain || this.state

    const element = this.element = document.createElement('div')
    element.className = 'fg-nodeview'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const toolbarElement = this.toolbarElement = element.appendChild(document.createElement('div'))
    toolbarElement.className = 'fg-toolbar'
    toolbarElement.style.display = 'flex'
    toolbarElement.style.flexDirection = 'row'
    toolbarElement.style.flexGrow = '0'

    const nodesElement = this.nodesElement = element.appendChild(document.createElement('div'))
    nodesElement.className = 'fg-nodeview-nodes'
    nodesElement.style.position = 'relative'
    nodesElement.style.overflow = 'hidden'
    nodesElement.style.flex = '1 0 0%'

    this.layoutWidth = 0
    this.layoutWidthState = new State('StructureView::LayoutWidth', (state) => { this.updateLayoutWidth(state) })
    const stateUpdater = StateUpdater.updater(this.causalDomain)
    const layoutWidthChanged = (width) => {
      if (width !== this.layoutWidth) {
        this.layoutWidthState.invalidate()
        stateUpdater.update(1000, 100)
      }
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => { layoutWidthChanged(entries[0].contentRect.width) })
      this.resizeObserver.observe(this.nodesElement)
    } else {
      window.addEventListener('resize', () => { layoutWidthChanged(this.nodesElement.getBoundingClientRect().width) })
    }
  }
  setResized () {
    this.layoutWidthState.invalidate()
  }
  updateLayoutWidth (state) {
    const width = this.nodesElement.getBoundingClientRect().width
    if (this.layoutWidth !== width) {
      this.layoutWidth = width
    } else {
      state.cancel()
    }
  }
}
