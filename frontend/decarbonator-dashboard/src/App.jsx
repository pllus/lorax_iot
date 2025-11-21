import { useState } from "react";
import Sidebar from "./components/sidebar";
import Dashboard from "./pages/dashboard";
import PlantStats from "./pages/PlantStats";
// ถ้ายังไม่มีสองหน้านี้จริง ๆ ให้คอมเมนต์ไว้ก่อนก็ได้
// import Prediction from "./pages/Prediction";
// import About from "./pages/About";

function App() {
  // state หน้า
  const [page, setPage] = useState("dashboard");

  // state รายการต้นไม้
  const [plants, setPlants] = useState([
    {
      id: 1,
      name: "Plant 1",
      description:
        "Body text for whatever you'd like to say. Add main takeaway points, quotes, anecdotes, or even a very very short story.",
    },
    {
      id: 2,
      name: "Plant 2",
      description:
        "Body text for whatever you'd like to say. Add main takeaway points, quotes, anecdotes, or even a very very short story.",
    },
  ]);

  const handleAddPlant = () => {
    const newPlant = {
      id: plants.length + 1,
      name: `Plant ${plants.length + 1}`,
      description:
        "Body text for whatever you'd like to say. Add main takeaway points, quotes, anecdotes, or even a very very short story.",
    };
    setPlants([...plants, newPlant]);
  };

  // เลือกว่าจะ render อะไรในด้านขวา ตาม page
  const renderContent = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;

      case "plant-stats":
        return (
          <PlantStats plants={plants} onAddPlant={handleAddPlant} />
        );

      case "map":
        return (
          <div>
            <h1>Map Page</h1>
            <p>คุณกำลังอยู่ที่หน้า Map</p>
          </div>
        );

      case "about":
        return (
          <div>
            <h1>About Us Page</h1>
            <p>คุณกำลังอยู่ที่หน้า About Us</p>
          </div>
        );

      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar รับ props currentPage & setPage */}
      <Sidebar currentPage={page} setPage={setPage} />

      {/* เนื้อหาด้านขวา */}
      <main className="flex-1 p-10 bg-gray-100 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
