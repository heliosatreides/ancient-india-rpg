const { execSync } = require('child_process');
try {
  execSync('node test.js', { cwd: '/tmp/ancient-india-rpg', stdio: 'inherit' });
  console.log('All tests completed.');
} catch (e) {
  console.error('Tests failed');
  process.exit(1);
}
