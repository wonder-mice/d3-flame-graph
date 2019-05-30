import {nodeMarked, nodeDescendantMarked} from './Node'
import {NodeHighlightClass} from './NodeHighlight'

export function markingPredicate (term) {
  if (!term) {
    return null
  }
  if (typeof term === 'function') {
    return term
  }
  term = String(term)
  if (!term.length) {
    return null
  } else if (term.startsWith('#')) {
    const str = term.slice(1)
    return function (node) { return node.name === str }
  } else if (1 < term.length && ('"' === term[0] || '\'' === term[0]) && term[0] === term[term.length - 1]) {
    const str = term.slice(1, -1)
    return function (node) { return node.name.includes(str) }
  }
  const re = new RegExp(term)
  return function (node) { return re.test(node.name) }
}

// FIXME: This function can receive (optional?) revision and then it will be able to set `nodeHiddenDescendantMarked` flags too.
export function markNodes (rootNodes, predicate) {
  let nodes, i, node, children, ancestor
  const queue = [rootNodes]
  const marked = []
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      ancestor = node.parent
      if (predicate && predicate(node)) {
        marked.push(node)
        node.mark = ancestor && (ancestor.mark & 0b0101) ? 0b0101 : 0b0001
        for (; ancestor && !(ancestor.mark & 0b0010); ancestor = ancestor.parent) {
          ancestor.mark |= 0b0010
        }
      } else {
        node.mark = ancestor && (ancestor.mark & 0b0101) ? 0b0100 : 0b0000
      }
      children = node.children
      if (children && children.length) {
        queue.push(children)
      }
    }
  }
  return marked
}

/*
export function selectNodes (rootNodes, predicate) {
  const selected = []
  let nodes, i, node, children
  const queue = [rootNodes]
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      if (predicate(node)) {
        selected.push(node)
      }
      children = node.children
      if (children && children.length) {
        queue.push(children)
      }
    }
  }
  return selected
}
*/

// FIXME: When marking nodes, produce a list of marked nodes as well. It'll widely used and no need to recompute it each time.
// FIXME: We also need a centralized focused marked list, since it's computed.

export function markedNodes (rootNodes) {
  const marked = []
  let nodes, i, node, mark
  const queue = [rootNodes]
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      mark = node.mark
      if (mark & 0b0001) {
        marked.push(node)
      }
      if (mark & 0b0010) {
        queue.push(node.children)
      }
    }
  }
  return marked
}

export function markedNodesAggregate (rootNodes, traits) {
  let nodes, i, node, mark
  let aggregate = null
  const queue = [rootNodes]
  const aggregateRecursive = traits.selfValue
  const traitsCreateAggregate = traits.createAggregate
  const traitsAddAggregateItem = traits.addAggregateItem
  while ((nodes = queue.pop())) {
    for (i = nodes.length; i--;) {
      node = nodes[i]
      mark = node.mark
      if (mark & nodeMarked) {
        if (aggregate) {
          traitsAddAggregateItem.call(traits, aggregate, node.item)
        } else {
          aggregate = traitsCreateAggregate.call(traits, node.item)
        }
        if (!aggregateRecursive) {
          continue
        }
      }
      if (mark & nodeDescendantMarked) {
        queue.push(node.children)
      }
    }
  }
  return aggregate
}

export class NodeStyle {
  constructor () {
    // FIXME: It's bad that postfix ' ' must be specified here. Makes more sense for whoever calls `getIndex()` to specify this.
    this.focusHighlightClass = new NodeHighlightClass('fg-fc', ' ')
    this.markHighlightClass = new NodeHighlightClass('fg-mk', ' ')
    this.hoverHighlightClass = new NodeHighlightClass('fg-hv')
    this.selectionHighlightClass = new NodeHighlightClass('fg-sl')
    this.smallWidth = 35
    this.baseClass = 'node'
    this.baseClassSmall = 'node-sm'
  }
}

/*
const nodeHoverHighlightClass = new NodeHighlightClass('fg-hv')
const nodeSelectionHighlightClass = new NodeHighlightClass('fg-sl')
*/

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

  function updateView () {
    const nodesRect = nodesElement.getBoundingClientRect()
    hierarchyLayout.totalWidth = nodesRect.width
    hierarchyLayout.hasDelta = itemTraits.hasDelta
    const layout = hierarchyLayout.layout(model.root, focusNode, ++viewRevision)
    // FIXME: This height is 1 row off
    nodesElement.style.height = layout.height + 'px'
    hierarchyView.render(layout)
    updateHoverHighlight()
    // nodeSelectionHighlight.update(nodeSelection.nodes, viewRevision, true)
    nodeSelectionHighlight.update(model.selection.nodes, viewRevision, true)
    // FIXME: Looks like `searchController.updateView` does more then minimally required.
    searchController.updateView(focusNode)
  }

  function zoom (node) {
    focusNode = node
    if (expandNode) {
      const expandedNodes = expandNode(node)
      if (expandedNodes) {
        updateNodeValues(expandedNodes)
      }
      searchController.updateSearch(rootNode)
    }
    updateView()
  }

  function optionalGetter (getter, on, off) {
    return typeof getter === 'function' ? getter : (getter ? on : off)
  }

  chart.setSearchContent = function (_) {
    if (!arguments.length) { return searchController.searchContent }
    searchController.searchContent = optionalGetter(_, setSearchContent, null)
    return chart
  }

  chart.cellHeight = function (_) {
    if (!arguments.length) { return hierarchyLayout.rowHeight }
    hierarchyLayout.rowHeight = _
    return chart
  }

  chart.cellWidthMin = function (_) {
    if (!arguments.length) { return hierarchyLayout.nodeWidthMin }
    hierarchyLayout.nodeWidthMin = _
    return chart
  }

  chart.inverted = function (_) {
    if (!arguments.length) { return hierarchyView.inverted }
    hierarchyView.inverted = _
    return chart
  }

  chart.search = function (term) {
    searchController.search(term)
    searchController.updateSearch(model.root)
    updateView()
  }

  chart.clear = function () {
    searchController.search(null)
    searchController.updateSearch(model.root)
    updateView()
  }

  chart.onClick = function (_) {
    if (!arguments.length) { return clickHandler }
    clickHandler = _
    return chart
  }
}
*/
