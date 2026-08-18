/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import appCss from '~/styles/app.css?url'
import { readAuthCache, writeAuthCache } from '~/lib/authCache'
import { jsonLdGraph, jsonLdScript } from '~/lib/seo'
import { SITE_URL } from '~/lib/sitemap'

// Exposed to every route via beforeLoad context; read it with
// `useRouteContext({ from: "__root__" })`.
const checkSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getServerUser } = await import('~/server/supabaseServer')
  return { authenticated: (await getServerUser()) !== null }
})

// Root-level knowledge-graph anchor: Organization + WebSite nodes that every
// page inherits. Per-page `head()`s add their own WebPage/FAQPage/Product +
// BreadcrumbList nodes on top of this. No `SearchAction` — the site has no
// search feature, and inventing one would be inaccurate structured data.
const ROOT_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'YouInc',
      url: SITE_URL,
      logo: `${SITE_URL}/brand/youinc-icon-512.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'YouInc',
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ]),
)

export const Route = createRootRoute({
  // Resolved once per tab on the client and cached (see ~/lib/authCache for
  // why): this `beforeLoad` re-runs on every navigation, and the session cookie
  // almost never changes. Always fresh on the server.
  beforeLoad: async () => {
    const cached = readAuthCache()
    if (cached !== undefined) return { authenticated: cached }
    const { authenticated } = await checkSession()
    writeAuthCache(authenticated)
    return { authenticated }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'YouInc Ledger',
      },
      {
        name: 'description',
        content: 'A double-entry ledger for your own money, with a dashboard over it. Open source, runs on your machine.',
      },
      // Social share defaults (per-page head()s can override title/description).
      { property: 'og:site_name', content: 'YouInc' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'YouInc — a ledger for your own money' },
      {
        property: 'og:description',
        content: 'A double-entry ledger for your own money, with a dashboard over it. Open source, runs on your machine.',
      },
      { property: 'og:image', content: `${SITE_URL}/marketing/og-cover.png` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'YouInc — a ledger for your own money' },
      {
        name: 'twitter:description',
        content: 'A double-entry ledger for your own money, with a dashboard over it. Open source, runs on your machine.',
      },
      { name: 'twitter:image', content: `${SITE_URL}/marketing/og-cover.png` },
      { name: 'theme-color', content: '#111111' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/brand/youinc-icon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/brand/youinc-icon-32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'icon', href: '/brand/youinc-icon-16.png', sizes: '16x16', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/brand/youinc-icon-180.png', sizes: '180x180' },
    ],
    scripts: [ROOT_JSON_LD],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
