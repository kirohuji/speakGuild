const INTERNAL_PACKAGE_LOCATION = /^(?:story|nqtr):[a-z0-9_-]+$/i

/** Internal package references belong to routing/storage and must not reach UI copy. */
export function displayLearningUnitLocation(
  location: string | null | undefined,
  fallback: string,
) {
  const value = location?.trim()
  return value && !INTERNAL_PACKAGE_LOCATION.test(value) ? value : fallback
}
