import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { appRoutes } from './routes.js';

const server = fastify({ logger: true });

await server.register(cors, {
  origin: true,
});

server.register(appRoutes);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT ?? '3000', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🍼 MilkDrop Planner running at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
