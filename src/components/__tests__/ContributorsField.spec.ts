import { describe, it, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useForm } from 'vee-validate'

import ContributorsField from '../ContributorsField.vue'
import type { Contributor } from '@/lib/contributors'

function mountField(authors: Contributor[]) {
  let form!: ReturnType<typeof useForm<{ authors: Contributor[] }>>
  const Host = defineComponent({
    setup() {
      form = useForm({ initialValues: { authors } })
      return () =>
        h(ContributorsField, { name: 'authors', legend: 'Auteurs', addLabel: 'Ajouter un auteur' })
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, values: () => form.values.authors }
}

const feynman: Contributor = { kind: 'person', family: 'Feynman', given: 'Richard' }
const leighton: Contributor = { kind: 'person', family: 'Leighton', given: 'Robert' }

describe('ContributorsField', () => {
  it('adds and removes contributors', async () => {
    const { wrapper, values } = mountField([feynman])

    const add = wrapper.findAll('button').find((b) => b.text() === 'Ajouter un auteur')!
    await add.trigger('click')
    expect(values()).toEqual([feynman, { kind: 'person', family: '', given: '' }])

    await wrapper.findAll('button[aria-label="Retirer"]')[0]!.trigger('click')
    await flushPromises()
    expect(values()).toEqual([{ kind: 'person', family: '', given: '' }])
  })

  it('reorders contributors, and disables moves past the ends', async () => {
    const { wrapper, values } = mountField([feynman, leighton])
    const up = wrapper.findAll('button[aria-label="Monter"]')
    const down = wrapper.findAll('button[aria-label="Descendre"]')

    expect(up[0]!.attributes('disabled')).toBeDefined()
    expect(down[1]!.attributes('disabled')).toBeDefined()

    await up[1]!.trigger('click')
    expect(values()).toEqual([leighton, feynman])
  })

  it('shows no given names field for a group', () => {
    const { wrapper } = mountField([{ kind: 'group', family: 'CNRS', given: '' }])

    expect(wrapper.find('input[placeholder="Prénoms"]').exists()).toBe(false)
    expect(wrapper.find('input[placeholder="Nom du groupe"]').exists()).toBe(true)
  })
})
