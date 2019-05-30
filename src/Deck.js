import {State} from './State'
import {TabView} from './TabView'
import {DeckPage} from './DeckPage'

export class Deck {
  constructor (parent, causalDomain) {
    const state = this.state = new State('Deck::State')
    causalDomain = this.causalDomain = causalDomain || state

    const element = this.element = document.createElement('div')
    element.style.width = '100%'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const tabView = this.tabView = new TabView(element)
    tabView.plusTab.element.innerHTML = '<svg fill="currentColor" style="vertical-align:middle" width="12" height="16" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M12 9H7v5H5V9H0V7h5V2h2v5h5v2z"/></svg>'
    tabView.plusTab.element.addEventListener('click', (event) => {
      this.addPage('Selection')
    })
    const masterPage = this.masterPage = this.addPage('Master', causalDomain)
    state.input(masterPage.state)
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
    this.masterPage.setCostTraits(costTraits)
  }
  setValueTraits (valueTraits) {
    this.masterPage.setValueTraits(valueTraits)
  }
  setOrderFunction (orderFunction) {
    this.masterPage.setOrderFunction(orderFunction)
  }
  setNodeTooltipContentCallback (nodeTooltipContentCallback) {
    this.masterPage.setNodeTooltipContentCallback(nodeTooltipContentCallback)
  }
  update () {
    this.causalDomain.update()
  }
  addPage (name) {
    const tab = this.tabView.addTab(true)
    tab.element.innerText = name
    tab.element.addEventListener('click', (event) => {
      // activate
    })
    const page = new DeckPage(this.element)
    this.state.input(page.state)
    return page
  }
}
