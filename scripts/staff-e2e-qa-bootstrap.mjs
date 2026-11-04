import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const apiBase = process.env.E2E_BACKEND_API_URL || 'http://127.0.0.1:8080/api';
const adminEmail = process.env.QA_ADMIN_EMAIL;
const adminPassword = process.env.QA_ADMIN_PASSWORD;
const staffEmail = process.env.QA_STAFF_EMAIL;
const staffPassword = process.env.QA_STAFF_PASSWORD;
const createStaffEmail = process.env.QA_CREATE_STAFF_EMAIL;
const createStaffPassword = process.env.QA_CREATE_STAFF_PASSWORD;
const userEmail = process.env.QA_USER_EMAIL;
const userPassword = process.env.QA_USER_PASSWORD;
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

async function registerQaUser(email, password, label, name) {
  return postJson('/auth/register', {
    name,
    email,
    phone: '',
    password,
  }, label);
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
  required(createStaffEmail, 'QA_CREATE_STAFF_EMAIL');
  required(createStaffPassword, 'QA_CREATE_STAFF_PASSWORD');
  required(userEmail, 'QA_USER_EMAIL');
  required(userPassword, 'QA_USER_PASSWORD');
  required(employeeNumber, 'QA_EMPLOYEE_NUMBER');
  const githubEnv = required(process.env.GITHUB_ENV, 'GITHUB_ENV');
  process.env.PGPASSWORD = required(process.env.QA_DB_PASSWORD, 'QA_DB_PASSWORD');

  await registerQaUser(adminEmail, adminPassword, 'ADMIN QA registration', 'E2E QA Administrator');

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

  await registerQaUser(staffEmail, staffPassword, 'Staff QA registration', 'E2E QA Staff Member');

  const staffLookup = queryQaDatabase(staffEmail, `
    SELECT COUNT(*)::text || ':' || COALESCE(MIN(user_id)::text, '')
    FROM users WHERE email = :'qa_email';
  `);
  const staffMatch = /^1:(\d+)$/.exec(staffLookup);
  if (!staffMatch) throw new Error('Could not identify exactly one registered Staff QA user.');

  await registerQaUser(createStaffEmail, createStaffPassword, 'UI-created staff QA registration', 'E2E QA Staff To Create');
  const createStaffLookup = queryQaDatabase(createStaffEmail, `
    SELECT COUNT(*)::text || ':' || COALESCE(MIN(user_id)::text, '')
    FROM users WHERE email = :'qa_email';
  `);
  const createStaffMatch = /^1:(\d+)$/.exec(createStaffLookup);
  if (!createStaffMatch) throw new Error('Could not identify exactly one UI-created Staff QA user.');

  await registerQaUser(userEmail, userPassword, 'USER authorization QA registration', 'E2E QA User');

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

  appendFileSync(githubEnv, `QA_CREATE_STAFF_USER_ID=${createStaffMatch[1]}\n`, { encoding: 'utf8' });

  console.log('Isolated QA accounts registered; ADMIN promoted; baseline staff profile created through the authenticated Backend API.');
}

main().catch(error => {
  console.error(`QA bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
