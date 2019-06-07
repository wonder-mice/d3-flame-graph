import { State } from './State'
import { EnvironmentState } from './EnvironmentState'

//   Selection button        | Normal                      | Flatten
//  -------------------------+-----------------------------+-----------------------------
//   Set node subtree        | Set node subtree            | Set node.roots subtrees
//   Set node ancestors      | Set node ancestors          | Set node.roots ancestors
//   Set named subtree       | Set all named subtrees      | Set all named subtrees
//   Set named ancestors     | Set all named ancestors     | Set all named ancestors
//   Set named               | Set all with name           | Set all with name            (useless?)
//  -------------------------+-----------------------------+-----------------------------
//   Include node            | Include node                | Include node.roots           (+ node.recursiveRoots?)
//   Include node subtree    | Include node subtree        | Include node.roots subtrees
//   Include node ancestors  | Include node ancestors      | Include node.roots ancestors (+ node.recursiveRoots?)
//  -------------------------+-----------------------------+-----------------------------
//   Exclude node            | Exclude node                | Exclude node.roots           (+ node.recursiveRoots?)
//   Exclude node subtree    | Exclude node subtree        | Exclude node.roots subtrees
//   Exclude node ancestors  | Exclude node ancestors      | Exclude node.roots ancestors (+ node.recursiveRoots?)
//  -------------------------+-----------------------------+-----------------------------
//   Include named           | Include all with name       | Include all with name
//   Include named subtree   | Include all named subtrees  | Include all named subtrees
//   Include named ancestors | Include all named ancestors | Include all named ancestors
//  -------------------------+-----------------------------+-----------------------------
//   Exclude named           | Exclude all with name       | Exclude all with name
//   Exclude named subtree   | Exclude all named subtrees  | Exclude all named subtrees
//   Exclude named ancestors | Exclude all named ancestors | Exclude all named ancestors  (useless?)
//   Exclude named decendants| Exclude all named ancestors | Exclude all named ancestors  (useless?)
const buttons = {
  // Reset selection
  setSubtree: {
    title: 'Reset selection to include only this node and its descendants.',
    content: 'Σᛦ¹',
    callback: (selection, node) => { selection.setSubtree(node) }
  },
  setAncestors: {
    title: 'Reset selection to include only this node and its ancestors.',
    content: 'Σᛘ¹',
    callback: (selection, node) => { selection.setAncestors(node) }
  },
  setNamedSubtrees: {
    title: 'Reset selection to include only nodes with the same name and their descendants.',
    content: 'Σᛦⁿ',
    callback: (selection, node) => { selection.setNamedSubtrees(node.name) }
  },
  setNamedAncestors: {
    title: 'Reset selection to include only nodes with the same name and their ancestors.',
    content: 'Σᛘⁿ',
    callback: (selection, node) => { selection.setNamedAncestors(node.name) }
  },
  // Add to selection (node based)
  includeNode: {
    title: 'Add node to selection.',
    content: '+Σ¹',
    callback: (selection, node) => { selection.includeNode(node) }
  },
  includeSubtree: {
    title: 'Add node and its descendants to selection.',
    content: '+Σᛦ¹',
    callback: (selection, node) => { selection.includeSubtree(node) }
  },
  includeAncestors: {
    title: 'Add node and its ancestors to selection.',
    content: '+Σᛘ¹',
    callback: (selection, node) => { selection.includeAncestors(node) }
  },
  // Remove from selection (node based)
  excludeNode: {
    title: 'Remove node from selection.',
    content: '-Σ¹',
    callback: (selection, node) => { selection.excludeNode(node) }
  },
  excludeSubtree: {
    title: 'Remove node and its descendants from selection.',
    content: '-Σᛦ¹',
    callback: (selection, node) => { selection.excludeSubtree(node) }
  },
  excludeAncestors: {
    title: 'Remove node and its ancestors from selection.',
    content: '-Σᛘ¹',
    callback: (selection, node) => { selection.excludeAncestors(node) }
  },
  // Add to selection (name based)
  includeNamed: {
    title: 'Add nodes with the same name to selection.',
    content: '+Σⁿ',
    callback: (selection, node) => { selection.includeNamed(node.name) }
  },
  includeNamedSubtrees: {
    title: 'Add nodes with the same name and their descendants to selection.',
    content: '+Σᛦⁿ',
    callback: (selection, node) => { selection.includeNamedSubtrees(node.name) }
  },
  includeNamedAncestors: {
    title: 'Add nodes with the same name and their ancestors to selection.',
    content: '+Σᛘⁿ',
    callback: (selection, node) => { selection.includeNamedAncestors(node.name) }
  },
  // Remove from selection (name based)
  excludeNamed: {
    title: 'Remove nodes with the same name from selection.',
    content: '-Σⁿ',
    callback: (selection, node) => { selection.includeNamed(node.name) }
  },
  excludeNamedSubtrees: {
    title: 'Remove nodes with the same name and their descendants from selection.',
    content: '-Σᛦⁿ',
    callback: (selection, node) => { selection.excludeNamedSubtrees(node.name) }
  },
  excludeNamedAncestors: {
    title: 'Remove nodes with the same name and their ancestors from selection.',
    content: '-Σᛘⁿ',
    callback: (selection, node) => { selection.excludeNamedAncestors(node.name) }
  }
}

export class NodeTooltipView {
  constructor (container, causalDomain) {
    this.container = container
    this.contentCallback = null
    this.selectionInterface = null
    this.node = null
    this.elementState = new State('NodeTooltipView::Element', (state) => { this.updateElement(state) })
    this.contentState = new State('NodeTooltipView::Content', (state) => { this.updateContent(state) })
    this.contentState.input(this.elementState)
    this.causalDomain = causalDomain || this.contentState
  }
  setContentCallback (contentCallback) {
    this.contentCallback = contentCallback
    this.contentState.invalidate()
  }
  setSelectionInterface (selectionInterface) {
    this.selectionInterface = selectionInterface
    this.elementState.invalidate()
  }
  updateElement (state) {
    const headerId = EnvironmentState.newId('tooltip-header')
    const bodyId = EnvironmentState.newId('tooltip-body')

    const buttonIds = {}
    for (const name in buttons) {
      buttonIds[name] = EnvironmentState.newId('tooltip-button')
    }
    const contentHTML = (
      `<div class='fg-tooltip'>
        <div style="display: flex">
          <div id="${headerId}" class="fg-tooltip-header" style="flex: 1 1 auto"></div>
          <div class="fg-dropdown">
            <span class="fg-btn fg-btn-sm">
              <svg class="fg-icon" style="flex: 0 0 auto; fill: currentColor; width: 14px; height: 16px" viewBox="0 0 14 16" version="1.1" width="14" height="16" aria-hidden="true">
                <path fill-rule="evenodd" d="M2 13h4v1H2v-1zm5-6H2v1h5V7zm2 3V8l-3 3 3 3v-2h5v-2H9zM4.5 9H2v1h2.5V9zM2 12h2.5v-1H2v1zm9 1h1v2c-.02.28-.11.52-.3.7-.19.18-.42.28-.7.3H1c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h3c0-1.11.89-2 2-2 1.11 0 2 .89 2 2h3c.55 0 1 .45 1 1v5h-1V6H1v9h10v-2zM2 5h8c0-.55-.45-1-1-1H8c-.55 0-1-.45-1-1s-.45-1-1-1-1 .45-1 1-.45 1-1 1H3c-.55 0-1 .45-1 1z"></path>
              </svg>
            </span>
            <div class="fg-dropdown-content fg-dropdown-content-rt" style="display: flex; flex-direction: column">
              <span class="fg-btn fg-btn-sm" style="align-self:stretch">Copy callstack</span>
              <span class="fg-btn fg-btn-sm" style="align-self:stretch">Copy subframes</span>
              <span class="fg-btn fg-btn-sm" style="align-self:stretch">Copy view state</span>
            </div>
          </div>
          <div></div>
        </div>
        <div id="${bodyId}" class="fg-tooltip-body">
        </div>
        <div>
          <div style="display: flex">
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.setSubtree}" title="${buttons.setSubtree.title}">${buttons.setSubtree.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setAncestors}" title="${buttons.setAncestors.title}">${buttons.setAncestors.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setNamedSubtrees}" title="${buttons.setNamedSubtrees.title}">${buttons.setNamedSubtrees.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.setNamedAncestors}" title="${buttons.setNamedAncestors.title}">${buttons.setNamedAncestors.content}</span>
              </div>
            </div>
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.includeNode}" title="${buttons.includeNode.title}">${buttons.includeNode.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeSubtree}" title="${buttons.includeSubtree.title}">${buttons.includeSubtree.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeAncestors}" title="${buttons.includeAncestors.title}">${buttons.includeSubtree.content}</span>
              </div>
            </div>
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.excludeNode}" title="${buttons.excludeNode.title}">${buttons.excludeNode.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeSubtree}" title="${buttons.excludeSubtree.title}">${buttons.excludeSubtree.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeAncestors}" title="${buttons.excludeAncestors.title}">${buttons.excludeSubtree.content}</span>
              </div>
            </div>
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.includeNamed}" title="${buttons.includeNamed.title}">${buttons.includeNamed.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeNamedSubtrees}" title="${buttons.includeNamedSubtrees.title}">${buttons.includeNamedSubtrees.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.includeNamedAncestors}" title="${buttons.includeNamedAncestors.title}">${buttons.includeNamedAncestors.content}</span>
              </div>
            </div>
            <div class="fg-dropdown">
              <span class="fg-btn fg-btn-sm" id="${buttonIds.excludeNamed}" title="${buttons.excludeNamed.title}">${buttons.excludeNamed.content}</span>
              <div class="fg-dropdown-content fg-dropdown-content-lb" style="display: flex; flex-direction: column-reverse">
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeNamedSubtrees}" title="${buttons.excludeNamedSubtrees.title}">${buttons.excludeNamedSubtrees.content}</span>
                <span class="fg-btn fg-btn-sm" style="align-self:stretch" id="${buttonIds.excludeNamedAncestors}" title="${buttons.excludeNamedAncestors.title}">${buttons.excludeNamedAncestors.content}</span>
              </div>
            </div>
          </div>
          <div class="fg-tooltip-hint">
            <div class="fg-tooltip-hint-mouse-out">Hold <kbd>Shift</kbd> to move mouse inside.</div>
            <div class="fg-tooltip-hint-mouse-in">Release <kbd>Shift</kbd> to select text.</div>
          </div>
        </div>
      </div`)
    const container = this.container
    container.innerHTML = contentHTML
    this.header = container.querySelector('#' + headerId)
    this.body = container.querySelector('#' + bodyId)

    const causalDomain = this.causalDomain
    for (const name in buttons) {
      container.querySelector('#' + buttonIds[name]).addEventListener('click', (event) => {
        buttons[name].callback(this.selectionInterface, this.node)
        causalDomain.update()
      })
    }
  }
  updateContent (state) {
    const node = this.node
    if (node) {
      this.header.innerText = node.name
      // FIXME: Do we need it?
      // this.buttonSelectionToggleNode.innerText = node.selected & nodeFlagSelected ? '-Σ¹' : '+Σ¹'
      const contentCallback = this.contentCallback
      if (contentCallback) {
        contentCallback(this, node)
      }
    } else {
      state.cancel()
    }
  }
}
