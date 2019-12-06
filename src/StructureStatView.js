import {deltaColor} from './Color'
import {State} from './State'
import {Node} from './Node'
import {TooltipView} from './TooltipView'
import {NodeTooltipView} from './NodeTooltipView'

class NodeBarView {
  constructor () {
    this.visible = true
    const element = this.element = document.createElement('div')
    element.className = 'fg-node-bar'
    const backgroundElement = this.backgroundElement = element.appendChild(document.createElement('div'))
    backgroundElement.className = 'fg-node-bar-background'
    const contentElement = this.contentElement = element.appendChild(document.createElement('div'))
    contentElement.className = 'fg-node-bar-content'
  }
  show (text, width, color) {
    this.backgroundElement.style.width = width
    this.backgroundElement.style.backgroundColor = color
    this.contentElement.textContent = text
    if (!this.visible) {
      this.visible = true
      this.element.style.opacity = 1.0
    }
  }
  hide () {
    if (this.visible) {
      this.visible = false
      this.backgroundElement.style.width = ''
      this.backgroundElement.style.backgroundColor = ''
      this.element.style.opacity = 0.0
    }
  }
}

export class StructureStatView {
  constructor (model, causalDomain) {
    this.model = model
    const state = this.state = new State('StructureStatView:State')
    causalDomain = this.causalDomain = causalDomain || state
    this.clickListener = null

    this.empty = true
    this.scopeNode = null
    this.statNodes = null
    this.statNode = new Node(null, null, null)
    this.statState = new State('StructureStatView:Stat')
    this.statState.input(model.valueState)

    this.hovered = false
    this.hoverEvent = null
    this.hoverState = new State('StructureStatView:Hover')

    const barView = this.barView = new NodeBarView()
    barView.hide()
    const element = this.element = barView.element
    element.addEventListener('click', (event) => { this.onClick(event) })
    element.addEventListener('mouseenter', (event) => { this.onMouseEnter(event) })
    element.addEventListener('mouseleave', (event) => { this.onMouseLeave(event) })
    element.addEventListener('mousemove', (event) => { this.onMouseMove(event) })

    const tooltipView = this.tooltipView = new TooltipView(document.body)
    const tooltipContentView = this.tooltipContentView = new NodeTooltipView(tooltipView.element, causalDomain)
    tooltipContentView.setNode(this.statNode)
    tooltipContentView.setNamed(false)
    tooltipContentView.contentState.input(this.statState)

    this.summaryStringPrefix = null
    this.summaryStringBlank = null
    this.summaryStringCostCallback = null
    this.summaryStringCountCallback = null
    this.summaryState = new State('StructureStatView:Summary')

    this.barState = new State('StructureStatView:Bar', (state) => { this.updateBar(state) })
    this.barState.input(this.statState)
    this.barState.input(this.summaryState)

    this.tooltipState = new State('StructureStatView:Tooltip', (state) => { this.updateTooltip(state) })
    this.tooltipState.input(this.statState)
    this.tooltipState.input(this.hoverState)
    this.tooltipState.input(tooltipContentView.contentState)

    state.input(this.barState)
    state.input(this.tooltipState)
  }
  discard () {
    document.body.removeChild(this.tooltipView.element)
  }
  setSummaryStringPrefix (summaryStringPrefix) {
    this.summaryStringPrefix = summaryStringPrefix
    this.summaryState.invalidate()
  }
  setSummaryStringBlank (summaryStringBlank) {
    this.summaryStringBlank = summaryStringBlank
    this.summaryState.invalidate()
  }
  setSummaryStringCostCallback (summaryStringCostCallback) {
    this.summaryStringCostCallback = summaryStringCostCallback
    this.summaryState.invalidate()
  }
  setSummaryStringCountCallback (summaryStringCountCallback) {
    this.summaryStringCountCallback = summaryStringCountCallback
    this.summaryState.invalidate()
  }
  setStat (scopeNode, statNodes, statCost) {
    this.empty = false
    this.scopeNode = scopeNode
    this.statNodes = statNodes
    this.statNode.cost = statCost
    this.statState.invalidate()
  }
  setEmpty () {
    this.empty = true
    this.scopeNode = null
    this.statNodes = null
    this.statNode.cost = null
    this.statState.invalidate()
  }
  onClick (event) {
    const clickListener = this.clickListener
    if (clickListener) {
      // FIXME: Not sure what would be useful here, maybe just `this`?
      clickListener(this.scopeNode, this.statNodes, this.statNode.cost)
    }
  }
  onMouseEnter (event) {
    this.hovered = true
    this.hoverEvent = event
    this.hoverState.invalidate()
    this.causalDomain.update()
  }
  onMouseLeave (event) {
    this.hovered = false
    this.hoverEvent = event
    this.hoverState.invalidate()
    this.causalDomain.update()
  }
  onMouseMove (event) {
    this.hovered = true
    this.hoverEvent = event
    this.hoverState.invalidate()
    this.causalDomain.update()
  }
  updateBar (state) {
    if (!this.empty) {
      const statCost = this.statNode.cost
      const summaryStringPrefix = this.summaryStringPrefix || ''
      let summaryString
      let barWidth
      let barColor
      if (statCost) {
        const valueTraits = this.model.valueTraits
        const delta = valueTraits.delta
        const statValue = valueTraits.getValue(statCost)
        const statDelta = delta ? valueTraits.getDelta(statCost) : null
        const scopeNode = this.scopeNode
        const scopeValue = scopeNode.total
        const scopeDelta = delta ? scopeNode.delta : null
        const rawRatio = scopeValue ? Math.abs(statValue / scopeValue) : 1.0
        const adjustedRatio = 1.0 < rawRatio ? 1.0 : rawRatio
        const statNodes = this.statNodes
        const statCount = statNodes ? statNodes.length : null
        const summaryStringCostCallback = this.summaryStringCostCallback
        const summaryStringCountCallback = this.summaryStringCountCallback
        const costSummary = (summaryStringCostCallback && summaryStringCostCallback(statCost)) || null
        const countSummary = (summaryStringCountCallback && summaryStringCountCallback(statCount)) || `${statCount} nodes`
        summaryString = costSummary ? `${costSummary} (${countSummary})` : `${countSummary}`
        barWidth = `${100 * adjustedRatio}%`
        barColor = deltaColor(statDelta, scopeDelta)
      } else {
        summaryString = this.summaryStringBlank || '-'
        barWidth = '0'
        barColor = deltaColor(0, 0)
      }
      this.barView.show(`${summaryStringPrefix}${summaryString}`, barWidth, barColor)
    } else {
      this.barView.hide()
    }
  }
  updateTooltip (state) {
    const tooltipView = this.tooltipView
    const hoverEvent = this.hoverEvent
    if (!this.empty && (this.hovered || (hoverEvent && hoverEvent.shiftKey && tooltipView.shown))) {
      if (!tooltipView.shown) {
        tooltipView.show(this.element, hoverEvent)
      } else if (hoverEvent && !hoverEvent.shiftKey) {
        tooltipView.move(hoverEvent)
      }
    } else {
      tooltipView.hide()
    }
  }
}
