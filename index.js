import { startProcessing } from './tool.js';
const express = require('express');
const app = express();

app.get('/', function (req, res) {
  res.send('Hello World');
});
app.get('/process/', function (req, res) {
  startProcessing();
  res.send('Processing...');
});

app.listen(3000);