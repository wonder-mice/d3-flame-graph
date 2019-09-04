import {State} from './State'
import {ElementSize} from './ElementSize'

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

export class NodeListRenderer {
  constructor (causalDomain) {
    this.nodes = null
    this.filterPredicate = null
    this.reversed = false
    this.nodeHeightPixels = null

    this.nodeClickListener = null
    this.nodeMouseEnterListener = null
    this.nodeMouseLeaveListener = null
    this.nodeMouseMoveListener = null
    this.nodeElementFunction = null
    this.nodeContentFunction = null

    this.nodesState = new State('NodeListRenderer::Nodes')
    this.filterPredicateState = new State('NodeListRenderer::FilterPredicate')
    this.reversedState = new State('NodeListRenderer::Reversed')
    this.nodeHeightState = new State('NodeListRenderer::NodeHeight', (state) => { this.updateNodeHeight(state) })
    this.nodeContentState = new State('NodeListRenderer::NodeContent')

    this.filteredNodesState = new State('NodeListRenderer::FilteredNodes', (state) => { this.updateFilteredNodes(state) })
    this.filteredNodesState.input(this.nodesState)
    this.filteredNodesState.input(this.filterPredicateState)

    this.commonStyleState = new State('NodeListRenderer::CommonStyle', (state) => { this.updateCommonStyle(state) })
    this.commonStyleState.input(this.nodeHeightState)

    this.layoutState = new State('NodeListRenderer::Layout', (state) => { this.updateLayout(state) })
    this.layoutState.input(this.filteredNodesState)
    this.layoutState.input(this.nodeHeightState)
    this.layoutState.input(this.reversedState)

    this.viewportState = new State('NodeListRenderer::Viewport')

    this.pageState = new State('NodeListRenderer::Page', (state) => { this.updatePage(state) })
    this.pageStateNodesInput = this.pageState.input(this.nodesState)
    this.pageStateLayoutInput = this.pageState.input(this.layoutState)
    this.pageStateCommonStyleInput = this.pageState.input(this.commonStyleState)
    this.pageStateNodeContentInput = this.pageState.input(this.nodeContentState)
    this.pageState.input(this.viewportState)

    this.filteredNodes = null
    this.nodeWidthSpec = null
    this.nodeHeightSpec = null
    this.unusedElements = []
    this.pageBegin = 0
    this.pageEnd = 0
    this.pageNodes = []
    this.pageRevision = 0

    const element = this.element = document.createElement('div')
    element.className = 'fg-nodelist'
    element.style.overflow = 'auto'
    element.style.position = 'relative'
    element.addEventListener('scroll', (event) => {
      this.viewportState.invalidate()
      causalDomain.update()
    })
    this.elementSize = new ElementSize(element, causalDomain)
    this.commonStyleState.input(this.elementSize.widthState)
    this.viewportState.input(this.elementSize.heightState)

    const nodesElement = this.nodesElement = element.appendChild(document.createElement('div'))
    nodesElement.className = 'fg-nodelist-nodes'
    nodesElement.style.width = '100%'
    nodesElement.style.position = 'absolute'
  }
  discard () {
    this.elementSize.discard()
  }
  setReversed (reversed) {
    this.reversed = reversed
    this.reversedState.invalidate()
  }
  setNodes (nodes) {
    this.nodes = nodes
    this.nodesState.invalidate()
  }
  setFilterPredicate (predicate) {
    this.filterPredicate = predicate
    this.filterPredicateState.invalidate()
  }
  setNodeHeightPixels (height) {
    this.nodeHeightPixels = height
    this.nodeHeightState.invalidate()
  }
  updateFilteredNodes (state) {
    const nodes = this.nodes
    const filterPredicate = this.filterPredicate
    if (nodes && filterPredicate) {
      this.filteredNodes = nodes.filter(filterPredicate)
    } else {
      this.filteredNodes = nodes
    }
  }
  updateNodeHeight (state) {
    const nodeHeightPixels = this.nodeHeightPixels
    this.nodeHeightSpec = null === nodeHeightPixels ? (nodeHeightPixels + 'px') : '1.5em'
  }
  updateCommonStyle (state) {
    this.nodeWidthSpec = this.elementSize.width + 'px'
  }
  updateLayout (state) {
    const nodeHeightPixels = this.nodeHeightPixels
    const filteredNodes = this.filteredNodes
    const filteredNodesCount = filteredNodes ? filteredNodes.length : 0
    this.nodesElement.style.height = (nodeHeightPixels * filteredNodesCount) + 'px'
  }
  updatePage (state) {
    const nodeHeightPixels = this.nodeHeightPixels
    const filteredNodes = this.filteredNodes
    const filteredNodesCount = filteredNodes ? filteredNodes.length : 0

    const nodesChanged = this.pageStateNodesInput.changed
    const layoutChanged = this.pageStateLayoutInput.changed
    const nodeContentChanged = this.pageStateNodeContentInput.changed
    const commonStyleChanged = this.pageStateCommonStyleInput.changed
    // Compute view port indexes.
    const scrollTop = this.element.scrollTop
    const viewportBegin = clip(Math.floor(scrollTop / nodeHeightPixels), 0, filteredNodesCount)
    const viewportEnd = clip(Math.ceil((scrollTop + this.elementSize.height) / nodeHeightPixels), 0, filteredNodesCount)
    const viewportLength = viewportEnd - viewportBegin
    // Allow to bail fast if just scrolling within current page threshold.
    if (!layoutChanged && !nodeContentChanged && !commonStyleChanged) {
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
    const nodeContentFunction = this.nodeContentFunction || ((element, node, initial) => {})
    for (let i = pageBegin, k = pageBase; i < pageEnd; ++i, k += pageDirection) {
      const node = this.filteredNodes[k]
      node.rev = pageRevision
      let element = node.element
      if (element) {
        if (layoutChanged) {
          element.style.top = (i * nodeHeightPixels) + 'px'
        }
        if (commonStyleChanged) {
          this.applyCommonStyle(element)
        }
        if (nodeContentChanged) {
          nodeContentFunction(element, node, false)
        }
      } else {
        element = this.createElement(node)
        nodeContentFunction(element, node, true)
        element.style.top = (i * nodeHeightPixels) + 'px'
        element.style.display = ''
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
      const style = element.style
      style.display = 'none'
      style.position = 'absolute'
      const nodeElementFunction = this.nodeElementFunction
      if (nodeElementFunction) {
        nodeElementFunction(element)
      }
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
}
