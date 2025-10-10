#!/usr/bin/env node
// createAdminUser.mjs
// Usage:
//   Interactive: node create-super-admin.mjs
//   With args:   node create-super-admin.mjs --name "Jane Admin" --email jane@example.com --password "secret"
// Requires: npm i pg argon2

import { Client } from 'pg';
import argon2 from 'argon2';
import readline from 'readline';

// ---- Config ----
// Use an environment variable for the database URL for better security.
// Example: export DATABASE_URL='postgresql://user:pass@host:port/db'
const DATABASE_URL = process.env.DATABASE_URL;

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
 * @param {readline.Interface} rl - The readline interface.
 * @param {string} promptText - The text to display before input.
 * @returns {Promise<string>} The user's hidden input.
 */
async function questionHidden(rl, promptText = 'Password: ') {
  // Store original write function
  const origWrite = rl._writeToOutput;

  // Override rl internal write to mask characters
  rl._writeToOutput = function (stringToWrite) {
    if (rl.stdoutMuted) {
      // Mask input with '*' but allow newlines to pass through
      if (stringToWrite.endsWith('\n')) {
        origWrite.call(this, '\n');
      } else {
        origWrite.call(this, '*');
      }
    } else {
      // Write normally if not muted
      origWrite.call(this, stringToWrite);
    }
  };

  // Manually write the prompt text so it's not affected by the mute
  rl.output.write(promptText);
  rl.stdoutMuted = true;

  const answer = await new Promise((resolve) => {
    // Ask question with an empty prompt since we already wrote it
    rl.question('', (val) => {
      // Restore original functionality
      rl.stdoutMuted = false;
      rl._writeToOutput = origWrite;
      // Manually write a newline because the muted input doesn't
      rl.output.write('\n');
      resolve(val);
    });
  });

  return answer;
}

// ---- SQL Queries ----
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
  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.');
    console.log('Please set it before running the script, e.g.,');
    console.log("export DATABASE_URL='postgresql://user:pass@host:port/database'");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const rl = createRL();

  try {
    console.log('✨ Create / ensure a Super Admin user\n');

    // Collect inputs (args override interactive)
    const name = (args.name ?? (await question(rl, 'Full Name: '))).trim();
    const email = (args.email ?? (await question(rl, 'User Email: '))).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }

    let password = args.password;
    if (!password) {
      const pw1 = await questionHidden(rl, 'Create New Password: ');
      const pw2 = await questionHidden(rl, 'Verify Password: ');
      if (!pw1) throw new Error('Password cannot be empty.');
      if (pw1 !== pw2) throw new Error('Passwords do not match.');
      password = pw1;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: 2,
      memoryCost: 1048576, // ~19MB
      parallelism: 4,
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

      console.log('\n✅ Global Admin Account Creation Successful!');
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
