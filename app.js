const express = require('express');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Main endpoint to query MCP servers
app.post('/query-mcp', (req, res) => {
    const { server, tool, args } = req.body;

    // Determine which MCP URL to use
    const mcpUrls = {
        'kite': 'https://mcp.kite.trade/mcp',
        'groww': 'https://mcp.groww.in/mcp'
    };

    const targetUrl = mcpUrls[server];
    if (!targetUrl) return res.status(400).send({ error: "Invalid server" });

    // Construct the terminal command
    // We use --tool to specify the function (e.g., get_holdings)
    const command = `npx mcp-remote ${targetUrl} --tool ${tool}`;

    console.log(`Executing: ${command}`);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${stderr}`);
            return res.status(500).send({ error: stderr });
        }
        try {
            res.json(JSON.parse(stdout));
        } catch (e) {
            res.send({ raw: stdout });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Bridge API running at http://localhost:${PORT}`);
});
