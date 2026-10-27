import { test, expect } from '@playwright/test'

import { emptySource, feynman1948, mockApi } from './mockApi'

test('edits the cited source from the particule', async ({ page }) => {
  const api = await mockApi(page, {
    sources: [
      {
        ...emptySource,
        id: 's1',
        owner_id: 'u1',
        type: 'book',
        title: 'QED',
        authors: 'Feynmann, Richard',
        year: 1985,
      },
    ],
    particules: [
      {
        id: 'p1',
        knowledge_base_id: 'kb1',
        title: 'Électrodynamique',
        permalink: 'electrodynamique',
        content: 'Mes notes.',
        origins: '',
        source_id: 's1',
      },
    ],
  })

  await page.goto('/app/kb1/electrodynamique')
  const list = page.getByRole('region', { name: 'Particules' })
  await expect(list.getByText('Feynmann, 1985')).toBeVisible()

  // Fix the author's name in the sheet
  await page.getByRole('button', { name: 'Modifier la source' }).click()
  const sheet = page.getByRole('dialog', { name: 'Modifier la source' })
  await expect(sheet.getByTestId('apa-reference')).toHaveText('Feynmann, R. (1985). QED.')
  await sheet.getByRole('button', { name: 'Corriger les informations' }).click()
  await sheet.getByPlaceholder('Nom', { exact: true }).fill('Feynman')
  await expect(sheet.getByTestId('apa-reference')).toHaveText('Feynman, R. (1985). QED.')
  await expect(sheet.getByText('Enregistré', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // Focus returns to the button, the labels follow, and the particule was not touched
  await expect(page.getByRole('button', { name: 'Modifier la source' })).toBeFocused()
  await expect(list.getByText('Feynman, 1985')).toBeVisible()
  await expect(page.getByRole('combobox').first()).toContainText('Feynman, 1985')
  expect(api.sources[0]).toMatchObject({ authors: 'Feynman, Richard' })
  expect(api.calls.some((c) => c.startsWith('PATCH /knowledge-bases/'))).toBe(false)
})

const particule = {
  id: 'p1',
  knowledge_base_id: 'kb1',
  title: 'Intégrales de chemin',
  permalink: 'integrales-de-chemin',
  content: 'Mes notes.',
  origins: '',
  source_id: null,
}

test('imports a DOI from the picker and cites it', async ({ page }) => {
  const api = await mockApi(page, {
    particules: [{ ...particule }],
    dois: { '10.1103/RevModPhys.20.367': feynman1948 },
  })
  await page.goto('/app/kb1/integrales-de-chemin')

  const picker = page.getByRole('combobox').first()
  await picker.click()
  await page.keyboard.type('https://doi.org/10.1103/RevModPhys.20.367')
  await page.getByRole('option', { name: /Importer le DOI 10\.1103\/RevModPhys\.20\.367/ }).click()

  await expect(page.getByTestId('apa-reference')).toContainText('Feynman, R. P. (1948).')
  await page.getByRole('button', { name: 'Ajouter et citer' }).click()

  // The popover closes on the cited source, and the particule saves it
  await expect(picker).toContainText('Feynman, 1948')
  await expect(picker).toBeFocused()
  await expect.poll(() => api.particules[0]!.source_id).toBe('s1')
  expect(api.sources[0]).toMatchObject({ type: 'journal_article', doi: '10.1103/RevModPhys.20.367' })
  expect(api.particules[0]!.content).toBe('Mes notes.')
})

test('creates an other source from the picker search and cites it', async ({ page }) => {
  const api = await mockApi(page, { particules: [{ ...particule }] })
  await page.goto('/app/kb1/integrales-de-chemin')

  const picker = page.getByRole('combobox').first()
  await picker.click()
  await page.keyboard.type('Cours de mécanique quantique')
  await page
    .getByRole('option', { name: /Créer « Cours de mécanique quantique » comme autre source/ })
    .click()

  await expect(picker).toContainText('Cours de mécanique quantique')
  await expect.poll(() => api.particules[0]!.source_id).toBe('s1')
  expect(api.sources[0]).toMatchObject({
    type: 'other',
    title: 'Cours de mécanique quantique',
    authors: null,
  })
})
