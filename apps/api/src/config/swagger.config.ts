import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env.config.js';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TradeMitra Enterprise Paper Trading API',
      version: '1.0.0',
      description:
        'MNC-grade REST & Real-time API for Equity and F&O Paper Trading platform inspired by Groww. Authored by Sumer Kumar.',
      contact: {
        name: 'Sumer Kumar',
        email: 'sumer.kumar@trademitra.local',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}${config.apiPrefix}`,
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.router.ts', './src/modules/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
