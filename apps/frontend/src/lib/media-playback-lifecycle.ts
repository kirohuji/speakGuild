/**
 * Tracks every transient HTML audio/video element, including `new Audio()`
 * instances that are not attached to the DOM.  Those detached instances are
 * otherwise invisible to a document query when a React route unmounts.
 */
const activeTransientMedia = new Set<HTMLMediaElement>()
const trackedMedia = new WeakSet<HTMLMediaElement>()
let installed = false

function isPersistent(media: HTMLMediaElement) {
  return media.hasAttribute('data-persistent-media')
}

function untrack(media: HTMLMediaElement) {
  activeTransientMedia.delete(media)
}

function track(media: HTMLMediaElement) {
  if (isPersistent(media)) return
  activeTransientMedia.add(media)
  if (trackedMedia.has(media)) return

  trackedMedia.add(media)
  media.addEventListener('pause', () => untrack(media))
  media.addEventListener('ended', () => untrack(media))
  media.addEventListener('error', () => untrack(media))
}

/** Install once at app start so all existing playback call sites are covered. */
export function installMediaPlaybackTracking() {
  if (installed || typeof window === 'undefined' || typeof HTMLMediaElement === 'undefined') return
  installed = true

  const originalPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function playWithLifecycle(...args: Parameters<HTMLMediaElement['play']>) {
    track(this)
    return originalPlay.apply(this, args)
  }
}

/** Interrupt foreground media without affecting explicitly persistent media such as BGM. */
export function stopTransientMediaPlayback() {
  activeTransientMedia.forEach((media) => {
    media.pause()
    try {
      media.currentTime = 0
    } catch {
      // A stream without a seekable timeline can still be paused.
    }
  })
  activeTransientMedia.clear()
}
