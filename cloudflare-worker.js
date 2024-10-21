/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    const allowedOrigin = '*'
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }
  
    const url = new URL(request.url)
    let response
  
    try {
      // Handle various API requests
      if (url.pathname === '/verify') {
        response = await fetch('http://xenblocks.io/verify', {
          method: request.method,
          headers: request.headers,
          body: request.body
        })
      } else if (url.pathname === '/lastblock') {
        response = await fetch('http://xenblocks.io:4445/getblocks/lastblock')
      } else if (url.pathname === '/send_pow') {
        response = await fetch('http://xenblocks.io:4446/send_pow', {
          method: request.method,
          headers: request.headers,
          body: request.body
        })
      } else if (url.pathname === '/difficulty') {
        response = await fetch('http://xenblocks.io/difficulty')
      } else {
        return new Response('Not Found', { 
          status: 404,
          headers: corsHeaders
        })
      }
  
      // Clone the response and add CORS headers
      const modifiedResponse = new Response(response.body, response)
      Object.keys(corsHeaders).forEach(key => {
        modifiedResponse.headers.set(key, corsHeaders[key])
      })
  
      return modifiedResponse
  
    } catch (error) {
      // Handle any network errors
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: corsHeaders
      })
    }
  }