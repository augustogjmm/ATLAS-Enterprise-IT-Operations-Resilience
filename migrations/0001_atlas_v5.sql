-- ATLAS V5: base multiusuario aislada por organización (Cloudflare D1 / SQLite).
-- No importar automáticamente datos locales ni crear organizaciones en producción.
-- Cloudflare D1 aplica claves foráneas automáticamente. PRAGMA foreign_keys=ON está
-- prohibido en D1; los ensayos con SQLite Node deben habilitarlo en sus fixtures.

CREATE TABLE IF NOT EXISTS atlas_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS atlas_memberships (
  tenant_id TEXT NOT NULL REFERENCES atlas_tenants(id),
  email TEXT NOT NULL COLLATE NOCASE,
  access_sub TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','editor','auditor','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_atlas_memberships_email ON atlas_memberships(email, status);

CREATE TABLE IF NOT EXISTS atlas_workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES atlas_tenants(id),
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  state_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_atlas_workspaces_tenant ON atlas_workspaces(tenant_id, updated_at DESC);

-- Auditoría de backend: no deriva de los eventos locales editables del workspace.
CREATE TABLE IF NOT EXISTS atlas_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES atlas_tenants(id),
  workspace_id TEXT REFERENCES atlas_workspaces(id),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_revision INTEGER,
  new_revision INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_atlas_audit_tenant ON atlas_audit_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_audit_workspace ON atlas_audit_events(tenant_id, workspace_id, occurred_at DESC);
