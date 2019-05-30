import {State} from './State'
import {StructureModel} from './StructureModel'
import {FlattenModel} from './FlattenModel'
import {NodeSelection, FlattenNodeSelection, NodeSelectionStructureTraits} from './NodeSelection'
import {nodeIndexNodes} from './NodeIndex'
import {StructureViewOptions, StructureView} from './StructureView'
import {FlattenViewOptions, FlattenView} from './FlattenView'
import {SplitView} from './SplitView'

export class DeckPage {
  constructor (parent, causalDomain) {
    const state = this.state = new State('DeckPage::State')
    causalDomain = this.causalDomain = causalDomain || state

    const element = this.element = document.createElement('div')
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
    const primarySelection = new NodeSelection(primaryModel)
    const primaryViewOptions = new StructureViewOptions()
    primaryViewOptions.causalDomain = causalDomain
    primaryViewOptions.tooltipHostElement = element
    const primaryView = this.primaryView = new StructureView(primaryModel, primaryViewOptions)
    primaryView.tooltipContentView.setSelectionInterface(primarySelection)
    primaryElement.appendChild(primaryView.element)
    state.input(primaryView.state)

    const secondaryModel = this.secondaryModel = new FlattenModel()
    secondaryModel.rootName = 'FIXME: Secondary root name'
    secondaryModel.setStructureTraits(NodeSelectionStructureTraits)
    const secondaryViewOptions = new FlattenViewOptions()
    secondaryViewOptions.causalDomain = causalDomain
    secondaryViewOptions.tooltipHostElement = element
    const secondaryView = this.secondaryView = new FlattenView(secondaryModel, secondaryViewOptions)
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
      this.secondaryModel.structureRoots = NodeSelectionStructureTraits.selectedRoots([this.primaryModel.rootNode])
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
  setNodeTooltipContentCallback (nodeTooltipContentCallback) {
    this.primaryView.tooltipContentView.setContentCallback(nodeTooltipContentCallback)
    this.secondaryView.tooltipContentView.setContentCallback(nodeTooltipContentCallback)
  }
}