# PM2 Process Manager Guide for myID.africa PWA

## What is PM2?

PM2 is a production-grade process manager for Node.js applications. It provides:
- **Persistent processes** - Apps keep running after you log out
- **Auto-restart** - Automatically restart on crashes
- **Load balancing** - Run multiple instances with clustering
- **Monitoring** - CPU, memory, and performance metrics
- **Log management** - Centralized log handling with rotation
- **Zero-downtime reloads** - Update code without stopping the service

## Quick Start

### 1. Build and Start

```bash
# Navigate to project directory
cd /perform1/srv/work/myid-app

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Build for production
npm run build

# Start with PM2
npm run pm2:start
```

Expected output:
```
[PM2] Spawning PM2 daemon with pm2_home=/root/.pm2
[PM2] PM2 Successfully daemonized
[PM2][WARN] Applications myid-pwa not running, starting...
[PM2][WARN] Applications myid-hsm not running, starting...
[PM2] App [myid-pwa] launched (1 instances)
[PM2] App [myid-hsm] launched (1 instances)
```

### 2. Check Status

```bash
npm run pm2:status
```

Output:
```
┌─────┬────────────┬─────────┬─────────┬──────────┬────────┬──────┐
│ id  │ name       │ mode    │ ↺      │ status   │ cpu    │ mem   │
├─────┼────────────┼─────────┼─────────┼──────────┼────────┼──────┤
│ 0   │ myid-pwa   │ cluster │ 0       │ online   │ 0%     │ 85mb  │
│ 1   │ myid-hsm   │ cluster │ 0       │ online   │ 0%     │ 42mb  │
└─────┴────────────┴─────────┴─────────┴──────────┴────────┴──────┘
```

### 3. View Logs

```bash
# All logs
npm run pm2:logs

# Specific process
pm2 logs myid-pwa
pm2 logs myid-hsm

# Last 100 lines
pm2 logs --lines 100
```

### 4. Test the Application

```bash
# Check PWA frontend
curl http://localhost:3000

# Check HSM backend health endpoint
curl http://localhost:3001/health
```

## Common Tasks

### Updating the Application

```bash
# Pull latest code
git pull

# Rebuild
npm run build

# Zero-downtime reload
npm run pm2:reload
```

### Monitoring

**Terminal Monitoring:**
```bash
npm run pm2:monit
```

Shows real-time CPU, memory, and logs in an interactive terminal dashboard.

**Web Monitoring:**
```bash
# Start web interface on port 9615
npm run pm2:web
```

Access at `http://localhost:9615`

**For remote access:**
```bash
# On server
pm2 web --host 0.0.0.0 --port 9615

# On your local machine, create SSH tunnel
ssh -L 9615:localhost:9615 user@server-ip

# Open browser
open http://localhost:9615
```

### Restarting Processes

```bash
# Restart all
npm run pm2:restart

# Restart specific process
pm2 restart myid-pwa
pm2 restart myid-hsm

# Reload (zero-downtime)
npm run pm2:reload
```

### Stopping and Removing

```bash
# Stop all processes
npm run pm2:stop

# Stop specific process
pm2 stop myid-pwa
pm2 stop myid-hsm

# Delete from PM2 (removes from process list)
npm run pm2:delete
```

## Advanced Configuration

### Startup on System Boot

Make PM2 start automatically when the server reboots:

```bash
# Generate startup script
pm2 startup

# This will output a command to run with sudo, for example:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Run the command it provides

# Save current process list
pm2 save
```

After reboot, PM2 will automatically resurrect your processes.

### Log Rotation

Install and configure log rotation to prevent logs from consuming disk space:

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M        # Rotate at 10MB
pm2 set pm2-logrotate:retain 7            # Keep 7 rotated files
pm2 set pm2-logrotate:compress true       # Compress old logs
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Daily at midnight
```

### Environment Variables

The `ecosystem.config.cjs` file defines environment variables:

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  // Add custom env vars here
}
```

To use different environments:

```bash
# Start with development environment
pm2 start ecosystem.config.cjs --env development

# Start with production environment (default)
pm2 start ecosystem.config.cjs --env production
```

### Cluster Mode

The ecosystem config runs in cluster mode for better performance:

```javascript
instances: 1,      // Number of instances
exec_mode: 'cluster',  // Cluster mode for load balancing
```

To run multiple instances:

```bash
# Edit ecosystem.config.cjs
# Change: instances: 1
# To:     instances: 4  (or -1 for auto, based on CPU cores)

# Reload
npm run pm2:reload
```

## Troubleshooting

### Processes Not Starting

Check logs for errors:
```bash
pm2 logs myid-pwa --err
pm2 logs myid-hsm --err
```

### Port Already in Use

```bash
# Check what's using the port
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Restart PM2 processes
npm run pm2:restart
```

### Memory Issues

Check memory usage:
```bash
npm run pm2:monit
```

Configure max memory restart in `ecosystem.config.cjs`:
```javascript
max_memory_restart: '1G',  // Restart if memory exceeds 1GB
```

### Logs Not Showing

```bash
# Check log file location
pm2 show myid-pwa

# Logs are stored in:
logs/pwa-out.log
logs/pwa-error.log
logs/hsm-out.log
logs/hsm-error.log

# View directly
tail -f logs/pwa-out.log
```

## PM2 Ecosystem Configuration

The `ecosystem.config.cjs` file defines two applications:

1. **myid-pwa** - Frontend PWA (port 3000)
2. **myid-hsm** - Backend HSM service (port 3001)

Both run automatically when you execute `npm run pm2:start`.

### Modifying the Configuration

Edit `/perform1/srv/work/myid-app/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'myid-pwa',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/perform1/srv/work/myid-app',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Add more environment variables here
      },
    },
    // ... more apps
  ]
};
```

After changing the config:
```bash
npm run pm2:delete
npm run pm2:start
```

## Useful PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 list` | List all processes |
| `pm2 logs` | View logs for all processes |
| `pm2 logs <name>` | View logs for specific process |
| `pm2 monit` | Monitor processes (interactive) |
| `pm2 restart <name>` | Restart process |
| `pm2 reload <name>` | Zero-downtime reload |
| `pm2 stop <name>` | Stop process |
| `pm2 delete <name>` | Remove process from PM2 |
| `pm2 describe <name>` | Show detailed process info |
| `pm2 flush` | Clear all logs |
| `pm2 reset <name>` | Reset restart counter |
| `pm2 web` | Start web interface |
| `pm2 save` | Save current process list |
| `pm2 resurrect` | Restore saved process list |
| `pm2 startup` | Generate startup script |
| `pm2 unstartup` | Remove startup script |

## Benefits of Using PM2

1. **Stay Connected Without Being Connected**
   - Start processes with PM2, then log out
   - Processes continue running in the background
   - SSH back in anytime to check status

2. **Automatic Recovery**
   - App crashes? PM2 restarts it automatically
   - Server reboots? PM2 resurrects your processes
   - No manual intervention needed

3. **Production-Ready**
   - Zero-downtime reloads
   - Cluster mode for load balancing
   - Built-in log management
   - Performance monitoring

4. **Developer-Friendly**
   - Simple commands
   - Clear status output
   - Real-time monitoring
   - Easy debugging

## Next Steps

1. Set up PM2 startup script for auto-start on boot
2. Configure log rotation to manage disk space
3. Set up monitoring alerts (optional)
4. Configure environment-specific variables
5. Test zero-downtime deployments

For more information, see the [official PM2 documentation](https://pm2.keymetrics.io/).
