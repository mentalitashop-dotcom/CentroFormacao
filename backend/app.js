const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const config = require('./config');
const publicRoutes = require('./routes/public');
const privateRoutes = require('./routes/private');
const seedAdmin = require('./utils/seedAdmin');
const ModalityStructure = require('./models/modalityStructure');

const app = express();
const PORT = config.port;

app.use(cors({
  origin: config.frontendOrigins,
  credentials: true,
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages']
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API - Clube Formação',
      version: '1.0.0',
      description: 'Documentação da API de gestão de inscrições do clube'
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: ['./routes/**/*.js', './controllers/**/*.js']
};
const openApiSpecification = swaggerJSDoc(swaggerOptions);

app.get('/', (req, res) => res.json({ message: 'Backend do Clube Formação online', port: PORT }));
app.get(['/healthz', '/api/healthz'], (req, res) => res.json({ ok: true }));
app.get('/openapi.json', (req, res) => res.json(openApiSpecification));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpecification, {
  swaggerOptions: { persistAuthorization: true }
}));

app.use('/api', publicRoutes);
app.use('/api', privateRoutes);

app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Erro interno do servidor.' });
});

mongoose.Promise = global.Promise;
if (!config.mongoUri) {
  throw new Error('Configura a variável de ambiente MONGODB_URI antes de iniciar o backend.');
}

mongoose.connect(config.mongoUri, { dbName: config.mongoDbName })
  .then(async () => {
    console.log(`Ligação ao MongoDB estabelecida com sucesso na base de dados ${config.mongoDbName}.`);
    try {
      await ModalityStructure.collection.dropIndex('name_1');
    } catch (error) {
      if (error.codeName !== 'IndexNotFound') {
        console.warn('Não foi possível remover o índice anterior das áreas de formação:', error.message);
      }
    }
    await ModalityStructure.syncIndexes();
    await seedAdmin();
    app.listen(PORT, () => console.log(`Backend disponível em http://localhost:${PORT}`));
  })
  .catch((error) => console.error('Falha na ligação ao MongoDB:', error));

module.exports = app;
