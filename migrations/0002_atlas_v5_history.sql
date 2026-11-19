-- ATLAS V5 / Gobierno: historial acotado por workspace.
-- Aplicar tras 0001_atlas_v5.sql. No migrar automáticamente la base productiva.
-- El historial contiene snapshots JSON (puede incluir datos del usuario);
-- retener exclusivamente 5 revisiones más recientes por workspace.
CREATE TABLE IF NOT EXISTS atlas_workspace_revisions (
  tenant_id TEXT NOT NULL REFERENCES atlas_tenants(id),
  workspace_id TEXT NOT NULL REFERENCES atlas_workspaces(id),
  revision INTEGER NOT NULL CHECK(revision>=1),
  state_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, workspace_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_atlas_revision_latest
  ON atlas_workspace_revisions(tenant_id,workspace_id,revision DESC);
