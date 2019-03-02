const test = require('tape')
const flamegraph = require('../dist/flamegraph')

function makeHierarchy(xs) {
    const roots = []
    for (let i = 0, n = xs.length; i < n; ++i) {
        const x = xs[i]
        const path = x.path.split("/")
        let children = roots
        for (let j = 0, m = path.length - 1; j < m; ++j) {
            const name = path[j]
            const child = children.find((child) => child.n === name)
            children = child.c || (child.c = [])
        }
        x.n = path[path.length - 1]
        children.push(x)
    }
    return roots
}

const hierarchy = makeHierarchy([
    {path: 'A', recursive: false},
    {path: 'A/B', recursive: false},
    {path: 'A/B/C', recursive: false},
    {path: 'A/B/C/C', recursive: true},
    {path: 'A/C', recursive: false},
    {path: 'B', recursive: false},
    {path: 'B/A', recursive: false},
    {path: 'B/B', recursive: false},
    {path: 'B/C', recursive: false},
])

test('ItemTraits.collectSiblings() default implementation correctness', function (t) {
    const traits = new flamegraph.ItemTraits()
    const siblings = traits.collectSiblings(hierarchy)
    t.deepEqual(siblings.map((item, index, array) => item.path).sort(),
                ['A/B', 'A/C', 'B/A', 'B/B', 'B/C'].sort())
    t.end()
})

test('ItemTraits.preorderDFS() default implementation correctness', function (t) {
  const expectations = [
      {name: 'A', level: 0, hasChildren: true},
      {name: 'B', level: 1, hasChildren: true},
      {name: 'C', level: 2, hasChildren: true},
      {name: 'C', level: 3, hasChildren: false},
      {name: 'C', level: 1, hasChildren: false},
  ]
  let k = 0
  const traits = new flamegraph.ItemTraits()
  traits.preorderDFS([hierarchy[0]], function (item, level, hasChildren) {
      const expected = expectations[k++]
      t.equal(item.n, expected.name, 'name')
      t.equal(level, expected.level, 'level')
      t.equal(!!hasChildren, expected.hasChildren, 'hasChildren')
  })
  t.end()
})