import { execFileSync } from 'node:child_process';

const apiBase = process.env.E2E_BACKEND_API_URL || 'http://127.0.0.1:8080/api';
const adminEmail = process.env.QA_ADMIN_EMAIL;
const adminPassword = process.env.QA_ADMIN_PASSWORD;
const staffEmail = process.env.QA_STAFF_EMAIL;
const staffPassword = process.env.QA_STAFF_PASSWORD;
const employeeNumber = process.env.QA_EMPLOYEE_NUMBER;

function required(value, name) {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function postJson(path, body, label, token) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`${label} request could not reach Backend.`);
  }
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  return response;
}

function queryQaDatabase(email, sql) {
  try {
    return execFileSync('docker', [
      'exec', '-i', '--env', `PGPASSWORD=${process.env.PGPASSWORD}`, 'staff-e2e-postgres',
      'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
      '-U', 'postgres', '-d', 'morphia3d', '-v', `qa_email=${email}`,
      '-f', '-',
    ], {
      encoding: 'utf8',
      env: process.env,
      input: sql,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error('QA database bootstrap query failed.');
  }
}

async function main() {
  required(adminEmail, 'QA_ADMIN_EMAIL');
  required(adminPassword, 'QA_ADMIN_PASSWORD');
  required(staffEmail, 'QA_STAFF_EMAIL');
  required(staffPassword, 'QA_STAFF_PASSWORD');
  required(employeeNumber, 'QA_EMPLOYEE_NUMBER');
  process.env.PGPASSWORD = required(process.env.QA_DB_PASSWORD, 'QA_DB_PASSWORD');

  await postJson('/auth/register', {
    name: 'E2E QA Administrator',
    email: adminEmail,
    phone: '',
    password: adminPassword,
  }, 'ADMIN QA registration');

  const updatedAdmin = queryQaDatabase(adminEmail, `
    WITH changed AS (
      UPDATE users SET role = 'ADMIN'
      WHERE email = :'qa_email' AND role = 'USER'
      RETURNING user_id
    )
    SELECT COUNT(*)::text || ':' || COALESCE(MIN(user_id)::text, '') FROM changed;
  `);
  if (!/^1:\d+$/.test(updatedAdmin)) {
    throw new Error('QA role promotion did not update exactly one newly registered user.');
  }

  await postJson('/auth/register', {
    name: 'E2E QA Staff Member',
    email: staffEmail,
    phone: '',
    password: staffPassword,
  }, 'Staff QA registration');

  const staffLookup = queryQaDatabase(staffEmail, `
    SELECT COUNT(*)::text || ':' || COALESCE(MIN(user_id)::text, '')
    FROM users WHERE email = :'qa_email';
  `);
  const staffMatch = /^1:(\d+)$/.exec(staffLookup);
  if (!staffMatch) throw new Error('Could not identify exactly one registered Staff QA user.');

  const loginResponse = await postJson('/auth/login', {
    email: adminEmail,
    password: adminPassword,
  }, 'ADMIN QA login');
  const loginData = await loginResponse.json();
  if (typeof loginData.token !== 'string' || !loginData.token) {
    throw new Error('ADMIN QA login did not return a JWT.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const staffResponse = await postJson('/admin/staff', {
    userId: Number(staffMatch[1]),
    employeeNumber,
    department: 'E2E QA',
    jobTitle: 'E2E Staff Member',
    joinedAt: today,
  }, 'Staff profile creation', loginData.token);
  const profile = await staffResponse.json();
  if (staffResponse.status !== 201 || profile.employeeNumber !== employeeNumber) {
    throw new Error('Staff profile API did not return the expected HTTP 201 fixture.');
  }

  console.log('QA users registered; exactly one ADMIN promoted; staff profile created through the authenticated Backend API.');
}

main().catch(error => {
  console.error(`QA bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
