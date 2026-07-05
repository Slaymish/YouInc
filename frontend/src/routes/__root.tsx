/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import appCss from '~/styles/app.css?url'
import { jsonLdGraph, jsonLdScript } from '~/lib/seo'
import { SITE_URL } from '~/lib/sitemap'

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
      logo: `${SITE_URL}/HB_logo.svg`,
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
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'YouInc Ledger',
      },
      {
        name: 'description',
        content: 'Local-first executive dashboard for the YouInc personal ERP ledger.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
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
