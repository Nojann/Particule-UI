import { test, expect, type Page } from '@playwright/test'

import { feynman1948, mockApi } from './mockApi'

const DOI = '10.1103/RevModPhys.20.367'

const screens = [
  {
    name: 'on a desktop',
    viewport: { width: 1280, height: 800 },
    openSidebar: async () => {},
  },
  {
    name: 'on a phone',
    viewport: { width: 375, height: 740 },
    // The sidebar is a sheet behind its trigger
    openSidebar: (page: Page) => page.getByRole('button', { name: 'Toggle Sidebar' }).click(),
  },
]

for (const { name, viewport, openSidebar } of screens) {
  test.describe(name, () => {
    test.use({ viewport })

    test('adds a source from its DOI, fixes it, copies and deletes it', async ({ page }) => {
      const api = await mockApi(page, { dois: { [DOI]: feynman1948 } })
      await page.goto('/app')

      // Sidebar → Sources
      await openSidebar(page)
      await page.getByRole('link', { name: 'Sources' }).click()
      await expect(page).toHaveURL(/\/app\/sources$/)
      await expect(page).toHaveTitle('Sources · Particule')

      // Paste a doi.org link: the source is found and added right away
      await page.getByRole('button', { name: 'Ajouter une source' }).click()
      await expect(page).toHaveURL(/\/app\/sources\?new$/)
      await expect(page.getByRole('radio', { name: 'Académique' })).toBeChecked()
      await page.getByLabel('DOI ou lien doi.org').fill(`https://doi.org/${DOI}`)
      await page.getByLabel('DOI ou lien doi.org').press('Enter')

      const reference = page.getByTestId('apa-reference')
      await expect(reference).toContainText('Feynman, R. P. (1948).')
      await expect(reference).toContainText(
        'Space-Time Approach to Non-Relativistic Quantum Mechanics',
      )
      await expect(reference.locator('em').first()).toHaveText(/Reviews of Modern Physics/)
      expect(api.calls).toContain(`DOI ${DOI}`)

      // No click needed: its editor opens with the details folded
      await expect(page).toHaveURL(/\/app\/sources\/s1$/)
      expect(api.calls.filter((c) => c === 'POST /sources/')).toHaveLength(1)
      await expect(page.getByText('Enregistré')).toBeVisible()
      expect(api.sources[0]).toMatchObject({
        type: 'journal_article',
        authors: 'Feynman, R. P.',
        doi: DOI,
        year: 1948,
      })
      const details = page.getByRole('button', { name: 'Corriger les informations' })
      await expect(details).toHaveAttribute('aria-expanded', 'false')

      // Fix the title to APA's sentence case
      await details.click()
      await page
        .getByLabel('Titre', { exact: true })
        .fill('Space-time approach to non-relativistic quantum mechanics')
      await expect(reference).toContainText(
        'Space-time approach to non-relativistic quantum mechanics',
      )
      await expect(page.getByText('Enregistré', { exact: true })).toBeVisible()
      expect(api.sources[0]).toMatchObject({
        title: 'Space-time approach to non-relativistic quantum mechanics',
      })

      // Copy the reference
      await page.getByRole('button', { name: 'Copier la référence' }).click()
      await expect(page.getByText('Référence copiée')).toBeAttached()

      // Delete it
      await page.getByRole('button', { name: 'Actions sur la source' }).click()
      await page.getByRole('menuitem', { name: 'Supprimer' }).click()
      await expect(
        page.getByText('Les particules qui citent cette source seront conservées, sans source.'),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
      await expect(page.getByText('Vous n’avez encore aucune source.')).toBeVisible()
      expect(api.sources).toHaveLength(0)
    })
  })
}

test('says when a DOI does not exist, and leads to the form', async ({ page }) => {
  await mockApi(page)
  await page.goto('/app/sources?new')

  await page.getByLabel('DOI ou lien doi.org').fill('10.9999/inconnu')
  await page.getByLabel('DOI ou lien doi.org').press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Ce DOI est introuvable.')

  await page.getByRole('button', { name: 'Saisir la référence à la main' }).click()
  await expect(page).toHaveURL(/\/app\/sources\?new&manual$/)
  await expect(page.getByLabel('Titre', { exact: true })).toBeFocused()
})

test('adds an other source with a title, a link and a note', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/app/sources?new')

  await page.getByRole('radio', { name: 'Autre' }).click()
  await page.getByLabel('Titre').fill('Feynman on the scientific method')
  await page.getByLabel('Lien').fill('https://www.youtube.com/watch?v=EYPapE-3FRw')
  await page.getByLabel('Note').fill('Deviner, calculer les conséquences, comparer.')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

  await expect(page).toHaveURL(/\/app\/sources\/s1$/)
  expect(api.sources[0]).toMatchObject({
    type: 'other',
    title: 'Feynman on the scientific method',
    authors: null,
    url: 'https://www.youtube.com/watch?v=EYPapE-3FRw',
    note: 'Deviner, calculer les conséquences, comparer.',
  })

  // No APA for it: the list shows its title and the link's site
  const row = page.getByRole('link', { name: /Feynman on the scientific method/ })
  await expect(row).toContainText('youtube.com')
  await expect(row).toContainText('Autre')
  await expect(page.getByTestId('apa-reference')).toHaveCount(0)
})

test('types a reference without a DOI by hand', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/app/sources?new')
  await page.getByRole('button', { name: 'Saisir la référence à la main' }).click()

  // A book with two authors; it starts with none, since only the title is required
  await page.getByLabel('Titre', { exact: true }).fill('The Feynman lectures on physics')
  await page.getByRole('button', { name: 'Ajouter un auteur' }).click()
  await page.getByPlaceholder('Nom', { exact: true }).fill('Feynman')
  await page.getByPlaceholder('Prénoms').fill('Richard P.')
  await page.getByRole('button', { name: 'Ajouter un auteur' }).click()
  await page.getByPlaceholder('Nom', { exact: true }).nth(1).fill('Leighton')
  await page.getByPlaceholder('Prénoms').nth(1).fill('Robert')
  await page.getByLabel('Année').fill('1964')
  await page.getByLabel('Éditeur').fill('Addison-Wesley')

  const reference = page.getByTestId('apa-reference')
  await expect(reference).toHaveText(
    'Feynman, R. P., & Leighton, R. (1964). The Feynman lectures on physics. Addison-Wesley.',
  )
  await expect(reference.locator('em')).toHaveText('The Feynman lectures on physics')

  // Saved without a button: the URL now holds the new source's id
  await expect(page).toHaveURL(/\/app\/sources\/s1$/)
  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible()
  expect(api.calls.filter((c) => c === 'POST /sources/')).toHaveLength(1)

  // A journal article without its journal is saved, and the notice asks for it
  await page.getByRole('combobox', { name: 'Type de source' }).click()
  await page.getByRole('option', { name: 'Article de revue' }).click()
  const notice = page.getByRole('status').filter({ hasText: 'Référence incomplète' })
  await expect(notice.getByRole('listitem')).toHaveText(['Revue'])
  await expect
    .poll(() => api.sources[0])
    .toMatchObject({ type: 'journal_article', container_title: null })
  await page.getByLabel('Revue').fill('Physics Today')
  await page.getByLabel('Volume').fill('20')
  await expect(reference).toHaveText(
    'Feynman, R. P., & Leighton, R. (1964). The Feynman lectures on physics. Physics Today, 20.',
  )
  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible()
  expect(api.sources[0]).toMatchObject({
    type: 'journal_article',
    container_title: 'Physics Today',
    volume: '20',
    publisher: null,
  })
  await expect(notice).toHaveCount(0)
})

test('adds a DOI whose metadata lacks the authors, and completes it later', async ({ page }) => {
  const api = await mockApi(page, { dois: { [DOI]: { ...feynman1948, author: [] } } })
  await page.goto('/app/sources?new')

  await page.getByLabel('DOI ou lien doi.org').fill(DOI)
  await page.getByLabel('DOI ou lien doi.org').press('Enter')

  // Added all the same: the editor opens, saved, and says what the reference lacks
  await expect(page).toHaveURL(/\/app\/sources\/s1$/)
  expect(api.sources[0]).toMatchObject({ doi: DOI, authors: null })
  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible()
  const notice = page.getByRole('status').filter({ hasText: 'Référence incomplète' })
  await expect(notice.getByRole('listitem')).toHaveText(['Auteurs'])

  // The details are open: add the author, and the notice goes
  await page.getByRole('button', { name: 'Ajouter un auteur' }).click()
  await page.getByPlaceholder('Nom', { exact: true }).fill('Feynman')
  await page.getByPlaceholder('Prénoms').fill('R. P.')
  await expect(notice).toHaveCount(0)
  await expect.poll(() => api.sources[0]).toMatchObject({ authors: 'Feynman, R. P.' })
})
