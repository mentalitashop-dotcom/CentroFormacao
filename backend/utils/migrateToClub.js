const mongoose = require('mongoose');
const config = require('../config');
const ClubSettings = require('../models/clubSettings');
const ModalityStructure = require('../models/modalityStructure');
const EnrolmentPlan = require('../models/enrolmentPlan');
const Image = require('../models/image');
const Season = require('../models/season');
const seedAdmin = require('./seedAdmin');

const shouldReset = process.argv.includes('--reset');

const football = {
  name: 'Futebol',
  description: 'Centro de formação dedicado ao acompanhamento de atletas por escalão.',
  color: '#004b9b',
  levels: [
    { name: 'Sub-7', description: 'Iniciação desportiva para atletas dos 5 aos 6 anos.', color: '#1d4ed8' },
    { name: 'Sub-9', description: 'Aprendizagem técnica e coordenação em contexto de jogo.', color: '#2563eb' },
    { name: 'Sub-11', description: 'Formação de base com treino técnico e coletivo.', color: '#3b82f6' },
    { name: 'Sub-13', description: 'Escalão de desenvolvimento competitivo inicial.', color: '#60a5fa' }
  ]
};

const plans = [
  { name: 'Sub-7 - Iniciação', level: 'Sub-7', feeCents: 2500, vacancies: 18, color: '#1d4ed8', description: 'Inscrição para atletas dos 5 aos 6 anos com treinos lúdicos, coordenação motora e primeiros contactos com o treino.', details: { Escalão: 'Sub-7', Idade: '5 a 6 anos', Treinos: '2 por semana', Local: 'Campo principal' } },
  { name: 'Sub-9 - Formação Base', level: 'Sub-9', feeCents: 3000, vacancies: 20, color: '#2563eb', description: 'Inscrição para atletas dos 7 aos 8 anos com foco em domínio de bola, regras de jogo e trabalho em equipa.', details: { Escalão: 'Sub-9', Idade: '7 a 8 anos', Treinos: '2 por semana', Local: 'Campo sintético' } },
  { name: 'Sub-11 - Desenvolvimento', level: 'Sub-11', feeCents: 3500, vacancies: 16, color: '#3b82f6', description: 'Inscrição para atletas dos 9 aos 10 anos com treino técnico, tomada de decisão e jogos de preparação.', details: { Escalão: 'Sub-11', Idade: '9 a 10 anos', Treinos: '3 por semana', Local: 'Campo principal' } },
  { name: 'Sub-13 - Competição', level: 'Sub-13', feeCents: 4200, vacancies: 14, color: '#60a5fa', description: 'Inscrição para atletas dos 11 aos 12 anos com integração em contexto competitivo e acompanhamento técnico.', details: { Escalão: 'Sub-13', Idade: '11 a 12 anos', Treinos: '3 por semana', Competição: 'Distrital' } }
];

function svg(title, subtitle, color) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="#f8fafc"/><rect x="42" y="42" width="816" height="516" rx="34" fill="${color}"/><circle cx="710" cy="150" r="92" fill="rgba(255,255,255,0.16)"/><circle cx="180" cy="470" r="130" fill="rgba(255,255,255,0.12)"/><path d="M232 318c72-72 187-72 260 0s187 72 260 0" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="18" stroke-linecap="round"/><circle cx="450" cy="278" r="76" fill="rgba(255,255,255,0.18)" stroke="#ffffff" stroke-width="10"/><text x="450" y="418" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#ffffff">${title}</text><text x="450" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#e0f2fe">${subtitle}</text></svg>`, 'utf8');
}

async function imageUrl(name, subtitle, color) {
  const originalName = `${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.svg`;
  let image = await Image.findOne({ originalName });
  if (!image) {
    image = await Image.create({ originalName, mimeType: 'image/svg+xml', size: 1, data: svg(name, subtitle, color) });
    image.size = image.data.length;
    await image.save();
  }
  return `/api/images/load/${image._id}`;
}

function randomCode(index) {
  const base = `56026${String(Date.now()).slice(-5)}${String(index).padStart(2, '0')}`;
  return base.slice(0, 13).padEnd(13, '0');
}

async function upsertStructure(data, parent = null) {
  let structure = await ModalityStructure.findOne({ name: data.name, parent });
  if (!structure) structure = new ModalityStructure({ name: data.name, parent });
  structure.name = data.name;
  structure.description = data.description;
  structure.parent = parent;
  structure.imageUrl = await imageUrl(data.name, parent ? 'Escalão do clube' : 'Centro de formação', data.color);
  structure.active = true;
  await structure.save();
  return structure;
}

async function seedClubSettings() {
  let settings = await ClubSettings.findOne();
  if (!settings) settings = new ClubSettings();
  settings.name = 'Centro de Formação';
  settings.phone = '912345678';
  settings.email = 'secretaria@centroformacao.pt';
  settings.aboutText = 'O Centro de Formação permite gerir inscrições de atletas por escalão, acompanhando vagas, dados pessoais, documentos e histórico de participação.';
  settings.addressType = 'Rua';
  settings.addressName = 'do Clube';
  settings.address = 'Rua do Clube';
  settings.setupComplete = false;
  await settings.save();
}

async function seedStructures() {
  const levelByName = new Map();
  const parent = await upsertStructure(football, null);
  for (const level of football.levels) {
    const child = await upsertStructure(level, parent._id);
    levelByName.set(level.name, child);
  }
  return levelByName;
}

async function seedSeason() {
  await Season.findOneAndUpdate(
    { name: 'Época 2026/2027' },
    { name: 'Época 2026/2027', startsAt: new Date('2026-08-01T00:00:00.000Z'), endsAt: new Date('2027-07-31T23:59:59.000Z'), active: true },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

async function seedPlans(levelByName) {
  for (let index = 0; index < plans.length; index++) {
    const data = plans[index];
    const structure = levelByName.get(data.level);
    await EnrolmentPlan.findOneAndUpdate(
      { name: data.name },
      {
        code: randomCode(index + 1),
        name: data.name,
        description: data.description,
        details: data.details,
        modalityStructure: structure._id,
        feeCents: data.feeCents,
        vacancies: data.vacancies,
        active: true,
        images: [{ imageUrl: await imageUrl(data.name, 'Inscrição disponível', data.color), isMain: true, sortOrder: 0 }]
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }
}

async function run() {
  if (!config.mongoUri) throw new Error('MONGODB_URI não está configurado.');
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName });

  if (shouldReset) {
    await mongoose.connection.dropDatabase();
    console.log(`Base de dados ${config.mongoDbName} limpa.`);
  }

  await seedClubSettings();
  await seedAdmin();
  await seedSeason();
  const levelByName = await seedStructures();
  await seedPlans(levelByName);
  await mongoose.disconnect();
  console.log(`Base de dados ${config.mongoDbName} preparada para o centro de formação.`);
}

run().catch(async (error) => {
  console.error('Erro ao preparar a base de dados:', error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});