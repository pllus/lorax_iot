function Sidebar({ currentPage, setPage }) {
  const menuItems = [
    { id: "dashboard", label: "DASHBOARD" },
    { id: "plant-stats", label: "PLANT STATS" },
    { id: "prediction", label: "PREDICTION" },
    { id: "about", label: "ABOUT US" }
  ];

  return (
    <aside className="w-64 bg-[#1f7a4a] text-white flex flex-col p-6">
      {/* Logo */}
      <div className="mb-10">
        <span className="block text-[10px] tracking-[2px]">THE</span>
        <span className="block text-xl font-bold tracking-[1.5px]">DECARBONATOR</span>
        <span className="block text-[10px] tracking-[2px] ml-[150px]">3000</span>
      </div>

      {/* Menu */}
      <nav className="flex flex-col gap-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`text-left px-4 py-2.5 pl-28 rounded-full text-xs tracking-wider transition-colors ${
              currentPage === item.id
                ? "bg-white text-[#1f7a4a]"
                : "bg-transparent hover:bg-white/15"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Plant Icon */}
      <div className="mt-auto flex justify-center items-center pb-5">
        <span className="text-7xl">🌱</span>
      </div>
    </aside>
  );
}

export default Sidebar;