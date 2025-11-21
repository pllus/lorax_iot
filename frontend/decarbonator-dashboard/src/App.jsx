import { useState } from "react";
import Sidebar from "./components/sidebar";
import Dashboard from "./pages/dashboard";
import PlantStats from "./pages/PlantStats";
// import Prediction from "./pages/Prediction";
// import About from "./pages/About";

function App() {
  const [page, setPage] = useState("dashboard");
  const [plants, setPlants] = useState([
    {
      id: 1,
      name: "Plant 1",
      description: "Body text for whatever you'd like to say. Add main takeaway points, quotes, anecdotes, or even a very very short story."
    },
    {
      id: 2,
      name: "Plant 2",
      description: "Body text for whatever you'd like to say. Add main takeaway points, quotes, anecdotes, or even a very very short story."
    }
  ]);

  const handleAddPlant = () => {
    const newPlant = {
      id: plants.length + 1,
      name: `Plant ${plants.length + 1}`,
      description: "Body text for whatever you'd like to say. Add main takeaway points, quotes, anecdotes, or even a very very short story."
    };
    setPlants([...plants, newPlant]);
  };

  const renderContent = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "plant-stats":
        return <PlantStats plants={plants} onAddPlant={handleAddPlant} />;
      case "prediction":
        return <Prediction />;
      case "about":
        return <About />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar currentPage={page} setPage={setPage} />
      <main className="flex-1 p-10 bg-gray-100 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;