import {State} from './State'
import {TabView} from './TabView'
import {DeckPage} from './DeckPage'
import {NodeSelectionStructureTraits} from './NodeSelection'
import {generateElementId, elementWithId} from './EnvironmentState'

const iconReload = '<path fill-rule="evenodd" fill="currentColor" d="M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z"/>'
const iconClose = '<path fill-rule="evenodd" fill="currentColor" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"/>'
const iconPlus = '<path fill-rule="evenodd" fill="currentColor" d="M12 9H7v5H5V9H0V7h5V2h2v5h5v2z"/>'

class DeckItem {
  constructor (tab, page, input) {
    this.tab = tab
    this.page = page
    this.input = input
    const state = this.state = new State('DeckItem::State')
    state.input(this.page.state)
    this.tabTitleState = new State('DeckItem::TabTitle')
    state.input(this.tabTitleState)
    this.tabButtonElement = null
    this.tabTitleElement = null
  }
  setActive (active) {
    this.page.setHidden(!active)
    this.tab.setActive(active)
    if (active) {
      this.input.attach(this.state)
    } else {
      this.input.detach()
    }
  }
}

export class Deck {
  constructor (parent, causalDomain) {
    const state = this.state = new State('Deck::State')
    causalDomain = this.causalDomain = causalDomain || state

    this.aggregationNo = 0
    this.nodeTooltipContentCallback = null
    this.items = []
    this.activeItem = null

    const element = this.element = document.createElement('div')
    element.style.width = '100%'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const tabView = this.tabView = new TabView(element)
    const plusTab = this.plusTab = tabView.addTab(null, false)
    const plusTabElement = plusTab.element
    plusTabElement.classList.add('fg-deck-tab')
    plusTabElement.addEventListener('click', (event) => { this.onPlusTabClick() })
    plusTabElement.title = 'Extract selected subtree.'
    plusTabElement.innerHTML = `<svg fill="currentColor" class="fg-deck-tab-plus" width="12" height="16" viewBox="0 0 12 16">${iconPlus}</svg>`

    const masterItem = this.masterItem = this.newMasterItem()
    this.setActiveItem(masterItem)

    if (parent) {
      parent.appendChild(element)
    }
  }
  setRootName (name) {
    this.masterItem.page.setRootName(name)
  }
  setStructureRoots (roots) {
    this.masterItem.page.setStructureRoots(roots)
  }
  setStructureTraits (structureTraits) {
    this.masterItem.page.setStructureTraits(structureTraits)
  }
  setCostTraits (costTraits) {
    for (let items = this.items, i = items.length; i--;) {
      items[i].page.setCostTraits(costTraits)
    }
  }
  setValueTraits (valueTraits) {
    for (let items = this.items, i = items.length; i--;) {
      items[i].page.setValueTraits(valueTraits)
    }
  }
  setOrderFunction (orderFunction) {
    for (let items = this.items, i = items.length; i--;) {
      items[i].page.setOrderFunction(orderFunction)
    }
  }
  setNodeTooltipContentCallback (nodeTooltipContentCallback) {
    this.nodeTooltipContentCallback = nodeTooltipContentCallback
    for (let items = this.items, i = items.length; i--;) {
      items[i].page.setNodeTooltipContentCallback(nodeTooltipContentCallback)
    }
  }
  update () {
    this.causalDomain.update()
  }
  newPage () {
    const page = new DeckPage(this.element, this.causalDomain)
    page.element.style.flex = '1 0'
    page.secondaryView.nodeClickListener = (node) => { this.onFlattenNodeClick(node) }
    return page
  }
  newItem (page) {
    const input = this.state.input()
    const tab = this.tabView.addTab(this.plusTab, false)
    const tabElement = tab.element
    const item = new DeckItem(tab, page, input)
    this.items.push(item)
    const buttonId = generateElementId('deck-tab-btn')
    const titleId = generateElementId('deck-tab-title')
    tabElement.addEventListener('click', (event) => { this.onItemTabClick(item) })
    tabElement.classList.add('fg-deck-tab')
    tabElement.innerHTML = `<svg id="${buttonId}" class="fg-deck-tab-btn" viewBox="0 0 12 16"></svg><span id="${titleId}" class="fg-deck-tab-title"></span>`
    item.tabButtonElement = elementWithId(tabElement, buttonId)
    item.tabTitleElement = elementWithId(tabElement, titleId)
    return item
  }
  newMasterItem () {
    const page = this.newPage()
    const item = this.newItem(page)
    item.tabButtonElement.innerHTML = iconReload
    item.tabButtonElement.onclick = (event) => {
      event.stopPropagation()
      this.onItemTabReset(item)
    }
    item.tabTitleState.input(page.primaryModel.structureState)
    item.tabTitleState.action = (state) => {
      const rootNode = item.page.primaryModel.rootNode
      item.tabTitleElement.textContent = rootNode ? rootNode.name : '(Empty)'
    }
    return item
  }
  newClosableItem (page, title) {
    const item = this.newItem(page)
    item.tabTitleElement.textContent = title
    item.tabButtonElement.innerHTML = iconClose
    item.tabButtonElement.onclick = (event) => {
      event.stopPropagation()
      this.onItemTabClose(item)
    }
    return item
  }
  newSelectionItem (sourceItem) {
    const sourcePage = sourceItem.page
    const sourceModel = sourcePage.primaryModel
    const page = this.newPage()
    const selectedRoots = NodeSelectionStructureTraits.selectedRoots([sourceModel.rootNode])
    const rootName = NodeSelectionStructureTraits.suggestedName(selectedRoots, '(Empty)', null)
    page.setRootName(rootName || 'Everything')
    page.setStructureRoots(selectedRoots)
    page.setStructureTraits(NodeSelectionStructureTraits)
    page.setStructureCoalescing(true)
    page.setCostTraits(sourceModel.costTraits)
    page.setValueTraits(sourceModel.valueTraits)
    page.setOrderFunction(sourceModel.orderFunction)
    page.setNodeTooltipContentCallback(this.nodeTooltipContentCallback)
    page.primaryView.setFocusNode(sourcePage.primaryView.focusNode)
    page.secondaryModel.setStructurePath(sourcePage.secondaryModel.structurePath)

    const title = rootName || 'Aggregation #' + (++this.aggregationNo)
    const item = this.newClosableItem(page, title)
    return item
  }
  newFlattenItem (sourceItem, node) {
    const sourcePage = sourceItem.page
    const sourceModel = sourcePage.primaryModel
    const page = this.newPage()
    const rootName = node.name
    page.setRootName(rootName)
    page.setStructureRoots(node.roots)
    page.setStructureTraits(NodeSelectionStructureTraits)
    page.setStructureCoalescing(true)
    page.setCostTraits(sourceModel.costTraits)
    page.setValueTraits(sourceModel.valueTraits)
    page.setOrderFunction(sourceModel.orderFunction)
    page.setNodeTooltipContentCallback(this.nodeTooltipContentCallback)

    const item = this.newClosableItem(page, rootName)
    return item
  }
  setActiveItem (item) {
    const activeItem = this.activeItem
    if (activeItem !== item) {
      if (activeItem) {
        activeItem.setActive(false)
      }
      if (item) {
        item.setActive(true)
      }
      this.activeItem = item
    }
  }
  onFlattenNodeClick (node) {
    const item = this.newFlattenItem(this.activeItem, node)
    this.setActiveItem(item)
    this.causalDomain.update()
  }
  onPlusTabClick () {
    const item = this.newSelectionItem(this.activeItem)
    this.setActiveItem(item)
    this.causalDomain.update()
  }
  onItemTabReset (item) {
    const page = item.page
    const rootNode = page.primaryModel.rootNode
    if (rootNode) {
      page.primarySelection.setSubtree(rootNode)
    }
    this.setActiveItem(item)
    this.causalDomain.update()
  }
  onItemTabClose (item) {
    const items = this.items
    const index = items.indexOf(item)
    if (item === this.activeItem) {
      const next = index + 1
      if (next < items.length) {
        this.setActiveItem(items[next])
      } else if (0 < index) {
        this.setActiveItem(items[index - 1])
      } else {
        this.setActiveItem(null)
      }
    }
    items.splice(index, 1)
    this.state.remove(item.input)
    this.tabView.removeTab(item.tab)
    const page = item.page
    this.element.removeChild(page.element)
    page.discard()
    this.causalDomain.update()
  }
  onItemTabClick (item) {
    this.setActiveItem(item)
    this.causalDomain.update()
  }
}
