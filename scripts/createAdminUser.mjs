#!/usr/bin/env node
// create-super-admin.mjs
// Usage:
//   Interactive: node create-super-admin.mjs
//   With args:   node create-super-admin.mjs --name "Jane Admin" --email jane@example.com --password "secret"
// Requires: npm i pg argon2

import { Client } from 'pg';
import argon2 from 'argon2';
import readline from 'readline';

// ---- Config ----
const DATABASE_URL = 'postgresql://postgres:!Jameson5475!@45.63.69.221:5432/karaoke';

// ---- Tiny argv parser ----
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), argv[i + 1]];
      if (!a.includes('=') && typeof v === 'string' && !v.startsWith('--')) {
        out[k] = v;
        i++;
      } else {
        out[k] = v ?? true;
      }
    }
  }
  return out;
}

// ---- Readline helpers ----
function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
}
function question(rl, q) {
  return new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));
}
/**
 * Ask for hidden input (no echo). Shows the prompt text, masks entered chars.
 */
async function questionHidden(rl, promptText = 'Password: ') {
  // Override rl internal write to mask characters
  const origWrite = rl._writeToOutput;
  rl._writeToOutput = function (stringToWrite) {
    // Keep the actual prompt visible, mask subsequent input
    if (this.stdoutMuted) {
      // Preserve newlines (on Enter), otherwise print '*'
      if (stringToWrite.endsWith('\n')) {
        origWrite.call(this, '\n');
      } else {
        origWrite.call(this, '*');
      }
    } else {
      origWrite.call(this, stringToWrite);
    }
  };

  rl.stdoutMuted = false;
  const answer = await new Promise((resolve) => {
    rl.stdoutMuted = true;
    rl.question(promptText, (val) => {
      rl.stdoutMuted = false;
      rl._writeToOutput = origWrite;
      // print a newline after hidden entry
      process.stdout.write('\n');
      resolve(val);
    });
  });
  return answer;
}

// ---- SQL ----
const SQL = {
  // sanity: ensure password_hash column exists
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
  const args = parseArgs(process.argv);
  const rl = createRL();

  try {
    console.log('Create / ensure a Super Admin user\n');

    // Collect inputs (args override interactive)
    const name = (args.name ?? (await question(rl, 'Full name: '))).trim();
    const email = ((args.email ?? (await question(rl, 'Email: '))).trim()).toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }

    let password = args.password;
    if (!password) {
      const pw1 = await questionHidden(rl, 'Password: ');
      const pw2 = await questionHidden(rl, 'Confirm password: ');
      if (!pw1) throw new Error('Password cannot be empty.');
      if (pw1 !== pw2) throw new Error('Passwords do not match.');
      password = pw1;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 19456, // ~19MB
      parallelism: 2,
    });

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      // Make sure users.password_hash is present
      const chk = await client.query(SQL.checkPasswordHashColumn);
      if (chk.rowCount === 0) {
        throw new Error(
          "The column public.users.password_hash doesn't exist. " +
          "Add it first: ALTER TABLE public.users ADD COLUMN password_hash text NOT NULL;"
        );
      }

      await client.query('BEGIN');

      // Ensure admin role + permission, then link them
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
        console.log(`Updated existing user ${email} (and set admin role).`);
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
