import {State} from './State'
import {EnvironmentState} from './EnvironmentState'
import {deltaColor, nameColor} from './Color'
import {
  nodeRootPath, nodeWalk,
  nodeFlagMarked, nodeFlagHiddenDescendantMarked, nodeFlagMarkedShift,
  nodeFlagHighlighted, nodeFlagHiddenDescendantHighlighted, nodeMaskHighlight, nodeMaskHighlightShift,
  nodeMaskFocus, nodeMaskFocusShift, nodeFlagSelected, nodeFlagTiny
} from './Node'
import {nodeIndexNodes, createNodeNameIndex} from './NodeIndex'
import {NodeTreeRenderer} from './NodeTreeRenderer'
import {TooltipView} from './TooltipView'
import {NodeTooltipView} from './NodeTooltipView'

const pageFlagNodeTinyChanged = 0b01
const pageFlagNodeColorChanged = 0b10
const nodeMaskMarkAppearance = nodeFlagMarked | nodeFlagHiddenDescendantMarked
const nodeMaskAppearance = nodeFlagTiny | nodeFlagSelected | nodeMaskFocus | nodeMaskMarkAppearance | nodeMaskHighlight

const nodeFocusClasses = ['', '', ' fg-fc2', ' fg-fc3']
const nodeMarkClasses = ['', ' fg-mk1', ' fg-mk2', ' fg-mk3']
const nodeHighlightClasses = ['', ' fg-hl1', ' fg-hl2', ' fg-hl3']

const nodeTinyWidthPixels = 35

class NodeHighlight {
  constructor (renderer) {
    this.renderer = renderer
    this.highlightedNodes = null
  }
  update (nodes, layoutChanged) {
    // If `layoutChanged`, then all nodes in current layout have flags in
    // `nodeMaskHighlight` set to 0 (because layout clears them).
    const renderer = this.renderer
    if (!layoutChanged) {
      const highlightedNodes = this.highlightedNodes
      if (highlightedNodes) {
        for (let i = highlightedNodes.length; i--;) {
          highlightedNodes[i].flags &= ~nodeMaskHighlight
        }
        renderer.setAppearanceChanged(highlightedNodes)
      }
    }
    this.highlightedNodes = null
    if (!nodes) {
      return
    }
    // Hightlight each node or its first visible ancestor.
    const revision = renderer.layoutRevision
    const highlightedNodes = []
    let highlightedNodeCount = 0
    nextNode:
    for (let i = nodes.length; i--;) {
      let node = nodes[i]
      let highlightFlag = nodeFlagHighlighted
      if (revision !== node.rev) {
        do {
          if (!(node = node.parent)) {
            continue nextNode
          }
        } while (revision !== node.rev)
        highlightFlag = nodeFlagHiddenDescendantHighlighted
      }
      const flags = node.flags
      node.flags = flags | highlightFlag
      if (!(flags & nodeMaskHighlight)) {
        highlightedNodes[highlightedNodeCount++] = node
      }
    }
    if (highlightedNodeCount) {
      this.highlightedNodes = highlightedNodes
      if (!layoutChanged) {
        renderer.setAppearanceChanged(highlightedNodes)
      }
    }
  }
}

export class StructureView {
  constructor (model, causalDomain) {
    this.state = new State('StructureView:State')
    this.causalDomain = causalDomain || this.state
    this.model = model

    const element = this.element = document.createElement('div')
    element.className = 'fg-structure'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const toolbarElement = this.toolbarElement = element.appendChild(document.createElement('div'))
    toolbarElement.className = 'fg-toolbar'
    toolbarElement.style.display = 'flex'
    toolbarElement.style.flexDirection = 'row'
    toolbarElement.style.flexGrow = '0'
    toolbarElement.innerHTML = (
`<div style="flex: 1 0"></div>
<div style="flex: 0 1; display:flex; flex-direction: row; flex-basis: 25%">
  <input type="text" style="flex: 1 0" class="fg-input fg-input-mono" value="https://github.com/wonder-mice/zf_log.git">
  <button type="button" class="fg-btn fg-btn-sm">Search</button>
  <button type="button" class="fg-btn fg-btn-sm">Clear</button>
</div>`)

    this.rootIndex = null
    this.rootIndexState = new State('StructureView:RootIndex', (state) => { this.updateRootIndex(state) })
    this.rootIndexState.input(model.structureState)
    this.rootIndexState.input(model.costTraitsState)

    const renderer = this.renderer = new NodeTreeRenderer(this.causalDomain)
    const view = this // Because `this` in listener function will be set to HTML element object
    renderer.nodeClickListener = function (event) { view.onNodeClick(this, event) }
    renderer.nodeMouseEnterListener = function (event) { view.onNodeMouseEnter(this, event) }
    renderer.nodeMouseLeaveListener = function (event) { view.onNodeMouseLeave(this, event) }
    renderer.nodeMouseMoveListener = function (event) { view.onNodeMouseMove(this, event) }
    renderer.nodeElementFunction = (element) => { this.nodeElement(element) }
    renderer.nodeContentFunction = (element, node, initial) => { this.nodeContent(element, node, initial) }
    renderer.nodeAppearanceFunction = (element, node) => { this.nodeAppearance(element, node) }
    renderer.pagePrepareFunction = (appearanceOnly) => { this.pagePrepare(appearanceOnly) }
    renderer.setNodeHeightPixels(18)
    renderer.element.style.flex = '1 0 0%'
    element.appendChild(renderer.element)

    this.rootNodeState = new State('StructureView:RootNode', (state) => { this.updateRootNode(state) })
    this.rootNodeState.input(model.structureState)
    renderer.rootNodeState.input(this.rootNodeState)

    this.focusNodeState = new State('StructureView:FocusNode', (state) => { this.updateFocusNode(state) })
    this.focusNodeState.input(this.rootNodeState)
    renderer.focusNodeState.input(this.focusNodeState)

    this.focusStatsState = new State('StructureView:FocusStats', (state) => { this.updateFocusStats(state) })
    this.focusStatsState.input(renderer.focusNodeState)
    this.focusStatsState.input(model.valueState)

    this.maxDelta = null
    this.layoutStatsState = new State('StructureView:LayoutStats', (state) => { this.updateLayoutStats(state) })
    this.layoutStatsState.input(renderer.layoutState)
    this.layoutStatsState.input(model.valueState)
    this.layoutStatsState.input(this.focusStatsState)

    this.nodeTinyState = new State('StructureView:NodeTiny')
    this.nodeTinyState.input(renderer.layoutState)
    this.nodeColorState = new State('StructureView:NodeColor')
    this.nodeColorState.input(this.layoutStatsState)
    this.nodeColorState.input(model.valueState)

    renderer.nodeAppearanceState.input(renderer.focusNodeState)
    renderer.nodeAppearanceState.input(model.selectionState)
    renderer.nodeContentState.input(this.focusStatsState)
    renderer.nodeContentState.input(this.layoutStatsState)
    renderer.nodeContentState.input(model.valueState)
    renderer.layoutState.input(model.valueState)
    renderer.layoutState.input(model.orderState)
    this.pageStateNodeTinyInput = renderer.pageState.input(this.nodeTinyState)
    this.pageStateNodeColorInput = renderer.pageState.input(this.nodeColorState)
    this.pageFlags = 0

    this.hoveredElement = null
    this.hoveredElementEvent = null
    this.hoveredElementState = new State('StructureView:HoveredElement')

    this.hoveredNode = null
    this.hoveredNodeState = new State('StructureView:HoveredNode', (state) => { this.updateHoveredNode(state) })
    this.hoveredNodeStateStructureInput = this.hoveredNodeState.input(model.structureState)
    this.hoveredNodeState.input(this.hoveredElementState)

    this.hoverHighlight = new NodeHighlight(renderer)
    this.hoverHighlightDelegate = null
    this.hoverHighlightState = new State('StructureView:HoverHighlight', (state) => { this.updateHoverHighlight(state) })
    this.hoverHighlightStateLayoutInput = this.hoverHighlightState.input(renderer.layoutState)
    this.hoverHighlightStateHoveredNodeInput = this.hoverHighlightState.input(this.hoveredNodeState)
    this.hoverHighlightState.input(this.rootIndexState)
    renderer.nodeAppearanceChangeState.input(this.hoverHighlightState)

    this.tooltipNodeState = new State('StructureView:TooltipNode', (state) => { this.updateTooltipNode(state) })
    this.tooltipNodeState.input(this.hoveredNodeState)
    const tooltipView = this.tooltipView = new TooltipView(document.body)
    const tooltipContentView = this.tooltipContentView = new NodeTooltipView(tooltipView.element, this.causalDomain)
    tooltipContentView.contentState.input(this.tooltipNodeState)
    this.tooltipPositionState = new State('StructureView:TooltipPosition', (state) => { this.updateTooltipPosition(state) })
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
  setFocusNode (node) {
    this.renderer.setFocusNode(node)
    this.focusNodeState.invalidate()
  }
  get focusNode () {
    return this.renderer.focusNode
  }
  setResized () {
    this.renderer.elementSize.invalidate()
  }
  onNodeClick (element, event) {
    if (!EnvironmentState.textSelected()) {
      const node = element.__node__
      this.renderer.setFocusNode(node)
      this.causalDomain.update()
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
  updateRootIndex (state) {
    const model = this.model
    this.rootIndex = createNodeNameIndex([model.rootNode], model.costTraits)
  }
  updateRootNode (state) {
    this.renderer.setRootNode(this.model.rootNode)
  }
  updateFocusNode (state) {
    const renderer = this.renderer
    const focusNode = renderer.focusNode
    if (focusNode) {
      const focusPath = []
      const rootNode = renderer.rootNode
      if (rootNode !== nodeRootPath(focusNode, focusPath)) {
        renderer.setFocusNode(focusPath.length ? nodeWalk(rootNode, focusPath) : null)
      }
    }
  }
  updateFocusStats (state) {
    // No need in this state right now, but I want to keep it, since computation of
    // focus stats is something we'll probably want at some point.
    state.cancel()
  }
  updateLayoutStats (state) {
    const layoutNodes = this.renderer.layoutNodes
    let maxDelta = null
    if (this.model.valueTraits.delta) {
      maxDelta = 0
      for (let i = layoutNodes.length; i--;) {
        const delta = Math.abs(layoutNodes[i].delta)
        if (maxDelta < delta) {
          maxDelta = delta
        }
      }
    }
    if (maxDelta !== this.maxDelta) {
      this.maxDelta = maxDelta
    } else {
      state.cancel()
    }
  }
  updateHoveredNode (state) {
    const hoveredNode = this.hoveredNode
    if (this.hoveredNodeStateStructureInput.changed) {
      this.hoveredNode = null
      return
    }
    // If we want discard tooltip when node becomes invisible, here we
    // can check for its revision to see whether it was included in layout.
    // Will need to add dependency on layoutState for that though.
    if (!hoveredNode || !this.hoveredElementEvent.shiftKey) {
      const hoveredElement = this.hoveredElement
      const node = hoveredElement ? hoveredElement.__node__ : null
      if (node !== hoveredNode) {
        this.hoveredNode = node
        return
      }
    }
    state.cancel()
  }
  updateHoverHighlight (state) {
    let highlightedNodes = null
    const hoveredNode = this.hoveredNode
    const hoverHighlightDelegate = this.hoverHighlightDelegate
    if (hoverHighlightDelegate) {
      highlightedNodes = hoverHighlightDelegate(hoveredNode, this.hoverHighlightStateHoveredNodeInput.changed)
    } else if (hoveredNode) {
      highlightedNodes = nodeIndexNodes(this.rootIndex, hoveredNode.name)
    }
    this.hoverHighlight.update(highlightedNodes, this.hoverHighlightStateLayoutInput.changed)
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
  nodeElement (element) {
    element.className = 'fg-node'
  }
  nodeClassName (flags) {
    let className = flags & nodeFlagTiny ? 'fg-node fg-tiny' : 'fg-node'
    if (!(flags & nodeFlagSelected)) {
      className += ' fg-nsel'
    }
    const markFlags = flags & nodeMaskMarkAppearance
    if (markFlags) {
      className += nodeMarkClasses[markFlags >>> nodeFlagMarkedShift]
    }
    const focusFlags = flags & nodeMaskFocus
    if (focusFlags) {
      className += nodeFocusClasses[focusFlags >>> nodeMaskFocusShift]
    }
    const highlightFlags = flags & nodeMaskHighlight
    if (highlightFlags) {
      className += nodeHighlightClasses[highlightFlags >>> nodeMaskHighlightShift]
    }
    return className
  }
  nodeContent (element, node, initial) {
    const pageFlags = this.pageFlags
    let flags = node.flags
    if (initial || (pageFlags & pageFlagNodeTinyChanged)) {
      // This complicated optimization is due to assumption that it's best to
      // minimize access to DOM, specifically setters that impact measuremnt and
      // rendering to avoid unneccessary invalidation.
      const oflags = flags
      flags = nodeTinyWidthPixels < node.width ? flags & ~nodeFlagTiny : flags | nodeFlagTiny
      if (initial || oflags !== flags) {
        element.textContent = flags & nodeFlagTiny ? '' : node.name
        node.flags = flags
      }
    }
    if (initial || (pageFlags & pageFlagNodeColorChanged)) {
      const maxDelta = this.maxDelta
      if (maxDelta) {
        element.style.backgroundColor = deltaColor(node.delta, maxDelta)
      } else {
        element.style.backgroundColor = nameColor(node.name)
      }
    }
    const appearance = flags & nodeMaskAppearance
    if (initial || appearance !== node.appearance) {
      element.className = this.nodeClassName(appearance)
      node.appearance = appearance
    }
  }
  nodeAppearance (element, node) {
    const appearance = node.flags & nodeMaskAppearance
    if (appearance !== node.appearance) {
      element.className = this.nodeClassName(appearance)
      node.appearance = appearance
    }
  }
  pagePrepare (appearanceOnly) {
    if (!appearanceOnly) {
      this.pageFlags = (this.pageStateNodeTinyInput.changed ? pageFlagNodeTinyChanged : 0) |
                       (this.pageStateNodeColorInput.changed ? pageFlagNodeColorChanged : 0)
    }
  }
}
