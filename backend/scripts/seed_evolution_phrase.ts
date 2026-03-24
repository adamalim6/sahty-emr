import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

async function seedEvolution() {
  try {
    const pool = getGlobalPool();
    const res = await pool.query('SELECT id FROM tenants LIMIT 1;');
    if (res.rows.length === 0) {
      console.error('No tenants found!');
      process.exit(1);
    }
    const tenantId = res.rows[0].id;
    console.log(`Using tenant ID: ${tenantId}`);

    const tenantPool = getTenantPool(tenantId);

    const insertQuery = `
      INSERT INTO smart_phrases (
          id,
          trigger,
          trigger_search,
          label,
          description,
          body_html,
          scope,
          tenant_id,
          user_id,
          is_active,
          created_at,
          updated_at
      )
      VALUES (
          gen_random_uuid(),
          'evolution',
          'evolution',
          'Évolution (Smart Values Test)',
          'Test phrase for embedded smart values compiler',
          '
      <p><strong>Dernières constantes</strong></p>
      {{vitals}}

      <p><strong>Addictions</strong></p>
      {{addictions}}

      <p><strong>Allergies</strong></p>
      {{allergies}}

      <p>{{cursor}}</p>
      ',
          'tenant',
          $1,
          NULL,
          TRUE,
          NOW(),
          NOW()
      );
    `;

    // Try deleting it first if it exists to avoid unique constraint collisions
    await tenantPool.query("DELETE FROM smart_phrases WHERE trigger = 'evolution';");
    
    await tenantPool.query(insertQuery, [tenantId]);
    console.log('Successfully seeded /evolution phrase!');
  } catch (error) {
    console.error('Failed to seed:', error);
  } finally {
    process.exit(0);
  }
}

seedEvolution();
