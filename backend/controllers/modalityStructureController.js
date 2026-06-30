var ModalityStructure = require('../models/modalityStructure');
var EnrolmentPlan = require('../models/enrolmentPlan');
var registerAudit = require('../utils/audit');
var listing = require('../utils/listing');

// Função auxiliar «relatedIds».
async function relatedIds(structure) {
  if (structure.parent) return [structure._id];
  const children = await ModalityStructure.find({ parent: structure._id }).select('_id');
  return [structure._id, ...children.map((item) => item._id)];
}

// Função auxiliar «deactivateCascade».
async function deactivateCascade(structure) {
  const ids = await relatedIds(structure);
  await ModalityStructure.updateMany({ _id: { $in: ids } }, { $set: { active: false } });
  const plans = await EnrolmentPlan.updateMany({ modalityStructure: { $in: ids } }, { $set: { active: false } });
  return { structures: ids.length, plans: plans.modifiedCount || 0 };
}

// Remove cascade.
async function removeCascade(structure) {
  const ids = await relatedIds(structure);
  const plans = await EnrolmentPlan.deleteMany({ modalityStructure: { $in: ids } });
  const structures = await ModalityStructure.deleteMany({ _id: { $in: ids } });
  return { structures: structures.deletedCount || 0, plans: plans.deletedCount || 0 };
}

// Função auxiliar «resolveParentModalityStructure».
async function resolveParentModalityStructure(parent, currentModalityStructureId) {
  if (!parent) {
    return null;
  }

  if (currentModalityStructureId && String(parent) === String(currentModalityStructureId)) {
    const error = new Error('A área principal não pode ser o próprio escalão.');
    error.statusCode = 400;
    throw error;
  }

  const parentModalityStructure = await ModalityStructure.findById(parent);
  if (!parentModalityStructure) {
    const error = new Error('Área principal inválida.');
    error.statusCode = 400;
    throw error;
  }

  if (parentModalityStructure.parent) {
    const error = new Error('Um escalão só pode pertencer a uma área principal.');
    error.statusCode = 400;
    throw error;
  }

  return parentModalityStructure._id;
}

// Função auxiliar «structureNameExists».
async function structureNameExists(name, parent, currentModalityStructureId) {
  const filter = {
    name: String(name).trim(),
    parent: parent || null
  };

  if (currentModalityStructureId) {
    filter._id = { $ne: currentModalityStructureId };
  }

  return ModalityStructure.findOne(filter);
}

// Lista áreas de formação e escalões.
exports.list = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { active: true };

    let structures = await ModalityStructure.find(filter).populate('parent', 'name').lean();

    const opts = listing.options(req.query, ['name', 'createdAt', 'updatedAt'], 'name', 'asc');
    structures = structures.filter((structure) => listing.includesSearch([structure.name, structure.description, structure.parent?.name], opts.search)).sort((a, b) => listing.compare(a, b, opts.sortBy, opts.sortDir));
    listing.respond(res, structures, opts.page, opts.limit);
  } catch (error) {
    console.error('Erro ao listar áreas de formação:', error);
    res.status(500).json({ message: 'Erro ao listar áreas de formação.' });
  }
};

// Carrega os elementos apresentados em destaque.
exports.featured = async (req, res) => {
  try {
    const structures = await ModalityStructure.find({ parent: { $ne: null }, active: true }).populate('parent', 'name').sort({ name: 1 }).limit(8).lean();
    res.json(structures);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar escalões em destaque.' });
  }
};

// Cria área de formação ou escalão.
exports.create = async (req, res) => {
  try {
    const { name, description, parent, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'O nome da área de formação ou escalão é obrigatório.' });
    }

    const parentModalityStructureId = await resolveParentModalityStructure(parent);
    const existingModalityStructure = await structureNameExists(name, parentModalityStructureId);
    if (existingModalityStructure) {
      return res.status(400).json({ message: 'Já existe uma área de formação ou escalão com esse nome neste nível.' });
    }

    const structure = new ModalityStructure({ name: String(name).trim(), description: description ? String(description).trim() : '', imageUrl: imageUrl ? String(imageUrl).trim() : '', parent: parentModalityStructureId, active: true});

    await structure.save();
    await registerAudit(req, 'criou', parentModalityStructureId ? 'Escalão' : 'Área de formação', structure, {description: structure.description, parent: parentModalityStructureId ? String(parentModalityStructureId) : null});
    res.status(201).json({ message: `${parentModalityStructureId ? 'Escalão' : 'Área de formação'} criado com sucesso.`, structure });
  } catch (error) {
    console.error('Erro ao criar área de formação/escalão:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Erro ao criar área de formação ou escalão.' });
  }
};

// Atualiza área de formação ou escalão.
exports.update = async (req, res) => {
  try {
    const { name, description, parent, active, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'O nome da área de formação ou escalão é obrigatório.' });
    }

    const structure = await ModalityStructure.findById(req.params.id);
    if (!structure) {
      return res.status(404).json({ message: 'Área de formação ou escalão não encontrado.' });
    }

    if (parent) {
      const childCategoriesCount = await ModalityStructure.countDocuments({ parent: structure._id });
      if (childCategoriesCount > 0) {
        return res.status(400).json({ message: 'Uma área de formação com escalões não pode passar a escalão.' });
      }
    }

    const parentModalityStructureId = await resolveParentModalityStructure(parent, structure._id);
    const existingModalityStructure = await structureNameExists(name, parentModalityStructureId, structure._id);
    if (existingModalityStructure) {
      return res.status(400).json({ message: 'Já existe uma área de formação ou escalão com esse nome neste nível.' });
    }

    const previous = { name: structure.name, description: structure.description, active: structure.active, parent: structure.parent ? String(structure.parent) : null };
    structure.name = String(name).trim();
    structure.description = description ? String(description).trim() : '';
    structure.imageUrl = imageUrl ? String(imageUrl).trim() : '';
    structure.parent = parentModalityStructureId;
    structure.active = active !== undefined ? Boolean(active) : structure.active;

    await structure.save();
    if (active === false) await deactivateCascade(structure);
    await registerAudit(req, 'editou', structure.parent ? 'Escalão' : 'Área de formação', structure, {
      previous,
      current: { name: structure.name, description: structure.description, active: structure.active, parent: structure.parent ? String(structure.parent) : null }
    });
    res.json({ message: `${structure.parent ? 'Escalão' : 'Área de formação'} atualizado com sucesso.`, structure });
  } catch (error) {
    console.error('Erro ao atualizar área de formação/escalão:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Erro ao atualizar área de formação ou escalão.' });
  }
};

// Remove área de formação ou escalão.
exports.remove = async (req, res) => {
  try {
    const structure = await ModalityStructure.findById(req.params.id);
    if (!structure) {
      return res.status(404).json({ message: 'Área de formação ou escalão não encontrado.' });
    }

    if (req.userEmployeeRole !== 'Admin') {
      const impact = await deactivateCascade(structure);
      await registerAudit(req, 'desativou', structure.parent ? 'Escalão' : 'Área de formação', structure);
      return res.json({ message: `Área de formação/escalão desativado juntamente com ${impact.structures - 1} escalões e ${impact.plans} planos de inscrição.`, structure, impact });
    }

    const impact = await removeCascade(structure);
    await registerAudit(req, 'removeu', structure.parent ? 'Escalão' : 'Área de formação', structure);
    res.json({ message: `Área de formação/escalão removido juntamente com ${impact.structures - 1} escalões e ${impact.plans} planos de inscrição.`, impact });
  } catch (error) {
    console.error('Erro ao remover área de formação/escalão:', error);
    res.status(500).json({ message: 'Erro ao remover área de formação ou escalão.' });
  }
};
