import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = 3001
serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}/api`)
})
