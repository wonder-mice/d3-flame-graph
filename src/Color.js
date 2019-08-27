function hsv2rbg (h, s, v) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r, g, b
  switch (i % 6) {
  case 0: r = v; g = t; b = p; break
  case 1: r = q; g = v; b = p; break
  case 2: r = p; g = v; b = t; break
  case 3: r = p; g = q; b = v; break
  case 4: r = t; g = p; b = v; break
  case 5: r = v; g = p; b = q; break
  }
  return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')'
}

export function deltaColor (delta, maxDelta) {
  const s = delta && maxDelta ? Math.abs(delta / maxDelta) : 0
  // Use of HSL colorspace would be more appropriate, since its saturation better models
  // kind of effect we are after. However, HSV colorspace is computationaly simpler and
  // we can emulate desired effect by adjusting brightness (value) based on `s`.
  // return hsv2rbg(0 <= delta ? 0 : 0.67, s, 0.7 + 0.3 * s)
  // FIXME: Looks like CSS knows has built-in support for HSL colors, need to try it!
  return hsv2rbg(0 <= delta ? 0 : 0.28, s, 0.8 + 0.2 * s)
}

export function nameColor (name) {
  // Name based color supposed to give similar colors for similar names.
  let tone = 0
  if (name) {
    const maxLength = 6
    const n = maxLength < name.length ? maxLength : name.length
    const mod = 10
    let range = 0
    for (let i = 0, weight = 1; i < n; ++i, weight *= 0.7) {
      tone += weight * (name.charCodeAt(i) % mod)
      range += weight * (mod - 1)
    }
    if (range > 0) {
      tone /= range
    }
  }
  const r = 200 + Math.round(55 * tone)
  const g = Math.round(230 * (1 - tone))
  const b = Math.round(55 * (1 - tone))
  return 'rgb(' + r + ',' + g + ',' + b + ')'
}
