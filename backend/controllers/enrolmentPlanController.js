var EnrolmentPlan = require('../models/enrolmentPlan');
var ModalityStructure = require('../models/modalityStructure');
var registerAudit = require('../utils/audit');

// Gera code.
async function generatePlanCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
    if (!await EnrolmentPlan.exists({ code })) return code;
  }
  throw new Error('Não foi possível gerar um codigo único.');
}

// Constrói imagens.
function buildImages(mainImageUrl, extraImageUrls) {
  const images = [];

  if (mainImageUrl) {
    images.push({ imageUrl: String(mainImageUrl).trim(), isMain: true, sortOrder: 0 });
  }

  if (Array.isArray(extraImageUrls)) {
    extraImageUrls.slice(0, 3).forEach((url, index) => {
      if (url) {
        images.push({ imageUrl: String(url).trim(), isMain: false, sortOrder: index + 1 });
      }
    });
  }

  return images;
}

// Lista planos de inscrição.
exports.list = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const modalityStructure = req.query.modalityStructure;
    const includeInactive = req.query.includeInactive === 'true';
    const sortBy = req.query.sortBy === 'price' ? 'feeCents' : 'name';
    const sortDir = req.query.sortDir === 'desc' ? -1 : 1;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 500);

    const filter = includeInactive ? {} : { active: true };

    if (search) {
      filter.$or = [{ name: { $regex: search, $options: 'i' } }, { code: { $regex: search, $options: 'i' } }];
    }

    if (modalityStructure) {
      const childCategories = await ModalityStructure.find({ parent: modalityStructure }).select('_id');
      filter.modalityStructure = childCategories.length ? { $in: [modalityStructure, ...childCategories.map(item => item._id)] } : modalityStructure;
    }

    const total = await EnrolmentPlan.countDocuments(filter);
    const plans = await EnrolmentPlan.find(filter).populate({path: 'modalityStructure', select: 'name parent', populate: { path: 'parent', select: 'name' }}).sort({ [sortBy]: sortDir }).skip((page - 1) * limit).limit(limit).lean();

    res.json({ plans, total, page, limit });
  } catch (error) {
    console.error('Erro ao listar planos de inscrição:', error);
    res.status(500).json({ message: 'Erro ao listar planos de inscrição.' });
  }
};

// Carrega os elementos apresentados em destaque.
exports.featured = async (_req, res) => {
  try {
    const featuredPlans = await EnrolmentPlan.find({ active: true }).populate({ path: 'modalityStructure', select: 'name parent', populate: { path: 'parent', select: 'name' }}).sort({ createdAt: -1 }).limit(3).lean();

    res.json(featuredPlans);
  } catch (error) {
    console.error('Erro ao carregar escalões em destaque:', error);
    res.status(500).json({ message: 'Erro ao carregar escalões em destaque.' });
  }
};

// Obtém by id.
exports.getById = async (req, res) => {
  try {
    const plan = await EnrolmentPlan.findById(req.params.id).populate({ path: 'modalityStructure', select: 'name parent', populate: { path: 'parent', select: 'name' }});

    if (!plan || plan.active === false) {
      return res.status(404).json({ message: 'Plano de inscrição não encontrado.' });
    }

    res.json(plan);
  } catch (error) {
    console.error('Erro ao carregar plano de inscrição:', error);
    res.status(500).json({ message: 'Erro ao carregar plano de inscrição.' });
  }
};

// Cria plano de inscrição.
exports.create = async (req, res) => {
  try {
    const { code, name, description, details, modalityStructure, feeCents, vacancies, mainImageUrl, extraImageUrls } = req.body;

    if (!name || !description || !modalityStructure || !feeCents || mainImageUrl === undefined) {
      return res.status(400).json({ message: 'Preenche os campos obrigatórios do plano de inscrição.' });
    }

    const generatedCode = await generatePlanCode();

    const structureExists = await ModalityStructure.findById(modalityStructure);
    if (!structureExists || structureExists.active === false) {
      return res.status(400).json({ message: 'Seleciona uma área de formação ou escalão ativo.' });
    }

    const price = Number(feeCents);
    const vacanciesValue = Number(vacancies || 0);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'A mensalidade deve ser maior do que zero.' });
    }

    if (!Number.isInteger(vacanciesValue) || vacanciesValue < 0) {
      return res.status(400).json({ message: 'As vagas devem ser um número inteiro e não podem ser negativas.' });
    }

    const images = buildImages(mainImageUrl, extraImageUrls);
    if (images.filter(image => image.isMain).length !== 1) {
      return res.status(400).json({ message: 'A imagem principal é obrigatória.' });
    }

    const plan = new EnrolmentPlan({
      code: generatedCode, name: String(name).trim(), description: String(description).trim(), details: details || {}, modalityStructure, feeCents: price, vacancies: vacanciesValue, images, active: true});

    await plan.save();
    await registerAudit(req, 'criou', 'Plano de inscrição', plan, { code: plan.code, feeCents: plan.feeCents, vacancies: plan.vacancies});
    res.status(201).json({ message: 'Plano de inscrição criado com sucesso.', plan });
  } catch (error) {
    console.error('Erro ao criar plano de inscrição:', error);
    res.status(500).json({ message: 'Erro ao criar plano de inscrição.' });
  }
};

// Atualiza plano de inscrição.
exports.update = async (req, res) => {
  try {
    const { code, name, description, details, modalityStructure, feeCents, vacancies, mainImageUrl, extraImageUrls } = req.body;

    const plan = await EnrolmentPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plano de inscrição não encontrado.' });
    }

    if (!code || !name || !description || !modalityStructure || !feeCents) {
      return res.status(400).json({ message: 'Preenche os campos obrigatórios do plano de inscrição.' });
    }

    if (!/^\d{13}$/.test(String(code))) {
      return res.status(400).json({ message: 'O codigo deve ter 13 dígitos.' });
    }

    const existingEnrolmentPlan = await EnrolmentPlan.findOne({ code: String(code).trim(), _id: { $ne: plan._id }
    });

    if (existingEnrolmentPlan) {
      return res.status(400).json({ message: 'Já existe um plano de inscrição com esse código.' });
    }

    const structureExists = await ModalityStructure.findById(modalityStructure);
    if (!structureExists || structureExists.active === false) {
      return res.status(400).json({ message: 'Seleciona uma área de formação ou escalão ativo.' });
    }

    const price = Number(feeCents);
    const vacanciesValue = Number(vacancies || 0);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'A mensalidade deve ser maior do que zero.' });
    }

    if (!Number.isInteger(vacanciesValue) || vacanciesValue < 0) {
      return res.status(400).json({ message: 'As vagas devem ser um número inteiro e não podem ser negativas.' });
    }

    const previous = { name: plan.name, code: plan.code, feeCents: plan.feeCents, vacancies: plan.vacancies, active: plan.active };
    plan.code = String(code).trim();
    plan.name = String(name).trim();
    plan.description = String(description).trim();
    plan.details = details || {};
    plan.modalityStructure = modalityStructure;
    plan.feeCents = price;
    plan.vacancies = vacanciesValue;

    if (mainImageUrl !== undefined || extraImageUrls !== undefined) {
      const images = buildImages(mainImageUrl, extraImageUrls);
      if (images.filter(image => image.isMain).length !== 1) {
        return res.status(400).json({ message: 'A imagem principal é obrigatória.' });
      }
      plan.images = images;
    }

    await plan.save();
    await registerAudit(req, 'editou', 'Plano de inscrição', plan, { previous, current: { name: plan.name, code: plan.code, feeCents: plan.feeCents, vacancies: plan.vacancies, active: plan.active }});
    res.json({ message: 'Plano de inscrição atualizado com sucesso.', plan });
  } catch (error) {
    console.error('Erro ao atualizar plano de inscrição:', error);
    res.status(500).json({ message: 'Erro ao atualizar plano de inscrição.' });
  }
};

// Atualiza imagens.
exports.updateImages = async (req, res) => {
  try {
    const plan = await EnrolmentPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plano de inscrição não encontrado.' });
    }

    const images = buildImages(req.body.mainImageUrl, req.body.extraImageUrls);
    if (images.filter(image => image.isMain).length !== 1) {
      return res.status(400).json({ message: 'A imagem principal é obrigatória.' });
    }

    plan.images = images;
    await plan.save();
    await registerAudit(req, 'atualizou imagens', 'Plano de inscrição', plan, { images: images.map((image) => image.imageUrl)});

    res.json({ message: 'Imagens do plano de inscrição guardadas.', plan });
  } catch (error) {
    console.error('Erro ao atualizar imagens do plano de inscrição:', error);
    res.status(500).json({ message: 'Erro ao guardar imagens do plano de inscrição.' });
  }
};

// Remove plano de inscrição.
exports.remove = async (req, res) => {
  try {
    const plan = await EnrolmentPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plano de inscrição não encontrado.' });
    }

    if (req.userEmployeeRole === 'Admin') {
      await EnrolmentPlan.deleteOne({ _id: plan._id });
      await registerAudit(req, 'removeu', 'Plano de inscrição', plan, { code: plan.code });
      return res.json({ message: 'Plano de inscrição removido definitivamente.' });
    }

    plan.active = false;
    await plan.save();
    await registerAudit(req, 'desativou', 'Plano de inscrição', plan, { code: plan.code });

    res.json({ message: 'Plano de inscrição desativado com sucesso.', plan });
  } catch (error) {
    console.error('Erro ao remover plano de inscrição:', error);
    res.status(500).json({ message: 'Erro ao remover plano de inscrição.' });
  }
};
