export default function () {
  var itemSelfValue = false
  var itemHasDelta = false

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

  function Node (parent, item, name) {
    this.parent = parent
    this.item = item
    this.name = name
    // (mark & 0b0001) - node is marked
    // (mark & 0b0010) - node has a descendant that is marked
    // (mark & 0b0100) - node has an ancestor that is marked
    // (mark & 0b1000) - node has marked descendants that are not visible (e.g. too small)
    this.mark = 0
    // (bits & 0b10) - node is on the path from focused node to the root
    // (bits & 0b11) - node is fucesed
    this.bits = 0
  }

  function NodeContext () {
    this.hasDelta = false
    this.maxDelta = 0
  }

  function markingPredicate (term) {
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

  function markedAggregate (roots) {
    let nodes, i, node, mark
    let aggregated = null
    const queue = [roots]
    const aggregateRecursive = itemSelfValue
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        mark = node.mark
        if (mark & 0b0001) {
          if (aggregated) {
            addAggregatedItem(aggregated, node.item)
          } else {
            aggregated = createAggregatedItem(node.item)
          }
          if (!aggregateRecursive) {
            continue
          }
        }
        if (mark & 0b0010) {
          queue.push(node.children)
        }
      }
    }
    return aggregated
  }

  function hsv2rbg (h, s, v) {
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    let r, g, b
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break
      case 1: r = q; g = v; b = p; break
      case 2: r = p; g = v; b = t; break
      case 3: r = p; g = q; b = v; break
      case 4: r = t; g = p; b = v; break
      case 5: r = v; g = p; b = q; break
    }
    return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')'
  }

  var nodeWidthSmall = 35
  var nodeClassBase = 'node'
  var nodeClassBaseSmall = 'node-sm'
  var nodeClassFocus = 'focus-'
  var nodeClassMarked = 'mark-'

  function getNodeColor (node, context) {
    if (context.hasDelta && context.maxDelta) {
      const delta = node.delta || 0
      const s = Math.abs(delta / context.maxDelta)
      // Use of HSL colorspace would be more appropriate, since its saturation better models
      // kind of effect we are after. However, HSV colorspace is computationaly simpler and
      // we can emulate desired effect by adjusting brightness (value) based on `s`.
      // return hsv2rbg(0 <= delta ? 0 : 0.67, s, 0.7 + 0.3 * s)
      return hsv2rbg(0 <= delta ? 0 : 0.28, s, 0.8 + 0.2 * s)
    }
    let tone = 0
    const name = node.name
    if (name) {
      const maxLength = 6
      const n = maxLength < name.length ? maxLength : name.length
      const mod = 10
      let range = 0
      for (let i = 0, weight = 1; i < n; ++i, weight *= 0.7) {
        tone += weight * (name.charCodeAt(i) % mod)
        range += weight * (mod - 1)
      }
      if (range > 0) {
        tone /= range
      }
    }
    const r = 200 + Math.round(55 * tone)
    const g = Math.round(230 * (1 - tone))
    const b = Math.round(55 * (1 - tone))
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  }

  function getNodeTitle (node, context) {
    let title = node.name + ', total: ' + node.toal + ', self: ' + node.self
    if (context.hasDelta) {
      title += ', Δ: ' + node.delta
    }
    return title
  }

  function setNodeContent (node, context) {
    const small = node.width <= nodeWidthSmall
    let classes = small ? nodeClassBaseSmall : nodeClassBase
    const focus = node.bits & 0b11
    if (focus) { classes += ' ' + nodeClassFocus + focus }
    const mark = node.mark & 0b1001
    if (mark) { classes += ' ' + nodeClassMarked + mark }
    this.className = classes
    this.textContent = small ? '' : node.name
  }

  function setNodeTip (node, context) {
    this.innerText = getNodeTitle(node, context)
  }

  function setSearchContent (marked, aggregated, markedFocus, aggregatedFocus) {
    let html = 'Total: ' + marked.length + ' items'
    if (aggregated) {
      html += ', value=' + getAggregatedItemValue(aggregated)
      if (itemHasDelta) {
        html += ', delta=' + getAggregatedItemDelta(aggregated)
      }
    }
    html += '; Focus: ' + markedFocus.length + ' items'
    if (aggregatedFocus) {
      html += ', value=' + getAggregatedItemValue(aggregatedFocus)
      if (itemHasDelta) {
        html += ', delta=' + getAggregatedItemDelta(aggregatedFocus)
      }
    }
    this.innerHTML = html
  }

  function markNodes (roots, predicate) {
    let nodes, i, node, children, ancestor
    const queue = [roots]
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

  function markedNodes (roots) {
    const marked = []
    let nodes, i, node, mark
    const queue = [roots]
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
      this.frameCounts.set(frame, n ? n + 1 : 1)
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
      return 0 < this.frameCounts.get(frame)
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
    const aggregateRecursive = itemSelfValue
    const levels = Array(queue.length).fill(0)
    const callstack = new Callstack()
    const nodes = new Map()
    while ((item = queue.pop())) {
      level = levels.pop()
      name = getItemName(item)
      recursive = callstack.recursive(name)
      if (aggregateRecursive || !recursive) {
        node = nodes.get(name)
        if (!node) {
          node = new Node(parentNode, createAggregatedItem(item), name)
          node.roots = [item]
          node.dir = true
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
  // Keep in mind, that following is NOT neccessary true:
  //   parent.total == parent.self + sum([child.total for child in parent.children])
  //   node.total >= node.self
  // Layout is free to interpret such cases as it sees fit (pun intended).
  function updateItemViewNodeValues (rootNodes) {
    if (!rootNodes || !rootNodes.length) {
      return
    }
    let i, node, children, nodes, nodesTotal, k, parent
    const hasDelta = itemHasDelta
    const hasTotal = !itemSelfValue
    const queue = []
    const siblingsList = []
    // These bootstrap loop allows to use more efficient algorithm in main processing
    // loop (that would require to check for `node.parent` to be not null, which also
    // is not a reliable indicator in case of mixed-view node hierarchies we plan for).
    for (i = rootNodes.length; i--;) {
      node = rootNodes[i]
      node.total = node.self = getItemValue(node.item)
      if (hasDelta) {
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
        nodesTotal += (node.total = node.self = getItemValue(node.item))
        if (hasDelta) {
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
        parent.self = parent.self - nodesTotal
      }
    }
    // If neccessary, traverse the tree in reverse order and compute `total` fields.
    if (!hasTotal) {
      for (i = siblingsList.length; i--;) {
        nodesTotal = 0
        nodes = siblingsList[i]
        for (k = nodes.length; k--;) {
          nodesTotal += nodes[k].total
        }
        parent = nodes[0].parent
        parent.total = parent.total + nodesTotal
      }
    }
  }

  // Same as `updateItemViewNodeValues()`, but for flatten view.
  function updateFlattenViewNodeValues (rootNodes) {
    let nodes, i, node, children
    const hasDelta = itemHasDelta
    const queue = [rootNodes]
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        node.self = 0
        node.total = Math.abs(getAggregatedItemValue(node.item))
        if (hasDelta) {
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
        updateFlattenViewNodeValues(children)
      }
    }
  }

  function createItemViewNode (datum) {
    let nodes, i, node, itemChildren, k, nodeChildren, childItem, childNode
    const rootItem = getItemRoot(datum)
    const rootNode = new Node(null, rootItem, getItemName(rootItem))
    const queue = [[rootNode]]
    const siblingsList = []
    while ((nodes = queue.pop())) {
      for (i = nodes.length; i--;) {
        node = nodes[i]
        itemChildren = getItemChildren(node.item)
        if (itemChildren && (k = itemChildren.length)) {
          nodeChildren = []
          while (k--) {
            childItem = itemChildren[k]
            childNode = new Node(node, childItem, getItemName(childItem))
            nodeChildren.push(childNode)
          }
          node.children = nodeChildren
          queue.push(nodeChildren)
          siblingsList.push(nodeChildren)
        }
      }
    }
    updateItemViewNodeValues([rootNode])
    return rootNode
  }

  function createFlattenViewNode (datum) {
    const rootItem = getItemRoot(datum)
    const rootNode = new Node(null, createAggregatedItem(rootItem), getItemName(rootItem))
    rootNode.roots = [rootItem]
    rootNode.children = aggregatedNodesByFlatteningItems(rootNode, rootNode.roots)
    rootNode.dir = true
    updateFlattenViewNodeValues([rootNode])
    return rootNode
  }

  // Default node sorting function orders by `node.total` with larger nodes on the left.
  function nodesTotalOrder (nodeA, nodeB) {
    return nodeA.total - nodeB.total
  }

  class HierarchyLayoutResult {
    constructor () {
      this.nodes = null
      this.height = 0
      this.rowHeight = 0
      this.context = new NodeContext()
      this.reference = 0
    }
  }

  class HierarchyLayout {
    constructor () {
      this.totalWidth = 0
      this.nodeWidthMin = 0
      this.rowHeight = 18
      this.hasDelta = false
      this.order = nodesTotalOrder
    }
    layout (rootNode, focusNode, reference) {
      let node, i, children, childrenY, n, directory
      let subtotal, abstotal, ratio, child, childX, childWidth, delta
      let totalHeight = 0
      const nodes = []
      const totalWidth = this.totalWidth
      const nodeWidthMin = this.nodeWidthMin
      const rowHeight = this.rowHeight
      const hasDelta = this.hasDelta
      const order = this.order
      // Layout stem nodes.
      const stemNodes = []
      node = focusNode || rootNode
      do { stemNodes.push(node) } while ((node = node.parent))
      for (i = stemNodes.length; i--;) {
        node = stemNodes[i]
        node.width = totalWidth
        node.x = 0
        node.y = totalHeight
        node.mark &= 0b0111
        node.bits = (node.bits & 0b11111100) | (0 === i ? 0b11 : 0b10)
        node.ref = reference
        nodes.push(node)
        totalHeight += rowHeight
      }
      let maxDelta = hasDelta ? Math.abs(node.delta) : 0
      // Layout branches.
      const queue = [focusNode]
      while ((node = queue.pop())) {
        children = node.children
        if (!children || !(n = children.length)) {
          continue
        }
        if (order) {
          children.sort(order)
        }
        childrenY = node.y + rowHeight
        directory = node.dir
        if (directory) {
          for (subtotal = 0, i = n; i--;) {
            subtotal = subtotal < (abstotal = Math.abs(children[i].total)) ? abstotal : subtotal
          }
        } else {
          for (subtotal = Math.abs(node.self), i = n; i--;) {
            subtotal += Math.abs(children[i].total)
          }
        }
        ratio = 0 < subtotal ? node.width / subtotal : 0
        for (childX = node.x, i = n; i--;) {
          child = children[i]
          childWidth = Math.floor(Math.abs(child.total) * ratio)
          if (childWidth < nodeWidthMin) {
            if (child.mark & 0b0011) {
              node.mark |= 0b1000
            }
            continue
          }
          child.width = childWidth
          child.x = childX
          child.y = childrenY
          if (directory) {
            childrenY += rowHeight
          } else {
            childX += childWidth
            queue.push(child)
          }
          if (hasDelta) {
            delta = Math.abs(child.delta)
            if (maxDelta < delta) {
              maxDelta = delta
            }
          }
          child.mark &= 0b0111
          child.bits &= 0b11111100
          child.ref = reference
          nodes.push(child)
        }
        if (totalHeight < childrenY) {
          totalHeight = childrenY
        }
      }
      const result = new HierarchyLayoutResult()
      result.nodes = nodes
      result.height = totalHeight
      result.rowHeight = rowHeight
      result.context.hasDelta = hasDelta
      result.context.maxDelta = maxDelta
      result.reference = reference
      return result
    }
  }

  class HierarchyView {
    constructor (container) {
      this.container = container
      this.nodeColor = getNodeColor
      this.nodeTitle = null
      this.nodeContent = setNodeContent
      this.inverted = false
      this.context = null
      this.nodes = null
      this.reference = false // Any alternating value will work, could use incremented integer instead.
      this.unusedElements = []
    }
    render (layout) {
      let nodes, i, node, element
      const unusedElements = this.unusedElements
      if ((nodes = this.nodes) && this.reference !== layout.reference) {
        // Hide currently visible elements that don't have their node in `layout`.
        const reference = layout.reference
        for (i = nodes.length; i--;) {
          node = nodes[i]
          if (node.ref !== reference) {
            node.element.style.display = 'none'
          }
        }
      }
      const container = this.container
      const nodeColor = this.nodeColor
      const nodeTitle = this.nodeTitle
      const nodeContent = this.nodeContent
      const fixY = this.inverted ? layout.height - layout.rowHeight : 0
      const context = this.context = layout.context
      this.nodes = nodes = layout.nodes
      this.reference = layout.reference
      for (i = nodes.length; i--;) {
        element = (node = nodes[i]).element
        if (!element) {
          if (!(element = unusedElements.pop())) {
            element = document.createElement('div')
            element.addEventListener('click', nodeClick)
            element.addEventListener('mouseover', nodeMouseOver)
            element.addEventListener('mouseout', nodeMouseOut)
            element.addEventListener('mousemove', nodeMouseMove)
            container.appendChild(element)
          }
          node.element = element
          element.__node__ = node
        }
        element.style.width = node.width + 'px'
        element.style.left = node.x + 'px'
        element.style.top = Math.abs(node.y - fixY) + 'px'
        element.style.backgroundColor = nodeColor(node, context)
        element.title = nodeTitle ? nodeTitle(node, context) : ''
        nodeContent.call(element, node, context)
        element.style.display = 'block'
      }
      this.nodes = nodes
    }
    recycle (roots) {
      let nodes, i, node, element, children
      const queue = [roots]
      while ((nodes = queue.pop())) {
        for (i = nodes.length; i--;) {
          node = nodes[i]
          if ((element = node.element)) {
            element.__node__ = null
            this.unusedElements.push(element)
          }
          if ((children = node.children)) {
            queue.push(children)
          }
        }
      }
    }
  }

  class TooltipView {
    constructor (container) {
      this.shown = false
      this.nodeTip = null
      this.element = document.createElement('div')
      this.element.className = 'tip'
      this.tipDx = 0
      this.tipDy = 0
      container.appendChild(this.element)
      // Safari is very annoying with its default tooltips for text with ellipsis.
      // The only way to disable it is to add dummy block element inside.
      this.deterringElement = document.createElement('div')
    }
    show (event, element, node, context) {
      const elementRect = element.getBoundingClientRect()
      const insideRect = element.parentElement.getBoundingClientRect()
      this.nodeTip.call(this.element, node, context)
      // Need to reset `display` here, so `getBoundingClientRect()` will actually layout the tip element.
      this.element.visibility = 'hidden'
      this.element.style.display = 'block'
      const tipRect = this.element.getBoundingClientRect()
      const clientWidth = document.documentElement.clientWidth
      const clientHeight = document.documentElement.clientHeight
      const px = event.clientX
      const py = event.clientY
      const pd = elementRect.height
      let x = px + pd
      let y = py + pd
      if (clientWidth < x + tipRect.width) {
        x = clientWidth - tipRect.width
      }
      if (clientHeight < y + tipRect.height) {
        y = py - pd - tipRect.height
      }
      x -= insideRect.left
      y -= insideRect.top
      this.tipDx = px - x
      this.tipDy = py - y
      element.appendChild(this.deterringElement)
      this.element.style.transform = 'translate(' + x + 'px,' + y + 'px)'
      this.element.visibility = 'visible'
      this.shown = true
    }
    hide () {
      if (this.shown) {
        const deterringParent = this.deterringElement.parentElement
        if (deterringParent) {
          deterringParent.removeChild(this.deterringElement)
        }
        this.element.style.display = 'none'
        this.shown = false
      }
    }
    update (event) {
      if (this.shown) {
        const x = event.clientX - this.tipDx
        const y = event.clientY - this.tipDy
        this.element.style.transform = 'translate(' + x + 'px,' + y + 'px)'
      }
    }
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
        const aggregated = markedAggregate([rootNode])
        const aggregatedFocus = markedAggregate([focusNode])
        this.searchContent.call(this.element, this.marked, aggregated, markedFocus, aggregatedFocus)
        this.element.style.display = 'block'
      } else {
        this.element.style.display = 'none'
      }
    }
  }

  const containerElement = document.createElement('div')
  const searchElement = document.createElement('div')
  const nodesSpaceElement = document.createElement('div')
  const nodesElement = document.createElement('div')
  containerElement.className = 'd3-flame-graph'
  searchElement.className = 'search'
  nodesSpaceElement.className = 'nodes-space'
  nodesElement.className = 'nodes'
  nodesSpaceElement.appendChild(nodesElement)
  containerElement.appendChild(searchElement)
  containerElement.appendChild(nodesSpaceElement)

  const hierarchyLayout = new HierarchyLayout()
  const searchController = new SearchController(searchElement)
  const hierarchyView = new HierarchyView(nodesElement)
  const tooltipView = new TooltipView(nodesSpaceElement)

  var rootNode = null
  var focusNode = null
  var updateNodeValues = null
  var expandNode = null
  var chartWidth = null
  var chartHeight = null
  var clickHandler = null

  function updateView () {
    const nodesRect = nodesElement.getBoundingClientRect()
    hierarchyLayout.totalWidth = nodesRect.width
    hierarchyLayout.hasDelta = itemHasDelta
    const layout = hierarchyLayout.layout(rootNode, focusNode, !hierarchyView.reference)
    nodesElement.style.height = layout.height + 'px'
    hierarchyView.render(layout)
    searchController.updateView(focusNode)
  }

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
  externalState.listen()

  function zoom (node) {
    focusNode = node
    if (expandNode) {
      expandNode(node)
      searchController.updateSearch(rootNode)
    }
    updateView()
  }

  function nodeClick () {
    if (!externalState.textSelected()) {
      tooltipView.hide()
      const node = this.__node__
      zoom(node)
      if (clickHandler) {
        clickHandler.call(this, node)
      }
    }
  }

  function nodeMouseOver (event) {
    if (tooltipView.nodeTip) {
      if (!(externalState.shiftKey && tooltipView.shown)) {
        tooltipView.show(event, this, this.__node__, hierarchyView.context)
      }
    }
  }

  function nodeMouseOut (event) {
    if (!externalState.shiftKey) {
      tooltipView.hide()
    }
  }

  function nodeMouseMove (event) {
    if (!externalState.shiftKey && tooltipView.shown) {
      tooltipView.update(event)
    }
  }

  function optionalGetter (getter, on, off) {
    return typeof getter === 'function' ? getter : (getter ? on : off)
  }

  function chart (element) {
    nodesElement.style.width = chartWidth ? chartWidth + 'px' : '100%'
    nodesElement.style.height = chartHeight ? chartHeight + 'px' : '0px'
    element.appendChild(containerElement)
    return chart
  }

  chart.selfValue = function (_) {
    if (!arguments.length) { return itemSelfValue }
    itemSelfValue = _
    return chart
  }

  chart.hasDelta = function (_) {
    if (!arguments.length) { return itemHasDelta }
    itemHasDelta = _
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
    if (!arguments.length) { return hierarchyView.nodeColor }
    hierarchyView.nodeColor = _ || getNodeColor
    return chart
  }

  chart.getNodeTitle = function (_) {
    if (!arguments.length) { return hierarchyView.nodeTitle }
    hierarchyView.nodeTitle = optionalGetter(_, getNodeTitle, null)
    return chart
  }

  chart.setNodeContent = function (_) {
    if (!arguments.length) { return hierarchyView.nodeContent }
    hierarchyView.nodeContent = _ || setNodeContent
    return chart
  }

  chart.setNodeTip = function (_) {
    if (!arguments.length) { return tooltipView.nodeTip }
    tooltipView.nodeTip = optionalGetter(_, setNodeTip, null)
    return chart
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

  chart.sort = function (_) {
    if (!arguments.length) { return hierarchyLayout.order }
    hierarchyLayout.order = optionalGetter(_, nodesTotalOrder, null)
    return chart
  }

  chart.inverted = function (_) {
    if (!arguments.length) { return hierarchyView.inverted }
    hierarchyView.inverted = _
    return chart
  }

  chart.height = function (_) {
    if (!arguments.length) { return chartHeight }
    chartHeight = _
    return chart
  }

  chart.width = function (_) {
    if (!arguments.length) { return chartWidth }
    chartWidth = _
    return chart
  }

  chart.createItemsView = function (datum) {
    if (rootNode) {
      hierarchyView.recycle([rootNode])
    }
    focusNode = rootNode = createItemViewNode(datum)
    updateNodeValues = updateItemViewNodeValues
    expandNode = null
    searchController.updateSearch(rootNode)
    updateView()
    return chart
  }

  chart.createFlattenView = function (datum) {
    if (rootNode) {
      hierarchyView.recycle([rootNode])
    }
    focusNode = rootNode = createFlattenViewNode(datum)
    updateNodeValues = updateFlattenViewNodeValues
    expandNode = expandFlattenViewNode
    searchController.updateSearch(rootNode)
    updateView()
    return chart
  }

  chart.updateValues = function () {
    updateNodeValues([rootNode])
    updateView()
    return chart
  }

  chart.search = function (term) {
    searchController.search(term)
    searchController.updateSearch(rootNode)
    updateView()
  }

  chart.clear = function () {
    searchController.search(null)
    searchController.updateSearch(rootNode)
    updateView()
  }

  chart.onClick = function (_) {
    if (!arguments.length) { return clickHandler }
    clickHandler = _
    return chart
  }

  chart.zoomTo = function (node) {
    zoom(node)
  }

  chart.resetZoom = function () {
    zoom(rootNode)
  }

  return chart
}
