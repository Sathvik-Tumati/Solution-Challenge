import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { T } from '../../styles/tokens'

// Dynamic Leaflet import for Vite compatibility
export default function MapPreview({
  lat,
  lng,
  zoom = 5,
  markers = [],
  selectedId = null,
  height = '350px',
  clusterMarkers = false,
  showSelectedPulse = true,
  popupMaxWidth = 200,
  onMarkerClick
}) {
  const [Leaflet, setLeaflet] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)

  // Load Leaflet dynamically
  useEffect(() => {
    let mounted = true
    const loadLeaflet = async () => {
      try {
        const { MapContainer, TileLayer, Marker, Popup } = await import('react-leaflet')
        const L = await import('leaflet')
        
        // Fix marker icon paths for Vite
        delete L.default.Icon.Default.prototype._getIconUrl
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
        })
        
        if (mounted) {
          setLeaflet({ MapContainer, TileLayer, Marker, Popup, L: L.default })
        }
      } catch (err) {
        console.error('Failed to load Leaflet:', err)
      }
    }
    loadLeaflet()
    return () => { mounted = false }
  }, [])

  // Update map view when center/zoom changes
  useEffect(() => {
    if (mapInstance && Leaflet) {
      mapInstance.setView([lat, lng], zoom)
    }
  }, [lat, lng, zoom, mapInstance, Leaflet])

  if (!Leaflet) {
    return (
      <div style={{ height, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSecondary }}>
        Loading map...
      </div>
    )
  }

  const { MapContainer, TileLayer, Marker, Popup, L } = Leaflet

  // Custom marker icon with priority-based coloring
  const createMarkerIcon = (marker) => {
    const { color, pulsing } = marker
    return L.divIcon({
      className: '',
      html: `
        <div style="
          position: relative;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${pulsing ? `
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: ${color};
              opacity: 0.3;
              animation: pulse 2s infinite;
            "></div>
            <style>@keyframes pulse { 0% { transform: scale(1); opacity: 0.3; } 70% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }</style>
          ` : ''}
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${color};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    })
  }

  // Selected marker gets extra pulse ring
  const createSelectedIcon = (marker) => {
    const baseIcon = createMarkerIcon(marker)
    if (showSelectedPulse) {
      return L.divIcon({
        className: '',
        html: `
          <div style="position: relative;">
            ${baseIcon.options.html}
            <div style="
              position: absolute;
              top: -4px; left: -4px;
              width: 36px; height: 36px;
              border-radius: 50%;
              border: 2px solid ${marker.color};
              animation: pulse-ring 1.5s infinite;
            "></div>
            <style>@keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }</style>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      })
    }
    return baseIcon
  }

  return (
    <div style={{ height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={setMapInstance}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {markers.map(marker => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={marker.id === selectedId ? createSelectedIcon(marker) : createMarkerIcon(marker)}
            eventHandlers={{
              click: () => onMarkerClick?.(marker)
            }}
          >
            <Popup maxWidth={popupMaxWidth}>
              <div dangerouslySetInnerHTML={{ __html: marker.popup }} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}