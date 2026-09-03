import { useEffect } from 'react'

/**
 * Reload a tab that is running a bundle the site no longer serves.
 *
 * A single-page app only fetches `index.html` on a real navigation, so a tab
 * left open across a deploy keeps running the JavaScript it booted with — for
 * days, if nobody closes it. Everyone who kept the game open was therefore
 * playing a different client from everyone who had opened it since, and the
 * mismatches were invisible until they weren't: rooms whose new visual modes
 * rendered for the host and for nobody else, and a start-of-game route fight
 * between two screens that only one of the two bundles knew how to stop.
 *
 * The check is the hashed entry script in `index.html`. Vite renames it on every
 * build that changes anything, so "the file I booted with is no longer the one
 * being served" is exactly "there has been a deploy".
 */

/** How often to ask the host whether the entry bundle has changed under us. */
const POLL_MS = 4 * 60_000

/**
 * Never reload twice for the same target build. If a reload doesn't actually
 * land us on it — a CDN still serving two versions, a proxy rewriting the
 * document — the tab has to degrade to "slightly stale" rather than to a reload
 * loop, so the build we already tried is remembered by name.
 */
const GUARD_KEY = 'hg:build-reload-target'

/** `/assets/index-a1b2c3.js` out of a document, whatever order its attrs are in. */
function entryFrom(html: string): string | null {
  return html.match(/src="([^"]*\/assets\/[^"]+\.js)"/i)?.[1] ?? null
}

export function useLatestBuild() {
  useEffect(() => {
    const booted = document
      .querySelector<HTMLScriptElement>('script[src*="/assets/"]')
      ?.getAttribute('src')
    // The dev server serves unhashed modules — nothing to compare, nothing to do.
    if (!booted) return

    let stopped = false

    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        // Cache-busted twice over: the header for well-behaved caches, the query
        // for the ones that ignore it.
        let res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) res = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok || stopped) return

        const latest = entryFrom(await res.text())
        if (!latest || latest === booted) return

        // Private mode throws on both calls; a tab that can't remember what it
        // tried doesn't get to try, because it could never stop.
        if (sessionStorage.getItem(GUARD_KEY) === latest) return
        sessionStorage.setItem(GUARD_KEY, latest)

        window.location.reload()
      } catch {
        /* offline, host unreachable, or no storage — try again next time */
      }
    }

    const id = window.setInterval(check, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    check()

    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
