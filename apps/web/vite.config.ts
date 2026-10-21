import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@framesense/camera": path.resolve(__dirname, "../../packages/camera/src"),
      "@framesense/composition": path.resolve(__dirname, "../../packages/composition/src"),
      "@framesense/config": path.resolve(__dirname, "../../packages/config/src"),
      "@framesense/core": path.resolve(__dirname, "../../packages/core/src"),
      "@framesense/feedback": path.resolve(__dirname, "../../packages/feedback/src"),
      "@framesense/guidance": path.resolve(__dirname, "../../packages/guidance/src"),
      "@framesense/perception": path.resolve(__dirname, "../../packages/perception/src"),
    },
  },
  worker: {
    format: "es",
  },
});
