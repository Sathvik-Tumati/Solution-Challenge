/**
 * TaskMap — shared Leaflet + OpenStreetMap map component for CivicPulse
 *
 * Props (CoordinatorDashboard mode):
 *   markers:    Array<{ id, lat, lng, color, pulsing, popup }>
 *   center:     { lat, lng, zoom }
 *   selectedId: string | null
 *   height:     string  (default '100%')
 *   clusterMarkers?: boolean  (default false)
 *
 * Props (VolunteerDashboard mode):
 *   coords:     { lat, lng } | string | null
 *   title:      string
 *   height:     string
 *
 * IMPORTANT: Leaflet CSS must be imported once at app entry (index.css or main.jsx):
 *   import 'leaflet/dist/leaflet.css'
 * This component also injects a <style> tag as a belt-and-suspenders fallback.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin } from 'lucide-react'
import { T } from '../../styles/tokens'

// ── Fix Leaflet's broken default icon paths in Vite/webpack bundlers ──────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Leaflet CSS injected inline as fallback ───────────────────────────────────
const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
function ensureLeafletCSS() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`link[href="${LEAFLET_CSS_HREF}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = LEAFLET_CSS_HREF
  document.head.appendChild(link)
}
ensureLeafletCSS()

// ── Custom colored DivIcon factory ────────────────────────────────────────────
function makeIcon(color = '#3B82F6', pulsing = false, selected = false) {
  const size = selected ? 24 : 16
  const ring = selected ? `box-shadow: 0 0 0 4px ${color}40, 0 0 0 8px ${color}20;` : ''
  const pulse = pulsing ? `animation: civicpulse-ping 1.4s ease-in-out infinite;` : ''

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        ${ring}
        ${pulse}
        position: relative;
        transition: transform 0.2s;
      " onmouseenter="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform='scale(1)'"></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 6)],
  })
}

// ── Pulse animation injected once ─────────────────────────────────────────────
const PULSE_STYLE_ID = 'civicpulse-map-keyframes'
function ensurePulseStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById(PULSE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PULSE_STYLE_ID
  style.textContent = `
    @keyframes civicpulse-ping {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.5); opacity: 0.6; }
    }
    .leaflet-container { z-index: 0; touch-action: pan-x pan-y; }
    .leaflet-popup-content-wrapper {
      border-radius: 12px !important;
      font-family: inherit !important;
      font-size: 13px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
      max-width: 240px !important;
      padding: 8px 12px !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      line-height: 1.4 !important;
    }
    @media (max-width: 768px) {
      .leaflet-control-zoom { display: none !important; }
    }
  `
  document.head.appendChild(style)
}
ensurePulseStyle()

// ── Inner controller: flies the map when center/zoom changes (debounced) ─────
function MapFlyController({ lat, lng, zoom }) {
  const map = useMap()
  const prevRef = useRef({ lat, lng, zoom })
  const flyTimeout = useRef(null)

  const flyToLocation = useCallback((targetLat, targetLng, targetZoom) => {
    if (flyTimeout.current) clearTimeout(flyTimeout.current)
    flyTimeout.current = setTimeout(() => {
      map.flyTo([targetLat, targetLng], targetZoom, { duration: 0.8, easeLinearity: 0.5 })
    }, 100)
  }, [map])

  useEffect(() => {
    const prev = prevRef.current
    if (prev.lat === lat && prev.lng === lng && prev.zoom === zoom) return
    prevRef.current = { lat, lng, zoom }
    flyToLocation(lat, lng, zoom)
    return () => { if (flyTimeout.current) clearTimeout(flyTimeout.current) }
  }, [lat, lng, zoom, flyToLocation])

  return null
}

// ── Marker clustering helper (lightweight, no external lib) ───────────────────
function clusterMarkers(markers, threshold = 0.01) {
  const clusters = []
  const used = new Set()
  
  for (let i = 0; i < markers.length; i++) {
    if (used.has(i)) continue
    const cluster = [markers[i]]
    used.add(i)
    
    for (let j = i + 1; j < markers.length; j++) {
      if (used.has(j)) continue
      const dx = markers[j].lat - markers[i].lat
      const dy = markers[j].lng - markers[i].lng
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < threshold) {
        cluster.push(markers[j])
        used.add(j)
      }
    }
    
    if (cluster.length > 1) {
      const avgLat = cluster.reduce((sum, m) => sum + m.lat, 0) / cluster.length
      const avgLng = cluster.reduce((sum, m) => sum + m.lng, 0) / cluster.length
      clusters.push({
        id: `cluster-${cluster[0].id}`,
        lat: avgLat,
        lng: avgLng,
        color: cluster[0].color,
        pulsing: cluster.some(m => m.pulsing),
        popup: `<div style="font-weight:600">${cluster.length} tasks nearby</div>`,
        isCluster: true,
        members: cluster
      })
    } else {
      clusters.push(cluster[0])
    }
  }
  return clusters
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 1: CoordinatorMap — multi-marker operational map
// ─────────────────────────────────────────────────────────────────────────────
function CoordinatorMap({ 
  markers = [], 
  center, 
  selectedId, 
  height = '100%',
  clusterMarkers: enableClustering = false 
}) {
  const defaultCenter = [20.5937, 78.9629]
  const defaultZoom = 5

  const initCenter = center?.lat && center?.lng ? [center.lat, center.lng] : defaultCenter
  const initZoom = center?.zoom ?? defaultZoom

  const validMarkers = useMemo(() => 
    markers.filter(m => 
      m.lat != null && m.lng != null && 
      !isNaN(parseFloat(m.lat)) && !isNaN(parseFloat(m.lng))
    ), [markers]
  )

  const displayMarkers = useMemo(() => {
    if (!enableClustering || validMarkers.length < 5) return validMarkers
    return clusterMarkers(validMarkers)
  }, [validMarkers, enableClustering])

  return (
    <MapContainer
      center={initCenter}
      zoom={initZoom}
      style={{ width: '100%', height, borderRadius: 'inherit' }}
      scrollWheelZoom={false}
      tap={false}
      zoomControl={true}
      aria-label="Operational map showing civic needs"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {center?.lat && center?.lng && (
        <MapFlyController lat={center.lat} lng={center.lng} zoom={center.zoom ?? 12} />
      )}

      {displayMarkers.map(m => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={makeIcon(m.color, m.pulsing, m.id === selectedId)}
          aria-label={m.popup ? `Task: ${m.popup.replace(/<[^>]*>/g, '')}` : 'Task location'}
        >
          {m.popup && (
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: m.popup }} style={{ maxWidth: 220 }} />
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 2: VolunteerTaskMap — single-task location map
// ─────────────────────────────────────────────────────────────────────────────
function VolunteerTaskMap({ coords, title, height = '220px' }) {
  const HYDERABAD = { lat: 17.3850, lng: 78.4867 }
  
  const parseCoords = (c) => {
    if (!c) return null
    if (typeof c === 'string') {
      const match = c.match(/\(([-\d.]+),\s*([-\d.]+)\)/) || c.match(/^([-\d.]+),\s*([-\d.]+)$/)
      if (match) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
      }
    }
    if (typeof c === 'object' && c.lat != null && c.lng != null) {
      return { lat: parseFloat(c.lat), lng: parseFloat(c.lng) }
    }
    return null
  }

  const center = parseCoords(coords) ?? HYDERABAD
  const zoom = coords ? 14 : 11
  const hasValidCoords = !!parseCoords(coords)

  if (!hasValidCoords) {
    return (
      <div style={{
        height, borderRadius: '12px',
        background: T.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '6px',
        color: T.textSecondary, fontSize: '13px',
        border: `1px dashed ${T.border}`,
      }}>
        <MapPin size={20} color={T.textTertiary} />
        <span>Location not available</span>
      </div>
    )
  }

  return (
    <MapContainer
      key={`${center.lat},${center.lng}`}
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ width: '100%', height, borderRadius: '12px' }}
      scrollWheelZoom={false}
      tap={false}
      zoomControl={true}
      aria-label={`Map showing location: ${title || 'task'}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[center.lat, center.lng]}
        icon={makeIcon('#ef4444', false, true)}
        aria-label={title || 'Task location'}
      >
        {title && <Popup>{title}</Popup>}
      </Marker>
    </MapContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export — auto-detects mode based on props
// ─────────────────────────────────────────────────────────────────────────────
export default function TaskMap(props) {
  if (props.coords !== undefined || props.title !== undefined || props.singleCoords !== undefined) {
    return <VolunteerTaskMap coords={props.coords ?? props.singleCoords} title={props.title} height={props.height} />
  }
  return <CoordinatorMap {...props} />
}