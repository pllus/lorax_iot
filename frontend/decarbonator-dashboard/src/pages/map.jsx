import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const center = [13.8479838, 100.5697013];

// icon ปกติ
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

// icon ตอน Connected = true (ให้เป็นสีเขียว)
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

export default function MapPage() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/plants/all");
        const data = await res.json();
        if (data.success) {
          setPlants(data.plants);
        } else {
          setError("โหลดข้อมูลไม่สำเร็จ (success = false)");
        }
      } catch (err) {
        setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    fetchPlants();
  }, []);

  if (loading) return <div>กำลังโหลดข้อมูลต้นไม้...</div>;
  if (error) return <div>เกิดข้อผิดพลาด: {error}</div>;

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {plants.map((plant) => {
          const lat = parseFloat(String(plant.Latitude).trim());
          const lng = parseFloat(String(plant.Longtitude).trim());
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

          const isConnected = Boolean(plant.Connected);
          const icon = isConnected ? connectedIcon : defaultIcon;

          return (
            <Marker key={plant.id || plant._id} position={[lat, lng]} icon={icon}>
              <Popup>
                <div>
                  <strong>{plant.Name}</strong>
                  <br />
                  ชื่อไทย: {plant.Species}
                  <br />
                  ชื่อวิทยาศาสตร์: {plant.ScientificName || "-"}
                  <br />
                  วงศ์: {plant.Family || "-"}
                  <br />
                  สถานะ: {isConnected ? "Connected" : "Disconnected"}
                  <br />
                  <br />
                  <span>{plant.Description || "ไม่มีคำอธิบาย"}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
