import http from 'node:http';

const port = Number(process.env.TEST_SERVER_PORT) || 3456;

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const queryTitle = url.searchParams.get('title');
  const pathTitle = url.pathname.slice(1);
  const rawTitle = (queryTitle ?? pathTitle) || 'Default Title';
  const title = escapeHtml(rawTitle);

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body><h1>${title}</h1></body>
</html>`);
});

server.listen(port, () => {
  console.log(`E2E test server listening on http://localhost:${port}`);
});
