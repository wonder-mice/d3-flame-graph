export class EnvironmentState {
}

let lastId = 0

export function generateElementId (tag) {
  return 'fg-' + (tag || 'id') + '-' + (++lastId)
}

export function elementWithId (container, id) {
  // Can't use `document.getElementById(id)` because `container` is not necessary
  // added to the `document` yet, while `querySelector()` works for any element.
  return container.querySelector('#' + id)
}

function textSelected () {
  return window.getSelection().type === 'Range'
}

function onKeyUpDown (event) {
  switch (event.type) {
  case 'keydown':
  case 'keyup':
    EnvironmentState.shiftKey = event.shiftKey
    break
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onKeyUpDown, false)
  document.addEventListener('keyup', onKeyUpDown, false)
}

EnvironmentState.shiftKey = false
EnvironmentState.textSelected = textSelected
