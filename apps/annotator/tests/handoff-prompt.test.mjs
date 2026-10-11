import assert from 'node:assert/strict'
import test from 'node:test'
import jitiFactory from 'jiti'

const jiti = jitiFactory(import.meta.url)
const { buildHandoffPrompt } = await jiti.import('../src/lib/export.ts')

test('defines Region as a single baked image and Background as text-free', () => {
  const prompt = buildHandoffPrompt('home', 'flutter')

  assert.match(prompt, /RegionCallout: generate the entire indicated region, including its background and all visible text, as one image\./)
  assert.match(prompt, /BackgroundCallout: generate only the clean background, with no text baked into it\./)
})
