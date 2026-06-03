import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MapPin, Lock, ChevronRight, Home, Coffee, Building, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { exploreApi, type GameMap, type LocationPin } from '../api/explore-api'
import { cn } from '@/lib/cn'

const LOCATION_ICONS: Record<string, typeof MapPin> = {
  '宿舍大厅': Home, '咖啡店': Coffee, '图书馆': Building, '教室': GraduationCap,
}

export function ExploreMapPage() {
  const { t } = useTranslation()
  const [maps, setMaps] = useState<GameMap[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMap, setSelectedMap] = useState<GameMap | null>(null)

  useEffect(() => {
    exploreApi.getMaps()
      .then((data) => {
        const arr = Array.isArray(data) ? data : []
        setMaps(arr)
        if (arr.length > 0) setSelectedMap(arr[0])
      })
      .catch(() => setMaps([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  if (maps.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('exploreMap.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('exploreMap.subtitleNoMap')}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MapPin className="size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{t('exploreMap.comingSoon')}</p>
            <p className="text-sm text-muted-foreground">{t('exploreMap.unlockHint')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('exploreMap.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('exploreMap.subtitle')}</p>
      </div>

      {/* Map selector */}
      {maps.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {maps.map((m) => (
            <Badge
              key={m.id}
              variant={selectedMap?.id === m.id ? 'default' : 'outline'}
              className="cursor-pointer shrink-0"
              onClick={() => setSelectedMap(m)}
            >
              {m.displayName}
            </Badge>
          ))}
        </div>
      )}

      {/* Map area */}
      {selectedMap && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>{selectedMap.displayName}</span>
              {!selectedMap.unlocked && (
                <Badge variant="outline" className="gap-1 text-amber-500">
                  <Lock className="size-3" /> {t('exploreMap.preview')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mini-map visualization */}
            <div
              className="relative mb-4 h-64 rounded-xl border border-border bg-muted/30"
              style={
                selectedMap.thumbnailUrl
                  ? { backgroundImage: `url(${selectedMap.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a27 40%, #5a4a2d 70%, #3a3a5c 100%)' }
              }
            >
              {/* Location pins */}
              {selectedMap.locations.map((loc) => (
                <LocationPinOnMap key={loc.id} location={loc} />
              ))}

              {/* Map label if no background */}
              {!selectedMap.thumbnailUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm font-medium text-white/60">📍 {selectedMap.displayName}</p>
                </div>
              )}
            </div>

            {/* Location list */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('exploreMap.locations')}</p>
              {selectedMap.locations.map((loc, idx) => {
                const Icon = LOCATION_ICONS[loc.name] ?? MapPin
                return (
                  <Link
                    key={loc.id}
                    to={`/explore/${loc.id}`}
                    {...(idx === 0 ? { 'data-spotlight': 'first-unit' } : {})}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                      loc.isPreview
                        ? 'border-border bg-muted/30'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{loc.displayName}</p>
                        {loc.isPreview && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="size-2.5" /> 需解锁
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Absolutely positioned location pin on the mini-map */
function LocationPinOnMap({ location }: { location: LocationPin }) {
  const left = ((location.posX || 50) / 100) * 100
  const top = ((location.posY || 50) / 100) * 100
  const Icon = LOCATION_ICONS[location.name] ?? MapPin

  return (
    <Link
      to={`/explore/${location.id}`}
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div className={cn(
        'flex size-8 items-center justify-center rounded-full shadow-lg',
        location.isPreview ? 'bg-muted-foreground/60' : 'bg-primary/80',
      )}>
        <Icon className="size-4 text-white" />
      </div>
      <p className="mt-1 text-center text-[10px] font-medium text-white drop-shadow-md">
        {location.displayName}
      </p>
    </Link>
  )
}
