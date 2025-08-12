import express from 'express';
import pricingRouter from './api/pricing.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
app.use(express.json());
app.use('/pricing', pricingRouter);

export default app;

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] === modulePath) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on ${port}`);
  });
}
