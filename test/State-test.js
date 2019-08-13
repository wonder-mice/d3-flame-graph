const test = require('tape')
const flamegraph = require('../dist/flamegraph')

test('State.invalidate() simple transitivity', function (t) {
    const a = new flamegraph.State('A')
    const b = new flamegraph.State('B')
    b.input(a)
    flamegraph.State.update(b)
    t.notOk(a.dirty, 'a is clean')
    t.notOk(b.dirty, 'b is clean')
    a.invalidate()
    t.ok(a.dirty, 'a is dirty')
    t.ok(b.dirty, 'b is dirty')
    t.end()
})

test('State.update() handles inputs without producer', function (t) {
    const a = new flamegraph.State('A')
    const ai = a.input()
    t.ok(a.dirty, 'a is dirty')
    flamegraph.State.update(a)
    t.notOk(a.dirty, 'a is clean')
    t.end()
})