var EnrolmentRequest = require('../models/enrolmentRequest');
var EnrolmentPlan = require('../models/enrolmentPlan');
var User = require('../models/user');
var UserData = require('../models/userData');
var registerAudit = require('../utils/audit');
var listing = require('../utils/listing');

const allowedStatuses = ['pendente', 'validada', 'em_acompanhamento', 'concluida', 'cancelada'];
const allowedTransitions = {
  pendente: ['validada', 'cancelada'],
  validada: ['em_acompanhamento', 'cancelada'],
  em_acompanhamento: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: []
};

// Lista inscrições registadas no clube.
exports.list = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const filter = allowedStatuses.includes(status) ? { status } : {};

    let enrolments = await EnrolmentRequest.find(filter).populate('user', 'username email').lean();

    const opts = listing.options(req.query, ['createdAt', 'totalCents', 'status'], 'createdAt');
    enrolments = enrolments
      .filter((enrolment) => listing.includesSearch([
        enrolment._id,
        enrolment.status,
        enrolment.user?.username,
        enrolment.user?.email,
        ...(enrolment.items || []).flatMap((item) => [item.planName, item.planCode])
      ], opts.search))
      .sort((a, b) => listing.compare(a, b, opts.sortBy, opts.sortDir));

    listing.respond(res, enrolments, opts.page, opts.limit);
  } catch (error) {
    console.error('Erro ao listar inscrições:', error);
    res.status(500).json({ message: 'Erro ao listar inscrições.' });
  }
};


// Cria uma inscrição para um atleta.
exports.create = async (req, res) => {
  try {
    const athleteId = String(req.body.athleteId || '').trim();
    const planId = String(req.body.planId || '').trim();

    const athlete = await User.findById(athleteId);
    if (!athlete || athlete.role !== 'Atleta' || athlete.ativo === false) {
      return res.status(404).json({ message: 'Atleta ativo não encontrado.' });
    }

    let plan = await EnrolmentPlan.findById(planId);
    if (!plan || plan.active === false) {
      return res.status(404).json({ message: 'Plano de inscrição ativo não encontrado.' });
    }

    const existingEnrolment = await EnrolmentRequest.findOne({
      user: athlete._id,
      status: { $ne: 'cancelada' },
      'items.plan': plan._id
    });
    if (existingEnrolment) {
      return res.status(400).json({ message: 'Este atleta ja tem uma inscricao ativa neste escalao.' });
    }

    const reservedPlan = await EnrolmentPlan.findOneAndUpdate(
      { _id: plan._id, active: true, vacancies: { $gt: 0 } },
      { $inc: { vacancies: -1 } },
      { new: true }
    );
    if (!reservedPlan) {
      return res.status(400).json({ message: 'Este plano ja nao tem vagas disponiveis.' });
    }
    plan = reservedPlan;

    const athleteData = await UserData.findOne({ user: athlete._id }).lean();
    const mainImage = (plan.images || []).find((image) => image.isMain) || (plan.images || [])[0];
    const totalCents = Number(plan.feeCents || 0);

    let enrolment;
    try {
      enrolment = await EnrolmentRequest.create({
      user: athlete._id,
      status: 'pendente',
      registrationChannel: 'secretaria',
      athleteAddress: {
        addressType: athleteData?.addressType || '',
        addressName: athleteData?.addressName || '',
        doorNumber: athleteData?.doorNumber || '',
        postalCode: athleteData?.postalCode || '',
        city: athleteData?.city || ''
      },
      billing: {
        useAthleteAddress: true,
        taxpayerRequested: !!athleteData?.taxpayerNumber,
        taxpayerNumber: athleteData?.taxpayerNumber || '',
        addressType: athleteData?.addressType || '',
        addressName: athleteData?.addressName || '',
        doorNumber: athleteData?.doorNumber || '',
        postalCode: athleteData?.postalCode || '',
        city: athleteData?.city || ''
      },
      items: [{
        plan: plan._id,
        planCode: plan.code,
        planName: plan.name,
        planImageUrl: mainImage?.imageUrl || '',
        monthlyFeeCents: totalCents,
        quantity: 1,
        lineTotalCents: totalCents
      }],
      subtotalCents: totalCents,
      totalCents,
      discountCents: 0,
      statusHistory: [{ changedByUser: req.userId, newStatus: 'pendente', note: 'Inscricao criada na secretaria.' }]
      });
    } catch (creationError) {
      await EnrolmentPlan.findByIdAndUpdate(plan._id, { $inc: { vacancies: 1 } });
      throw creationError;
    }
    await registerAudit(req, 'criou', 'Inscrição', enrolment, { athlete: athlete.username, plan: plan.name });
    await enrolment.populate('user', 'username email');

    res.status(201).json({ message: 'Inscrição criada com sucesso.', enrolment });
  } catch (error) {
    console.error('Erro ao criar inscrição:', error);
    res.status(500).json({ message: 'Erro ao criar inscrição.' });
  }
};
// Atualiza o estado de uma inscrição.
exports.updateStatus = async (req, res) => {
  try {
    const nextStatus = String(req.body.status || '').trim();

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ message: 'Estado de inscrição inválido.' });
    }

    const enrolment = await EnrolmentRequest.findById(req.params.id);
    if (!enrolment) {
      return res.status(404).json({ message: 'Inscrição não encontrada.' });
    }

    const oldStatus = enrolment.status;
    if (!allowedTransitions[oldStatus]?.includes(nextStatus)) {
      return res.status(400).json({ message: `Não é possível alterar uma inscrição de ${oldStatus} para ${nextStatus}.` });
    }

    enrolment.status = nextStatus;
    if (nextStatus === 'validada' && !enrolment.validatedAt) enrolment.validatedAt = new Date();
    if (nextStatus === 'concluida') enrolment.completedAt = new Date();

    enrolment.statusHistory.push({
      changedByUser: req.userId,
      oldStatus,
      newStatus: nextStatus,
      note: req.body.note ? String(req.body.note).trim() : ''
    });

    await enrolment.save();
    await registerAudit(req, 'alterou estado', 'Inscrição', enrolment, {
      oldStatus,
      newStatus: nextStatus,
      note: req.body.note ? String(req.body.note).trim() : ''
    });
    await enrolment.populate('user', 'username email');

    res.json({ message: 'Estado da inscrição atualizado.', enrolment });
  } catch (error) {
    console.error('Erro ao atualizar inscrição:', error);
    res.status(500).json({ message: 'Erro ao atualizar inscrição.' });
  }
};

// Estatísticas do clube.
exports.storeStats = async (req, res) => {
  try {
    const totalEnrolments = await EnrolmentRequest.countDocuments();
    const openEnrolments = await EnrolmentRequest.countDocuments({ status: { $nin: ['concluida', 'cancelada'] } });
    const completedEnrolments = await EnrolmentRequest.countDocuments({ status: 'concluida' });
    const canceledEnrolments = await EnrolmentRequest.countDocuments({ status: 'cancelada' });
    const plansCount = await EnrolmentPlan.countDocuments({ active: true });
    const lowVacancyPlans = await EnrolmentPlan.countDocuments({ active: true, vacancies: { $lte: 5 } });

    const mostRequestedPlans = await EnrolmentRequest.aggregate([
      { $match: { status: { $ne: 'cancelada' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.planName', quantity: { $sum: '$items.quantity' }, totalCents: { $sum: '$items.lineTotalCents' } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 }
    ]);

    res.json({ totalEnrolments, openEnrolments, completedEnrolments, canceledEnrolments, plansCount, lowVacancyPlans, mostRequestedPlans });
  } catch (error) {
    console.error('Erro ao carregar dashboard do clube:', error);
    res.status(500).json({ message: 'Erro ao carregar dashboard do clube.' });
  }
};
