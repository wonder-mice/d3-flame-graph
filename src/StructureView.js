import {State} from './State'
import {nodeIndexNodes, createNodeNameIndex} from './NodeIndex'
import {NodeLayout} from './NodeLayout'
import {NodeRenderer} from './NodeRenderer'
import {NodeView} from './NodeView'
import {TooltipView} from './TooltipView'
import {NodeTooltipView} from './NodeTooltipView'
import {EnvironmentState} from './EnvironmentState'
import {NodeHighlightClass, NodeHighlight} from './NodeHighlight'

export class StructureViewOptions {
  constructor () {
    this.causalDomain = null
    this.tooltipHostElement = null
  }
}

export class StructureView extends NodeView {
  constructor (model, options) {
    super(options && options.causalDomain)
    const causalDomain = this.causalDomain
    const element = this.element
    this.model = model

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
    this.layoutState.input(this.layoutWidthState)
    this.layoutState.input(this.focusedNodeState)

    const renderer = this.renderer = new NodeRenderer(element)
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
    const tooltipView = this.tooltipView = new TooltipView(options.tooltipHostElement || element)
    const tooltipContentView = this.tooltipContentView = new NodeTooltipView(tooltipView.element, causalDomain)
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
    layout.totalWidth = this.layoutWidth
    layout.hasDelta = model.valueTraits.delta
    this.layoutResult = layout.layout([model.rootNode], this.focusedNode, ++this.revision)
  }
  updateRenderBase (state) {
    this.element.style.height = this.layoutResult.height + 'px'
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
