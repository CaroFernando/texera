#!/usr/bin/env node
// Seeds the LOCAL local-dev stack with public hub content for the landing page.
//
//   node scripts/seed-hub.mjs
//
// 1. seed-hub.sql: users, public workflows, likes and clones (plain SQL).
// 2. Datasets and models through the file-service API, signed in as the
//    default local admin (texera/texera, see docs/getting-started/AccessLogin.md;
//    override with TEXERA_USER / TEXERA_PASSWORD). They need real LakeFS
//    repositories: getTops drops entries it cannot size, so SQL rows alone
//    never show up.
// 3. Likes for those datasets/models (SQL).
//
// Re-runnable: existing datasets/models with the same name are kept.
// Needs the stack up (bin/local-dev.sh up) and docker on PATH.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = "http://localhost:8080/api";
const FILES = "http://localhost:9092/api";

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", "texera-postgres", "psql", "-U", "texera", "-d", "texera_db", "-v", "ON_ERROR_STOP=1", "-qtA"],
    { input: sql, encoding: "utf8" }
  ).trim();
}

const DATASETS = [
  { name: "nyc-taxi-2025", description: "Yellow and green taxi trips for 2025, monthly parquet files.", likes: 6 },
  { name: "tweets-sample-1m", description: "One million English tweets with timestamps and language tags.", likes: 5 },
  { name: "openaq-sensors", description: "Hourly PM2.5 and NO2 readings from 400 sensors.", likes: 4 },
  { name: "gnomad-chr21-subset", description: "Variant calls for chromosome 21, filtered to PASS.", likes: 2 },
  { name: "retail-weekly-sales", description: "", likes: 1 },
];
const MODELS = [
  { name: "roberta-sentiment-ft", description: "RoBERTa fine-tuned on product reviews (3 classes).", likes: 5 },
  { name: "churn-xgboost-v2", description: "XGBoost churn classifier, AUC 0.91 on holdout.", likes: 3 },
  { name: "taxi-demand-lstm", description: "LSTM forecasting hourly pickups per zone.", likes: 2 },
  { name: "variant-effect-cnn", description: "CNN scoring the functional impact of variants.", likes: 1 },
];

async function post(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} POST ${url}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// 1. workflows ---------------------------------------------------------------
console.log(psql(readFileSync(join(here, "seed-hub.sql"), "utf8")).split("\n").slice(-3).join("\n"));

// 2. datasets + models via the API -------------------------------------------
const { accessToken } = await post(`${WEB}/auth/login`, {
  username: process.env.TEXERA_USER ?? "texera",
  password: process.env.TEXERA_PASSWORD ?? "texera",
});

const existing = new Set(
  psql(
    "SELECT 'dataset:'||name FROM texera_db.dataset WHERE owner_uid = 1 UNION ALL SELECT 'model:'||name FROM texera_db.model WHERE owner_uid = 1;"
  ).split("\n")
);

for (const d of DATASETS) {
  if (existing.has(`dataset:${d.name}`)) continue;
  await post(
    `${FILES}/dataset/create`,
    { datasetName: d.name, datasetDescription: d.description, isDatasetPublic: true, isDatasetDownloadable: true },
    accessToken
  );
  console.log(`created dataset ${d.name}`);
}
for (const m of MODELS) {
  if (existing.has(`model:${m.name}`)) continue;
  await post(
    `${FILES}/model/create`,
    {
      modelName: m.name,
      modelDescription: m.description,
      isModelPublic: true,
      isModelDownloadable: true,
      framework: "pytorch",
      format: "safetensors",
    },
    accessToken
  );
  console.log(`created model ${m.name}`);
}

// 3. likes from the seed users --------------------------------------------------
const values = (rows, kind) => rows.map(r => `('${kind}', '${r.name}', ${r.likes})`).join(", ");
psql(`
SET search_path TO texera_db;
CREATE TEMP TABLE want (kind text, name text, likes int);
INSERT INTO want VALUES ${values(DATASETS, "dataset")}, ${values(MODELS, "model")};
CREATE TEMP TABLE likers AS
  SELECT uid, row_number() OVER (ORDER BY uid) AS n FROM "user" WHERE email LIKE '%@seed.local';
INSERT INTO dataset_user_likes (uid, did)
  SELECT l.uid, d.did FROM want w JOIN dataset d ON d.name = w.name AND d.owner_uid = 1
  JOIN likers l ON l.n <= w.likes WHERE w.kind = 'dataset' ON CONFLICT DO NOTHING;
INSERT INTO model_user_likes (uid, mid)
  SELECT l.uid, m.mid FROM want w JOIN model m ON m.name = w.name AND m.owner_uid = 1
  JOIN likers l ON l.n <= w.likes WHERE w.kind = 'model' ON CONFLICT DO NOTHING;
`);

for (const type of ["workflow", "dataset", "model"]) {
  const count = await (await fetch(`${WEB}/hub/count?entityType=${type}`)).text();
  console.log(`hub ${type}s: ${count}`);
}
