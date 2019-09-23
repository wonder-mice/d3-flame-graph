import {State} from './State'
import {deltaColor} from './Color'
import {NodeListRenderer} from './NodeListRenderer'
import {FilterInputView} from './TextInputView'
import {TooltipView} from './TooltipView'
import {NodeTooltipView} from './NodeTooltipView'
import {EnvironmentState} from './EnvironmentState'

export class FlattenView {
  constructor (model, causalDomain) {
    this.state = new State('FlattenView::State')
    this.causalDomain = causalDomain || this.state
    this.model = model
    this.nodeClickListener = null

    const element = this.element = document.createElement('div')
    element.className = 'fg-flatten'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const toolbarElement = this.toolbarElement = element.appendChild(document.createElement('div'))
    toolbarElement.className = 'fg-toolbar'
    toolbarElement.style.display = 'flex'
    toolbarElement.style.flexDirection = 'row'
    toolbarElement.style.flexGrow = '0'

    const nodeFilterView = this.nodeFilterView = new FilterInputView(this.causalDomain)
    const nodeFilterElement = nodeFilterView.element
    nodeFilterElement.style.flex = '1 0'
    toolbarElement.appendChild(nodeFilterElement)

    this.hoveredElement = null
    this.hoveredElementEvent = null
    this.hoveredElementState = new State('FlattenView:HoveredElement')

    this.hoveredNode = null
    this.hoveredNodeState = new State('FlattenView:HoveredNode', (state) => { this.updateHoveredNode(state) })
    this.hoveredNodeStructureNodeInput = this.hoveredNodeState.input(model.structureNodeState)
    this.hoveredNodeState.input(this.hoveredElementState)

    const renderer = this.renderer = new NodeListRenderer(this.causalDomain)
    const view = this // Because `this` in listener function will be set to HTML element object
    renderer.nodeClickListener = function (event) { view.onNodeClick(this, event) }
    renderer.nodeMouseEnterListener = function (event) { view.onNodeMouseEnter(this, event) }
    renderer.nodeMouseLeaveListener = function (event) { view.onNodeMouseLeave(this, event) }
    renderer.nodeMouseMoveListener = function (event) { view.onNodeMouseMove(this, event) }
    renderer.nodeElementFunction = (element) => { this.nodeElement(element) }
    renderer.nodeContentFunction = (element, node, initial) => { this.nodeContent(element, node, initial) }
    renderer.setNodeHeightPixels(18)
    renderer.element.style.flex = '1 0 0%'
    element.appendChild(renderer.element)

    this.nodesStatsState = new State('FlattenView:NodesStats', (state) => { this.updateNodesStats(state) })
    this.nodesStatsState.input(renderer.nodesState)
    this.nodesStatsState.input(model.valueState)
    this.filterPredicateState = new State('FlattenView:FilterPredicate', (state) => { this.updateFilterPredicate(state) })
    this.filterPredicateState.input(nodeFilterView.predicateState)
    this.renderer.filterPredicateState.input(this.filterPredicateState)
    this.filteredStatsState = new State('FlattenView:FilteredStats', (state) => { this.updateFilteredStats(state) })
    this.filteredStatsState.input(renderer.filteredNodesState)
    this.filteredStatsState.input(model.valueState)
    this.filteredStatsState.input(this.nodesStatsState)
    renderer.nodeContentState.input(this.nodesStatsState)
    renderer.nodeContentState.input(this.filteredStatsState)
    renderer.nodeContentState.input(model.valueState)
    renderer.filteredNodesState.input(model.orderState)
    renderer.nodesState.input(State.wrap(model.structureNodeState, (state) => {
      renderer.setNodes(this.model.structureNode.children)
    }))

    this.tooltipNodeState = new State('FlattenView:TooltipNode', (state) => { this.updateTooltipNode(state) })
    this.tooltipNodeState.input(this.hoveredNodeState)
    const tooltipView = this.tooltipView = new TooltipView(document.body)
    const tooltipContentView = this.tooltipContentView = new NodeTooltipView(tooltipView.element, this.causalDomain)
    tooltipContentView.contentState.input(this.tooltipNodeState)
    this.tooltipPositionState = new State('FlattenView:TooltipPosition', (state) => { this.updateTooltipPosition(state) })
    this.tooltipPositionState.input(this.tooltipContentView.contentState)
    this.tooltipPositionState.input(this.hoveredElementState)
    this.tooltipPositionStateHoveredNodeInput = this.tooltipPositionState.input(this.hoveredNodeState)

    this.state.input(renderer.pageState)
    this.state.input(this.tooltipPositionState)
  }
  discard () {
    this.renderer.discard()
    document.body.removeChild(this.tooltipView.element)
  }
  setResized () {
    this.renderer.elementSize.invalidate()
  }
  setFilterExpression (filterExpression) {
    this.nodeFilterView.setText(filterExpression)
  }
  get filterExpression () {
    return this.nodeFilterView.text
  }
  onNodeClick (element, event) {
    if (!EnvironmentState.textSelected()) {
      const node = element.__node__
      const listener = this.nodeClickListener
      if (listener) {
        listener(node)
      } else {
        // Keeping this branch to remember how this method worked before.
        // But current idea is that `nodeClickListener` should always be set.
        this.model.setStructureNode(node)
        this.causalDomain.update()
      }
    }
  }
  onNodeMouseEnter (element, event) {
    this.hoveredElement = element
    this.hoveredElementEvent = event
    this.hoveredElementState.invalidate()
    this.causalDomain.update()
  }
  onNodeMouseLeave (element, event) {
    this.hoveredElement = null
    this.hoveredElementEvent = event
    this.hoveredElementState.invalidate()
    this.causalDomain.update()
  }
  onNodeMouseMove (element, event) {
    this.hoveredElement = element
    this.hoveredElementEvent = event
    this.hoveredElementState.invalidate()
    this.causalDomain.update()
  }
  updateHoveredNode (state) {
    const hoveredNode = this.hoveredNode
    if (this.hoveredNodeStructureNodeInput.changed) {
      this.hoveredNode = null
      return
    }
    if (!this.hoveredElementEvent.shiftKey || !hoveredNode) {
      const hoveredElement = this.hoveredElement
      const node = hoveredElement ? hoveredElement.__node__ : null
      if (node !== hoveredNode) {
        this.hoveredNode = node
        return
      }
    }
    state.cancel()
  }
  updateTooltipNode (state) {
    const hoveredNode = this.hoveredNode
    if (hoveredNode) {
      this.tooltipContentView.node = hoveredNode
    } else {
      state.cancel()
    }
  }
  updateTooltipPosition (state) {
    const hoveredNode = this.hoveredNode
    if (hoveredNode) {
      if (this.tooltipPositionStateHoveredNodeInput.changed) {
        if (this.tooltipView.shown || !this.hoveredElementEvent.shiftKey) {
          this.tooltipView.show(this.hoveredNode.element, this.hoveredElementEvent)
        }
      } else if (!this.hoveredElementEvent.shiftKey) {
        this.tooltipView.move(this.hoveredElementEvent)
      }
    } else {
      this.tooltipView.hide()
    }
  }
  updateNodesStats (state) {
    let maxValue = 0
    let maxDelta = 0
    const nodes = this.renderer.nodes
    if (nodes) {
      for (let i = nodes.length; i--;) {
        const node = nodes[i]
        const value = Math.abs(node.total)
        const delta = Math.abs(node.delta)
        if (maxValue < value) { maxValue = value }
        if (maxDelta < delta) { maxDelta = delta }
      }
    }
    this.nodesMaxValue = maxValue
    this.nodesMaxDelta = maxDelta
  }
  updateFilterPredicate (state) {
    const namePredicate = this.nodeFilterView.predicate
    const filterPredicate = namePredicate ? (node) => { return namePredicate(node.name) } : null
    this.renderer.setFilterPredicate(filterPredicate)
  }
  updateFilteredStats (state) {
    let maxValue = 0
    let maxDelta = 0
    const renderer = this.renderer
    const nodes = renderer.nodes
    const filteredNodes = renderer.filteredNodes
    if (filteredNodes === nodes) {
      maxValue = this.nodesMaxValue
      maxDelta = this.nodesMaxDelta
    } else if (filteredNodes) {
      for (let i = filteredNodes.length; i--;) {
        const node = filteredNodes[i]
        const value = Math.abs(node.total)
        const delta = Math.abs(node.delta)
        if (maxValue < value) { maxValue = value }
        if (maxDelta < delta) { maxDelta = delta }
      }
    }
    this.filteredMaxValue = maxValue
    this.filteredMaxDelta = maxDelta
  }
  nodeElement (element) {
    element.className = 'fg-node'
  }
  nodeContent (element, node, initial) {
    if (initial) {
      element.textContent = node.name
    }
    // FIXME: gradient shoud use absolute values
    const prcnt = (Math.abs(node.total) / this.nodesMaxValue * 100) + '%'
    // FIXME: color should use name color when no delta available
    const color = deltaColor(node.delta, this.maxDelta)
    element.style.background = `linear-gradient(to right, ${color} ${prcnt}, #fff ${prcnt})`
  }
}
