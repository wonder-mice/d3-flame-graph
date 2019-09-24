import {State} from './State'
import {StateUpdater} from './StateUpdater'
import {stringFilterPredicate, stringFilterPlaceholder, stringFilterTooltip} from './StringFilter'

export class TextInputView {
  constructor (causalDomain, element) {
    this.textState = new State('TextInputView:Text', (state) => { this.updateText(state) })
    this.textStateElementContentInput = this.textState.input()
    this.causalDomain = causalDomain || this.textState

    if (!element) {
      element = document.createElement('input')
    }
    this.element = element
    element.type = 'text'
    element.addEventListener('input', (event) => { this.onInput(event) })
  }
  setText (text) {
    this.text = text
    this.textState.invalidate()
    this.textStateElementContentInput.send()
  }
  updateText (state) {
    if (this.textStateElementContentInput.changed) {
      this.element.value = this.text
    }
  }
  onInput (event) {
    this.text = this.element.value
    this.textState.invalidate()
    this.textStateElementContentInput.cancel()
    StateUpdater.typing(this.causalDomain)
  }
}

export class FilterInputView extends TextInputView {
  constructor (causalDomain, element) {
    super(causalDomain, element)
    element = this.element
    element.className = 'fg-input fg-input-mono'
    element.autocomplete = 'off'
    element.autocorrect = 'off'
    element.autocapitalize = 'off'
    element.spellcheck = 'false'
    element.placeholder = stringFilterPlaceholder
    element.title = stringFilterTooltip

    this.predicate = null
    this.predicateState = new State('FilterInputView:Predicate', (state) => { this.updatePredicate(state) })
    this.predicateState.input(this.textState)
  }
  updatePredicate (state) {
    let predicate = null
    try {
      predicate = stringFilterPredicate(this.text)
    } catch (error) {
      const element = this.element
      element.setCustomValidity(error.message)
      element.reportValidity()
    }
    if (predicate !== this.predicate) {
      this.predicate = predicate
    } else {
      state.cancel()
    }
  }
}
