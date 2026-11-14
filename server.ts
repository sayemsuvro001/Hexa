import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

interface CpuSample {
  idle: number;
  total: number;
}

let prevCpuSample: CpuSample | null = null;

function readProcCpuSample(): CpuSample {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf8');
    const cpuLine = stat.split('\n').find((line) => line.startsWith('cpu '));
    if (cpuLine) {
      const parts = cpuLine
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((n) => Number(n) || 0);
      const idle = (parts[3] || 0) + (parts[4] || 0);
      const total = parts.reduce((acc, v) => acc + v, 0);
      if (total > 0) {
        return { idle, total };
      }
    }
  } catch {
    // Fallback to os.cpus() on non-proc environments
  }

  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.idle +
      cpu.times.irq;
  }
  return { idle, total };
}

function getRealCpuUsagePercent(): number | null {
  const current = readProcCpuSample();
  if (!prevCpuSample) {
    prevCpuSample = current;
    // Initial instantaneous estimate from loadavg normalized by cores when available
    const cores = Math.max(1, os.cpus().length);
    const load1 = os.loadavg()[0] || 0;
    return Math.min(100, Math.round((load1 / cores) * 1000) / 10);
  }

  const deltaTotal = current.total - prevCpuSample.total;
  const deltaIdle = current.idle - prevCpuSample.idle;
  prevCpuSample = current;

  if (deltaTotal <= 0) {
    return null;
  }
  const usage = ((deltaTotal - deltaIdle) / deltaTotal) * 100;
  return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
}

function readMemoryStats() {
  const totalBytes = os.totalmem();
  let availableBytes = os.freemem();

  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const matchTotal = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
    const matchAvail = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
    const realTotal = matchTotal ? Number(matchTotal[1]) * 1024 : totalBytes;
    const realAvail = matchAvail ? Number(matchAvail[1]) * 1024 : availableBytes;
    const usedBytes = Math.max(0, realTotal - realAvail);
    return {
      totalBytes: realTotal,
      availableBytes: realAvail,
      usedBytes,
      usagePercent: realTotal > 0 ? Math.round((usedBytes / realTotal) * 1000) / 10 : 0,
      source: '/proc/meminfo',
    };
  } catch {
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    return {
      totalBytes,
      availableBytes,
      usedBytes,
      usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
      source: 'os.totalmem',
    };
  }
}

function readStorageStats() {
  try {
    const stats = fs.statfsSync('/');
    const blockSize = Number(stats.bsize || 4096);
    const totalBytes = Number(stats.blocks) * blockSize;
    const freeBytes = Number(stats.bfree) * blockSize;
    const availableBytes = Number(stats.bavail) * blockSize;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return {
      totalBytes,
      usedBytes,
      availableBytes,
      usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
      mountPoint: '/',
      source: 'fs.statfsSync',
    };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/hardware', (_req, res) => {
    const cpus = os.cpus();
    const cpuUsagePercent = getRealCpuUsagePercent();
    const memory = readMemoryStats();
    const storage = readStorageStats();
    const loadAvg = os.loadavg();

    res.json({
      timestamp: Date.now(),
      ram: memory,
      storage,
      cpu: {
        usagePercent: cpuUsagePercent,
        cores: cpus.length,
        architecture: os.arch(),
        model: cpus[0]?.model?.trim() || 'Unknown Processor',
        speedMhz: cpus[0]?.speed || null,
        loadAverage: {
          oneMin: Math.round((loadAvg[0] || 0) * 100) / 100,
          fiveMin: Math.round((loadAvg[1] || 0) * 100) / 100,
          fifteenMin: Math.round((loadAvg[2] || 0) * 100) / 100,
        },
        source: '/proc/stat + os.cpus',
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        uptimeSeconds: Math.floor(os.uptime()),
        hostname: os.hostname(),
      },
    });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HEXA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
