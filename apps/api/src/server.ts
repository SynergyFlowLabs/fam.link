import { createApp } from './app.js';

const port = Number(process.env['PORT'] ?? 8787);
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Fam Link API listening on http://0.0.0.0:${port}`);
});
