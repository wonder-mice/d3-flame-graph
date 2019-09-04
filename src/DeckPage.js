import {State} from './State'
import {StructureModel} from './StructureModel'
import {FlattenModel} from './FlattenModel'
import {NodeStructureTraits} from './Node'
import {NodeSelection, FlattenNodeSelection} from './NodeSelection'
import {nodeIndexNodes} from './NodeIndex'
import {StructureView} from './StructureView'
import {FlattenView} from './FlattenView'
import {SplitView} from './SplitView'

export class DeckPage {
  constructor (parent, causalDomain) {
    const state = this.state = new State('DeckPage::State')
    causalDomain = this.causalDomain = causalDomain || state

    const element = this.element = document.createElement('div')
    element.style.display = 'flex'
    element.style.flexDirection = 'column'
    element.className = 'fg-deck-page'

    const splitView = this.splitView = new SplitView(element)
    splitView.element.style.flex = '1 0'
    const primaryElement = this.primaryElement = splitView.left.appendChild(document.createElement('div'))
    primaryElement.style.width = '100%'
    primaryElement.style.height = '100%'
    const secondaryElement = this.secondaryElement = splitView.right.appendChild(document.createElement('div'))
    secondaryElement.style.width = '100%'
    secondaryElement.style.height = '100%'

    const primaryModel = this.primaryModel = new StructureModel()
    const primarySelection = this.primarySelection = new NodeSelection(primaryModel)
    const primaryView = this.primaryView = new StructureView(primaryModel, causalDomain)
    primaryView.tooltipContentView.setSelectionInterface(primarySelection)
    primaryElement.appendChild(primaryView.element)
    primaryView.element.style.width = '100%'
    primaryView.element.style.height = '100%'
    state.input(primaryView.state)

    const secondaryModel = this.secondaryModel = new FlattenModel()
    secondaryModel.setStructureTraits(NodeStructureTraits)
    const secondaryView = this.secondaryView = new FlattenView(secondaryModel, causalDomain)
    secondaryView.tooltipContentView.setSelectionInterface(new FlattenNodeSelection(primarySelection))
    secondaryElement.appendChild(secondaryView.element)
    secondaryView.element.style.width = '100%'
    secondaryView.element.style.height = '100%'
    state.input(secondaryView.state)

    this.primaryHighlightMirrorsSecondary = false
    this.primaryHoverHighlightStateSecondaryHoveredNodeInput = primaryView.hoverHighlightState.input(secondaryView.hoveredNodeState)
    primaryView.hoverHighlightDelegate = (hoveredNode, hoveredNodeChanged) => {
      const secondaryHoveredNode = this.secondaryView.hoveredNode
      if (hoveredNodeChanged && hoveredNode) {
        this.primaryHighlightMirrorsSecondary = false
      } else if (this.primaryHoverHighlightStateSecondaryHoveredNodeInput.changed && secondaryHoveredNode) {
        this.primaryHighlightMirrorsSecondary = true
      }
      let highlightNodes = null
      if (secondaryHoveredNode && (this.primaryHighlightMirrorsSecondary || !hoveredNode)) {
        highlightNodes = secondaryHoveredNode.roots
      } else if (hoveredNode) {
        highlightNodes = nodeIndexNodes(this.primaryView.rootIndex, hoveredNode.name)
      }
      return highlightNodes
    }

    this.secondaryStructureState = new State('DeckPage::SecondaryStructure', (state) => {
      const primaryRootNode = this.primaryModel.rootNode
      const secondaryModel = this.secondaryModel
      secondaryModel.rootName = primaryRootNode ? primaryRootNode.name : '(Empty)'
      secondaryModel.structureRoots = primaryRootNode ? [primaryRootNode] : null
    })
    this.secondaryStructureState.input(primaryModel.structureState)
    this.secondaryModel.structureRootsState.input(this.secondaryStructureState)

    /*
    this.selectedStructureState = new State('DeckPage::SelectedStructure', (state) => {
      // FIXME: Can `primaryRootNode` be `null`?
      // FIXME: Set secondaryModel.setStructureTraits(NodeSelectionStructureTraits)
      const primaryRootNode = this.primaryModel.rootNode
      const selectedRoots = NodeSelectionStructureTraits.selectedRoots([primaryRootNode])
      const secondaryModel = this.secondaryModel
      secondaryModel.rootName = NodeSelectionStructureTraits.suggestedName(selectedRoots, '(Empty)', '(Selection)')
      secondaryModel.structureRoots = selectedRoots
    })
    this.selectedStructureState.input(primaryModel.selectionState)
    this.secondaryModel.structureRootsState.input(this.selectedStructureState)
    */

    splitView.resized = () => {
      // FIXME: It could be benificial to have a `width` input for layout state,
      // FIXME: so it can benefit from knowledge that only width changed.
      this.primaryView.setResized()
      this.secondaryView.setResized()
      this.causalDomain.update()
    }
    if (parent) {
      parent.appendChild(element)
    }
  }
  discard () {
    this.primaryView.discard()
    this.secondaryView.discard()
  }
  setRootName (name) {
    this.primaryModel.setRootName(name)
  }
  setStructureRoots (roots) {
    this.primaryModel.setStructureRoots(roots)
  }
  setStructureTraits (structureTraits) {
    this.primaryModel.setStructureTraits(structureTraits)
  }
  setStructureCoalescing (coalescing) {
    this.primaryModel.setStructureCoalescing(coalescing)
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
  setHidden (hidden) {
    if (hidden) {
      this.primaryView.tooltipView.hide()
      this.secondaryView.tooltipView.hide()
    }
    this.element.style.display = hidden ? 'none' : 'flex'
  }
}
