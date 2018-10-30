import { select } from 'd3-selection'
import { format } from 'd3-format'

export default function () {
  var itemValueSelf = false
  var itemDeltaPresent = false

  var getItemRoot = function (datum) {
    return datum
  }

  var getItemChildren = function (item) {
    return item.c || item.children
  }

  var getItemName = function (item) {
    return item.n || item.name
  }

  var getItemValue = function (item) {
    return item.v || item.value
  }

  var getItemDelta = function (item) {
    return item.d || item.delta
  }

  var getItemKind = function (item) {
    return item.l || item.libtype
  }

  var createAggregatedItem = function (item) {
    return { items: [item] }
  }

  var addAggregatedItem = function (aggregated, item) {
    aggregated.items.push(item)
  }

  var getAggregatedItemValue = function (aggregatedItem) {
    let value = 0
    const items = aggregatedItem.items
    for (let i = items.length; i--;) { value += getItemValue(items[i]) }
    return value
  }

  var getAggregatedItemDelta = function (aggregatedItem) {
    let delta = 0
    const items = aggregatedItem.items
    for (let i = items.length; i--;) { delta += getItemDelta(items[i]) }
    return delta
  }

  var nodeIdGenerator = 0

  function Node (parent, depth, item, name) {
    this.parent = parent
    this.depth = depth
    this.item = item
    this.name = name
    this.id = ++nodeIdGenerator
    this.height = 0 // max([child.height for child in children]) + 1, 0 for leave nodes.
  }

  // `siblingsList` is list of siblings lists (array of arrays). Each siblings list
  // must be non-empty and contain only children of the same parent. Siblings lists
  // must be in DFS post-order (list with parent node must be before all lists with
  // descendant nodes). Function will update `height` up to common ancestor node,
  // which itself *must* *not* be in `siblingsList`.
  function updateNodeSiblingsHeight (siblingsList) {
    let nodes, n, node, height
    for (let i = siblingsList.length; i--;) {
      nodes = siblingsList[i]
      height = 0
      for (n = nodes.length; n--;) {
        node = nodes[n]
        if (height < node.height) {
          height = node.height
        }
      }
      node.parent.height = height + 1
    }
  }

  // `node` must have correct/desired `height` set. Function will update `height` of
  // all ancestors, including the root node. For efficiency purposes, this function
  // can only increase `height`.
  function updateNodeAncestorsHeight (node) {
    let parent, height
    while ((parent = node.parent)) {
      height = node.height + 1
      if (height <= parent.height) {
        break
      }
      parent.height = height
      node = parent
    }
  }

  // Keeps track of current callstack frames and facilitates recursion detection.
  // Initial `level` is 0 (callstack is empty). Frames are expected to be strings
  // that contain function and module name.
  class Callstack {
    constructor () {
      this.frames = []
      this.frameCounts = new Map()
    }
    push (frame) {
      const n = this.frameCounts.get(frame)
      this.frameCounts.set(frame, undefined === n ? 1 : n + 1)
      this.frames.push(frame)
    }
    pop (level) {
      let frame, n
      while (level < this.frames.length) {
        frame = this.frames.pop()
        n = this.frameCounts.get(frame)
        if (n > 1) {
          this.frameCounts.set(frame, n - 1)
        } else {
          this.frameCounts.delete(frame)
        }
      }
    }
    recursive (frame) {
      return undefined !== this.frameCounts.get(frame)
    }
  }

  // Aggregates descendants of `rootItems` (but not `rootItems` themselves) with the
  // same name, regardless of their place in items hierarchy.
  function aggregatedNodesByFlatteningItems (parentNode, rootItems) {
    let n, children, i, item, level, name, recursive, node
    const queue = []
    n = rootItems.length
    while (n--) {
      children = getItemChildren(rootItems[n])
      if (children && (i = children.length)) {
        while (i--) {
          queue.push(children[i])
        }
      }
    }
    const aggregateRecursive = itemValueSelf
    const depth = parentNode.depth + 1
    const levels = Array(queue.length).fill(0)
    const callstack = new Callstack()
    const nodes = new Map()
    while ((item = queue.pop())) {
      level = levels.pop()
      name = getItemName(item)
      recursive = callstack.recursive(name)
      if (aggregateRecursive || !recursive) {
        node = nodes.get(name)
        if (undefined === node) {
          node = new Node(parentNode, depth, createAggregatedItem(item), name)
          node.roots = [item]
          nodes.set(name, node)
        } else {
          addAggregatedItem(node.item, item)
          if (!recursive) {
            node.roots.push(item)
          }
        }
      }
      children = getItemChildren(item)
      if (children && (i = children.length)) {
        callstack.pop(level++)
        callstack.push(name)
        while (i--) {
          queue.push(children[i])
          levels.push(level)
        }
      }
    }
    return nodes.size ? Array.from(nodes.values()) : null
  }

  // Performs pre-layout stage by updating `node.total`, `node.self` and `node.delta`
  // fields using `getItemValue()` and `getItemDelta()` functions. Updated fields don't
  // have any intrinsic semantic meaning other than how layout interprets them. Nodes
  // will be laid out in space allowed by `parent.total - parent.self` proportionally
  // to their `total` value.
  // Item value (returned from `getItemValue()`) can be negative (e.g. when value
  // represents some kind of delta, though not necessary the same as `getItemDelta()`).
  // In such case, updated `total` and `self` values will be positive, however in their
  // computation signed item value will be used. Note that, it's NOT neccessary true
  // that:
  //   parent.total == parent.self + sum([child.total for child in parent.children])
  function updateItemViewNodeValues (rootNodes) {
    if (!rootNodes || !rootNodes.length) {
      return
    }
    let i, node, children, nodes, nodesTotal, k, value, parent
    const needDelta = itemDeltaPresent
    const hasTotal = !itemValueSelf
    const queue = []
    const siblingsList = []
    // These bootstrap loop allows to use more efficient algorithm in main processing
    // loop (that would require to check for `node.parent` to be not null, which also
    // is not a reliable indicator in case of mixed-view node hierarchies we plan for).
    for (i = rootNodes.length; i--;) {
      node = rootNodes[i]
      value = getItemValue(node.item)
      if (hasTotal) {
        node.total = Math.abs(node.self = value)
      } else {
        node.self = Math.abs(node.total = value)
      }
      if (needDelta) {
        node.delta = getItemDelta(node.item)
      }
      children = node.children
      if (children && children.length) {
        queue.push(children)
        siblingsList.push(children)
      }
    }
    // If `hasTotal`, update `node.total` and compute `node.self` values. Otherwise,
    // update `node.self` and populate `siblingsList` that will be processed later.
    while ((nodes = queue.pop())) {
      nodesTotal = 0
      i = nodes.length
      while (i--) {
        node = nodes[i]
        value = getItemValue(node.item)
        if (hasTotal) {
          node.total = Math.abs(node.self = value)
          nodesTotal += value
        } else {
          node.self = Math.abs(node.total = value)
        }
        if (needDelta) {
          node.delta = getItemDelta(node.item)
        }
        children = node.children
        if (children && children.length) {
          queue.push(children)
          siblingsList.push(children)
        }
      }
      if (hasTotal) {
        parent = node.parent
        parent.self = Math.abs(parent.self - nodesTotal)
      }
    }
    // If neccessary, traverse the tree in reverse order and compute `total` fields.
    if (!hasTotal) {
      for (i = siblingsList.length; i--;) {
        nodesTotal = 0
        nodes = siblingsList[i]
        for (k = nodes.length; k--;) {
          node = nodes[k]
          node.total = Math.abs(value = node.total)
          nodesTotal += value
        }
        parent = node.parent
        parent.total = Math.abs(parent.total + nodesTotal)
      }
    }
  }

  // Same as `updateItemViewNodeValues()`, but for flatten view.
  function updateFlattenViewNodeValues (rootNodes) {
    let nodes, i, node, children
    const needDelta = itemDeltaPresent
    const queue = [rootNodes]
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        node.self = 0
        node.total = Math.abs(getAggregatedItemValue(node.item))
        if (needDelta) {
          node.delta = getAggregatedItemDelta(node.item)
        }
        children = node.children
        if (children && children.length) {
          queue.push(children)
        }
      }
    }
  }

  function expandFlattenViewNode (node) {
    if (undefined === node.children) {
      const children = node.children = aggregatedNodesByFlatteningItems(node, node.roots)
      if (children) {
        updateNodeSiblingsHeight([children])
        updateNodeAncestorsHeight(node)
        updateFlattenViewNodeValues(children)
      }
    }
  }

  function createItemViewNode (datum) {
    let nodes, i, node, itemChildren, depth, k, nodeChildren, childItem, childNode
    const rootItem = getItemRoot(datum)
    const rootNode = new Node(null, 0, rootItem, getItemName(rootItem))
    const queue = [[rootNode]]
    const siblingsList = []
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        depth = node.depth + 1
        itemChildren = getItemChildren(node.item)
        if (itemChildren && (k = itemChildren.length)) {
          nodeChildren = []
          while (k--) {
            childItem = itemChildren[k]
            childNode = new Node(node, depth, childItem, getItemName(childItem))
            nodeChildren.push(childNode)
          }
          node.children = nodeChildren
          queue.push(nodeChildren)
          siblingsList.push(nodeChildren)
        }
      }
    }
    updateNodeSiblingsHeight(siblingsList)
    updateNodeAncestorsHeight(rootNode)
    updateItemViewNodeValues([rootNode])
    return rootNode
  }

  function createFlattenViewNode (datum) {
    const rootItem = getItemRoot(datum)
    const rootNode = new Node(null, 0, createAggregatedItem(rootItem), getItemName(rootItem))
    rootNode.roots = [rootItem]
    const childrenNodes = rootNode.children = aggregatedNodesByFlatteningItems(rootNode, rootNode.roots)
    if (childrenNodes && childrenNodes.length) {
      updateNodeSiblingsHeight([childrenNodes])
      updateNodeAncestorsHeight(rootNode)
    }
    updateFlattenViewNodeValues([rootNode])
    return rootNode
  }

  // Default node sorting function orders by `node.total` with larger nodes on the left.
  function nodesTotalOrder (nodeA, nodeB) {
    return nodeA.total - nodeB.total
  }

  var root = null
  var updateNodeValues = null
  var expandNode = null

  var w = null // graph width
  var h = null // graph height
  var cellHeight = 18
  var tooltip = true // enable tooltip
  var title = '' // graph title
  var order = nodesTotalOrder
  var inverted = false // invert the graph direction
  var clickHandler = null
  var minFrameSize = 0
  var detailsElement = null
  var elided = false
  var searchSum = 0
  var maxDelta = 0

  const containerElement = document.createElement('div')
  const titleElement = document.createElement('div')
  const nodesSpaceElement = document.createElement('div')
  const nodesElement = document.createElement('div')
  const tipElement = document.createElement('div')
  // Safari is very annoying with its default tooltips for text with ellipsis.
  // The only way to disable it is to add dummy block element inside.
  const tipDeterringElement = document.createElement('div')
  containerElement.className = 'd3-flame-graph'
  titleElement.className = 'title'
  nodesSpaceElement.className = 'nodes-space'
  nodesElement.className = 'nodes'
  tipElement.className = 'tip'
  nodesSpaceElement.appendChild(nodesElement)
  nodesSpaceElement.appendChild(tipElement)
  containerElement.appendChild(titleElement)
  containerElement.appendChild(nodesSpaceElement)

  const externalState = {
    shiftKey: false,
    handleEvent (event) {
      switch (event.type) {
        case 'keydown':
        case 'keyup':
          this.shiftKey = event.shiftKey
          break
      }
    },
    listen () {
      document.addEventListener('keydown', this, false)
      document.addEventListener('keyup', this, false)
    },
    textSelected () {
      return window.getSelection().type === 'Range'
    }
  }
  }

  var updateNodeDecendants = function (root) {
    let nodes, i, node, itemChildren, depth, k, nodeChildren
    const queue = [[root]]
    const siblingsList = []
    while (queue.length) {
      nodes = queue.pop()
      i = nodes.length
      while (i--) {
        node = nodes[i]
        depth = node.depth + 1
        itemChildren = getItemChildren(node.data)
        if (itemChildren && (k = itemChildren.length)) {
          nodeChildren = []
          while (k--) {
            nodeChildren.push(new Node(node, itemChildren[k], depth, idgen++))
          }
          node.children = nodeChildren
          queue.push(nodeChildren)
          siblingsList.push(nodeChildren)
        }
      }
    }
    updateNodeSiblingsHeight(siblingsList)
    updateNodeAncestorsHeight(root)
  }

  var searchHandler = function () {
    if (detailsElement) { setSearchDetails() }
  }
  var originalSearchHandler = searchHandler

  var detailsHandler = function (d) {
    if (detailsElement) {
      if (d) {
        detailsElement.innerHTML = d
      } else {
        if (searchSum) {
          setSearchDetails()
        } else {
          detailsElement.innerHTML = ''
        }
      }
    }
  }
  var originalDetailsHandler = detailsHandler

  var labelHandler = function (d) {
    return getItemName(d.data) + ' (' + format('.3f')(100 * (d.x1 - d.x0), 3) + '%, ' + d.value + ' samples)'
  }

  function setSearchDetails () {
    detailsElement.innerHTML = `${searchSum} of ${totalValue} samples (${format('.3f')(100 * (searchSum / totalValue), 3)}%)`
  }

  function generateHash (name) {
    // Return a vector (0.0->1.0) that is a hash of the input string.
    // The hash is computed to favor early characters over later ones, so
    // that strings with similar starts have similar vectors. Only the first
    // 6 characters are considered.
    const MAX_CHAR = 6

    var hash = 0
    var maxHash = 0
    var weight = 1
    var mod = 10

    if (name) {
      for (var i = 0; i < name.length; i++) {
        if (i > MAX_CHAR) { break }
        hash += weight * (name.charCodeAt(i) % mod)
        maxHash += weight * (mod - 1)
        weight *= 0.70
      }
      if (maxHash > 0) { hash = hash / maxHash }
    }
    return hash
  }

  var getNodeColor = function (node) {
    // Return a color for the given name and library type. The library type
    // selects the hue, and the name is hashed to a color in that hue.

    let r
    let g
    let b

    if (differential) {
      let delta = getItemDelta(node.data)

      r = 220
      g = 220
      b = 220

      if (!delta) {
        delta = 0
      }

      if (delta > 0) {
        b = Math.round(210 * (maxDelta - delta) / maxDelta)
        g = b
      } else if (delta < 0) {
        r = Math.round(210 * (maxDelta + delta) / maxDelta)
        g = r
      }
    } else {
      let name = getItemName(node.data)
      let libtype = getItemKind(node.data)

      // default when libtype is not in use
      var hue = elided ? 'cold' : 'warm'

      if (!elided && !(typeof libtype === 'undefined' || libtype === '')) {
        // Select hue. Order is important.
        hue = 'red'
        if (typeof name !== 'undefined' && name && name.match(/::/)) {
          hue = 'yellow'
        }
        if (libtype === 'kernel') {
          hue = 'orange'
        } else if (libtype === 'jit') {
          hue = 'green'
        } else if (libtype === 'inlined') {
          hue = 'aqua'
        }
      }

      // calculate hash
      var vector = 0
      if (name) {
        var nameArr = name.split('`')
        if (nameArr.length > 1) {
          name = nameArr[nameArr.length - 1] // drop module name if present
        }
        name = name.split('(')[0] // drop extra info
        vector = generateHash(name)
      }

      // calculate color
      if (hue === 'red') {
        r = 200 + Math.round(55 * vector)
        g = 50 + Math.round(80 * vector)
        b = g
      } else if (hue === 'orange') {
        r = 190 + Math.round(65 * vector)
        g = 90 + Math.round(65 * vector)
        b = 0
      } else if (hue === 'yellow') {
        r = 175 + Math.round(55 * vector)
        g = r
        b = 50 + Math.round(20 * vector)
      } else if (hue === 'green') {
        r = 50 + Math.round(60 * vector)
        g = 200 + Math.round(55 * vector)
        b = r
      } else if (hue === 'aqua') {
        r = 50 + Math.round(60 * vector)
        g = 165 + Math.round(55 * vector)
        b = g
      } else if (hue === 'cold') {
        r = 0 + Math.round(55 * (1 - vector))
        g = 0 + Math.round(230 * (1 - vector))
        b = 200 + Math.round(55 * vector)
      } else {
        // original warm palette
        r = 200 + Math.round(55 * vector)
        g = 0 + Math.round(230 * (1 - vector))
        b = 0 + Math.round(55 * (1 - vector))
      }
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  }

  const getNodeColorDefault = getNodeColor

  var getNodeClass = function (node, small) {
    let classes = small ? 'node-sm' : 'node'
    if (node.fade) classes += ' stem'
    if (node.highlight) classes += ' highlight'
    return classes
  }

  function show (d) {
    d.fade = false
    d.hide = false
    if (d.children) {
      d.children.forEach(show)
    }
  }

  function hideSiblings (node) {
    let child = node
    let parent = child.parent
    let children, i, sibling
    while (parent) {
      children = parent.children
      i = children.length
      while (i--) {
        sibling = children[i]
        if (sibling !== child) {
          sibling.hide = true
        }
      }
      child = parent
      parent = child.parent
    }
  }

  function fadeAncestors (d) {
    if (d.parent) {
      d.parent.fade = true
      fadeAncestors(d.parent)
    }
  }

  function tipShow (d, itemRect, insideRect) {
    tipElement.innerHTML = labelHandler(d)
    // Need to reset `display` here, so `getBoundingClientRect()` will actually layout the `tipElement`.
    tipElement.style.display = 'unset'
    const tipRect = tipElement.getBoundingClientRect()
    const clientWidth = document.documentElement.clientWidth
    const clientHeight = document.documentElement.clientHeight
    let x = -insideRect.left
    if (clientWidth < itemRect.left + tipRect.width) {
      x += clientWidth - tipRect.width
    } else if (itemRect.left > 0) {
      x += itemRect.left
    }
    let y = -insideRect.top
    const itemBottom = itemRect.top + itemRect.height
    const tipBottom = itemBottom + tipRect.height
    if (clientHeight < tipBottom) {
      const tipTop = itemRect.top - tipRect.height
      if (0 <= tipTop || clientHeight - tipBottom < tipTop) {
        y += tipTop
      } else {
        y += itemBottom
      }
    } else {
      y += itemBottom
    }
    tipElement.style.transform = 'translate(' + x + 'px,' + y + 'px)'
  }

  function tipHide () {
    tipElement.style.display = 'none'
  }

  function tipShown () {
    return tipElement.style.display !== 'none'
  }

  function zoom (node) {
    if (expandNode) {
      expandNode(node)
    }
    hideSiblings(node)
    show(node)
    fadeAncestors(node)
    updateView()
  }

  function searchTree (d, term) {
    var re = new RegExp(term)
    var results = []
    var sum = 0

    function searchInner (d, foundParent) {
      var label = getItemName(d.data)
      var found = false

      if (typeof label !== 'undefined' && label && label.match(re)) {
        d.highlight = true
        found = true
        if (!foundParent) {
          sum += d.value
        }
        results.push(d)
      } else {
        d.highlight = false
      }

      if (d.children) {
        d.children.forEach(function (child) {
          searchInner(child, (foundParent || found))
        })
      }
    }

    searchInner(d, false)
    searchSum = sum
    searchHandler(results, sum, totalValue)
  }

  function clear (d) {
    d.highlight = false
    if (d.children) {
      d.children.forEach(function (child) {
        clear(child)
      })
    }
  }

  function nodeClick () {
    if (!externalState.textSelected()) {
      if (tooltip) tipHide()
      const d = this.__data__
      zoom(d)
      if (clickHandler) {
        clickHandler.call(this, d)
      }
    }
  }

  function nodeMouseOver () {
    if (tooltip) {
      this.appendChild(tipDeterringElement)
      if (!(externalState.shiftKey && tipShown())) {
        tipShow(this.__data__, this.getBoundingClientRect(), this.parentElement.getBoundingClientRect())
      }
    }
  }

  function nodeMouseOut () {
    if (tooltip) {
      if (tipDeterringElement.parentElement === this) {
        this.removeChild(tipDeterringElement)
      }
      if (!externalState.shiftKey) {
        tipHide()
      }
    }
  }

  function chart (element) {
    titleElement.innerHTML = title
    nodesElement.style.width = w ? w + 'px' : '100%'
    nodesElement.style.height = h ? h + 'px' : '100%'
    element.appendChild(containerElement)
    return chart
  }

  chart.createItemsView = function (datum) {
    root = createItemViewNode(datum)
    updateNodeValues = updateItemViewNodeValues
    expandNode = null
    updateView()
    return chart
  }

  chart.createFlattenView = function (datum) {
    root = createFlattenViewNode(datum)
    updateNodeValues = updateFlattenViewNodeValues
    expandNode = expandFlattenViewNode
    updateView()
    return chart
  }

  chart.updateValues = function () {
    updateNodeValues([root])
    updateView()
    return chart
  }

  chart.height = function (_) {
    if (!arguments.length) { return h }
    h = _
    return chart
  }

  chart.width = function (_) {
    if (!arguments.length) { return w }
    w = _
    return chart
  }

  chart.cellHeight = function (_) {
    if (!arguments.length) { return cellHeight }
    cellHeight = _
    return chart
  }

  chart.tooltip = function (_) {
    if (!arguments.length) { return tooltip }
    tooltip = !!_
    return chart
  }

  chart.title = function (_) {
    if (!arguments.length) { return title }
    title = _
    return chart
  }

  chart.sort = function (_) {
    if (!arguments.length) { return order }
    if (typeof _ === 'function') {
      order = _
    } else {
      order = _ ? nodesTotalOrder : null
    }
    return chart
  }

  chart.inverted = function (_) {
    if (!arguments.length) { return inverted }
    inverted = _
    return chart
  }

  chart.differential = function (_) {
    if (!arguments.length) { return itemDeltaPresent }
    itemDeltaPresent = _
    return chart
  }

  chart.elided = function (_) {
    if (!arguments.length) { return elided }
    elided = _
    return chart
  }

  chart.setLabelHandler = function (_) {
    if (!arguments.length) { return labelHandler }
    labelHandler = _
    return chart
  }
  // Kept for backwards compatibility.
  chart.label = chart.setLabelHandler

  chart.search = function (term) {
    searchTree(root, term)
    update()
  }

  chart.clear = function () {
    searchSum = 0
    detailsHandler(null)
    clear(root)
    update()
  }

  chart.zoomTo = function (d) {
    zoom(d)
  }

  chart.resetZoom = function () {
    zoom(root)
  }

  chart.onClick = function (_) {
    if (!arguments.length) {
      return clickHandler
    }
    clickHandler = _
    return chart
  }

  chart.minFrameSize = function (_) {
    if (!arguments.length) { return minFrameSize }
    minFrameSize = _
    return chart
  }

  chart.setDetailsElement = function (_) {
    if (!arguments.length) { return detailsElement }
    detailsElement = _
    return chart
  }
  // Kept for backwards compatibility.
  chart.details = chart.setDetailsElement

  chart.selfValue = function (_) {
    if (!arguments.length) { return itemValueSelf }
    itemValueSelf = _
    return chart
  }

  chart.getItemName = function (_) {
    if (!arguments.length) { return getItemName }
    getItemName = _
    return chart
  }

  chart.getItemValue = function (_) {
    if (!arguments.length) { return getItemValue }
    getItemValue = _
    return chart
  }

  chart.getItemDelta = function (_) {
    if (!arguments.length) { return getItemDelta }
    getItemDelta = _
    return chart
  }

  chart.getItemChildren = function (_) {
    if (!arguments.length) { return getItemChildren }
    getItemChildren = _
    return chart
  }

  chart.getItemKind = function (_) {
    if (!arguments.length) { return getItemKind }
    getItemKind = _
    return chart
  }

  chart.createAggregatedItem = function (_) {
    if (!arguments.length) { return createAggregatedItem }
    createAggregatedItem = _
    return chart
  }

  chart.addAggregatedItem = function (_) {
    if (!arguments.length) { return addAggregatedItem }
    addAggregatedItem = _
    return chart
  }

  chart.getAggregatedItemValue = function (_) {
    if (!arguments.length) { return getAggregatedItemValue }
    getAggregatedItemValue = _
    return chart
  }

  chart.getAggregatedItemDelta = function (_) {
    if (!arguments.length) { return getAggregatedItemDelta }
    getAggregatedItemDelta = _
    return chart
  }

  chart.getNodeColor = function (_) {
    if (!arguments.length) { return getNodeColor }
    getNodeColor = _ || getNodeColorDefault
    return chart
  }

  chart.getNodeClass = function (_) {
    if (!arguments.length) { return getNodeClass }
    getNodeClass = _
    return chart
  }

  chart.setSearchHandler = function (_) {
    if (!arguments.length) {
      searchHandler = originalSearchHandler
      return chart
    }
    searchHandler = _
    return chart
  }

  chart.setDetailsHandler = function (_) {
    if (!arguments.length) {
      detailsHandler = originalDetailsHandler
      return chart
    }
    detailsHandler = _
    return chart
  }

  return chart
}
