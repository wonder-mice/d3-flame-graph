import {State} from './State'
import {NodeLayout} from './NodeLayout'
import {NodeRenderer} from './NodeRenderer'
import {NodeView} from './NodeView'
import {TooltipView} from './TooltipView'
import {NodeTooltipView} from './NodeTooltipView'
import {EnvironmentState} from './EnvironmentState'

export class FlattenViewOptions {
  constructor () {
    this.causalDomain = null
    this.tooltipHostElement = null
  }
}

export class FlattenView extends NodeView {
  constructor (model, options) {
    super(options && options.causalDomain)
    const causalDomain = this.causalDomain
    const element = this.element
    this.model = model

    this.hoveredElement = null
    this.hoveredElementEvent = null
    this.hoveredElementState = new State('FlattenView::HoveredElement')

    this.layout = new NodeLayout()
    this.layoutState = new State('FlattenView::Layout', (state) => { this.updateLayout(state) })
    this.layoutState.input(model.orderState)
    this.layoutState.input(model.valueState)
    this.layoutState.input(model.structureNodeState)
    this.layoutState.input(model.structureState)
    this.layoutState.input(this.layoutWidthState)

    this.hoveredNode = null
    this.hoveredNodeState = new State('FlattenView::HoveredNode', (state) => { this.updateHoveredNode(state) })
    this.hoveredNodeStateLayoutInput = this.hoveredNodeState.input(this.layoutState)
    this.hoveredNodeState.input(this.hoveredElementState)

    const renderer = this.renderer = new NodeRenderer(element)
    const view = this // Because `this` in listener function will be set to HTML element object
    renderer.nodeClickListener = function (event) { view.onNodeClick(this, event) }
    renderer.nodeMouseEnterListener = function (event) { view.onNodeMouseEnter(this, event) }
    renderer.nodeMouseLeaveListener = function (event) { view.onNodeMouseLeave(this, event) }
    renderer.nodeMouseMoveListener = function (event) { view.onNodeMouseMove(this, event) }
    this.renderBaseState = new State('FlattenView::RenderBase', (state) => { this.updateRenderBase(state) })
    this.renderBaseState.input(this.layoutState)
    this.renderState = new State('FlattenView::Render', (state) => { this.updateRender(state) })
    this.renderStateBaseInput = this.renderState.input(this.renderBaseState)

    this.tooltipNodeState = new State('FlattenView::TooltipNode', (state) => { this.updateTooltipNode(state) })
    this.tooltipNodeState.input(this.hoveredNodeState)
    const tooltipView = this.tooltipView = new TooltipView(options.tooltipHostElement || element)
    const tooltipContentView = this.tooltipContentView = new NodeTooltipView(tooltipView.element, causalDomain)
    tooltipContentView.contentState.input(this.tooltipNodeState)
    this.tooltipPositionState = new State('FlattenView::TooltipPosition', (state) => { this.updateTooltipPosition(state) })
    this.tooltipPositionState.input(this.tooltipContentView.contentState)
    this.tooltipPositionState.input(this.hoveredElementState)
    this.tooltipPositionStateHoveredNodeInput = this.tooltipPositionState.input(this.hoveredNodeState)

    this.state.input(this.renderState)
    this.state.input(this.tooltipPositionState)

    this.revision = 0
  }
  onNodeClick (element, event) {
    if (!EnvironmentState.textSelected()) {
      const node = element.__node__
      this.model.setStructureNode(node)
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
  updateLayout (state) {
    const model = this.model
    const layout = this.layout
    layout.totalWidth = this.layoutWidth
    layout.hasDelta = model.valueTraits.delta
    this.layoutResult = layout.layout([model.rootNode], model.structureNode, ++this.revision)
  }
  updateRenderBase (state) {
    this.element.style.height = this.layoutResult.height + 'px'
    this.renderer.render(this.layoutResult)
  }
  updateRender (state) {
    if (this.renderStateBaseInput.changed) {
      // Nothing to do, `updateRenderBase()` already did everything.
      // return
    }
  }
  updateHoveredNode (state) {
    // FIXME: Here we can check for revision to see whether node is still on screen.
    const hoveredNode = this.hoveredNode
    if (this.hoveredNodeStateLayoutInput.changed) {
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
}
