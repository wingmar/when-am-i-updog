import { App } from "./app";
import "./style.css";

document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init().catch((err) => console.error("Initialization error:", err));
});
