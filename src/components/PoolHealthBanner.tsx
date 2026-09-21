import { poolHealth } from "@/lib/agent";
import { Alert } from "./ui";

export function PoolHealthBanner({ audience }: { audience: "user" | "admin" }) {
  const health = poolHealth();
  if (health.kind === "ok") return null;
  const kind = health.kind === "no-sources" || health.kind === "source-error" ? "error" : "warn";
  return (
    <div className="mb-6">
      <Alert kind={kind}>{audience === "admin" ? health.adminMessage : health.userMessage}</Alert>
    </div>
  );
}
