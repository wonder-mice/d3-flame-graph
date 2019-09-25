import {State} from './State'
import {ElementSize} from './ElementSize'
import {
  nodeFlagFocused, nodeFlagDescendantFocused, nodeMaskFocus,
  nodeFlagMarked, nodeFlagDescendantMarked, nodeFlagHiddenDescendantMarked,
  nodeMaskHighlight
} from './Node'

function positionNode (style, node) {
  style.width = node.width + 'px'
  style.left = node.x + 'px'
  style.top = node.y + 'px'
}

export class NodeTreeRenderer {
  constructor (causalDomain) {
    this.rootNode = null
    this.focusNode = null
    this.nodeHeightPixels = 18
    this.nodeWidthMinPixels = 3
    this.nodeClickListener = null
    this.nodeMouseEnterListener = null
    this.nodeMouseLeaveListener = null
    this.nodeMouseMoveListener = null
    this.nodeElementFunction = null
    this.nodeContentFunction = null
    this.pagePrepareFunction = null
    this.nodeAppearanceFunction = null

    this.rootNodeState = new State('NodeTreeRenderer:RootNode')
    this.focusNodeState = new State('NodeTreeRenderer:FocusNode')
    this.nodeHeightState = new State('NodeTreeRenderer:NodeHeight')
    // Users are supposed to add inputs to `nodeContentState` to signal content change.
    this.nodeContentState = new State('NodeTreeRenderer:NodeContent')
    this.commonStyleState = new State('NodeTreeRenderer:CommonStyle', (state) => { this.updateCommonStyle(state) })
    this.commonStyleState.input(this.nodeHeightState)
    this.layoutState = new State('NodeTreeRenderer:Layout', (state) => { this.updateLayout(state) })
    this.layoutState.input(this.rootNodeState)
    this.layoutState.input(this.focusNodeState)
    // Users can add inputs to `nodeAppearanceState` to signal changes in appearance. This
    // state implies that appearance for all nodes changed. If appearance changes for known subset
    // of nodes, consider using `nodeAppearanceChangeState` with `setAppearanceChanged()` call to
    // avoid updating nodes for which appearance didn't change.
    this.nodeAppearanceState = new State('NodeTreeRenderer:NodeAppearance')
    // Users can add inputs to `nodeAppearanceChangeState` to signal changes in appearance. However,
    // it's REQUIRED to call `setAppearanceChanged()` with a list of nodes for which appearance
    // changed (or `null` to signal that appearance changed for all nodes).
    this.nodeAppearanceChangeState = new State('NodeTreeRenderer:NodeAppearanceChange', (state) => { this.updateNodeAppearanceChange(state) })
    this.nodeAppearanceChangeStateNodeAppearanceInput = this.nodeAppearanceChangeState.input(this.nodeAppearanceState)
    this.pageState = new State('NodeTreeRenderer:Page', (state) => { this.updatePage(state) })
    this.pageStateNodeContentInput = this.pageState.input(this.nodeContentState)
    this.pageStateCommonStyleInput = this.pageState.input(this.commonStyleState)
    this.pageStateLayoutInput = this.pageState.input(this.layoutState)
    this.pageStateNodeAppearanceChangeInput = this.pageState.input(this.nodeAppearanceChangeState)

    const element = this.element = document.createElement('div')
    element.className = 'fg-nodetree'
    element.style.overflow = 'auto'
    element.style.position = 'relative'

    // It's convenient to be able to zoom-in by artificially increasing layout width. This will
    // increase number of elements on page. To maintain consistent performance will need to paginate
    // and hide elements that are not visible.
    // element.addEventListener('scroll', (event) => {
    //   this.viewportState.invalidate()
    //   causalDomain.update()
    // })
    this.elementSize = new ElementSize(element, causalDomain)
    this.layoutState.input(this.elementSize.widthState)

    const nodesElement = this.nodesElement = element.appendChild(document.createElement('div'))
    nodesElement.className = 'fg-nodetree-nodes'
    nodesElement.style.width = '100%'
    nodesElement.style.position = 'absolute'

    this.layoutWidth = 0
    this.layoutHeight = 0
    this.layoutNodes = []
    this.layoutRevision = 0
    this.appearanceNodes = []
    this.appearanceNodeCount = 0
    this.pageNodes = []
    this.unusedElements = []
  }
  discard () {
    this.elementSize.discard()
  }
  setNodeHeightPixels (height) {
    this.nodeHeightPixels = height
    this.nodeHeightState.invalidate()
  }
  setNodeWidthMinPixels (width) {
    this.nodeWidthMinPixels = width
    this.layoutState.invalidate()
  }
  setRootNode (node) {
    this.rootNode = node
    this.rootNodeState.invalidate()
  }
  setFocusNode (node) {
    this.focusNode = node
    this.focusNodeState.invalidate()
  }
  setAppearanceChanged (nodes) {
    if (0 > this.appearanceNodeCount) {
      // Appearance for all nodes was already invalidated, so we don't
      // bother tracking individual nodes.
      return
    }
    if (nodes) {
      const n = nodes.length
      if (!n) {
        // Empty list - no nodes changed.
        return
      }
      this.appearanceNodes.push(nodes)
      this.appearanceNodeCount += n
    } else {
      // When `nodes` is `null` we invalidate appearance for all nodes.
      this.appearanceNodes.length = 0
      this.appearanceNodeCount = -1
    }
    this.nodeAppearanceChangeState.invalidate()
  }
  updateCommonStyle (state) {
    this.nodeHeightSpec = this.nodeHeightPixels + 'px'
  }
  updateLayout (state) {
    const layoutNodes = this.layoutNodes
    const revision = ++this.layoutRevision
    const focusNode = this.focusNode || this.rootNode
    if (!focusNode) {
      this.layoutHeight = 0
      this.layoutWidth = 0
      layoutNodes.length = 0
      return
    }
    let layoutNodeCount = 0
    let layoutHeight = 0
    const layoutWidth = this.layoutWidth = this.elementSize.width
    const nodeWidthMin = this.nodeWidthMinPixels
    const nodeHeightPixels = this.nodeHeightPixels
    const layoutMask = ~(nodeMaskFocus | nodeFlagHiddenDescendantMarked | nodeMaskHighlight)
    const markMask = nodeFlagMarked | nodeFlagDescendantMarked
    // Layout stem nodes.
    const stemNodes = []
    for (let node = focusNode; node; node = node.parent) {
      stemNodes.push(node)
    }
    for (let i = stemNodes.length, parent = null; i--; layoutHeight += nodeHeightPixels) {
      const node = stemNodes[i]
      node.width = layoutWidth
      node.x = 0
      node.y = layoutHeight
      node.flags = (node.flags & layoutMask) | (i ? nodeFlagDescendantFocused : nodeFlagFocused)
      node.rev = revision
      layoutNodes[layoutNodeCount++] = node
      if (parent) {
        const siblings = parent.children
        if (siblings) {
          for (let j = siblings.length; j--;) {
            const sibling = siblings[j]
            if (sibling !== node && (sibling.flags & markMask)) {
              parent.flags |= nodeFlagHiddenDescendantMarked
              break
            }
          }
        }
      }
      parent = node
    }
    // Layout branches.
    const queue = [focusNode]
    for (let k = queue.length; k--;) {
      const node = queue[k]
      const children = node.children
      if (!children) {
        continue
      }
      const n = children.length
      if (!n) {
        continue
      }
      const childrenY = node.y + nodeHeightPixels
      // FIXME: When self value is non-0 and all children are 0 their width will be 0. Or when
      // FIXME: self is so bit that leaves little space for children.
      // FIXME: Interesting option could be to include node.self in subtotal or not.
      let subtotal = Math.abs(node.self)
      for (let i = n; i--;) {
        subtotal += Math.abs(children[i].total)
      }
      // FIXME: When ratio is 0, it seems useful to fall back to uniform distrubution where all nodes get same width.
      const ratio = 0 < subtotal ? node.width / subtotal : 0
      for (let i = 0, childX = node.x; i < n; ++i) {
        const child = children[i]
        const childWidth = Math.floor(Math.abs(child.total) * ratio)
        if (childWidth < nodeWidthMin) {
          if (child.flags & markMask) {
            node.flags |= nodeFlagHiddenDescendantMarked
          }
          continue
        }
        child.width = childWidth
        child.x = childX
        child.y = childrenY
        childX += childWidth
        queue[k++] = child
        child.flags &= layoutMask
        child.rev = revision
        layoutNodes[layoutNodeCount++] = child
      }
      if (layoutHeight < childrenY) {
        layoutHeight = childrenY
      }
    }
    this.layoutHeight = layoutNodeCount ? layoutHeight + nodeHeightPixels : 0
    this.layoutNodes = layoutNodes
    layoutNodes.length = layoutNodeCount
  }
  updateNodeAppearanceChange (state) {
    if (this.nodeAppearanceChangeStateNodeAppearanceInput.changed) {
      this.appearanceNodes.length = 0
      this.appearanceNodeCount = -1
    } else if (0 === this.appearanceNodeCount) {
      state.cancel()
    }
  }
  updatePage (state) {
    const nodeContentChanged = this.pageStateNodeContentInput.changed
    const commonStyleChanged = this.pageStateCommonStyleInput.changed
    const layoutChanged = this.pageStateLayoutInput.changed
    const nodeAppearanceChanged = this.pageStateNodeAppearanceChangeInput.changed
    const substanceChanged = commonStyleChanged || nodeContentChanged || layoutChanged
    const pageNodes = this.pageNodes
    const pagePrepareFunction = this.pagePrepareFunction
    if (pagePrepareFunction) {
      const appearanceOnly = nodeAppearanceChanged && !substanceChanged
      pagePrepareFunction(appearanceOnly)
    }
    if (substanceChanged) {
      if (layoutChanged) {
        // Hide currently visible elements that don't have their node in `layout`.
        const revision = this.layoutRevision
        for (let i = pageNodes.length; i--;) {
          const node = pageNodes[i]
          if (revision !== node.rev) {
            this.recycleElement(node)
          }
        }
      }
      const layoutNodes = this.layoutNodes
      const layoutNodeCount = layoutNodes.length
      const setNodeContentFunction = this.nodeContentFunction
      const updateNodeContentFunction = nodeContentChanged || nodeAppearanceChanged ? setNodeContentFunction : null
      pageNodes.length = layoutNodeCount
      for (let i = 0; i < layoutNodeCount; ++i) {
        const node = pageNodes[i] = layoutNodes[i]
        let element = node.element
        if (element) {
          if (layoutChanged) {
            positionNode(element.style, node)
          }
          if (commonStyleChanged) {
            this.applyCommonStyle(element)
          }
          if (updateNodeContentFunction) {
            updateNodeContentFunction(element, node, false)
          }
        } else {
          element = this.createElement(node)
          const style = element.style
          positionNode(style, node)
          if (setNodeContentFunction) {
            setNodeContentFunction(element, node, true)
          }
          style.display = ''
        }
      }
    } else if (nodeAppearanceChanged) {
      // It's an optimization for cases when only node appearance changes. It can be any
      // changes that preserve layout. Note, that `nodeContentFunction()` must do things
      // that `nodeAppearanceFunction()` does in cases when layout changes (when layout
      // changes `nodeAppearanceFunction()` function will not be called).
      const nodeAppearanceFunction = this.nodeAppearanceFunction
      if (nodeAppearanceFunction) {
        const pageNodeCount = pageNodes.length
        const appearanceNodeCount = this.appearanceNodeCount
        // Due to suboptimal design, it's possible to add the same node more than once to
        // `appearanceNodes` list. If this list is too big, than it's simpler to just
        // update all `pageNodes`, where each node is known to present only once. Also
        // if `appearanceNodeCount` is `-1`, than it indicates that full appearance
        // update (all nodes in `pageNodes`) was requested explicitly.
        if (appearanceNodeCount < 0 || pageNodeCount <= appearanceNodeCount) {
          for (let i = pageNodeCount; i--;) {
            const node = pageNodes[i]
            nodeAppearanceFunction(node.element, node)
          }
        } else {
          const appearanceNodes = this.appearanceNodes
          for (let k = appearanceNodes.length; k--;) {
            const nodes = appearanceNodes[k]
            for (let i = nodes.length; i--;) {
              const node = nodes[i]
              nodeAppearanceFunction(node.element, node)
            }
          }
        }
      }
    }
    if (nodeAppearanceChanged) {
      this.appearanceNodes.length = 0
      this.appearanceNodeCount = 0
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
    style.height = this.nodeHeightSpec
  }
}
