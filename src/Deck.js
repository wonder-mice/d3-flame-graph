import {State} from './State'
import {TabView} from './TabView'
import {DeckPage} from './DeckPage'
import {NodeSelectionStructureTraits} from './NodeSelection'

class DeckItem {
  constructor (tab, page) {
    this.tab = tab
    this.page = page
  }
}

export class Deck {
  constructor (parent, causalDomain) {
    const state = this.state = new State('Deck::State')
    causalDomain = this.causalDomain = causalDomain || state

    this.nodeTooltipContentCallback = null
    this.items = []
    this.itemNo = 0
    this.activeItem = null

    const element = this.element = document.createElement('div')
    element.style.width = '100%'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const tabView = this.tabView = new TabView(element)
    const plusTab = this.plusTab = tabView.addTab(null, false)
    plusTab.element.addEventListener('click', (event) => { this.onPlusTabClick() })
    plusTab.element.innerHTML = (
`<svg fill="currentColor" style="vertical-align: middle" width="12" height="16" viewBox="0 0 12 16">
  <path fill-rule="evenodd" d="M12 9H7v5H5V9H0V7h5V2h2v5h5v2z"/>
</svg>`)

    const masterPage = this.masterPage = new DeckPage(this.element, this.causalDomain)
    const masterItem = this.masterItem = this.addPage(masterPage, 'Master')
    this.setActiveItem(masterItem)

    if (parent) {
      parent.appendChild(element)
    }
  }
  setStructureRoots (roots) {
    this.masterPage.setStructureRoots(roots)
  }
  setStructureTraits (structureTraits) {
    this.masterPage.setStructureTraits(structureTraits)
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
  setActiveItem (item) {
    const activeItem = this.activeItem
    if (activeItem !== item) {
      if (activeItem) {
        activeItem.page.element.style.display = 'none'
        activeItem.tab.setActive(false)
      }
      item.page.element.style.display = 'flex'
      item.tab.setActive(true)
      this.activeItem = item
    }
  }
  addPage (page, name) {
    this.state.input(page.state)
    const tab = this.tabView.addTab(this.plusTab, false)
    const item = new DeckItem(tab, page)
    this.items.push(item)
    tab.element.addEventListener('click', (event) => { this.onItemTabClick(item) })
    tab.element.innerText = name
    return item
  }
  onPlusTabClick () {
    const activeItem = this.activeItem
    const activePage = activeItem.page
    const activeModel = activePage.primaryModel
    const page = new DeckPage(this.element, this.causalDomain)
    page.setStructureRoots(NodeSelectionStructureTraits.selectedRoots([activeModel.rootNode]))
    page.setStructureTraits(NodeSelectionStructureTraits)
    page.setStructureCoalescing(true)
    page.setCostTraits(activeModel.costTraits)
    page.setValueTraits(activeModel.valueTraits)
    page.setOrderFunction(activeModel.orderFunction)
    page.setNodeTooltipContentCallback(this.nodeTooltipContentCallback)
    const item = this.addPage(page, 'Selection #' + (++this.itemNo))
    this.setActiveItem(item)
    this.causalDomain.update()
  }
  onItemTabClick (item) {
    this.setActiveItem(item)
    this.causalDomain.update()
  }
}
