import type { Page, Route } from '@playwright/test'

/**
 * In-memory stand-in for the Particule API, so the journeys run without a back end.
 * It implements just what the tested screens call, with the server's rules that matter.
 */
export interface MockApi {
  sources: Record<string, unknown>[]
  particules: Record<string, unknown>[]
  /** Requests received, as "METHOD /path" */
  calls: string[]
}

const user = {
  id: 'u1',
  email: 'alice@example.com',
  full_name: 'Alice',
  is_active: true,
  is_superuser: false,
  created_at: '2026-10-21T08:30:00',
}

const knowledgeBase = {
  id: 'kb1',
  name: 'Physique',
  owner_id: 'u1',
  created_at: '2026-10-21T08:30:00',
}

export async function mockApi(
  page: Page,
  initial: Partial<Pick<MockApi, 'sources' | 'particules'>> & {
    /** CSL-JSON that doi.org returns, by DOI */
    dois?: Record<string, unknown>
  } = {},
): Promise<MockApi> {
  const api: MockApi = {
    sources: initial.sources ?? [],
    particules: initial.particules ?? [],
    calls: [],
  }
  let nextId = 1

  await page.addInitScript(() => localStorage.setItem('particule.token', 'tok'))

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^.*\/api\/v1/, '')
    const method = request.method()
    api.calls.push(`${method} ${path}`)
    const json = (status: number, body?: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: body === undefined ? '' : JSON.stringify(body),
      })

    if (path === '/users/me') return json(200, user)
    if (path === '/knowledge-bases/') return json(200, [knowledgeBase])
    if (path === '/knowledge-bases/kb1/particules/') return json(200, api.particules)

    if (path === '/sources/') {
      if (method === 'GET') return json(200, api.sources)
      const source = { ...request.postDataJSON(), id: `s${nextId++}`, owner_id: 'u1' }
      api.sources.push(source)
      return json(201, source)
    }

    const particuleMatch = path.match(/^\/knowledge-bases\/kb1\/particules\/(\w+)$/)
    if (particuleMatch && method === 'PATCH') {
      const particule = api.particules.find((p) => p.id === particuleMatch[1])
      if (!particule) return json(404, { detail: 'Particule not found' })
      Object.assign(particule, request.postDataJSON())
      return json(200, particule)
    }

    const sourceMatch = path.match(/^\/sources\/(\w+)$/)
    if (sourceMatch) {
      const index = api.sources.findIndex((s) => s.id === sourceMatch[1])
      if (index === -1) return json(404, { detail: 'Source not found' })
      if (method === 'PATCH') {
        api.sources[index] = { ...api.sources[index], ...request.postDataJSON() }
        return json(200, api.sources[index])
      }
      if (method === 'DELETE') {
        api.sources.splice(index, 1)
        for (const p of api.particules) if (p.source_id === sourceMatch[1]) p.source_id = null
        return json(204)
      }
    }

    return json(404, { detail: 'Not mocked' })
  })

  // doi.org, the only third party the app calls: CSL-JSON for the known DOIs, 404 otherwise
  await page.route('https://doi.org/**', async (route: Route) => {
    const doi = decodeURIComponent(new URL(route.request().url()).pathname.slice(1))
    api.calls.push(`DOI ${doi}`)
    const item = (initial.dois ?? {})[doi]
    if (!item) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.citationstyles.csl+json',
      body: JSON.stringify(item),
    })
  })

  return api
}

/** As doi.org answers for this DOI, trimmed: Crossref's type names, lowercased DOI */
export const feynman1948 = {
  type: 'journal-article',
  DOI: '10.1103/revmodphys.20.367',
  title: 'Space-Time Approach to Non-Relativistic Quantum Mechanics',
  author: [{ given: 'R. P.', family: 'Feynman' }],
  'container-title': 'Reviews of Modern Physics',
  volume: '20',
  issue: '2',
  page: '367-387',
  publisher: 'American Physical Society (APS)',
  issued: { 'date-parts': [[1948, 4, 1]] },
  URL: 'http://dx.doi.org/10.1103/RevModPhys.20.367',
}

export const emptySource = {
  editors: null,
  container_title: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  url: null,
  published_date: null,
  accessed_date: null,
  year: null,
  edition: null,
  publisher: null,
  note: null,
}
