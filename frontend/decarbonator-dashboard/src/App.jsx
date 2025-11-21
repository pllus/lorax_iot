import { useState } from "react";
import "./App.css";

function App() {
  // state เก็บว่าเราอยู่หน้าไหน
  const [page, setPage] = useState("dashboard");

  // ฟังก์ชันช่วยเช็คว่าเมนูไหน active
  const getMenuItemClass = (targetPage) =>
    page === targetPage ? "menu-item active" : "menu-item";

  // เนื้อหาที่จะแสดงตรง main content ด้านขวา
  let contentTitle = "";
  let contentSubtitle = "";

  if (page === "dashboard") {
    contentTitle = "Dashboard Page";
    contentSubtitle = "คุณกำลังอยู่ที่หน้า Dashboard";
  } else if (page === "plant-stats") {
    contentTitle = "Plant Stats Page";
    contentSubtitle = "คุณกำลังอยู่ที่หน้า Plant Stats";
  } else if (page === "prediction") {
    contentTitle = "Prediction Page";
    contentSubtitle = "คุณกำลังอยู่ที่หน้า Prediction";
  } else if (page === "about") {
    contentTitle = "About Us Page";
    contentSubtitle = "คุณกำลังอยู่ที่หน้า About Us";
  }

  return (
    <div className="app">
      {/* ด้านซ้าย: Sidebar สีเขียว */}
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-small">THE</span>
          <span className="logo-main">DECARBONATOR</span>
          <span className="logo-sub">3000</span>
        </div>

        <nav className="menu">
          <button
            className={getMenuItemClass("dashboard")}
            onClick={() => setPage("dashboard")}
          >
            DASHBOARD
          </button>

          <button
            className={getMenuItemClass("plant-stats")}
            onClick={() => setPage("plant-stats")}
          >
            PLANT STATS
          </button>

          <button
            className={getMenuItemClass("prediction")}
            onClick={() => setPage("prediction")}
          >
            PREDICTION
          </button>

          <button
            className={getMenuItemClass("about")}
            onClick={() => setPage("about")}
          >
            ABOUT US
          </button>
        </nav>

        <div className="plant-icon">
          <span className="plant-emoji">🌱</span>
        </div>
      </aside>

      {/* ด้านขวา: เนื้อหาหลัก */}
      <main className="content">
        <h1 className="content-title">{contentTitle}</h1>
        <p className="content-subtitle">{contentSubtitle}</p>
      </main>
    </div>
  );
}

export default App;
