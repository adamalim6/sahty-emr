const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://sahty:sahty@localhost:5432/sahty_global'
});
pool.query(`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_schema = 'reference' AND table_name = 'observation_groups';
`).then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
