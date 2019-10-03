/*
export function flamegraph () {
  const nodeHoverHighlight = new NodeHighlight(nodeHoverHighlightClass)
  const nodeSelectionHighlight = new NodeHighlight(nodeSelectionHighlightClass)

  function setSearchContent (marked, aggregated, markedFocus, aggregatedFocus) {
    const traits = itemTraits
    let html = 'Total: ' + marked.length + ' items'
    if (aggregated) {
      html += ', value=' + traits.getAggregateValue(aggregated)
      if (traits.hasDelta) {
        html += ', delta=' + traits.getAggregateDelta(aggregated)
      }
    }
    html += '; Focus: ' + markedFocus.length + ' items'
    if (aggregatedFocus) {
      html += ', value=' + traits.getAggregateValue(aggregatedFocus)
      if (traits.hasDelta) {
        html += ', delta=' + traits.getAggregateDelta(aggregatedFocus)
      }
    }
    this.innerHTML = html
  }

  // Default node sorting function orders by `node.total` with larger nodes on the left.
  function nodesTotalOrder (nodeA, nodeB) {
    return nodeA.total - nodeB.total
  }

  class SearchController {
    constructor (element) {
      this.element = element
      this.searchContent = setSearchContent
      this.predicate = null
      this.marked = null
    }
    search (term) {
      this.predicate = markingPredicate(term)
    }
    updateSearch (rootNode) {
      if (this.predicate || this.marked) {
        const marked = markNodes([rootNode], this.predicate)
        this.marked = this.predicate ? marked : null
      }
    }
    updateView (focusNode) {
      if (this.marked) {
        const markedFocus = markedNodes([focusNode])
        const aggregated = markedNodesAggregate([model.root], itemTraits)
        const aggregatedFocus = markedNodesAggregate([focusNode], itemTraits)
        this.searchContent.call(this.element, this.marked, aggregated, markedFocus, aggregatedFocus)
        this.element.style.display = 'block'
      } else {
        this.element.style.display = 'none'
      }
    }
  }

  const searchController = new SearchController(searchElement)

  function updateHoverHighlight () {
    let nodes = null
    if (model.index && hoveredNode && hoveredNode.rev === viewRevision) {
    // if (rootNodeIndex && hoveredNode && hoveredNode.rev === viewRevision) {
      // const indexEntry = rootNodeIndex.get(hoveredNode.name)
      const indexEntry = model.index.get(hoveredNode.name)
      if (indexEntry) {
        nodes = indexEntry.nodes
      }
    }
    nodeHoverHighlight.update(nodes, viewRevision, true)
  }
  */
