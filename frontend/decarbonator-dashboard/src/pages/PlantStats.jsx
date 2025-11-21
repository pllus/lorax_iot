function PlantStats({ plants, onAddPlant }) {
  const handleViewStats = (plantId) => {
    alert(`Viewing stats for Plant ${plantId}`);
  };

  return (
    <div>
      <h1 className="text-xl mb-1.5">View Individual Plant Statistics</h1>
      <p className="text-xs text-gray-500 mb-8">{plants.length} Plants Available</p>

      {/* Plants Container */}
      <div className="flex flex-col gap-6 mb-8">
        {plants.map((plant) => (
          <div
            key={plant.id}
            className="flex gap-6 bg-white p-6 rounded-lg shadow-sm"
          >
            {/* Plant Image Placeholder */}
            <div className="w-[100px] h-[100px] bg-gray-300 rounded flex-shrink-0"></div>

            {/* Plant Info */}
            <div className="flex-1 flex flex-col">
              <h2 className="text-xl font-semibold mb-2 text-gray-800">
                {plant.name}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {plant.description}
              </p>
              <button
                onClick={() => handleViewStats(plant.id)}
                className="self-start px-6 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                View stats
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Plant Button */}
      <button
        onClick={onAddPlant}
        className="px-6 py-2.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 hover:border-gray-400 transition-colors"
      >
        Add Plant
      </button>
    </div>
  );
}

export default PlantStats;