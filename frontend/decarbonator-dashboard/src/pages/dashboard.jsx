import { useState, useEffect } from "react";

function Dashboard({ sensorData = [], plants = [] }) {
  // For API
  const [totalPlants, setTotalPlants] = useState(0);
  const [totalCo2, setTotalCo2] = useState(0);
  const [bangkokAvgTemp, setBangkokAvgTemp] = useState(null);

  // state สำหรับวันที่/เวลา ที่กำลังเลือก (ยังไม่กด Done)
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  // state สำหรับช่วงเวลาที่ ยืนยันแล้ว (ตอนกด Done)
  const [appliedRange, setAppliedRange] = useState(null);

  // Sorting state for action logs
  const [sortField, setSortField] = useState("timestamp"); // 'timestamp' | 'plantName' | 'type'
  const [sortDirection, setSortDirection] = useState("desc"); // 'asc' | 'desc'

  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const res = await fetch("/plants/all");
        if (!res.ok) {
          console.error("Failed to fetch plants:", res.status);
          return;
        }
        const data = await res.json();

        if (Array.isArray(data)) {
          setTotalPlants(data.length);
        } else if (Array.isArray(data.plants)) {
          setTotalPlants(data.plants.length);
        } else {
          console.warn("Unknown /plants/all response shape:", data);
        }
      } catch (err) {
        console.error("Error fetching plants:", err);
      }
    };

    const fetchCo2Count = async () => {
      try {
        const res = await fetch("/carbon/co2/count");
        if (!res.ok) {
          console.error("Failed to fetch CO2 count:", res.status);
          return;
        }
        const data = await res.json();

        if (typeof data === "number") {
          setTotalCo2(data);
        } else if (typeof data.count === "number") {
          setTotalCo2(data.count);
        } else {
          console.warn("Unknown /carbon/co2/count response shape:", data);
        }
      } catch (err) {
        console.error("Error fetching CO2 count:", err);
      }
    };

    const fetchBangkokWeather = async () => {
      try {
        // Kasetsart Bangkhen approx coordinates: lat 13.84725, lon 100.57157
        const url =
          "https://api.open-meteo.com/v1/forecast" +
          "?latitude=13.84725" +
          "&longitude=100.57157" +
          "&daily=temperature_2m_max,temperature_2m_min" +
          "&timezone=Asia%2FBangkok";

        const res = await fetch(url);
        if (!res.ok) {
          console.error("Failed to fetch Bangkok weather:", res.status);
          return;
        }
        const data = await res.json();

        if (
          data.daily &&
          Array.isArray(data.daily.temperature_2m_max) &&
          Array.isArray(data.daily.temperature_2m_min) &&
          data.daily.temperature_2m_max.length > 0 &&
          data.daily.temperature_2m_min.length > 0
        ) {
          const tMax = data.daily.temperature_2m_max[0];
          const tMin = data.daily.temperature_2m_min[0];
          const avg = (tMax + tMin) / 2;
          setBangkokAvgTemp(avg);
        } else {
          console.warn("Unexpected Open-Meteo response shape:", data);
        }
      } catch (err) {
        console.error("Error fetching Bangkok weather:", err);
      }
    };

    fetchPlants();
    fetchCo2Count();
    fetchBangkokWeather();
  }, []);

  // เช็คว่ากรอกครบทั้ง 4 ช่องหรือยัง
  const isComplete =
    startDate && startTime && endDate && endTime;

  // helper แปลง date+time เป็น string ส
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "";
    const dt = new Date(`${dateStr}T${timeStr}`);
    return dt.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateTimeDisplay = (date) => {
    if (!date) return "-";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDone = () => {
    if (!isComplete) return;
    setAppliedRange({
      startDate,
      startTime,
      endDate,
      endTime,
    });
  };

  const handleCancel = () => {
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setAppliedRange(null);
  };

  // -----------------------------
  // Action detection from sensorData
  // sensorData เป็น data ก้อนเดียวกับ graph ใน PlantDetail
  // -----------------------------
  const HUMIDITY_SPIKE = 8; // % ปรับได้
  const LUX_SPIKE_ON = 200; // lux delta up = light on
  const LUX_SPIKE_OFF = 200; // lux delta down = light off

  const actionLogs = (() => {
    if (!sensorData || sensorData.length === 0) return [];

    // group by plant_id 
    const byPlant = new Map();

    sensorData.forEach((item) => {
      const plantId = item.plant_id ?? "default";
      if (!byPlant.has(plantId)) {
        byPlant.set(plantId, []);
      }
      byPlant.get(plantId).push(item);
    });

    const logs = [];

    byPlant.forEach((entries, plantId) => {
      // sort by time (oldest -> newest)
      const sorted = [...entries].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      // หา plant name จาก data 
      const fromEntriesName = sorted[0]?.plant_name;
      const fromPlants = plants.find(
        (p) => String(p.id) === String(plantId)
      );
      const plantName =
        fromEntriesName ||
        fromPlants?.name ||
        `Plant ${plantId}`;

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];

        const prevHum = Number(prev.humidity);
        const curHum = Number(cur.humidity);
        const prevLux = Number(prev.lux);
        const curLux = Number(cur.lux);

        const ts = new Date(cur.timestamp);

        // Watering: humidity spike up
        if (
          !isNaN(prevHum) &&
          !isNaN(curHum) &&
          curHum - prevHum >= HUMIDITY_SPIKE
        ) {
          logs.push({
            timestamp: ts,
            plantName,
            type: "Water",
          });
        }

        // Light ON: lux spike up
        if (
          !isNaN(prevLux) &&
          !isNaN(curLux) &&
          curLux - prevLux >= LUX_SPIKE_ON
        ) {
          logs.push({
            timestamp: ts,
            plantName,
            type: "Light On",
          });
        }

        // Light OFF: lux spike down
        if (
          !isNaN(prevLux) &&
          !isNaN(curLux) &&
          prevLux - curLux >= LUX_SPIKE_OFF
        ) {
          logs.push({
            timestamp: ts,
            plantName,
            type: "Light Off",
          });
        }
      }
    });

    return logs;
  })();


  // Sorting for action logs
  const sortedLogs = [...actionLogs].sort((a, b) => {
    let cmp = 0;

    if (sortField === "timestamp") {
      cmp = a.timestamp.getTime() - b.timestamp.getTime();
    } else if (sortField === "plantName") {
      cmp = a.plantName.localeCompare(b.plantName);
    } else if (sortField === "type") {
      cmp = a.type.localeCompare(b.type);
    }

    return sortDirection === "asc" ? cmp : -cmp;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      // toggle direction
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : "asc"
      );
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  return (
    <div className="p-8 space-y-8">
      {/* หัวข้อใหญ่ + การ์ดสรุป */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Decarbonator Overview
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-md px-6 py-4 flex flex-col justify-between">
          <p className="text-xs text-gray-500 mb-2">
            Total Plants
          </p>
          <p className="text-2xl font-semibold">{totalPlants}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md px-6 py-4 flex flex-col justify-between">
          <p className="text-xs text-gray-500 mb-2">
            Total CO2 Absorbed
          </p>
          <p className="text-2xl font-semibold">
            {totalCo2} ppm
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md px-6 py-4 flex flex-col justify-between">
          <p className="text-xs text-gray-500 mb-2">
            Bangkok Avg Temp (Today)
          </p>
          <p className="text-2xl font-semibold">
            {bangkokAvgTemp !== null
              ? `${bangkokAvgTemp.toFixed(1)} °C`
              : "-"}
          </p>
        </div>
      </div>

      <hr className="border-t border-gray-300 my-4" />

      {/* Action Logs */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Action Logs</h1>
        <p className="text-gray-500"> Detected watering and light on/off from sensor spikes</p>
      </div>

      <section className="bg-white rounded-2xl shadow-md px-6 py-4">
        {sortedLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No detected events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase">
                  <th
                    className="py-2 pr-4 cursor-pointer select-none"
                    onClick={() => handleSort("timestamp")}
                  >
                    Date / Time{" "}
                    <span className="ml-1">{renderSortIcon("timestamp")}</span>
                  </th>

                  <th
                    className="py-2 pr-4 cursor-pointer select-none"
                    onClick={() => handleSort("plantName")}
                  >
                    Plant{" "}
                    <span className="ml-1">{renderSortIcon("plantName")}</span>
                  </th>

                  <th
                    className="py-2 pr-4 cursor-pointer select-none"
                    onClick={() => handleSort("type")}
                  >
                    Type{" "}
                    <span className="ml-1">{renderSortIcon("type")}</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedLogs.map((log, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{formatDateTimeDisplay(log.timestamp)}</td>
                    <td className="py-2 pr-4">{log.plantName}</td>
                    <td className="py-2 pr-4">{log.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Graph */}
      {appliedRange && (
        <section className="space-y-4">
          <h2 className="text-m font-medium mb-2">
            <h2 className="text-m font-medium mb-2">
              Comparing data from{" "}
              {formatDateTime(
                appliedRange.startDate,
                appliedRange.startTime
              )}{" "}
              until{" "}
              {formatDateTime(
                appliedRange.endDate,
                appliedRange.endTime
              )}
            </h2>
          </h2>
        </section>
      )}
    </div>
    
  );
}

export default Dashboard;
