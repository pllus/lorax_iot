import { useState } from "react";

function PlantStats({ onNavigateToPlant }) {
  const [plants, setPlants] = useState([
    {
      id: 1,
      name: "Jimmy",
      species: "Mulberry tree",
      status: "🔴 offline (last connected 11/22/2025)",
      health: "🟢 Healthy",
      water: "🟡 (last watered 11/22/2025)",
      image: "https://images.unsplash.com/photo-1466781783364-36c955e42a7f?w=400&h=400&fit=crop"
    },
    {
      id: 2,
      name: "Plant 2",
      species: "Unknown",
      status: "",
      health: "",
      water: "Green, Yellow, Red [last watered]",
      image: "https://images.unsplash.com/photo-1459156212016-c812468e2115?w=400&h=400&fit=crop"
    },
  ]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          View Individual Plant Statistics
        </h1>
        <p className="text-gray-500">{plants.length} Plants Available</p>
      </div>

      {/* Plants List */}
      <div className="space-y-4">
        {plants.map((plant) => (
          <div
            key={plant.id}
            className="bg-white rounded-lg shadow p-6 border border-gray-200"
          >
            <div className="flex items-start gap-6">
              {/* Plant Image */}
              <img 
                src={plant.image} 
                alt={plant.name}
                className="w-24 h-24 rounded object-cover shrink-0"
              />

              {/* Plant Info */}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {plant.name}
                </h2>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Species:</span> {plant.species}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> {plant.status}
                  </p>
                  <p>
                    <span className="font-medium">Health:</span> {plant.health}
                  </p>
                  <p>
                    <span className="font-medium">Water:</span> {plant.water}
                  </p>
                </div>
                <button 
                  onClick={() => onNavigateToPlant(plant)}
                  className="mt-4 px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View stats
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlantStats;