// Writes public/version.txt so /version.txt always names the live commit.
// CI writes it before `railway up`; Railway's own GitHub rebuilds (e.g. after a variable change)
// get it from RAILWAY_GIT_COMMIT_SHA. An existing file is kept; local builds without either skip.
import { existsSync, writeFileSync } from "node:fs";
const file = new URL("../public/version.txt", import.meta.url);
const sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
if (!existsSync(file) && sha) writeFileSync(file, sha + "\n");
