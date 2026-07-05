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
      // Social share defaults (per-page head()s can override title/description).
      { property: 'og:site_name', content: 'YouInc' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'YouInc — Run yourself like a company.' },
      {
        property: 'og:description',
        content: 'Local-first executive dashboard for the YouInc personal ERP ledger.',
      },
      { property: 'og:image', content: `${SITE_URL}/marketing/og-cover.png` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'YouInc — Run yourself like a company.' },
      {
        name: 'twitter:description',
        content: 'Local-first executive dashboard for the YouInc personal ERP ledger.',
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
