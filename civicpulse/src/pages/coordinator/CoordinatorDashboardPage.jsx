import { useState, useEffect, useMemo } from 'react'
import { 
  Home, ListChecks, Activity, 
  Users as UsersIcon, CheckCircle2, Search,
  AlertTriangle
} from 'lucide-react'
import PageTransition from '../../components/layout/PageTransition'
import NeedDetailDrawer from '../../components/coordinator/NeedDetailDrawer'
import MapPreview from '../../components/location/MapPreview'
import Badge from '../../components/ui/Badge'
import MetricsDashboard from '../../components/coordinator/MetricsDashboard'
import EmptyState from '../../components/ui/EmptyState'
import { useRealtimeNeeds } from '../../hooks/useRealtimeNeeds'
import { useRealtimeVolunteers } from '../../hooks/useRealtimeVolunteers'
import { fetchDashboardMetrics } from '../../adapters/coordinatorAdapter'
import { T } from '../../styles/tokens'
import useIsMobile from '../../hooks/useIsMobile'

const VIEW_MODES = [
  { id: 'overview',     label: 'Overview',     icon: Home },
  { id: 'triage',       label: 'Triage Queue',  icon: ListChecks },
  { id: 'active',       label: 'Active Ops',    icon: Activity },
  { id: 'escalated',    label: 'Escalations',   icon: AlertTriangle },
  { id: 'resolutions',  label: 'Verification',  icon: CheckCircle2 },
]

// ✅ IMPROVED: Better default zoom for operational view
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629, zoom: 5 }
const CITY_VIEW_ZOOM = 12
const COUNTRY_VIEW_ZOOM = 5

export default function CoordinatorDashboardPage() {
  const isMobile = useIsMobile(1024)
  const { needs, loading: needsLoading } = useRealtimeNeeds()
  const { volunteers } = useRealtimeVolunteers()
  const [metrics, setMetrics]           = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [selectedNeed, setSelectedNeed] = useState(null)
  const [activeView, setActiveView]     = useState('overview')
  const [searchQuery, setSearchQuery]   = useState('')
  const [mapCenter, setMapCenter]       = useState(INDIA_CENTER)

  // Metrics polling — independent of needs/volunteers to avoid re-firing on every update
  useEffect(() => {
    let mounted = true

    async function loadMetrics() {
      const m = await fetchDashboardMetrics()
      if (mounted) {
        setMetrics(m)
        setMetricsLoading(false)
      }
    }

    loadMetrics()
    const interval = setInterval(loadMetrics, 30_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, []) // ← intentionally empty: metrics poll independently

  const filteredNeeds = useMemo(() => {
    let result = [...needs]

    if (activeView === 'triage')      result = result.filter(n => n.status === 'pending_review')
    else if (activeView === 'active') result = result.filter(n => ['open', 'matched', 'active'].includes(n.status))
    else if (activeView === 'escalated')   result = result.filter(n => n.escalation_status && n.status !== 'resolved')
    else if (activeView === 'resolutions') result = result.filter(n => n.status === 'resolved' && !n.verified)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(n =>
        n.summary?.toLowerCase().includes(q) ||
        n.tracking_id?.toLowerCase().includes(q)
      )
    }

    return result.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
  }, [needs, activeView, searchQuery])

  // ✅ IMPROVED: Richer marker data with multiple coordinate format support
  const mapMarkers = useMemo(() =>
    filteredNeeds
      .filter(n => {
        // Accept multiple coordinate formats: location_coords, coords, or geo
        const coords = n.location_coords || n.coords || n.geo
        return coords?.lat && coords?.lng
      })
      .map(need => {
        const coords = need.location_coords || need.coords || need.geo
        const isHighPriority = (need.priority_score || 0) > 80
        const isEscalated = !!need.escalation_status && need.escalation_status !== 'waiting'
        const isActive = ['active', 'matched', 'in_progress'].includes(need.status)
        
        return {
          id: need.id,
          lat: coords.lat,
          lng: coords.lng,
          // Visual priority: escalated > high priority > active > default
          color: isEscalated ? T.urgent : isHighPriority ? '#DC2626' : isActive ? T.success : T.primary,
          // Pulsing animation for critical items
          pulsing: isEscalated || isHighPriority,
          // Rich popup content with HTML formatting
          popup: `
            <div style="min-width: 180px; font-family: system-ui;">
              <div style="font-weight: 700; margin-bottom: 4px;">${need.summary || 'Untitled'}</div>
              <div style="font-size: 11px; color: #666; margin-bottom: 6px;">${need.tracking_id || ''}</div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <span style="background: ${need.escalation_status ? '#FEE2E2' : '#EFF6FF'}; color: ${need.escalation_status ? '#DC2626' : '#3B82F6'}; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">
                  ${need.status}
                </span>
                ${need.category ? `<span style="background: #F3F4F6; color: #374151; padding: 2px 8px; border-radius: 10px; font-size: 10px;">${need.category}</span>` : ''}
              </div>
              ${need.priority_score ? `<div style="margin-top: 6px; font-size: 11px;"><strong>Priority:</strong> ${Math.round(need.priority_score)}</div>` : ''}
            </div>
          `,
          // Metadata for potential clustering logic
          meta: {
            status: need.status,
            category: need.category,
            urgency: need.urgency,
            priority: need.priority_score,
          }
        }
      }),
    [filteredNeeds]
  )

  // ✅ IMPROVED: Smoother zoom behavior when selecting a need
  const handleRowClick = (need) => {
    setSelectedNeed(need)
    
    const coords = need.location_coords || need.coords || need.geo
    if (coords?.lat && coords?.lng) {
      // Smooth zoom to city level when selecting a need
      setMapCenter({ 
        lat: coords.lat, 
        lng: coords.lng, 
        zoom: CITY_VIEW_ZOOM 
      })
    } else {
      // Return to country view if no coords
      setMapCenter({ ...INDIA_CENTER, zoom: COUNTRY_VIEW_ZOOM })
    }
  }

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: isMobile ? '16px' : '32px' }}>
        <MetricsDashboard metrics={metrics} loading={metricsLoading} />

        {/* View mode tabs + search bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '16px',
          backgroundColor: T.white, padding: '16px',
          borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: T.shadowSm
        }}>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
            {VIEW_MODES.map(view => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px', borderRadius: T.radiusFull,
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                  transition: 'all 0.2s',
                  backgroundColor: activeView === view.id ? T.primary : 'transparent',
                  color: activeView === view.id ? T.white : T.textSecondary,
                }}
              >
                <view.icon size={16} />
                {view.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: T.textTertiary }} />
            <input
              placeholder="Search operational feed..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px', borderRadius: T.radiusMd,
                border: `1px solid ${T.border}`, fontSize: '14px',
                width: '240px', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 400px',
          gap: '24px', minHeight: '600px',
        }}>
          {/* Live feed table */}
          <div style={{
            backgroundColor: T.white, border: `1px solid ${T.border}`,
            borderRadius: T.radiusLg, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px', borderBottom: `1px solid ${T.border}`,
              backgroundColor: T.surface2, display: 'flex', justifyContent: 'space-between',
            }}>
              <h3 style={{ fontWeight: 800, fontSize: '15px' }}>Live Operational Feed</h3>
              <span style={{ fontSize: '12px', color: T.textTertiary }}>{filteredNeeds.length} items</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {needsLoading ? (
                <div style={{ padding: '24px' }} className="shimmer">Syncing with field...</div>
              ) : filteredNeeds.length === 0 ? (
                <div style={{ padding: '40px' }}>
                  <EmptyState title="No items in this view" />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{
                      textAlign: 'left', color: T.textSecondary,
                      fontSize: '11px', textTransform: 'uppercase',
                      borderBottom: `1px solid ${T.border}`,
                    }}>
                      <th style={{ padding: '12px 16px' }}>Priority</th>
                      <th style={{ padding: '12px 16px' }}>Incident Summary</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNeeds.map(need => (
                      <tr
                        key={need.id}
                        onClick={() => handleRowClick(need)}
                        style={{
                          borderBottom: `1px solid ${T.border}`,
                          cursor: 'pointer', transition: '0.1s',
                          backgroundColor: selectedNeed?.id === need.id ? `${T.primary}08` : 'transparent',
                        }}
                      >
                        <td style={{ padding: '16px', fontWeight: 800, color: (need.priority_score || 0) > 80 ? T.urgent : T.textPrimary }}>
                          {need.priority_score ?? '—'}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 700 }}>{need.summary}</div>
                          <div style={{ fontSize: '12px', color: T.textTertiary }}>{need.tracking_id}</div>
                        </td>
                        <td style={{ padding: '16px' }}><Badge type="status" value={need.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right column: map + audit log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              height: '350px', backgroundColor: T.white,
              border: `1px solid ${T.border}`, borderRadius: T.radiusLg,
              overflow: 'hidden', position: 'relative',
            }}>
              {/* ✅ IMPROVED: Enhanced MapPreview with better props */}
              <MapPreview
                lat={mapCenter.lat}
                lng={mapCenter.lng}
                zoom={mapCenter.zoom}
                markers={mapMarkers}
                selectedId={selectedNeed?.id}
                height="100%"
                // Enhanced UX props
                clusterMarkers={true}              // Enable clustering for dense areas
                showSelectedPulse={true}           // Pulsing ring around selected marker
                popupMaxWidth={220}                // Wider popups for rich content
                onMarkerClick={(marker) => {
                  // Optional: auto-select need when clicking map marker
                  const need = filteredNeeds.find(n => n.id === marker.id)
                  if (need) setSelectedNeed(need)
                }}
              />
            </div>

            <div style={{ flex: 1, backgroundColor: T.surface2, borderRadius: T.radiusLg, padding: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: T.textTertiary, textTransform: 'uppercase', marginBottom: '12px' }}>
                System Audit Log
              </h4>
              <div style={{ fontSize: '12px', color: T.textSecondary, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {needs.slice(0, 5).map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: T.primary, fontWeight: 700 }}>LIVE</span>
                    <span>Request {n.tracking_id} → {n.status}</span>
                  </div>
                ))}
                {needs.length === 0 && (
                  <span style={{ color: T.textTertiary }}>No recent activity</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <NeedDetailDrawer
          isOpen={!!selectedNeed}
          onClose={() => setSelectedNeed(null)}
          need={selectedNeed}
        />
      </div>
    </PageTransition>
  )
}