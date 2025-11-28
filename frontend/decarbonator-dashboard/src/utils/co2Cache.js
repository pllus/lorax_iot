/**
 * CO2 Cache Utility
 * Calculates and stores CO2 absorption data from sensor logs
 * Updates cache every 5 minutes and on app initialization
 */

const CACHE_KEY = "co2_absorption_cache";
const CACHE_EXPIRY_MINUTES = 5;
const CACHE_EXPIRY_HOURS = CACHE_EXPIRY_MINUTES / 60;

/**
 * Get cached CO2 data
 * @returns {{ totalCo2: number, lastUpdated: string } | null}
 */
export const getCachedCo2 = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = new Date();
    const lastUpdated = new Date(data.lastUpdated);
    const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);

    // Return cached data if still fresh
    if (hoursDiff < CACHE_EXPIRY_HOURS) {
      return data;
    }
  } catch (e) {
    console.warn("Failed to read CO2 cache:", e);
  }
  return null;
};

/**
 * Calculate total CO2 absorption from sensor data
 * Assumes CO2 column contains ppm values
 * @param {Array} sensorData - Array of sensor readings with carbon field
 * @returns {number} Total CO2 in ppm
 */
const calculateTotalCo2 = (sensorData) => {
  if (!Array.isArray(sensorData) || sensorData.length === 0) {
    return 0;
  }

  // Calculate average CO2 reading as a proxy for "absorption"
  // Since we have readings over time, we can sum them or take weighted average
  const validReadings = sensorData
    .filter((item) => item.carbon !== undefined && item.carbon !== null)
    .map((item) => Number(item.carbon));

  if (validReadings.length === 0) return 0;

  // Sum all readings as total CO2 measured
  const total = validReadings.reduce((sum, val) => sum + val, 0);
  return Math.round(total);
};

/**
 * Fetch sensor data and update cache
 * @returns {Promise<number>} Total CO2 value
 */
export const updateCo2Cache = async () => {
  try {
    // Fetch latest sensor data from the same endpoint PlantDetail uses
    const response = await fetch(
      "http://127.0.0.1:8000/carbon/co2/all?limit=500&interval=5min"
    );

    if (!response.ok) {
      console.error("Failed to fetch CO2 data:", response.status);
      // Return cached value if available, otherwise 0
      const cached = getCachedCo2();
      return cached?.totalCo2 ?? 0;
    }

    const sensorData = await response.json();
    const totalCo2 = calculateTotalCo2(sensorData);

    // Store in cache
    const cacheData = {
      totalCo2,
      lastUpdated: new Date().toISOString(),
      dataPoints: sensorData.length,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log(`CO2 cache updated: ${totalCo2} ppm from ${sensorData.length} readings`);

    return totalCo2;
  } catch (err) {
    console.error("Error updating CO2 cache:", err);
    // Return cached value if available, otherwise 0
    const cached = getCachedCo2();
    return cached?.totalCo2 ?? 0;
  }
};

/**
 * Get CO2 data with automatic cache update
 * Fetches from cache if fresh, otherwise updates and caches
 * @returns {Promise<number>} Total CO2 value
 */
export const getTotalCo2 = async () => {
  const cached = getCachedCo2();

  // Return cached value if available
  if (cached) {
    return cached.totalCo2;
  }

  // Otherwise fetch and update cache
  return updateCo2Cache();
};

/**
 * Force refresh CO2 cache (bypass expiry)
 * @returns {Promise<number>} Total CO2 value
 */
export const refreshCo2Cache = () => {
  return updateCo2Cache();
};

/**
 * Get cache metadata
 * @returns {{ totalCo2: number, lastUpdated: string, dataPoints: number } | null}
 */
export const getCacheMetadata = () => {
  return getCachedCo2();
};
