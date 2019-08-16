import {State} from './State'
import {nodeIndexNodes, createNodeNameIndex} from './NodeIndex'
import {NodeLayout} from './NodeLayout'
import {NodeRenderer} from './NodeRenderer'
import {TooltipView} from './TooltipView'
import {NodeTooltipView} from './NodeTooltipView'
import {EnvironmentState} from './EnvironmentState'
import {ElementSize} from './ElementSize'
import {NodeHighlightClass, NodeHighlight} from './NodeHighlight'

export class StructureView {
  constructor (model, causalDomain) {
    this.state = new State('StructureView::State')
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

    const nodesElement = this.nodesElement = element.appendChild(document.createElement('div'))
    nodesElement.className = 'fg-nodetree'
    nodesElement.style.position = 'relative'
    nodesElement.style.overflow = 'hidden'
    nodesElement.style.flex = '1 0 0%'
    this.nodesElementSize = new ElementSize(this.nodesElement, this.causalDomain)

    this.rootIndexState = new State('StructureView::RootIndex', (state) => { this.updateRootIndex(state) })
    this.rootIndexState.input(model.structureState)
    this.rootIndexState.input(model.costTraitsState)
    this.rootIndex = null

    this.focusedNode = null
    this.focusedNodeState = new State('StructureView::FocusedNode', (state) => { this.updateFocusedNode(state) })
    this.focusedNodeStateStructureInput = this.focusedNodeState.input(model.structureState)

    this.layout = new NodeLayout()
    this.layoutState = new State('StructureView::Layout', (state) => { this.updateLayout(state) })
    this.layoutState.input(model.orderState)
    this.layoutState.input(model.valueState)
    this.layoutState.input(this.nodesElementSize.widthState)
    this.layoutState.input(this.focusedNodeState)

    const renderer = this.renderer = new NodeRenderer(this.nodesElement)
    const view = this // Because `this` in listener function will be set to HTML element object
    renderer.nodeClickListener = function (event) { view.onNodeClick(this, event) }
    renderer.nodeMouseEnterListener = function (event) { view.onNodeMouseEnter(this, event) }
    renderer.nodeMouseLeaveListener = function (event) { view.onNodeMouseLeave(this, event) }
    renderer.nodeMouseMoveListener = function (event) { view.onNodeMouseMove(this, event) }
    this.renderBaseState = new State('StructureView::RenderBase', (state) => { this.updateRenderBase(state) })
    this.renderBaseState.input(this.layoutState)
    this.renderState = new State('StructureView::Render', (state) => { this.updateRender(state) })
    this.renderStateBaseInput = this.renderState.input(this.renderBaseState)
    this.renderStateSelectionInput = this.renderState.input(model.selectionState)

    this.hoveredElement = null
    this.hoveredElementEvent = null
    this.hoveredElementState = new State('StructureView::HoveredElement')

    this.hoveredNode = null
    this.hoveredNodeState = new State('StructureView::HoveredNode', (state) => { this.updateHoveredNode(state) })
    this.hoveredNodeStateStructureInput = this.hoveredNodeState.input(model.structureState)
    this.hoveredNodeState.input(this.hoveredElementState)

    this.hoverHighlightDelegate = null
    this.hoverHighlightNodes = null
    this.hoverHighlight = new NodeHighlight(new NodeHighlightClass('fg-hv'))
    this.hoverHighlightState = new State('StructureView::HoverHighlight', (state) => { this.updateHoverHighlight(state) })
    this.hoverHighlightState.input(this.renderState)
    this.hoverHighlightStateHoveredNodeInput = this.hoverHighlightState.input(this.hoveredNodeState)
    this.hoverHighlightState.input(this.rootIndexState)

    this.tooltipNodeState = new State('StructureView::TooltipNode', (state) => { this.updateTooltipNode(state) })
    this.tooltipNodeState.input(this.hoveredNodeState)
    const tooltipView = this.tooltipView = new TooltipView(document.body)
    const tooltipContentView = this.tooltipContentView = new NodeTooltipView(tooltipView.element, this.causalDomain)
    tooltipContentView.contentState.input(this.tooltipNodeState)
    this.tooltipPositionState = new State('StructureView::TooltipPosition', (state) => { this.updateTooltipPosition(state) })
    this.tooltipPositionState.input(this.tooltipContentView.contentState)
    this.tooltipPositionState.input(this.hoveredElementState)
    this.tooltipPositionStateHoveredNodeInput = this.tooltipPositionState.input(this.hoveredNodeState)

    this.state.input(this.renderState)
    this.state.input(this.hoverHighlightState)
    this.state.input(this.tooltipPositionState)

    this.revision = 0
    this.rootIndex = null
  }
  setFocusedNode (node) {
    this.focusedNode = node
    this.focusedNodeState.invalidate()
  }
  setResized () {
    this.nodesElementSize.invalidate()
  }
  onNodeClick (element, event) {
    if (!EnvironmentState.textSelected()) {
      const node = element.__node__
      this.focusedNode = node
      this.focusedNodeState.invalidate()
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
  updateLayout (state) {
    const model = this.model
    const layout = this.layout
    layout.totalWidth = this.nodesElementSize.width
    layout.hasDelta = model.valueTraits.delta
    this.layoutResult = layout.layout(model.rootNode, this.focusedNode, ++this.revision)
  }
  updateRenderBase (state) {
    // FIXME: Renderer should own its element and providing target size should be part of renderer interface.
    this.nodesElement.style.height = this.layoutResult.height + 'px'
    this.renderer.render(this.layoutResult)
  }
  updateRender (state) {
    if (this.renderStateBaseInput.changed) {
      // Nothing to do, `updateRenderBase()` already did everything.
      return
    }
    if (this.renderStateSelectionInput.changed) {
      this.renderer.updateSelection(this.renderer.nodes)
    }
  }
  updateFocusedNode (state) {
    if (this.focusedNodeStateStructureInput.changed) {
      // FIXME: Find node that most closely matches the path to node in old structure.
    }
  }
  updateHoveredNode (state) {
    // FIXME: Here we can check for revision to see whether node is still on screen.
    const hoveredNode = this.hoveredNode
    if (this.hoveredNodeStateStructureInput.changed) {
      this.hoveredNode = null
      return
    }
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
    const hoverHighlightDelegate = this.hoverHighlightDelegate
    if (hoverHighlightDelegate) {
      hoverHighlightDelegate(state)
    } else {
      const hoveredNode = this.hoveredNode
      this.hoverHighlightNodes = hoveredNode ? nodeIndexNodes(this.rootIndex, hoveredNode.name) : null
    }
    // const nodes = nodeIndexNodes(this.rootIndex, this.hoverHighlightName)
    this.hoverHighlight.update(this.hoverHighlightNodes, this.revision, true)
    // This is just a small optimization that allows to avoid calling action on
    // downstream states in cases where only highlight changed. Those mentioned
    // downstream states are usually just aggregators and don't have actions
    // associated with them, so benefits of this optimization shouldn't be
    // anything noticible. However, in desire to test drive different state
    // based programming patterns I added this "optimization" here to see what
    // possible goods and bads it can cause.
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
}
