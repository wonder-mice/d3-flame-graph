import {State} from './State'
import {StructureTraits, CostTraits, ValueTraits} from './Item'
import {TabView} from './TabView'
import {DeckPage, DeckPageOptions} from './DeckPage'

export class DeckOptions {
  constructor () {
    this.causalDomain = null
    this.structureRoots = null
    this.structureTraits = null
    this.costTraits = null
    this.valueTraits = null
    this.nodeTooltipContentCallback = null
  }
}

export class Deck {
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
  constructor (parent, options) {
    const causalDomain = this.causalDomain = (options && options.causalDomain) || new State('Deck::CausalDomain')
    const nodeTooltipContentCallback = options && options.nodeTooltipContentCallback
    const structureRoots = (options && options.structureRoots) || null
    const structureTraits = (options && options.structureTraits) || new StructureTraits()
    const costTraits = (options && options.costTraits) || new CostTraits()
    const valueTraits = (options && options.valueTraits) || new ValueTraits()

    const element = this.element = document.createElement('div')
    element.style.width = '100%'
    element.style.display = 'flex'
    element.style.flexDirection = 'column'

    const tabView = this.tabView = new TabView(element)
    tabView.plusTab.element.innerHTML = '<svg fill="currentColor" style="vertical-align:middle" width="12" height="16" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M12 9H7v5H5V9H0V7h5V2h2v5h5v2z"/></svg>'
    tabView.plusTab.element.addEventListener('click', (event) => {
      this.addPage()
    })

    const masterPageOptions = new DeckPageOptions()
    masterPageOptions.causalDomain = causalDomain
    masterPageOptions.structureRoots = structureRoots
    masterPageOptions.structureTraits = structureTraits
    masterPageOptions.costTraits = costTraits
    masterPageOptions.valueTraits = valueTraits
    masterPageOptions.nodeTooltipContentCallback = nodeTooltipContentCallback
    this.addPage(masterPageOptions, 'Master')

    if (parent) {
      parent.appendChild(element)
    }
  }
  update () {
    this.causalDomain.update()
  }
  addPage (options, name) {
    const tab = this.tabView.addTab(true)
    tab.element.innerText = name
    tab.element.addEventListener('click', (event) => {
    })

    const page = new DeckPage(this.element, options)

    this.causalDomain.input(page.state)
  }
}
