const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.options('*', cors());
app.use(express.json());

// Main endpoint to query MCP servers
app.post('/query-mcp', (req, res) => {
  const { server, tool, args } = req.body || {};

  if (!server || !tool) {
    return res.status(400).json({ error: 'Missing required fields: server and tool' });
  }

  // Determine which MCP URL to use
  const mcpUrls = {
    kite: 'https://mcp.kite.trade/mcp',
    groww: 'https://mcp.groww.in/mcp',
  };

  const targetUrl = mcpUrls[server];
  if (!targetUrl) return res.status(400).json({ error: 'Invalid server' });

  // Build the command arguments for spawn:
  // npx mcp-remote <targetUrl> --tool <tool> [additional args...]
  const baseArgs = ['mcp-remote', targetUrl, '--tool', tool];
  let extraArgs = [];

  if (args) {
    if (Array.isArray(args)) {
      extraArgs = args.map(String);
    } else if (typeof args === 'string' && args.trim()) {
      // split on whitespace for a quick convenience (avoid complex shell parsing)
      extraArgs = args.trim().split(/\s+/);
    } else {
      // if it's some other type, coerce to string
      extraArgs = [String(args)];
    }
  }

  const cmd = 'npx';
  const cmdArgs = baseArgs.concat(extraArgs);

  console.log('Executing:', cmd, cmdArgs.join(' '));

  const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  const TIMEOUT_MS = 30_000; // 30s timeout

  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
  }, TIMEOUT_MS);

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    console.error('Failed to start process:', err);
    return res.status(500).json({ error: 'Failed to start mcp-remote', detail: err.message });
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      console.error('mcp-remote exited with code', code, 'stderr:', stderr);
      return res.status(500).json({ error: stderr || `mcp-remote exited with code ${code}` });
    }

    // Try to parse JSON result, otherwise return raw output
    try {
      const parsed = JSON.parse(stdout);
      return res.json(parsed);
    } catch (e) {
      // Not valid JSON — return raw stdout plus a parse hint
      return res.json({ raw: stdout, parseError: e.message });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Bridge API running at http://localhost:${PORT}`);
});
