# Tasks

- [ ] Don't allow suggestions in Filter in Flatten list
- [ ] Compare boot args
- [ ] Implement all selection buttons
- [ ] Deck must have an option for setting minimum node width
- [ ] Implement clipboard copy
- [ ] Implement search
- [ ] Implement state saves
- [ ] Set node cursor to arrow (default) or pointer, shouldn't be selectable
- [ ] Use string table for node names
- [ ] Name tab "Selection" only when not everything is selected
- [ ] Don't add fake "All" node in ardiff python
- [ ] Collapse recursion
- [ ] [Layout] Computed height is incorrect (off by 1)
- [ ] [NTBF] Don't use 70% as initial split view proportions, since it results in fractional sizes

# Notes

## Initial state of `StateInput.status`

It's not settled that setting initial `status` of `StateInput` to `pending` is better than `changed`. Initially, `changed` was used, because newly created inputs need to be processed by their states. However, having initial value of `changed` means that certain `StateInputTraits` callbacks will not be called (specifically `reset()`). To allow use of `StateInputTraits` as a mediator between two states (e.g. to send `width` value from producer to consumer), initial value of `StateInput.status` was (artificially?) changed to `pending`, so those callbacks are called for newly created inputs. Following helper was added and then removed to facilitate such use of `StateInput`.

```javascript
// Returns `StateInputTraits`-like object that can be used to transfer information
// from one `State` to another via `StateInput`. Example:
//   consumer.state.input(provider.state, StateInput.updater(() => { consumer.value = provider.value }))
static updater (updater) {
  return {send: updater, reset: updater}
}
```

Later it was decided that it's better to use explicit extra `State` object for such purposes.