import { Metrics } from './Metrics'
export const inputUnchanged = 0
export const inputPending = 1
export const inputChanged = 2

// Sets status of each `pending` output input to `unchanged`. If state that owns
// the input (consumer) now has all its inputs in `unchanged` status, repeat
// procedure recursively for all output inputs of this state. Note, that if
// input is `changed`, it will remain `changed`.
function outputSetClean (state) {
  const queue = [state.outputInputs]
  for (let k = queue.length; k--;) {
    const outputInputs = queue[k]
    for (let i = outputInputs.length; i--;) {
      const input = outputInputs[i]
      if (inputPending === input.status) {
        input.status = inputUnchanged
        const state = input.consumer
        if (!--state.inputsChanged) {
          // There are two approaches to reset `outputInputsMarked`:
          // 1. In `statesUpdate()` after state is picked from the queue
          // 2. In `stateValidate()` AND everywhere state can become clean during update phase.
          // Second approach will take state out of update graph as soon as first `send()` or
          // `cancel()` was called (including cases when it was called by/from producer states
          // as an optimization). This will make it impossible to make this state dirty again.
          // But this will requre to find all places where state can become clean during update
          // phase. Looks like this is the only one (except `stateValidate()` itself).
          // Taking first approach for now, since it's simpler and more robust.
          // state.outputInputsMarked = 0
          queue[k++] = state.outputInputs
        }
      }
    }
  }
}

// Set status of each `unchanged` output input to `pending`. If state that owns
// the input (consumer) previosuly had all its inputs `unchanged` (was clean),
// repeat procedure recursively for all output inputs of this state. Note, that
// if input is `changed`, it will remain changed (because `changed` is `dirty`
// too).
function outputSetDirty (state) {
  // It shouldn't be possible to start at `state` that is in update graph
  // (0 !== state.outputInputsMarked), then encounter another state which is NOT
  // in update graph (0 === state.outputInputsMarked) AND THEN encounter state
  // that is in update graph again. Because of that `state.outputInputsMarked`
  // can be used to verify that we are not additing states to update graph
  // (otherwise we would need to compare `outputInputsMarked` of producer with
  // `outputInputsMarked` of consumer for each input).
  const outputInputsMarked = state.outputInputsMarked
  const queue = [state.outputInputs]
  for (let k = queue.length; k--;) {
    const outputInputs = queue[k]
    for (let i = outputInputs.length; i--;) {
      const input = outputInputs[i]
      if (inputUnchanged === input.status) {
        const consumer = input.consumer
        // This is effectively an assert for debug purposes only.
        if (!outputInputsMarked && consumer.outputInputsMarked) {
          throw Error(`State that is not in update graph ("${input.producer.name}") can't be invalidated if it has consumers that are in update graph ("${consumer.name}").`)
        }
        input.status = inputPending
        if (!consumer.inputsChanged++) {
          queue[k++] = consumer.outputInputs
        }
      }
    }
  }
}

// Sets input status to `unchanged`. If this causes owning state (consumer) to
// have no `dirty` inputs, calls `outputSetClean()` on it to mark its output
// inputs as clean. Behavior is different (but only for provided `input`) from
// `outputSetClean()` in that it will always change input's status to
// `unchanged`, even when it's current status is `changed`.
function inputSetClean (input) {
  if (inputUnchanged !== input.status) {
    input.status = inputUnchanged
    const state = input.consumer
    if (!--state.inputsChanged) {
      outputSetClean(state)
    }
  }
}

// Sets input status to `changed`. If this causes owning state (consumer) to
// transition from 0 `dirty` inputs to 1 `dirty` input, calls `outputSetDirty()`
// on it to mark its output inputs as `dirty`. Behavior is different (but only
// for provided `input`) from `outputSetDirty()` in that it will always change
// input's status to `changed`, even when it's current status is `pending`.
function inputSetDirty (input) {
  if (inputUnchanged === input.status) {
    const state = input.consumer
    if (!state.inputsChanged++) {
      outputSetDirty(state)
    }
  }
  input.status = inputChanged
}

function inputPerformSend (input, value) {
  const traits = input.traits
  if (traits && traits.send) { traits.send(input, value) }
}

function inputPerformReset (input) {
  const traits = input.traits
  if (traits && traits.reset) { traits.reset(input) }
}

function inputPerformConsume (input) {
  const traits = input.traits
  if (traits && traits.consume) { traits.consume(input) }
}

function inputPerformAttach (input) {
  const traits = input.traits
  if (traits && traits.attach) { traits.attach(input) }
}

function inputPerformDetach (input) {
  const traits = input.traits
  if (traits && traits.detach) { traits.detach(input) }
}

function inputAttachProducer (input, producer) {
  producer.outputInputs.push(input)
  inputPerformAttach(input)
}

function inputDetachProducer (input, producer) {
  inputPerformDetach(input)
  const outputInputs = producer.outputInputs
  for (let i = outputInputs.length; i--;) {
    if (input === outputInputs[i]) {
      outputInputs.splice(i, 1)
      break
    }
  }
}

function outputSend (state, value) {
  const outputInputs = state.outputInputs
  for (let i = outputInputs.length; i--;) {
    const input = outputInputs[i]
    // Callback is called for all output inputs, regardless of their state.
    // That's because callback must be able to reliably assign latest value to
    // all of them, while their status is just whether consumer will interpret
    // updated value as a new one.
    inputPerformSend(input, value)
    // However, output input status will be updated to `changed` only if it's
    // still `pending`, because:
    // - Callback is allowed to explicitly set `unchanged` status on certain
    //   inputs.
    // - Upstream states are allowed to produce output for downstream states
    //   inside their update action callback (e.g. if they can compute it more
    //   efficiently). When this happens, all inputs of downstream state will
    //   be marked as `unchanged` indicating that state is clean and there is no
    //   need to call its update action callback. While we want `callback`
    //   above to update the output input value, we don't want to transition
    //   associated consumer state into dirty state and cause its update action
    //   callback to be called.
    if (inputPending === input.status) {
      input.status = inputChanged
    }
  }
}

function outputReset (state) {
  const outputInputs = state.outputInputs
  for (let i = outputInputs.length; i--;) {
    const input = outputInputs[i]
    // See comment in `outputSend()` on why we keep `unchanged` inputs unchanged.
    if (inputPending === input.status) {
      input.status = inputChanged
      inputPerformReset(input)
    }
  }
}

function stateValidate (state) {
  const inputs = state.inputs
  for (let i = inputs.length; i--;) {
    const input = inputs[i]
    input.status = inputUnchanged
    inputPerformConsume(input)
  }
  state.inputsChanged = 0
}

function stateUpdate (state) {
  const action = state.action
  if (!action || (action(state), state.inputsChanged)) {
    outputReset(state)
    stateValidate(state)
  }
}

function statesCollect (states) {
  // Traverse the subgraph and assign correct `outputInputsMarked` values to states
  // inside the subgraph. For each state, `outputInputsMarked` is number of dirty
  // next states (states that depend on this one) **in the subgraph**. Each state
  // from `states` gets a `+1` for being in `states` list, which is basically
  // simulates virtual state that depends on all states from `states`.
  const queue = states.slice()
  for (let k = queue.length; k--;) {
    const state = queue[k]
    if (state.inputsChanged && !state.outputInputsMarked++) {
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { queue[k++] = producer }
      }
    }
  }
  // Topological sort using computed `outputInputsMarked`. Each time state with
  // `outputInputsMarked` equal to `1` is found, add it to the `sorted` list and
  // add its dependencies (previous states) to the queue. For each encountered
  // state, decrease its `outputInputsMarked` by `1`.
  const sorted = []
  for (let k = states.length, n = sorted.length; k--;) {
    const state = states[k]
    if (state.inputsChanged && !--state.outputInputsMarked) {
      state.outputInputsMarked = 2000000000
      sorted[n++] = state
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { states[k++] = producer }
      }
    }
  }
  // Algorithm here can be imrpoved.
  return sorted
}

function statesUpdate (states) {
  if (Metrics.statesUpdate) {
    Metrics.statesUpdate(...states)
  }
  Metrics.begin('StateUpdate')
  const queue = statesCollect(states)
  const dirtyN = queue.length
  let updatedN = 0
  for (let k = dirtyN; k--;) {
    const state = queue[k]
    if (state.inputsChanged) {
      ++updatedN
      Metrics.begin(state.name)
      stateUpdate(state)
      Metrics.end('' + state.inputsChanged + '/' + state.inputs.length + ' inputs changed')
    }
    state.outputInputsMarked = 0
  }
  Metrics.end('' + updatedN + '/' + dirtyN + ' states updated')
}

export function statesPlot (states) {
  const queue = states.slice()
  for (let k = queue.length; k--;) {
    const state = queue[k]
    if (!state.outputInputsMarked++) {
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { queue[k++] = producer }
      }
    }
  }
  const sorted = []
  for (let k = states.length, n = sorted.length; k--;) {
    const state = states[k]
    if (!--state.outputInputsMarked) {
      sorted[n++] = state
      const inputs = state.inputs
      for (let i = inputs.length; i--;) {
        const producer = inputs[i].producer
        if (producer) { states[k++] = producer }
      }
    }
  }
  let uid = 0
  for (let k = sorted.length; k--;) {
    sorted[k].uid = ++uid
  }
  let dot = '# State graph:\ndigraph G {\n'
  for (let k = sorted.length; k--;) {
    const state = sorted[k]
    const stateName = `${state.name} (${state.uid})`
    if (state.inputsChanged) {
      dot += `    "${stateName}" [color=red]\n`
    }
    const inputs = state.inputs
    for (let i = inputs.length; i--;) {
      const input = inputs[i]
      const status = input.status
      const producer = input.producer
      const producerName = producer ? `${producer.name} (${producer.uid})` : `None (${++uid})`
      if (!producer) {
        dot += `    "${producerName}" [color=grey]\n`
      }
      dot += `    "${producerName}" -> "${stateName}"`
      if (inputUnchanged !== status) {
        dot += ` [color=${inputChanged === status ? 'red' : 'orange'}]`
      }
      dot += '\n'
    }
    state.outputInputsMarked = 0
  }
  dot += '}\n'
  return dot
}

export class StateInputTraits {
  static send (input, value) { input.value = value }
  static reset (input) { input.value = null }
  static consume (input) { this.reset(input) }
  static attach (input) { this.reset(input) }
  static detach (input) { this.reset(input) }
}

// `StateInput` is a mechanism `State` can use to get fine grained information
// about why it was invalidated. `StateInput` is owned by exactly one `State`,
// specified as `consumer` in `StateInput` constructor (required). It can be
// connected (optional) to exactly one output state (`producer` constructor
// parameter).
export class StateInput {
  constructor (consumer, producer, traits) {
    this.consumer = consumer
    this.producer = producer
    this.traits = traits
    // Initial status values is a bit tricky. Obviosly, `inputUnchanged` will not work,
    // because then newly added states will not be collected during update. However,
    // both `inputPending` and `inputChanged` will work to some extent, but with few
    // interesting differences. `inputPending` is good, because it's similar to what
    // happens when state is dirtied. E.g. if input has associated traits, `reset()`
    // or `send()` will be called as expected. With `inputChanged`, `reset()` will NOT
    // be called (because when input is in `inputChanged` it means somebody already
    // did `send()` or `reset()` on it explicitly). But using `inputPending` will cause
    // `changed` property to return `false` for newly created inputs. It's not a problem
    // when input is connected to some producer, then when producer is validated its
    // output inputs will be marked as `inputChanged` and in consumer action callback
    // `changed` property will return correct value. However, if input is dangling and
    // has no producer, then nobody will set its status to `inputChanged`. Thus consumer
    // action callback will observer input's status as `inputPending` and `changed` will
    // return `false`. Which is not totally incorrect, since nobody called `send()` or
    // `cancel()` on this input, so its status is undefined (i.e. pending).
    this.status = inputPending
  }
  get changed () {
    // Status `pending` is not considered `changed` here.
    return inputChanged === this.status
  }
  send (value) {
    inputPerformSend(this, value)
    inputSetDirty(this)
  }
  cancel () {
    // Regardles of current status, sets it to `unchanged` and propagates
    // `unchanged` status downstream for all `pending` output inputs.
    inputSetClean(this)
  }
  attach (producer) {
    this.producer = producer
    inputSetDirty(this)
    inputAttachProducer(this, producer)
  }
  detach () {
    inputDetachProducer(this, this.producer)
    inputSetClean(this)
    this.producer = null
  }
}

export class State {
  constructor (name, action) {
    this.name = name
    this.action = action
    this.inputs = []
    this.inputsChanged = 1
    this.outputInputs = []
    this.outputInputsMarked = 0
  }
  update () {
    if (this.inputsChanged) {
      statesUpdate([this])
    }
  }
  // Adds a new input and connects it to output of `producer` state (optional,
  // if not specified created input will not be connected to any state).
  input (producer, traits) {
    const input = new StateInput(this, producer, traits)
    this.inputs.push(input)
    if (!this.inputsChanged++) {
      outputSetDirty(this)
    }
    if (producer) {
      inputAttachProducer(input, producer)
    }
    return input
  }
  remove (input) {
    if (inputUnchanged !== input.status && !--this.inputsChanged) {
      outputSetClean(this)
    }
    const inputs = this.inputs
    for (let i = inputs.length; i--;) {
      if (inputs[i] === input) {
        inputs.splice(i, 1)
        break
      }
    }
  }
  get dirty () {
    return this.inputsChanged
  }
  // Invalidates state directly, regardless of status of its inputs. Invalidated
  // state can only by validated during state graph update phase.
  invalidate () {
    if (!this.inputsChanged++) {
      outputSetDirty(this)
    }
  }
  // Updates state output. Calls `callback` for each `unchanged` output input as
  // `callback(value, output)`.
  // Must only be used
  send (value) {
    if (this.inputsChanged) {
      // FIXME: Here we can assert that producers of all (changed?) inputs must be clean already.
      stateValidate(this)
    }
    outputSend(this, value)
  }
  cancel () {
    if (this.inputsChanged) {
      stateValidate(this)
    }
    outputSetClean(this)
  }
  static update (...states) { statesUpdate(states) }
  static plot (...states) { return statesPlot(states) }
}
