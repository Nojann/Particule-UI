import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import AtomAnimation from '../AtomAnimation.vue'

describe('AtomAnimation', () => {
  it('starts with one particle per orbit', () => {
    const wrapper = mount(AtomAnimation)

    expect(wrapper.findAll('.emit')).toHaveLength(3)
    expect(wrapper.attributes('aria-label')).toBe('Ajouter une particule')
  })

  it('emits a particle on click', async () => {
    const wrapper = mount(AtomAnimation)

    await wrapper.trigger('click')

    expect(wrapper.findAll('.emit')).toHaveLength(4)
    expect(wrapper.text()).toContain('4 particules')
  })

  it('replaces the oldest particle once full', async () => {
    const wrapper = mount(AtomAnimation)

    for (let i = 3; i < 9; i++) await wrapper.trigger('click')
    expect(wrapper.findAll('.emit')).toHaveLength(9)

    await wrapper.trigger('click')
    expect(wrapper.findAll('.emit')).toHaveLength(9)
    expect(wrapper.text()).toContain('9 particules')
  })
})
