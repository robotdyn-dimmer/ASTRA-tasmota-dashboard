import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import type { Plugin } from 'vite'
import type { ServerResponse } from 'http'
import * as nodeHttp from 'http'

/**
 * Dynamic device proxy plugin for Vite dev server.
 *
 * Problem: Chrome 98+ blocks localhost→192.168.x.x requests
 * (Private Network Access) unless the device sends PNA headers.
 * Tasmota 15.x on ESP32 does NOT send them even with SetOption120 1.
 *
 * Solution: Route all device HTTP requests through Vite's Node.js server.
 * URL pattern: /device-proxy/<device-ip>/<path>?<query>
 *   → forwarded as: http://<device-ip>/<path>?<query>
 * Node.js → no CORS/PNA restrictions.
 * ASTRA HTTP client uses this proxy automatically in dev mode.
 */
function deviceProxyPlugin(): Plugin {
  return {
    name: 'device-proxy',
    configureServer(server) {
      // ── SSE proxy: /device-sse/<ip>  →  http://<ip>:81/astra/sse ──────────
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/device-sse\/([^/?]+)$/)
        if (!m) return next()

        const deviceIp = m[1]
        console.log(`[device-sse] SSE proxy → ${deviceIp}:81`)

        // Send SSE headers immediately so EventSource fires onopen right away.
        // Berry's response body (the SSE data) is piped through once Berry
        // accepts the connection and writes its HTTP headers + first data frame.
        res.writeHead(200, {
          'Content-Type':                'text/event-stream',
          'Cache-Control':               'no-cache',
          'Connection':                  'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })
        res.flushHeaders()

        const upstream = nodeHttp.request(
          { hostname: deviceIp, port: 81, path: '/astra/sse', method: 'GET',
            headers: { Accept: 'text/event-stream' } },
          (upRes) => {
            // Berry responded — clear timeout, SSE can flow indefinitely
            upstream.setTimeout(0)
            upRes.pipe(res, { end: true })
            upRes.on('error', () => res.end())
          }
        )
        // If device doesn't respond on port 81 within 5s, close and free the connection
        upstream.setTimeout(5000, () => {
          console.warn(`[device-sse] timeout ${deviceIp}:81 — closing`)
          upstream.destroy()
          res.end()
        })
        upstream.on('error', (err) => {
          console.warn(`[device-sse] error ${deviceIp}: ${err.message}`)
          if (!res.headersSent) res.writeHead(502)
          res.end(`data: {"type":"error"}\n\n`)
        })
        req.on('close', () => upstream.destroy())
        upstream.end()
      })

      server.middlewares.use(async (req, res: ServerResponse, next) => {
        const match = req.url?.match(/^\/device-proxy\/([^/?]+)(\/[^?]*)?(\?.*)?$/)
        if (!match) return next()

        const deviceIp  = match[1]
        const urlPath   = match[2] || '/'
        const query     = match[3] || ''
        const targetUrl = `http://${deviceIp}${urlPath}${query}`

        console.log(`[device-proxy] ${req.method} ${targetUrl}`)

        try {
          // Collect request body for POST/PUT (needed for config save endpoints)
          let reqBody: Buffer | undefined
          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            reqBody = Buffer.concat(chunks)
          }

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 8000)

          const upstream = await fetch(targetUrl, {
            method:  req.method || 'GET',
            signal:  controller.signal,
            headers: {
              Accept: 'application/json',
              ...(reqBody ? { 'Content-Type': req.headers['content-type'] || 'application/json' } : {}),
            },
            body: reqBody,
          })
          clearTimeout(timer)

          const body = await upstream.arrayBuffer()

          res.writeHead(upstream.status, {
            'Content-Type':                         upstream.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin':          '*',
            'Access-Control-Allow-Methods':         'GET, POST, OPTIONS',
            'Access-Control-Allow-Private-Network': 'true',
            'Cache-Control':                        'no-cache',
          })
          res.end(Buffer.from(body))

        } catch (err) {
          const msg      = err instanceof Error ? err.message : String(err)
          const isAbort  = msg.includes('abort') || msg.includes('The operation was aborted')
          const code     = isAbort ? 504 : 502
          const errType  = isAbort ? 'timeout' : 'network'
          console.warn(`[device-proxy] ${errType}: ${targetUrl} — ${msg}`)
          res.writeHead(code, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: errType, detail: msg }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    deviceProxyPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'ASTRA — Tasmota Admin',
        short_name: 'ASTRA',
        description: 'Local IoT dashboard for Tasmota devices',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/cm\?/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tasmota-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
