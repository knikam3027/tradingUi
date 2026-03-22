const express = require('express');
const cors = require('cors');
const { PORT, CORS_ORIGINS } = require('./config');
const { loadPersistedToken, isConnected } = require('./models/authModel');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Load HDFC Sky token from file or .env on startup
loadPersistedToken();

const app = express();

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/api/v1', apiRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Node backend running', status: 'active', broker: 'HDFC Sky', connected: isConnected() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Login: http://localhost:${PORT}/auth/login`);
  if (isConnected()) console.log('Access token loaded from .env');
});
