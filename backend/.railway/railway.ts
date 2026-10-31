import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "iad" });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const postgresVolumeFEFA = volume("postgres-volume-fEFA", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "iad", sizeMB: 500 });
  const postgresVolumeOI5z = volume("postgres-volume-OI5z", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "iad", sizeMB: 500 });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "iad", sizeMB: 500 });
  const BoardingEdu = service("BoardingEdu", {
    // builder from CaC: "NIXPACKS"
    source: github("Shridhanya77/BoardingEdu", { branch: "main", checkSuites: false, rootDirectory: "backend" }),
    build: "cd backend && chmod +x build.sh && ./build.sh",
    start: "cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --timeout 120",
    healthcheck: "/healthz",
    healthcheckTimeout: 300,
    replicas: { "iad": 1 },
    networking: { privateNetworkEndpoint: "boardingedu" },
    env: { ALLOWED_HOSTS: preserve(), CLOUDFLARE_R2_ACCESS_KEY_ID: preserve(), CLOUDFLARE_R2_ACCOUNT_ID: preserve(), CLOUDFLARE_R2_BUCKET: preserve(), CLOUDFLARE_R2_SECRET_ACCESS_KEY: preserve(), CLOUDINARY_API_KEY: preserve(), CLOUDINARY_API_SECRET: preserve(), CLOUDINARY_CLOUD_NAME: preserve(), CORS_ALLOWED_ORIGINS: preserve(), CORS_ALLOWED_ORIGIN_REGEXES: preserve(), CSRF_TRUSTED_ORIGINS: preserve(), DATABASE_SSL_REQUIRE: preserve(), DATABASE_URL: preserve(), DB_HOST: preserve(), DB_NAME: preserve(), DB_PASSWORD: preserve(), DB_PORT: preserve(), DB_USER: preserve(), DEBUG: preserve(), MEILI_URL: preserve(), MISE_PYTHON_GITHUB_ATTESTATIONS: preserve(), PYTHON_VERSION: preserve(), REDIS_URL: preserve(), SECRET_KEY: preserve() },
  });
  const backend = service("backend", {
    // builder from CaC: "NIXPACKS"
    build: "chmod +x ./build.sh && ./build.sh",
    start: "gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --timeout 120",
    healthcheck: "/healthz",
    healthcheckTimeout: 300,
  });

  return project("fortunate-strength", {
    variables: { managed: true },
    resources: [BoardingEdu, Postgres, postgresVolumeFEFA, postgresVolumeOI5z, postgresVolume, backend],
  });
});
