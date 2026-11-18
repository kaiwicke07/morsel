// Publishes dist/ to the gh-pages branch (GitHub Pages serves it at /morsel/).
import { execSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';

const run = (cmd, cwd = 'dist') => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
run('git init -q -b gh-pages');
run('git add -A');
run('git -c user.name=deploy -c user.email=deploy@localhost commit -q -m "deploy"');
run(`git push -f ${remote} gh-pages`);
console.log('Deployed.');
