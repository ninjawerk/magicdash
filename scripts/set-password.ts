/** Usage: npm run set-password <new-password>   — resets the admin password (e.g. over SSH when locked out). */
import { loadAuth, setPassword } from '../server/auth';
const pw = process.argv[2];
if (!pw) {
  console.error('Usage: npm run set-password <new-password>');
  process.exit(1);
}
await loadAuth();
await setPassword(pw);
console.log('Admin password updated. Existing sessions are signed out.');
