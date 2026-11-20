// Dev-server proxy shared by every variant: the subset of
// frontend/proxy.config.json the landing page needs. Order matters: Vite takes
// the first prefix that matches, so the file-service routes come before /api.
export const texeraProxy = {
  "/api/config": { target: "http://localhost:9094", changeOrigin: true },
  "/api/dataset": { target: "http://localhost:9092", changeOrigin: true },
  "/api/model/": { target: "http://localhost:9092", changeOrigin: true },
  "/api": { target: "http://localhost:8080", changeOrigin: true },
};
