const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const NodeCache = require('node-cache');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced security
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());

// Caching
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

let colleges = [];

// Read CSV file
fs.createReadStream('db/database.csv')
  .pipe(csv())
  .on('data', (row) => {
    colleges.push(row);
  })
  .on('end', () => {
    console.log("[College-API] : CSV Loaded !👍");
  });

// Helper function to clean college names
const cleanCollegeName = (name) => {
  return name.replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "").trim();
};

app.get('/', (req, res) => {
  res.send("Colleges API : Developed by PrasadBobby");
});

app.get('/colleges/total', (req, res) => {
  const total = { total: colleges.length };
  res.json(total);
});

app.post('/colleges/search', [
  body('keyword').isString().trim().notEmpty(),
  body('page').optional().isInt({ min: 1 }),
  body('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { keyword, page = 1, limit = 10 } = req.body;
  const cacheKey = `search:${keyword}:${page}:${limit}`;
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    return res.json(cachedResult);
  }

  const result = colleges.filter(college => 
    college.name.toLowerCase().includes(keyword.toLowerCase())
  ).map(college => ({
    ...college,
    name: cleanCollegeName(college.name)
  }));

  const paginatedResult = result.slice((page - 1) * limit, page * limit);
  const response = {
    data: paginatedResult,
    page,
    limit,
    total: result.length,
    totalPages: Math.ceil(result.length / limit)
  };

  cache.set(cacheKey, response);
  res.json(response);
});

app.get('/colleges/state/:state', [
  body('page').optional().isInt({ min: 1 }),
  body('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { state } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = `state:${state}:${page}:${limit}`;
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    return res.json(cachedResult);
  }

  const result = colleges.filter(college => 
    college.state.toLowerCase() === state.toLowerCase()
  ).map(college => ({
    ...college,
    name: cleanCollegeName(college.name)
  }));

  const paginatedResult = result.slice((page - 1) * limit, page * limit);
  const response = {
    data: paginatedResult,
    page: Number(page),
    limit: Number(limit),
    total: result.length,
    totalPages: Math.ceil(result.length / limit)
  };

  cache.set(cacheKey, response);
  res.json(response);
});

app.get('/colleges/district/:district', [
  body('page').optional().isInt({ min: 1 }),
  body('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { district } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = `district:${district}:${page}:${limit}`;
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    return res.json(cachedResult);
  }

  const result = colleges.filter(college => 
    college.district.toLowerCase() === district.toLowerCase()
  ).map(college => ({
    ...college,
    name: cleanCollegeName(college.name)
  }));

  const paginatedResult = result.slice((page - 1) * limit, page * limit);
  const response = {
    data: paginatedResult,
    page: Number(page),
    limit: Number(limit),
    total: result.length,
    totalPages: Math.ceil(result.length / limit)
  };

  cache.set(cacheKey, response);
  res.json(response);
});

app.get('/allstates', (req, res) => {
  const cacheKey = 'allstates';
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    return res.json(cachedResult);
  }

  const result = [...new Set(colleges.map(college => college.state))].sort();
  cache.set(cacheKey, result);
  res.json(result);
});

app.get('/districts/:state', (req, res) => {
  const { state } = req.params;
  const cacheKey = `districts:${state}`;
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    return res.json(cachedResult);
  }

  const result = [...new Set(
    colleges
      .filter(college => college.state.toLowerCase() === state.toLowerCase())
      .map(college => college.district)
  )].sort();

  cache.set(cacheKey, result);
  res.json(result);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`API app listening at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
