import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

const center = [13.8479838, 100.5697013];

// default icon for plants
const defaultIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// icon when Connected = true (green)
const connectedIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// icon for Heatmap points (marker)
const heatPointIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// icon for Sensors (mock data)
const sensorIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ---------- Heatmap Layer Component ----------
function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (!points || points.length === 0) return;

    // convert to [lat, lng, intensity]
    const arr = points.map((p) => [p.lat, p.lng, p.intensity]);

    const heatLayer = L.heatLayer(arr, {
      radius: 25,
      blur: 15,
      maxZoom: 18,
    });

    heatLayer.addTo(map);

    // cleanup when unmount or points change
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

export default function MapPage() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // displayMode: "plants" | "heatmap" | "sensors"
  const [displayMode, setDisplayMode] = useState("plants");

  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/plants/all");
        const data = await res.json();
        if (data.success) {
          setPlants(data.plants);
        } else {
          setError("Failed to load data (success = false)");
        }
      } catch (err) {
        setError(err.message || "An error occurred while loading data");
      } finally {
        setLoading(false);
      }
    };

    fetchPlants();
  }, []);

  if (loading) return <div>Loading plants...</div>;
  if (error) return <div>Error: {error}</div>;

  // ---- Mock Heatmap Points (each point has its own description) ----
  const heatPoints = [
    {
      lat: center[0] + 0.0003,
      lng: center[1] + 0.0003,
      intensity: 0.9,
      text: "This zone shows high activity from multiple plant sensors and is close to the main plant cluster.",
    },
    {
      lat: center[0] - 0.0002,
      lng: center[1] + 0.0001,
      intensity: 0.7,
      text: "This area has relatively high signal, likely where plants are growing very well.",
    },
    {
      lat: center[0] + 0.0001,
      lng: center[1] - 0.00025,
      intensity: 0.8,
      text: "This zone has consistently high values and is useful as a reference area to compare with other points.",
    },
    {
      lat: center[0] - 0.00025,
      lng: center[1] - 0.00015,
      intensity: 0.6,
      text: "This area has medium intensity and may be a transition zone between dense and sparse regions.",
    },
  ];

  // ---- Mock Sensors Data ----
  const sensors = [
    {
      lat: center[0] + 0.0004,
      lng: center[1] + 0.00015,
      name: "Sensor A - CO₂ & Temp",
      description:
        "Sensor A measures CO₂ and temperature in the upper canopy area to monitor the impact on plant respiration.",
    },
    {
      lat: center[0] - 0.00035,
      lng: center[1] - 0.0001,
      name: "Sensor B - Soil Moisture",
      description:
        "Sensor B is buried in the soil to measure soil moisture for the experimental plant group on the east side.",
    },
    {
      lat: center[0] + 0.0001,
      lng: center[1] - 0.00035,
      name: "Sensor C - Biosignal Clamp",
      description:
        "Sensor C is clamped to plant branches to capture plant bioelectric signals for the Plant Health & Pollution Detection feature.",
    },
  ];

  const showPlants = displayMode === "plants";
  const showHeatmap = displayMode === "heatmap";
  const showSensors = displayMode === "sensors";

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------- Top Header ---------- */}
      <div
        style={{
          padding: "16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", margin: 0 }}>
            Plant Map
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#64748b",
              marginTop: "4px",
            }}
          >
            {plants.length} Plants Available
          </p>
        </div>

        {/* Toggle Modes: Plants / Heatmap / Sensors */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "#e5edff",
            padding: "4px",
            borderRadius: "999px",
          }}
        >
          <button
            onClick={() => setDisplayMode("plants")}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              backgroundColor:
                displayMode === "plants" ? "#1d4ed8" : "transparent",
              color: displayMode === "plants" ? "#ffffff" : "#1e293b",
              minWidth: "90px",
            }}
          >
            Plants
          </button>
          <button
            onClick={() => setDisplayMode("heatmap")}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              backgroundColor:
                displayMode === "heatmap" ? "#1d4ed8" : "transparent",
              color: displayMode === "heatmap" ? "#ffffff" : "#1e293b",
              minWidth: "90px",
            }}
          >
            Heatmap
          </button>
          <button
            onClick={() => setDisplayMode("sensors")}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              backgroundColor:
                displayMode === "sensors" ? "#1d4ed8" : "transparent",
              color: displayMode === "sensors" ? "#ffffff" : "#1e293b",
              minWidth: "90px",
            }}
          >
            Sensors
          </button>
        </div>
      </div>

      {/* ---------- Map ---------- */}
      <div style={{ flex: 1 }}>
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Plant markers from backend */}
          {showPlants &&
            plants.map((plant) => {
              const lat = parseFloat(String(plant.Latitude).trim());
              const lng = parseFloat(String(plant.Longtitude).trim());
              if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

              const isConnected = Boolean(plant.Connected);
              const icon = isConnected ? connectedIcon : defaultIcon;

              return (
                <Marker
                  key={plant.id || plant._id}
                  position={[lat, lng]}
                  icon={icon}
                >
                  <Popup>
                    <div>
                      <strong>{plant.Name}</strong>
                      <br />
                      Thai name: {plant.Species}
                      <br />
                      Scientific name: {plant.ScientificName || "-"}
                      <br />
                      Family: {plant.Family || "-"}
                      <br />
                      Status: {isConnected ? "Connected" : "Disconnected"}
                      <br />
                      <br />
                      <span>
                        {plant.Description || "No description available"}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Heatmap layer + markers for each heat point */}
          {showHeatmap && (
            <>
              <HeatmapLayer points={heatPoints} />
              {heatPoints.map((p, index) => (
                <Marker
                  key={`heat-${index}`}
                  position={[p.lat, p.lng]}
                  icon={heatPointIcon}
                >
                  <Popup>
                    <div>
                      <strong>Heat Point #{index + 1}</strong>
                      <br />
                      <strong>Intensity:</strong> {p.intensity}
                      <br />
                      <br />
                      <span>{p.text}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </>
          )}

          {/* Sensors (mock data) */}
          {showSensors &&
            sensors.map((s, idx) => (
              <Marker
                key={`sensor-${idx}`}
                position={[s.lat, s.lng]}
                icon={sensorIcon}
              >
                <Popup>
                  <div>
                    <strong>{s.name}</strong>
                    <br />
                    <br />
                    <span>{s.description}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
}
