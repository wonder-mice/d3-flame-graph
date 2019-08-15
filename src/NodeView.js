import {State} from './State'
import {ElementSize} from './ElementSize'

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

    this.nodesElementSize = new ElementSize(this.nodesElement, this.causalDomain)
  }
  setResized () {
    this.nodesElementSize.invalidate()
  }
}
