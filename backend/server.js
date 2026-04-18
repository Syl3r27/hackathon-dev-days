import express from 'express'
import cors from 'cors'

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));


app.listen(PORT, () => console.log(`Backend is up and running on port ${PORT}`));
export default app;
