import { useState } from "react";
import Sidebar from "./components/sidebar";
import Dashboard from "./pages/dashboard";
import PlantStats from "./pages/PlantStats";
import MapPage from "./pages/map";
// ถ้ายังไม่มีสองหน้านี้จริง ๆ ให้คอมเมนต์ไว้ก่อนก็ได้
// import Prediction from "./pages/Prediction";
// import About from "./pages/About";
import PlantDetail from "./pages/PlantDetail";

function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedPlant, setSelectedPlant] = useState(null);

  const handleNavigateToPlant = (plant) => {
    setSelectedPlant(plant);
    setPage("plant-detail");
  };

  const renderContent = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "plant-stats":
        return <PlantStats onNavigateToPlant={handleNavigateToPlant} />;
      case "plant-detail":
        return (
          <PlantDetail 
            plant={selectedPlant} 
            onBack={() => setPage("plant-stats")} 
          />
        );
      case "map":
        return <MapPage />;

        return <div><h1 className="text-3xl font-bold">Map Page</h1></div>;
      case "about":
        return <div><h1 className="text-3xl font-bold">About Us</h1></div>;
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