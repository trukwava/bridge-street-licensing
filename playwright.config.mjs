export default {
 testDir: './browser-tests',
 timeout: 30_000,
 expect: { timeout: 5_000 },
 retries: 0,
 workers: 1,
 use: {
  baseURL: 'http://127.0.0.1:4173',
  browserName: 'chromium',
  headless: true,
  trace: 'retain-on-failure'
 },
 reporter: [['list'],['html',{open:'never'}]],
 outputDir: './test-results'
};
