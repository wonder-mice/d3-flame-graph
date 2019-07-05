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
export class FlattenRenderer {
  constructor (model, causalDomain) {
    this.model = model

    this.focusedNode = null
    this.filterPredicate = null
    this.reversed = false
    this.nodeWidthSpec = '100%'
    this.nodeHeightPixels = 18
    this.nodeContent = nodeContent

    this.nodeClickListener = null
    this.nodeMouseEnterListener = null
    this.nodeMouseLeaveListener = null
    this.nodeMouseMoveListener = null

    this.focusedNodeState = new State('FlattenRenderer::FocusedNode')
    this.filterPredicateState = new State('FlattenRenderer::FilterPredicate')
    this.nodeWidthState = new State('FlattenRenderer::NodeWidth')
    this.nodeHeightState = new State('FlattenRenderer::NodeHeight')
    this.nodeValueState = new State('FlattenRenderer::NodeValue')
    this.nodeContentState = new State('FlattenRenderer::NodeContent')
    // FIXME: Hm...
    this.reversedState = new State('FlattenRenderer::Reversed')
    // FIXME: Need invalidate it when root element height changes too.
    this.viewportState = new State('FlattenRenderer::Viewport')

    // What needs to be configurable:
    // - Node text (getNodeTitle)
    // - Color (getNode)
    // - Color width
    // - Background
    // How content callback will get stats neccessary for it to function (e.g. max delta)?

    this.nodesState = new State('FlattenRenderer::Nodes', (state) => { this.updateNodes(state) })
    this.nodesState.input(this.focusedNodeState)

    this.nodesStatsState = new State('FlattenRenderer::NodesStats', (state) => { this.updateNodesStats(state) })
    this.nodesStatsState.input(this.nodesState)
    this.nodesStatsState.input(this.nodeValueState)

    this.filteredNodesState = new State('FlattenRenderer::FilteredNodes', (state) => { this.updateFilteredNodes(state) })
    this.filteredNodesState.input(this.nodesState)
    this.filteredNodesState.input(this.filterPredicateState)

    this.filteredStatsState = new State('FlattenRenderer::FilteredStats', (state) => { this.updateFilteredStats(state) })
    this.filteredStatsState.input(this.filteredNodesState)
    this.filteredStatsState.input(this.nodeValueState)
    this.filteredStatsState.input(this.nodesStatsState)

    // FIXME: This has a downside that nodes are still visible even if they will be hidden or renamed/reused. This
    // FIXME: will launch an animation we probably want to avoid. Move it inside updatePage()?
    this.commonStyleState = new State('FlattenRenderer::CommonStyle', (state) => { this.updateCommonStyle(state) })
    this.commonStyleState.input(this.nodeWidthState)
    this.commonStyleState.input(this.nodeHeightState)

    this.pageState = new State('FlattenRenderer::Page', (state) => { this.updatePage(state) })
    this.pageStateFocusedNodeInput = this.pageState.input(this.focusedNodeState)
    this.pageStateFilteredNodesInput = this.pageState.input(this.filteredNodesState)
    this.pageStateNodeHeightInput = this.pageState.input(this.nodeHeightState)
    this.pageStateNodeContentInput = this.pageState.input(this.nodeContentState)
    this.pageStateReversedInput = this.pageState.input(this.reversedState)
    this.pageState.input(this.nodesStatsState)
    this.pageState.input(this.filteredStatsState)
    this.pageState.input(this.nodeValueState)
    this.pageState.input(this.commonStyleState)
    this.pageState.input(this.viewportState)

    this.nodes = null
    this.filteredNodes = null
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
  setFocusedNode (focusedNode) {
    if (this.focusedNode !== focusedNode) {
      this.focusedNode = focusedNode
      this.focusedNodeState.invalidate()
    }
  }
  setFilterPredicate (predicate) {
    if (this.filterPredicate !== predicate) {
      this.filterPredicate = predicate
      this.filterPredicateState.invalidate()
    }
  }
  setNodeWidthSpec (width) {
    this.nodeWidthSpec = width
    this.nodeWidthState.invalidate()
  }
  setNodeHeightPixels (height) {
    this.nodeHeightPixels = height
    this.nodeHeightState.invalidate()
  }
  updateNodes (state) {
    const focusedNode = this.focusedNode
    const nodes = focusedNode ? focusedNode.children : null
    this.nodes = nodes && nodes.length ? nodes : null
  }
  updateNodesStats (state) {
    let maxValue = 0
    let maxDelta = 0
    const nodes = this.nodes
    if (nodes) {
      for (let i = nodes.length; i--;) {
        const node = nodes[i]
        const value = Math.abs(node.total)
        const delta = Math.abs(node.delta)
        if (maxValue < value) { maxValue = value }
        if (maxDelta < delta) { maxDelta = delta }
      }
    }
    this.nodesMaxValue = maxValue
    this.nodesMaxDelta = maxDelta
  }
  updateFilteredStats (state) {
    let maxValue = 0
    let maxDelta = 0
    const filteredNodes = this.filteredNodes
    if (filteredNodes === this.nodes) {
      maxValue = this.nodesMaxValue
      maxDelta = this.nodesMaxDelta
    } else if (filteredNodes) {
      for (let i = filteredNodes.length; i--;) {
        const node = filteredNodes[i]
        const value = Math.abs(node.total)
        const delta = Math.abs(node.delta)
        if (maxValue < value) { maxValue = value }
        if (maxDelta < delta) { maxDelta = delta }
      }
    }
    this.filteredMaxValue = maxValue
    this.filteredMaxDelta = maxDelta
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
    this.nodeHeightSpec = this.nodeHeightPixels + 'px'
  }
  updatePage (state) {
    const nodeHeightPixels = this.nodeHeightPixels
    const filteredNodes = this.filteredNodes
    const filteredNodesCount = filteredNodes ? filteredNodes.length : 0

    const commonStyleChanged = this.commonStyleState.changed
    const filteredNodesChanged = this.pageStateFilteredNodesInput.changed
    const nodeHeightChanged = this.pageStateNodeHeightInput.changed
    const focusedNodeChanged = this.pageStateFocusedNodeInput.changed
    const reversedChanged = this.pageStateReversedInput.changed
    const nodeContentChanged = this.pageStateNodeContentInput.changed
    const pageContentChanged = filteredNodesChanged || nodeHeightChanged || focusedNodeChanged || reversedChanged || nodeContentChanged
    if (pageContentChanged) {
      this.nodesElement.style.height = (nodeHeightPixels * filteredNodesCount) + 'px'
    }
    // Compute view port indexes.
    const scrollTop = this.element.scrollTop
    const viewportBegin = clip(Math.floor(scrollTop / nodeHeightPixels), 0, filteredNodesCount)
    const viewportEnd = clip(Math.ceil((scrollTop + this.element.offsetHeight) / nodeHeightPixels), 0, filteredNodesCount)
    const viewportLength = viewportEnd - viewportBegin
    // Bail if just scrolling within current page threshold.
    if (!pageContentChanged) {
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
    if (focusedNodeChanged) {
      for (let i = pageNodes.length; i--;) {
        this.recycleElement(pageNodes[i])
      }
      pageNodes.length = 0
    }
    // Update properties common for all elements.
    if (commonStyleChanged) {
      const unusedElements = this.unusedElements
      for (let i = unusedElements.length; i--;) {
        this.applyCommonStyle(unusedElements[i])
      }
      const pageNodes = this.pageNodes
      for (let i = pageNodes.length; i--;) {
        this.applyCommonStyle(pageNodes[i].element)
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
        if (nodeContentChanged || pageContentChanged) {
          element.style.top = (i * nodeHeightPixels) + 'px'
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
    for (let i = pageNodes.length; i--;) {
      const node = pageNodes[i]
      if (pageRevision !== node.rev) {
        this.recycleElement(node)
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
      element.className = 'fg-node'
      element.style.display = 'none'
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
