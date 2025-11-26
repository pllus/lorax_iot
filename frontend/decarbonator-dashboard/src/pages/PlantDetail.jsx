import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function PlantDetail({ plant, onBack }) {
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chat messages (for popup)
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "bot",
      text: `Hi, I'm your plant assistant. Chat is coming soon 🌱`,
    },
  ]);

  // State for filters
  const [selectedMetric, setSelectedMetric] = useState("carbon");
  const [timeRange, setTimeRange] = useState("all");
  const [dataInterval, setDataInterval] = useState("5min");
  const [selectedDate, setSelectedDate] = useState("all");
  const [availableDates, setAvailableDates] = useState([]);

  // Compare section state
  const [selectedCompareMetrics, setSelectedCompareMetrics] = useState([
    "carbon",
    "temperature",
  ]);
  const [showCompareMetricDropdown, setShowCompareMetricDropdown] =
    useState(false);

  // Chatbot popup state
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Updated metrics list with new Electrode data
  const metrics = [
    { value: "carbon", label: "Carbon (ppm)", color: "#22c55e" },
    { value: "temperature", label: "Air Temperature (°C)", color: "#ef4444" },
    { value: "humidity", label: "Air Humidity (%)", color: "#3b82f6" },
    { value: "lightIntensity", label: "Light Intensity", color: "#f59e0b" },
    { value: "lux", label: "Lux", color: "#fbbf24" },

    // New Electrical Metrics
    { value: "padsElectrode", label: "Pads Electrode (V)", color: "#8b5cf6" }, // AI_0
    { value: "glassElectrode", label: "Glass Electrode pH (V)", color: "#ec4899" }, // AI_1
    { value: "pureElectrode", label: "Pure Electrode (V)", color: "#06b6d4" }, // AI_2

    // Digital Inputs
    { value: "DI_0", label: "DI_0", color: "#a855f7" },
    { value: "DI_1", label: "DI_1", color: "#be185d" },
    { value: "DI_2", label: "DI_2", color: "#4338ca" },
  ];

  const intervalOptions = [
    { value: "raw", label: "Raw (30s)", description: "Most detailed" },
    { value: "1min", label: "1 Minute", description: "High detail" },
    { value: "5min", label: "5 Minutes", description: "Balanced" },
    { value: "15min", label: "15 Minutes", description: "Overview" },
    { value: "30min", label: "30 Minutes", description: "Summary" },
    { value: "1hour", label: "1 Hour", description: "Low detail" },
  ];

  // Formula from image: V = (Raw - 32768) * (20 / 65535)
  const calculateVoltage = (raw) => {
    if (raw === undefined || raw === null) return 0;
    return (raw - 32768) * (20 / 65535);
  };

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Determine limit based on interval
        const limitMap = {
          raw: 500,
          "1min": 500,
          "5min": 500,
          "15min": 500,
          "30min": 500,
          "1hour": 500,
        };

        const limit = limitMap[dataInterval] || 500;

        // Fetch both APIs in parallel
        const [co2Response, elecResponse] = await Promise.all([
          fetch(
            `http://127.0.0.1:8000/carbon/co2/all?limit=${limit}&interval=${dataInterval}`
          ),
          fetch(
            `http://127.0.0.1:8000/carbon/elec/all?limit=${limit}&interval=${dataInterval}`
          ),
        ]);

        if (!co2Response.ok || !elecResponse.ok) {
          throw new Error("Failed to fetch data from one or more endpoints");
        }

        const co2Data = await co2Response.json();
        const elecData = await elecResponse.json();

        // Create a Map for electrical data for easier merging by timestamp
        const elecMap = new Map();
        elecData.forEach((item) => {
          const key = item.timestamp || item.TIM;
          elecMap.set(key, item);
        });

        // Transform and Merge Data
        const transformedData = co2Data.map((item) => {
          const timestamp = item.timestamp || item.TIM;
          const dateObj = new Date(timestamp);

          // Find matching electrical data
          const elecItem = elecMap.get(timestamp) || {};

          return {
            timestamp: timestamp,
            date: dateObj.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),

            // Original CO2 Data
            carbon: item["COM_1 Wd_0"] ?? 0,
            temperature: (item["COM_1 Wd_1"] ?? 0) / 100,
            humidity: (item["COM_1 Wd_2"] ?? 0) / 100,
            lightIntensity: item["COM_1 Wd_4"] ?? 0,

            // Lux (adjust key to your API if needed)
            lux: item.lux ?? item["COM_1 Wd_6"] ?? 0,

            // New Electrical Data (Converted) – analog inputs
            padsElectrode: calculateVoltage(elecItem["AI_0 Val"]), // AI_0
            glassElectrode: calculateVoltage(elecItem["AI_1 Val"]), // AI_1
            pureElectrode: calculateVoltage(elecItem["AI_2 Val"]), // AI_2

            // Digital Inputs (0/1)
            DI_0: elecItem.DI_0 ?? 0,
            DI_1: elecItem.DI_1 ?? 0,
            DI_2: elecItem.DI_2 ?? 0,
          };
        });

        // Extract unique dates and sort them
        const dates = [...new Set(transformedData.map((item) => item.date))].sort(
          (a, b) => {
            return new Date(a) - new Date(b);
          }
        );
        setAvailableDates(dates);

        setSensorData(transformedData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [dataInterval]);

  // Format timestamp for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Get color for date
  const dateColors = [
    "#ef4444",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#6366f1",
    "#84cc16",
  ];

  const getColorForDate = (date) => {
    const index = availableDates.indexOf(date);
    return dateColors[index % dateColors.length];
  };

  // Filter data by time range and date
  const filterData = (data) => {
    let filtered = data;

    // Filter by selected date
    if (selectedDate !== "all") {
      filtered = filtered.filter((item) => item.date === selectedDate);
    }

    // Filter by time range
    if (timeRange !== "all") {
      const now = new Date();
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.timestamp);
        const hoursDiff = (now - itemDate) / (1000 * 60 * 60);

        if (timeRange === "1h") return hoursDiff <= 1;
        if (timeRange === "6h") return hoursDiff <= 6;
        if (timeRange === "24h") return hoursDiff <= 24;
        return true;
      });
    }

    // If filter removes everything, fall back to original
    return filtered.length > 0 ? filtered : data;
  };

  // ---- Helper: normalize metrics to 0–1 for compare section ----
  const normalizeMetrics = (data, metricKeys) => {
    if (!data || data.length === 0) return [];

    const stats = {};
    metricKeys.forEach((key) => {
      const vals = data
        .map((d) => d[key])
        .filter((v) => typeof v === "number" && !isNaN(v));
      if (vals.length === 0) {
        stats[key] = { min: 0, max: 1 };
      } else {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        // avoid division by zero; if constant, center at 0.5
        stats[key] = { min, max: max === min ? min + 1 : max };
      }
    });

    return data.map((item) => {
      const row = {
        time: formatTime(item.timestamp),
        dateTime: formatDateTime(item.timestamp),
        date: item.date,
        fullTimestamp: item.timestamp,
      };
      metricKeys.forEach((key) => {
        const { min, max } = stats[key];
        const raw = item[key];
        const norm =
          max === min ? 0.5 : (raw - min) / (max - min); // 0–1 scale
        row[key] = norm;
      });
      return row;
    });
  };

  const handleToggleCompareMetric = (value) => {
    setSelectedCompareMetrics((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      if (prev.length >= 3) {
        return prev; // do not exceed 3
      }
      return [...prev, value];
    });
  };

  // Format data for main chart
  const currentMetric =
    metrics.find((m) => m.value === selectedMetric) || metrics[0];

  const filteredData = filterData(sensorData);

  const chartData = filteredData.map((item) => ({
    time: formatTime(item.timestamp),
    dateTime: formatDateTime(item.timestamp),
    value: item[selectedMetric],
    date: item.date,
    fullTimestamp: item.timestamp,
    color: getColorForDate(item.date),
  }));

  // Data for compare chart
  const compareFilteredData = filterData(sensorData);
  const activeCompareMetrics =
    selectedCompareMetrics.length > 0
      ? selectedCompareMetrics
      : [metrics[0].value];

  const compareChartData = normalizeMetrics(
    compareFilteredData,
    activeCompareMetrics
  );

  // Get latest value
  const latestData =
    sensorData.length > 0 ? sensorData[sensorData.length - 1] : null;

  // Show loading state
  if (loading) {
    return (
      <div className="max-w-6xl">
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          ← Back to Plants
        </button>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-xl mt-4">Loading sensor data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-6xl">
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          ← Back to Plants
        </button>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800 font-semibold">Error loading data</p>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <button
        onClick={onBack}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
      >
        ← Back to Plants
      </button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Top Section */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Left Column - Image and Info */}
          <div>
            {/* Title row with chatbot icon */}
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{plant.name}</h1>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-300 bg-white shadow-sm flex items-center justify-center hover:shadow-md hover:scale-105 transition-transform"
              >
                <img
                  src={plant.chatAvatar || "/images/plant-chatbot-icon.png"}
                  alt="Plant chatbot"
                  className="w-full h-full object-cover"
                />
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] px-1.5 py-[1px] rounded-full shadow">
                  bot
                </span>
              </button>
            </div>

            <p className="text-gray-600 italic mb-6">{plant.species}</p>

            <img
              src={plant.image}
              alt={plant.name}
              className="w-64 h-64 object-contain mx-auto mb-4"
            />
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-3">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <p className="font-semibold text-blue-900">Plant Information</p>
              <p className="text-sm text-blue-700">Static and real-time data</p>
            </div>

            <div>
              <p className="text-gray-700">
                <span className="font-semibold">Age:</span> 6 months
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Health:</span> {plant.health}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Last Watered:</span>{" "}
                {plant.water}
              </p>
            </div>

            <div>
              {latestData ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <p className="text-gray-700 col-span-2 mt-3 font-semibold border-b pb-1">
                    Latest Sensor Readings:
                  </p>
                  <p className="text-gray-700">
                    <span className="font-semibold">Carbon:</span>{" "}
                    {latestData.carbon} ppm
                  </p>
                  <p className="text-gray-700">
                    <span className="font-semibold">Temp:</span>{" "}
                    {latestData.temperature.toFixed(1)}°C
                  </p>

                  <p className="text-gray-700">
                    <span className="font-semibold">Humidity:</span>{" "}
                    {latestData.humidity.toFixed(1)}%
                  </p>

                  {/* --- Section Title Matching Electrode Layout --- */}
                  <p className="text-gray-700 col-span-2 mt-3 font-semibold border-b pb-1">
                    Electrode Data (V):
                  </p>

                  {/* --- Electrode Data Matching Format --- */}
                  <p className="text-gray-700">
                    <span className="font-semibold">Pads:</span>{" "}
                    {latestData.padsElectrode.toFixed(4)} V
                  </p>
                  <p className="text-gray-700">
                    <span className="font-semibold">Glass pH:</span>{" "}
                    {latestData.glassElectrode.toFixed(4)} V
                  </p>
                  <p className="text-gray-700">
                    <span className="font-semibold">Pure:</span>{" "}
                    {latestData.pureElectrode.toFixed(4)} V
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">No data available</p>
              )}

              {latestData && (
                <p className="text-xs text-gray-500 mt-4">
                  Last updated:{" "}
                  {new Date(latestData.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Graph Section – Sensor Data Over Time */}
        <div className="border-t pt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Sensor Data Over Time</h2>

            {/* Controls */}
            <div className="flex gap-4 flex-wrap">
              {/* Date Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="all">All Dates</option>
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Interval Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Detail
                </label>
                <select
                  value={dataInterval}
                  onChange={(e) => setDataInterval(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metric Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metric
                </label>
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {metrics.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Range Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={selectedDate !== "all"}
                >
                  <option value="1h">Last 1 Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="all">All Data</option>
                </select>
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-yellow-700">
                <span className="font-semibold">Showing:</span>{" "}
                {chartData.length} data points at{" "}
                {intervalOptions.find((o) => o.value === dataInterval)?.label}{" "}
                intervals
                {selectedDate !== "all" && (
                  <span className="ml-2">
                    | <span className="font-semibold">Date:</span>{" "}
                    {selectedDate}
                  </span>
                )}
              </p>

              {/* Date color legend */}
              {selectedDate === "all" && availableDates.length > 1 && (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 mr-2">Dates:</span>
                  {availableDates.slice(0, 5).map((date) => (
                    <div key={date} className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getColorForDate(date) }}
                      ></div>
                      <span className="text-xs text-gray-600">{date}</span>
                    </div>
                  ))}
                  {availableDates.length > 5 && (
                    <span className="text-xs text-gray-600">
                      +{availableDates.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={selectedDate === "all" ? "dateTime" : "time"}
                  label={{
                    value: "Time",
                    position: "insideBottom",
                    textAnchor: "middle",
                    offset: -5,
                  }}
                  angle={selectedDate === "all" ? -15 : 0}
                  textAnchor={selectedDate === "all" ? "end" : "middle"}
                  height={selectedDate === "all" ? 80 : 60}
                />
                <YAxis
                  label={{
                    value: currentMetric.label,
                    angle: -90,
                    position: "insideLeft",
                    textAnchor: "middle",
                  }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded shadow">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: payload[0].payload.color }}
                          >
                            {payload[0].payload.date}
                          </p>
                          <p className="text-sm">
                            {payload[0].payload.fullTimestamp}
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: currentMetric.color }}
                          >
                            {currentMetric.label}:{" "}
                            {Number(payload[0].value).toFixed(4)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={currentMetric.label}
                  stroke={
                    selectedDate === "all" ? "#6b7280" : currentMetric.color
                  }
                  strokeWidth={2}
                  dot={
                    selectedDate === "all"
                      ? (props) => {
                          const { cx, cy, payload } = props;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={payload.color}
                              stroke={payload.color}
                            />
                          );
                        }
                      : { r: 4, fill: currentMetric.color }
                  }
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Stats */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Current</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Number(chartData[chartData.length - 1]?.value).toFixed(4)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(
                    chartData.reduce((sum, d) => sum + d.value, 0) /
                    chartData.length
                  ).toFixed(4)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Min</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.min(...chartData.map((d) => d.value)).toFixed(4)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Max</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.max(...chartData.map((d) => d.value)).toFixed(4)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Compare Metrics (Normalized) */}
        <div className="mt-10 border-t pt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Compare Metrics (0–1)</h2>

            <div className="flex gap-4 flex-wrap">
              {/* Date Selector (reuse same state) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="all">All Dates</option>
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Interval Selector (reuse) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Detail
                </label>
                <select
                  value={dataInterval}
                  onChange={(e) => setDataInterval(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metric Multi-select Dropdown */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Metrics
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setShowCompareMetricDropdown((prev) => !prev)
                  }
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-left w-56 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <span className="truncate text-sm">
                    {selectedCompareMetrics.length === 0
                      ? "Select metrics"
                      : `${selectedCompareMetrics.length} selected`}
                  </span>
                  <span className="ml-2 text-gray-400">▾</span>
                </button>

                {showCompareMetricDropdown && (
                  <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-auto">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b">
                      Select up to 3 metrics
                    </div>
                    {metrics.map((m) => {
                      const checked = selectedCompareMetrics.includes(m.value);
                      const disabled =
                        !checked && selectedCompareMetrics.length >= 3;
                      return (
                        <label
                          key={m.value}
                          className={`flex items-center gap-2 px-3 py-1 text-sm cursor-pointer hover:bg-gray-50 ${
                            disabled ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleCompareMetric(m.value)}
                          />
                          <span>{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time Range Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={selectedDate !== "all"}
                >
                  <option value="1h">Last 1 Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="all">All Data</option>
                </select>
              </div>
            </div>
          </div>

          {/* Info banner for compare */}
          <div className="bg-sky-50 border-l-4 border-sky-400 p-4 mb-6">
            <p className="text-sm text-sky-700">
              <span className="font-semibold">Normalized view:</span> Metrics
              are scaled from 0 - 1 based on their min/max values in the
              selected time range.
            </p>
          </div>

          <div className="mb-2">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={compareChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={selectedDate === "all" ? "dateTime" : "time"}
                  label={{
                    value: "Time",
                    position: "insideBottom",
                    textAnchor: "middle",
                    offset: -5,
                  }}
                  angle={selectedDate === "all" ? -15 : 0}
                  textAnchor={selectedDate === "all" ? "end" : "middle"}
                  height={selectedDate === "all" ? 80 : 60}
                />
                <YAxis
                  domain={[0, 1]}
                  label={{
                    value: "Normalized value (0–1)",
                    angle: -90,
                    position: "insideLeft",
                    textAnchor: "middle",
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded shadow">
                          <p className="text-xs text-gray-500 mb-1">
                            {payload[0].payload.fullTimestamp}
                          </p>
                          {payload.map((entry) => {
                            const metricDef = metrics.find(
                              (m) => m.value === entry.dataKey
                            );
                            return (
                              <p
                                key={entry.dataKey}
                                className="text-sm"
                                style={{
                                  color: metricDef?.color || "#111827",
                                }}
                              >
                                {metricDef?.label || entry.dataKey}:{" "}
                                {Number(entry.value).toFixed(3)}
                              </p>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {activeCompareMetrics.map((metricKey) => {
                  const metricDef = metrics.find((m) => m.value === metricKey);
                  return (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      name={metricDef?.label || metricKey}
                      stroke={metricDef?.color || "#6b7280"}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chatbot Popup */}
      {isChatOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
          {/* Dim background */}
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => setIsChatOpen(false)}
          />

          {/* Chat window */}
          <div
            className="
              relative pointer-events-auto 
              m-4 w-full 
              max-w-md
              min-w-[280px]
              min-h-[260px]
              h-[550px]
              bg-white 
              rounded-3xl
              shadow-2xl 
              border border-gray-200 
              flex flex-col 
              resize
              overflow-hidden
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1f7a4a] rounded-t-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/60">
                  <img
                    src={plant.chatAvatar || "/images/plant-chatbot-icon.png"}
                    alt="Chatbot"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {plant.name} Assistant
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white/80 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 px-4 py-3 overflow-y-auto text-sm space-y-3">
              {messages.map((msg) =>
                msg.from === "bot" ? (
                  <div
                    key={msg.id}
                    className="flex items-start gap-2 max-w-[85%]"
                  >
                    {/* Bot avatar for each bot message */}
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500 shrink-0">
                      <img
                        src={
                          plant.chatAvatar ||
                          "/images/plant-chatbot-icon.png"
                        }
                        alt="Bot"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="bg-emerald-50 text-emerald-900 px-3 py-2 rounded-lg rounded-bl-none">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-gray-100 text-gray-900 px-3 py-2 rounded-lg rounded-br-none max-w-[85%]">
                      {msg.text}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Input area (still placeholder) */}
            <div className="border-t px-3 py-2 bg-gray-50 rounded-b-3xl">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Chat coming soon…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  disabled
                />
                <button
                  className="px-3 py-2 text-xs rounded-lg bg-emerald-500 text-white opacity-70 cursor-not-allowed"
                  disabled
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlantDetail;
