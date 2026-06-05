async function loadApp() {
  const { default: app } = await import("../artifacts/api-server/dist/index.mjs");
  return app;
}

let appPromise = loadApp();

export default async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
