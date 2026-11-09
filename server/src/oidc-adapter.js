import { query } from "./db.js";

export default class PostgresOidcAdapter {
  constructor(model) {
    this.model = model;
  }

  async upsert(id, payload, expiresIn) {
    const expiresAt = Number.isFinite(expiresIn)
      ? new Date(Date.now() + Math.max(0, expiresIn) * 1000)
      : null;
    await query(
      `INSERT INTO oidc_artifacts (model, id, payload, expires_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (model, id) DO UPDATE
       SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
      [this.model, id, JSON.stringify(payload), expiresAt]
    );
  }

  async find(id) {
    const result = await query(
      `SELECT payload, consumed_at FROM oidc_artifacts
       WHERE model = $1 AND id = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
      [this.model, id]
    );
    if (!result.rowCount) return undefined;
    const payload = result.rows[0].payload;
    if (result.rows[0].consumed_at) {
      payload.consumed = Math.floor(new Date(result.rows[0].consumed_at).getTime() / 1000);
    }
    return payload;
  }

  async findByUserCode(userCode) {
    const result = await query(
      `SELECT payload, consumed_at FROM oidc_artifacts
       WHERE model = $1 AND payload->>'userCode' = $2
       AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [this.model, userCode]
    );
    if (!result.rowCount) return undefined;
    const payload = result.rows[0].payload;
    if (result.rows[0].consumed_at) {
      payload.consumed = Math.floor(new Date(result.rows[0].consumed_at).getTime() / 1000);
    }
    return payload;
  }

  async consume(id) {
    await query(
      "UPDATE oidc_artifacts SET consumed_at = COALESCE(consumed_at, NOW()), updated_at = NOW() WHERE model = $1 AND id = $2",
      [this.model, id]
    );
  }

  async destroy(id) {
    const artifact = await this.find(id);
    if (artifact?.grantId) {
      await query("DELETE FROM oidc_artifacts WHERE payload->>'grantId' = $1", [artifact.grantId]);
    }
    await query("DELETE FROM oidc_artifacts WHERE model = $1 AND id = $2", [this.model, id]);
  }

  async revokeByGrantId(grantId) {
    await query("DELETE FROM oidc_artifacts WHERE payload->>'grantId' = $1", [grantId]);
  }
}
