import express from 'express';

const PORT = 3000;
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(PORT, () => {
  console.log(`Application started on port ${PORT}`);
});
