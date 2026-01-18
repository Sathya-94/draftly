import app from './app.js';
import { env } from './config/env.js';

const port = env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});