import React, { useRef } from "react";
import { useKeyboardAdaptiveInput } from "../src/index";

export default function App() {
  const ref = useRef(null);
  useKeyboardAdaptiveInput(ref);

  return (
    <div>
      <h1>Library Demo</h1>
      <div style={{ paddingTop: 500, border: "1px solid" }}>padding</div>
      <input ref={ref} />
    </div>
  );
}
