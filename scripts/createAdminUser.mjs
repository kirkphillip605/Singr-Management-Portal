// create-super-admin.mjs
// Usage: node create-super-admin.mjs
// Requires: npm i pg argon2

import { Client } from 'pg';
import argon2 from 'argon2';
import readline from 'readline';
import { Writable } from 'stream';

const DATABASE_URL = 'postgresql://postgres:!Jameson5475!@45.63.69.221:5432/karaoke';

// ------------ prompt helpers ------------
function rlStd() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}
function ask(rl, q) {
  return new Promise((res) => rl.question(q, res));
}
async function askHidden(promptText) {
  const mute = new Writable({ write(_c, _e, cb) { cb(); } });
  const rl = readline.createInterface({ input: process.stdin, output: mute, terminal: true });
  const ans = await new Promise((res) => rl.question(promptText, res));
  rl.close();
  process.stdout.write('\n');
  return ans;
}

// ------------ SQL ------------
const SQL = {
  // sanity check: ensure users.password_hash exists
  checkPasswordHashColumn: `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password_hash';
  `,

  ensureAdminRole: `
    INSERT INTO public.roles (id, name, display_name, is_system)
    VALUES (gen_random_uuid(), 'admin', 'Global Administrator', TRUE)
    ON CONFLICT (name) DO UPDATE
      SET display_name = EXCLUDED.display_name, is_system = TRUE
    RETURNING id;
  `,

  ensureAdminAllPermission: `
    INSERT INTO public.permissions (id, description)
    VALUES ('admin.all', 'All administrative actions across the system')
    ON CONFLICT (id) DO NOTHING;
  `,

  linkAdminRolePermission: `
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES ($1, 'admin.all')
    ON CONFLICT DO NOTHING;
  `,

  findUserByEmail: `
    SELECT id FROM public.users WHERE email = $1;
  `,

  createUser: `
    INSERT INTO public.users (name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id;
  `,

  updateUserCore: `
    UPDATE public.users
       SET name = COALESCE($1, name),
           password_hash = $2,
           updated_at = now()
     WHERE id = $3;
  `,

  assignAdminRole: `
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;
  `,
};

async function main() {
  const rl = rlStd();
  try {
    console.log('Create / ensure a Super Admin user\n');

    const name = (await ask(rl, 'Full name: ')).trim();
    const email = (await ask(rl, 'Email: ')).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }

    const pw1 = await askHidden('Password: ');
    const pw2 = await askHidden('Confirm Password: ');
    if (!pw1) throw new Error('Password cannot be empty.');
    if (pw1 !== pw2) throw new Error('Passwords do not match.');

    const passwordHash = await argon2.hash(pw1, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 19456, // ~19MB
      parallelism: 1,
    });

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      // sanity check: users.password_hash must exist
      const chk = await client.query(SQL.checkPasswordHashColumn);
      if (chk.rowCount === 0) {
        throw new Error(
          "The column public.users.password_hash doesn't exist. " +
          "Please add it (e.g. ALTER TABLE public.users ADD COLUMN password_hash text NOT NULL;)"
        );
      }

      await client.query('BEGIN');

      // Ensure admin role & permission, then link
      const adminRoleRes = await client.query(SQL.ensureAdminRole);
      const adminRoleId = adminRoleRes.rows[0].id;
      await client.query(SQL.ensureAdminAllPermission);
      await client.query(SQL.linkAdminRolePermission, [adminRoleId]);

      // Create or update user
      const existing = await client.query(SQL.findUserByEmail, [email]);
      let userId;
      if (existing.rowCount > 0) {
        userId = existing.rows[0].id;
        await client.query(SQL.updateUserCore, [name || null, passwordHash, userId]);
        console.log(`Updated existing user ${email} and set admin role.`);
      } else {
        const created = await client.query(SQL.createUser, [name || null, email, passwordHash]);
        userId = created.rows[0].id;
        console.log(`Created user ${email} (${userId}).`);
      }

      // Assign admin role
      await client.query(SQL.assignAdminRole, [userId, adminRoleId]);

      await client.query('COMMIT');

      console.log('\n✅ Super Admin ready!');
      console.log(`- Email: ${email}`);
      console.log(`- Role: admin`);
      console.log(`- Permission linked to role: admin.all`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
