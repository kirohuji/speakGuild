/** Workers cannot use the Capacitor bridge. Supply verified JSON read by the host. */
export function modelFetch(config: { modelId: string; localModelPath?: string; localJsonFiles?: Record<string, string> }, fallback: typeof fetch): typeof fetch {
  const base = config.localModelPath ? `${config.localModelPath.replace(/\/$/, '')}/${config.modelId}/` : null
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (base && url.startsWith(base)) {
      const file = url.slice(base.length).split('?')[0]
      const json = config.localJsonFiles?.[file]
      if (json !== undefined) return new Response(json, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return fallback(input, init)
  }
}
