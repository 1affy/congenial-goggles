import React from "react";
import RexyzPfpGenerator from "./RexyzPfpGenerator";
import Starfield from "./Starfield";

function App() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* Фон — звёзды */}
      <Starfield />

      {/* Контент поверх */}
      <div className="relative z-10 p-6">
        <RexyzPfpGenerator />
      </div>
    </div>
  );
}

export default App;
