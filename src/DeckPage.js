import {State} from './State'
import {StructureTraits, CostTraits, ValueTraits} from './Item'
import {StructureModel} from './StructureModel'
import {FlattenModel} from './FlattenModel'
import {NodeSelection, FlattenNodeSelection, SelectedNodeStructureTraits, selectedNodeStructureRoots} from './NodeSelection'
import {nodeIndexNodes} from './NodeIndex'
import {StructureViewOptions, StructureView} from './StructureView'
import {FlattenViewOptions, FlattenView} from './FlattenView'
import {SplitView} from './SplitView'

export class DeckPageOptions {
  constructor () {
    this.causalDomain = null
    this.structureRoots = null
    this.structureTraits = null
    this.costTraits = null
    this.valueTraits = null
    this.nodeTooltipContentCallback = null
  }
}

export class DeckPage {
  // Needed features:
  // - Option to follow cost/value traits and order function from master model
  // - Option to setup using selection from master model
  constructor (parent, options) {
    const state = this.state = new State('DeckPage::State')
    const causalDomain = this.causalDomain = (options && options.causalDomain) || state
    const nodeTooltipContentCallback = options && options.nodeTooltipContentCallback
    const structureRoots = (options && options.structureRoots) || null
    const structureTraits = (options && options.structureTraits) || new StructureTraits()
    const costTraits = (options && options.costTraits) || new CostTraits()
    const valueTraits = (options && options.valueTraits) || new ValueTraits()

    const element = this.element = document.createElement('div')
    // FIXME: Remove flamegraph class
    element.className = 'flamegraph'
    element.style.width = '100%'
    element.style.display = 'flex'
    element.style.position = 'relative'
    element.style.flexDirection = 'column'

    const splitView = this.splitView = new SplitView(element)
    const primaryElement = this.primaryElement = splitView.left.appendChild(document.createElement('div'))
    primaryElement.style.width = '100%'
    primaryElement.style.overflow = 'auto'
    const secondaryElement = this.secondaryElement = splitView.right.appendChild(document.createElement('div'))
    secondaryElement.style.width = '100%'
    secondaryElement.style.overflow = 'auto'

    const primaryModel = this.primaryModel = new StructureModel()
    primaryModel.rootName = 'FIXME: Primary root name'
    primaryModel.setStructureRoots(structureRoots)
    primaryModel.setStructureTraits(structureTraits)
    primaryModel.setCostTraits(costTraits)
    primaryModel.setValueTraits(valueTraits)
    const primarySelection = new NodeSelection(primaryModel)
    const primaryViewOptions = new StructureViewOptions()
    primaryViewOptions.causalDomain = causalDomain
    primaryViewOptions.tooltipHostElement = element
    const primaryView = this.primaryView = new StructureView(primaryModel, primaryViewOptions)
    primaryView.tooltipContentView.setContentCallback(nodeTooltipContentCallback)
    primaryView.tooltipContentView.setSelectionInterface(primarySelection)
    primaryElement.appendChild(primaryView.element)
    state.input(primaryView.state)

    const secondaryModel = this.secondaryModel = new FlattenModel()
    secondaryModel.rootName = 'FIXME: Secondary root name'
    secondaryModel.setStructureTraits(new SelectedNodeStructureTraits())
    secondaryModel.setCostTraits(costTraits)
    secondaryModel.setValueTraits(valueTraits)
    const secondaryViewOptions = new FlattenViewOptions()
    secondaryViewOptions.causalDomain = causalDomain
    secondaryViewOptions.tooltipHostElement = element
    const secondaryView = this.secondaryView = new FlattenView(secondaryModel, secondaryViewOptions)
    secondaryView.tooltipContentView.setContentCallback(nodeTooltipContentCallback)
    secondaryView.tooltipContentView.setSelectionInterface(new FlattenNodeSelection(primarySelection))
    secondaryElement.appendChild(secondaryView.element)
    state.input(secondaryView.state)

    this.primaryHighlightMirrorsSecondary = false
    this.primaryHoverHighlightStateSecondaryHoveredNodeInput = primaryView.hoverHighlightState.input(secondaryView.hoveredNodeState)
    primaryView.hoverHighlightDelegate = (state) => {
      const primaryView = this.primaryView
      const primaryHoveredNode = primaryView.hoveredNode
      const secondaryHoveredNode = this.secondaryView.hoveredNode
      if (primaryView.hoverHighlightStateHoveredNodeInput.changed && primaryHoveredNode) {
        this.primaryHighlightMirrorsSecondary = false
      } else if (this.primaryHoverHighlightStateSecondaryHoveredNodeInput.changed && secondaryHoveredNode) {
        this.primaryHighlightMirrorsSecondary = true
      }
      let highlightNodes = null
      if (secondaryHoveredNode && (this.primaryHighlightMirrorsSecondary || !primaryHoveredNode)) {
        highlightNodes = secondaryHoveredNode.roots
      } else if (primaryHoveredNode) {
        highlightNodes = nodeIndexNodes(primaryView.rootIndex, primaryHoveredNode.name)
      }
      primaryView.hoverHighlightNodes = highlightNodes
    }

    this.selectedStructureState = new State('DeckPage::SelectedStructure', (state) => {
      this.secondaryModel.structureRoots = selectedNodeStructureRoots([this.primaryModel.rootNode])
    })
    this.selectedStructureState.input(primaryModel.selectionState)
    this.secondaryModel.structureRootsState.input(this.selectedStructureState)

    splitView.resized = () => {
      // FIXME: It could be benificial to have a `width` input for layout state,
      // FIXME: so it can benefit from knowledge that only width changed.
      this.primaryView.layoutState.invalidate()
      this.secondaryView.layoutState.invalidate()
      this.causalDomain.update()
    }
    if (parent) {
      parent.appendChild(element)
    }
  }
  applyStructureRoots (roots) {
    this.primaryModel.applyStructureRoots(roots)
  }
  setStructureRoots (roots) {
    this.primaryModel.setStructureRoots(roots)
  }
  setStructureTraits (structureTraits) {
    this.primaryModel.setStructureTraits(structureTraits)
  }
  setCostTraits (costTraits) {
    this.primaryModel.setCostTraits(costTraits)
    this.secondaryModel.setCostTraits(costTraits)
  }
  setValueTraits (valueTraits) {
    this.primaryModel.setValueTraits(valueTraits)
    this.secondaryModel.setValueTraits(valueTraits)
  }
  setOrderFunction (orderFunction) {
    this.primaryModel.setOrderFunction(orderFunction)
    this.secondaryModel.setOrderFunction(orderFunction)
  }
}
