import app from './app';
import { startPlanExpiryJob } from './jobs/planExpiry';

const PORT = process.env.PORT || process.env.API_PORT || 3000;

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT} (LAN accessible)`);
  console.log('API ready to accept requests');
});

const planExpiryTimer = startPlanExpiryJob();

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  clearInterval(planExpiryTimer);
  server.close(() => {
    console.log('HTTP server closed');
  });
});
