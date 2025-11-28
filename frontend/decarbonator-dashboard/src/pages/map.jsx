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
  // Predictions state keyed by sensor name
  const [predictions, setPredictions] = useState({});

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

// ---- Heatmap Points ----
const heatPoints = [
  {
    lat: 13.845183806267956,
    lng: 100.57074430044865,
    intensity: 0.2,
    text: "This zone shows low carbon intensity due to Jimmy",
  },
  {
    lat: 13.851507,
    lng: 100.575329,
    intensity: 0.5,
    text: "This zone shows medium carbon intensity",
  },
  {
    lat: 13.85125834581618,
    lng: 100.57120353666488,
    intensity: 0.85,
    text: "This zone shows high carbon intensity due to no Jimmy",
  },
];

// ---- Mock Sensors Data with latest readings ----
const sensors = [
  {
    lat: 13.845183806267956, 
    lng: 100.57074430044865,
    name: "Sensor set A",
    co2: 450,           // low
    estimatedPPM: 720.0, //AI here
    temperature: 29.3,
    humidity: 57.0,
    lightIntensity: 720,
  },
  {
    lat: 13.851507,
    lng: 100.575329,
    name: "Sensor set C",
    co2: 640,           // medium
    estimatedPPM: 780.0,
    temperature: 30.8,  // ระหว่าง 29.3 กับ 32.1
    humidity: 52.0,     // ระหว่าง 57 กับ 48.5
    lightIntensity: 790, // ระหว่าง 720 กับ 860
  },
  {
    lat: 13.85125834581618,
    lng: 100.57120353666488,
    name: "Sensor set B",
    co2: 865.4,         // high
    estimatedPPM: 910.0,
    temperature: 32.1,
    humidity: 48.5,
    lightIntensity: 860,
  },
];

  // -------------------- CO2 Prediction Helpers --------------------
  const parsePredictResponse = (data) => {
    if (!data) return null;
    if (typeof data === "number") return { "5min": data, "1hour": data };
    if (data["5min"] || data["1hour"]) {
      return {
        "5min": (typeof data["5min"] === "object" ? data["5min"].value ?? data["5min"].pred ?? null : data["5min"]),
        "1hour": (typeof data["1hour"] === "object" ? data["1hour"].value ?? data["1hour"].pred ?? null : data["1hour"]),
      };
    }
    if (data.predictions) return { "5min": data.predictions["5min"], "1hour": data.predictions["1hour"] };
    const numbers = Object.values(data).flatMap((v) => (typeof v === "number" ? [v] : []));
    if (numbers.length === 1) return { "5min": numbers[0], "1hour": numbers[0] };
    if (numbers.length >= 2) return { "5min": numbers[0], "1hour": numbers[1] };
    return null;
  };

  const fetchPredictionsForSensor = async (sensor) => {
    try {
      const url = `http://127.0.0.1:8000/co2/predict?co2=${encodeURIComponent(sensor.co2 ?? "")}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      return parsePredictResponse(data);
    } catch (err) {
      console.warn("Prediction fetch failed for", sensor.name, err);
      return null;
    }
  };

  const fetchAllPredictions = async () => {
    try {
      const results = await Promise.all(
        sensors.map(async (s) => {
          const pred = await fetchPredictionsForSensor(s);
          if (!pred) {
            const base = Number(s.co2) || 500;
            return { name: s.name, pred: { "5min": Math.round(base + 5), "1hour": Math.round(base + 30) } };
          }
          return { name: s.name, pred };
        })
      );
      const mapObj = {};
      results.forEach((r) => (mapObj[r.name] = r.pred));
      setPredictions(mapObj);
    } catch (e) {
      console.error("Failed to fetch predictions:", e);
    }
  };


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
            background: "#dcfce7",
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
                displayMode === "plants" ? "#16a34a" : "transparent",
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
                displayMode === "heatmap" ? "#16a34a" : "transparent",
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
                displayMode === "sensors" ? "#16a34a" : "transparent",
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
