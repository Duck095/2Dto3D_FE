import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const authPage = await readFile(new URL('./AuthPage.jsx', import.meta.url), 'utf8');
const authStyles = await readFile(new URL('./auth-page.css', import.meta.url), 'utf8');
const currentUserAccess = await readFile(new URL('../features/auth/currentUserAccess.js', import.meta.url), 'utf8');

test('auth design uses Pocket Joy branding without unsupported sign-in or fake policy actions', () => {
    assert.match(authPage, /2Dto3D/);
    assert.match(authPage, /Pocket Joy/);
    assert.doesNotMatch(authPage, /Morphia|Google|Facebook|Apple|Quên mật khẩu|Forgot password|href="#"|10K\+|50K\+/i);
});

test('login and registration keep the existing API payloads and validation rules', () => {
    assert.match(authPage, /authApi\.register\(\{\s*name:\s*form\.name,\s*email:\s*form\.email,\s*phone:\s*"",\s*password:\s*form\.password,/s);
    assert.match(authPage, /authApi\.login\(\{\s*email:\s*form\.email,\s*password:\s*form\.password,/s);
    assert.match(authPage, /form\.name\.trim\(\)\.length < 2/);
    assert.match(authPage, /!\/\^\\S\+@\\S\+\\\.\\S\+\$\/\.test\(form\.email\)/);
    assert.match(authPage, /form\.password\.length < 8/);
    assert.match(authPage, /form\.password !== form\.confirmPassword/);
    assert.match(authPage, /!form\.registrationConfirmed/);
    assert.match(authPage, /navigate\("\/login"\)/);
});

test('login waits for canonical backend identity and routes ADMIN and USER correctly', () => {
    const loginBranch = authPage.split('const res = await authApi.login')[1]?.split('\n            }')[0] ?? '';
    assert.match(loginBranch, /const currentUser = await login\(res\)/);
    assert.match(loginBranch, /const destination = getPostLoginPath\(currentUser\)/);
    assert.match(loginBranch, /navigate\(destination\)/);
    assert.ok(loginBranch.indexOf('await login(res)') < loginBranch.indexOf('navigate(destination)'));
    assert.match(authPage, /getPostLoginPath/);
    assert.match(currentUserAccess, /contexts\.includes\('ADMIN'\)/);
    assert.match(authPage, /catch \(err\)[\s\S]*?setErrors\(\{ submit:/);
});

test('remember-login state is removed because it is not wired to session persistence', () => {
    assert.doesNotMatch(authPage, /remember|Ghi nhớ đăng nhập/i);
});

test('password visibility button is separate from the input label and remains accessible', () => {
    const passwordInput = authPage.split('function PasswordInput')[1]?.split('function PocketJoyIllustration')[0] ?? '';
    assert.match(passwordInput, /<div className="joy-auth__field">\s*<label htmlFor=\{id\}/);
    assert.match(passwordInput, /<\/label>[\s\S]*<input[\s\S]*<button/);
    assert.doesNotMatch(passwordInput, /<label[^>]*>[\s\S]*<button[\s\S]*<\/label>/);
    assert.match(authPage, /aria-invalid=\{Boolean\(error\)\}/);
    assert.match(authPage, /aria-describedby=\{error \? errorId : undefined\}/);
    assert.match(authPage, /type="button"[\s\S]*?aria-label=\{visible \? 'Ẩn mật khẩu' : 'Hiện mật khẩu'\}/);
});

test('registration confirmation describes the supplied information, not a policy agreement', () => {
    assert.match(authPage, /Tôi xác nhận thông tin đăng ký là chính xác/);
    assert.doesNotMatch(authPage, /đồng ý.{0,40}(điều khoản|chính sách)|terms of service|privacy policy/i);
    assert.doesNotMatch(authPage, /href="#"/);
});

test('auth server errors remain visible and do not discard controlled field values', () => {
    assert.match(authPage, /err\.response\?\.data\?\.message \|\| err\.message/);
    assert.match(authPage, /setErrors\(\{\s*submit:/);
    assert.match(authPage, /setForm\(current => \(\{ \.\.\.current, \[field\]: value \}\)\)/);
    assert.match(authPage, /value=\{form\.password\}/);
    assert.match(authPage, /onClick=\{\(\) => setVisible\(current => !current\)\}/);
});

test('auth submission is guarded against repeated events and registration redirect is cleaned up', () => {
    assert.match(authPage, /submitLockRef\.current/);
    assert.match(authPage, /if \(submitLockRef\.current\) return/);
    assert.match(authPage, /disabled=\{loading \|\| registrationComplete\}/);
    assert.match(authPage, /clearTimeout\(redirectTimerRef\.current\)/);
});

test('auth form comes first on compact screens and becomes a two-column layout on desktop', () => {
    assert.match(authStyles, /grid-template-areas:\s*"form"\s*"intro"/);
    assert.match(authStyles, /@media\s*\(min-width:\s*1024px\)[\s\S]*grid-template-areas:\s*"intro form"[\s\S]*grid-template-columns:/);
    assert.match(authPage, /aria-invalid=\{Boolean\(errors\.email\)\}/);
    assert.match(authPage, /aria-busy=\{loading\}/);
    assert.match(authPage, /role="alert"/);
});
