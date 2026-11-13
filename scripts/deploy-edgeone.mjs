// 打包并部署到 EdgeOne Makers（项目 awmcedge）。用法：node scripts/deploy-edgeone.mjs
// 只上传线上需要的文件：legacy / tests / docs / scripts / *.mp4 都不进包。
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staging = await mkdtemp(join(tmpdir(), 'xiaoxing-deploy-'));
const include = ['index.html', 'styles.css', 'src', 'firmware', 'promo'];

try {
  for (const entry of include) await cp(join(root, entry), join(staging, entry), { recursive: true });
  await rm(join(staging, 'promo', 'xiaoxing-promo.mp4'), { force: true });

  const cli = process.env.EDGEONE_BIN || 'edgeone';
  const child = spawn(cli, ['makers', 'deploy', staging, '-n', 'awmcedge', '-e', 'production', '--json'], { stdio: 'inherit' });
  await new Promise((done, fail) => {
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`edgeone deploy 退出码 ${code}`))));
    child.on('error', fail);
  });
} finally {
  await rm(staging, { recursive: true, force: true });
}
