import {State} from './State'
import {deltaColor} from './NodeRenderer'

const pageThresholdCoefficient = 0.5
const pageLengthCoefficient = 1.5

function clip (value, min, max) {
  if (value < min) {
    return min
  }
  if (max < value) {
    return max
  }
  return value
}

// FIXME: Things to address:
//   [ ] What color to use when delta is not valid?
//   [ ] How element content is set
//   [ ] How to know that nodes have delta?
//   [ ] How to send information / updates from `model` to `renderer`.
//   [ ] How to compute min/max total/self/delta
//   [ ] Chrome / Safari 100% height issues (check FireFox as well)
//   [ ] updatePage() logic is too complicated and hard to follow, not optimal as well
export class NodeListRenderer {
  constructor (causalDomain) {
    this.nodes = null
    this.filterPredicate = null
    this.reversed = false
    this.nodeWidthPixels = null
    this.nodeHeightPixels = null

    this.nodeClass = 'fg-node'
    this.nodeClickListener = null
    this.nodeMouseEnterListener = null
    this.nodeMouseLeaveListener = null
    this.nodeMouseMoveListener = null

    this.nodesState = new State('FlattenRenderer::Nodes')
    this.filterPredicateState = new State('FlattenRenderer::FilterPredicate')
    this.reversedState = new State('FlattenRenderer::Reversed')
    this.nodeWidthState = new State('FlattenRenderer::NodeWidth')
    this.nodeHeightState = new State('FlattenRenderer::NodeHeight')
    this.nodeContentState = new State('FlattenRenderer::NodeContent')
    this.pageContentState = new State('FlattenRenderer::PageContent')

    /*
    this.nodesStatsState = new State('FlattenRenderer::NodesStats', (state) => { this.updateNodesStats(state) })
    this.nodesStatsState.input(this.nodesState)
    this.nodesStatsState.input(this.nodeValueState)
    */

    this.filteredNodesState = new State('FlattenRenderer::FilteredNodes', (state) => { this.updateFilteredNodes(state) })
    this.filteredNodesState.input(this.nodesState)
    this.filteredNodesState.input(this.filterPredicateState)

    /*
    this.filteredStatsState = new State('FlattenRenderer::FilteredStats', (state) => { this.updateFilteredStats(state) })
    this.filteredStatsState.input(this.filteredNodesState)
    this.filteredStatsState.input(this.nodeValueState)
    this.filteredStatsState.input(this.nodesStatsState)
    */

    this.commonStyleState = new State('FlattenRenderer::CommonStyle', (state) => { this.updateCommonStyle(state) })
    this.commonStyleState.input(this.nodeWidthState)
    this.commonStyleState.input(this.nodeHeightState)

    this.viewportState = new State('FlattenRenderer::Viewport')
    this.pageContentState.input(this.filteredNodesState)
    this.pageContentState.input(this.commonStyleState)
    this.pageContentState.input(this.reversedState)

    this.pageState = new State('FlattenRenderer::Page', (state) => { this.updatePage(state) })
    this.pageStateNodesInput = this.pageState.input(this.nodesState)
    this.pageStateFilteredNodesInput = this.pageState.input(this.filteredNodesState)
    this.pageStateNodeHeightInput = this.pageState.input(this.nodeHeightState)
    this.pageStateNodeContentInput = this.pageState.input(this.nodeContentState)
    this.pageStatePageContentInput = this.pageState.input(this.pageContentState)
    this.pageStateCommonStyleInput = this.pageState.input(this.commonStyleState)
    this.pageState.input(this.viewportState)

    this.nodes = null
    this.filteredNodes = null
    this.nodeWidthSpec = null
    this.nodeHeightSpec = null
    this.unusedElements = []
    this.pageBegin = 0
    this.pageEnd = 0
    this.pageNodes = []
    this.pageRevision = 0

    const element = this.element = document.createElement('div')
    element.style.overflow = 'auto'
    element.style.position = 'relative'
    element.style.width = '100%'
    element.style.height = '100%'
    element.addEventListener('scroll', (event) => {
      this.viewportState.invalidate()
      causalDomain.update()
    })
    const nodesElement = this.nodesElement = element.appendChild(document.createElement('div'))
    nodesElement.style.width = '100%'
    nodesElement.style.position = 'absolute'
  }
  sendNodesState (nodes) {
    this.nodes = nodes && nodes.length ? nodes : null
    this.nodesState.send()
  }
  setNodes (nodes) {
    this.setNodesState(nodes)
    this.nodesState.invalidate()
  }
  setFilterPredicate (predicate) {
    if (this.filterPredicate !== predicate) {
      this.filterPredicate = predicate
      this.filterPredicateState.invalidate()
    }
  }
  setNodeWidthPixels (width) {
    this.nodeWidthPixels = width
    this.nodeWidthState.invalidate()
  }
  setNodeHeightPixels (height) {
    this.nodeHeightPixels = height
    this.nodeHeightState.invalidate()
  }
  updateFilteredNodes (state) {
    const nodes = this.nodes
    const filterPredicate = this.filterPredicate
    if (nodes && filterPredicate) {
      const filteredNodes = []
      for (let i = 0, n = nodes.length; i < n; ++i) {
        const node = nodes[i]
        if (filterPredicate(node)) {
          filteredNodes.push(node)
        }
      }
      this.filteredNodes = filteredNodes
    } else {
      this.filteredNodes = nodes
    }
  }
  updateCommonStyle (state) {
    const nodeWidthPixels = this.nodeWidthPixels
    this.nodeHeightSpec = null === nodeWidthPixels ? (nodeWidthPixels + 'px') : '100%'
    const nodeHeightPixels = this.nodeHeightPixels
    this.nodeHeightSpec = null === nodeHeightPixels ? (nodeHeightPixels + 'px') : '1.5em'
  }
  updatePage (state) {
    const nodeHeightPixels = this.nodeHeightPixels
    const filteredNodes = this.filteredNodes
    const filteredNodesCount = filteredNodes ? filteredNodes.length : 0

    const nodesChanged = this.pageStateNodesInput.changed
    const filteredNodesChanged = this.pageStateFilteredNodesInput.changed
    const nodeHeightChanged = this.pageStateNodeHeightInput.changed
    const nodeContentChanged = this.pageStateNodeContentInput.changed
    const pageContentChanged = this.pageStatePageContentInput.changed
    const commonStyleChanged = this.pageStateCommonStyleInput.changed
    if (filteredNodesChanged || nodeHeightChanged) {
      this.nodesElement.style.height = (nodeHeightPixels * filteredNodesCount) + 'px'
    }
    // Compute view port indexes.
    const scrollTop = this.element.scrollTop
    const viewportBegin = clip(Math.floor(scrollTop / nodeHeightPixels), 0, filteredNodesCount)
    const viewportEnd = clip(Math.ceil((scrollTop + this.element.offsetHeight) / nodeHeightPixels), 0, filteredNodesCount)
    const viewportLength = viewportEnd - viewportBegin
    // Allow to bail fast if just scrolling within current page threshold.
    if (!pageContentChanged && !nodeContentChanged) {
      const pageThreshold = pageThresholdCoefficient * viewportLength
      const currentBegin = this.pageBegin
      const pageBeginOK = 0 === currentBegin || pageThreshold <= viewportBegin - currentBegin
      const currentEnd = this.pageEnd
      const pageEndOK = currentEnd === filteredNodesCount || pageThreshold <= currentEnd - viewportEnd
      if (pageBeginOK && pageEndOK) {
        state.cancel()
        return
      }
    }
    // Recycle all page nodes if focused node changed.
    const pageNodes = this.pageNodes
    if (nodesChanged) {
      for (let i = pageNodes.length; i--;) {
        this.recycleElement(pageNodes[i])
      }
      pageNodes.length = 0
    }
    // Update common style on recycled elements only to preserve invariant that
    // recycled elements have the right common style set.
    if (commonStyleChanged) {
      const unusedElements = this.unusedElements
      for (let i = unusedElements.length; i--;) {
        this.applyCommonStyle(unusedElements[i])
      }
    }
    // Compute updated page geometry.
    let pageBegin = viewportBegin - Math.round(pageLengthCoefficient * viewportLength)
    if (pageBegin < 0) {
      pageBegin = 0
    }
    let pageEnd = pageBegin + Math.round((2 * pageLengthCoefficient + 1) * viewportLength)
    if (filteredNodesCount < pageEnd) {
      pageEnd = filteredNodesCount
    }
    const pageLength = pageEnd - pageBegin
    // Provide each page node with properly configured element.
    const pageRevision = ++this.pageRevision
    const pageReversed = this.reversed
    const pageDirection = pageReversed ? -1 : 1
    const pageBase = pageReversed ? pageEnd - 1 : pageBegin
    for (let i = pageBegin, k = pageBase; i < pageEnd; ++i, k += pageDirection) {
      const node = this.filteredNodes[k]
      node.rev = pageRevision
      let element = node.element
      if (element) {
        if (pageContentChanged) {
          element.style.top = (i * nodeHeightPixels) + 'px'
          if (commonStyleChanged) {
            this.applyCommonStyle(element)
          }
        }
        if (nodeContentChanged) {
          this.applyContent(element, node)
        }
      } else {
        element = this.createElement(node)
        this.applyContent(element, node)
        element.style.top = (i * nodeHeightPixels) + 'px'
        element.style.display = 'block'
      }
    }
    // Recycle elements from nodes that were in `pageNodes` list before, but now are not.
    if (!nodesChanged) {
      for (let i = pageNodes.length; i--;) {
        const node = pageNodes[i]
        if (pageRevision !== node.rev) {
          const element = this.recycleElement(node)
          if (commonStyleChanged && element) {
            this.applyCommonStyle(element)
          }
        }
      }
    }
    // Update page geometry fields and `pageNodes` list.
    this.pageBegin = pageBegin
    this.pageEnd = pageEnd
    pageNodes.length = pageLength
    for (let i = 0, k = pageBase; i < pageLength; ++i, k += pageDirection) {
      pageNodes[i] = this.filteredNodes[k]
    }
  }
  createElement (node) {
    const unusedElements = this.unusedElements
    let element = unusedElements.pop()
    if (!element) {
      element = document.createElement('div')
      element.style.display = 'none'
      element.className = this.nodeClass
      element.addEventListener('click', this.nodeClickListener)
      element.addEventListener('mouseenter', this.nodeMouseEnterListener)
      element.addEventListener('mouseleave', this.nodeMouseLeaveListener)
      element.addEventListener('mousemove', this.nodeMouseMoveListener)
      this.applyCommonStyle(element)
      this.nodesElement.appendChild(element)
    }
    node.element = element
    element.__node__ = node
    return element
  }
  recycleElement (node) {
    const element = node.element
    if (element) {
      node.element = null
      element.style.display = 'none'
      element.__node__ = null
      this.unusedElements.push(element)
    }
    return element
  }
  applyCommonStyle (element) {
    const style = element.style
    style.width = this.nodeWidthSpec
    style.height = this.nodeHeightSpec
  }
  applyContent (element, node) {
    element.innerText = node.name
    const prcnt = (Math.abs(node.total) / this.nodesMaxValue * 100) + '%'
    const color = deltaColor(node.delta, this.maxDelta)
    element.style.background = `linear-gradient(to right, ${color} ${prcnt}, #fff ${prcnt})`
  }
}
