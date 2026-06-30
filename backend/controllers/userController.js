var User = require('../models/user');
var UserData = require('../models/userData');
var EnrolmentPlan = require('../models/enrolmentPlan');
var EnrolmentRequest = require('../models/enrolmentRequest');
var bcrypt = require('bcryptjs');
var addressUtils = require('../utils/address');
var listing = require('../utils/listing');

// Normaliza o endereço de email.
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Verifica se o email é válido.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Verifica se o nome de utilizador é válido.
function isValidUsername(username) {
  return /^[a-zA-Z0-9_]+$/.test(username);
}

// Verifica se o telefone é válido.
function isValidPhone(phone) {
  return /^[29]\d{8}$/.test(phone);
}

// Verifica se o NIF é válido.
function isValidTaxpayerNumber(value) {
  const nif = String(value || '').trim();
  if (!/^[1-9]\d{8}$/.test(nif)) return false;
  const sum = nif.slice(0, 8).split('').reduce((total, digit, index) => total + Number(digit) * (9 - index), 0);
  const checkDigit = 11 - (sum % 11);
  return Number(nif[8]) === (checkDigit >= 10 ? 0 : checkDigit);
}

// Verifica se a morada é válida.
function isValidAddress(address) {
  return /^(rua|avenida|praça|praca|largo|travessa|alameda|estrada|caminho|praceta|urbanização|urbanizacao|rotunda|beco|bairro|quinta|lugar|rampa|escadas|pátio|patio|zona industrial)\b/i.test(String(address || '').trim());
}

// Verifica se o utilizador é funcionário.
function isFuncionario(user) {
  return user && user.role === 'Funcionario';
}

// Função auxiliar «employeeJobTitle».
function employeeJobTitle(user) {
  return user?.employeeRole === 'Admin' ? 'Gestor do Centro de Formação' : 'Treinador';
}

// Função auxiliar «parseBirthDate».
function parseBirthDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Verifica se a data de nascimento é válida.
function isValidBirthDate(date) {
  if (!date) return false;
  const today = new Date();
  const minDate = new Date('1900-01-01T00:00:00.000Z');
  return date <= today && date >= minDate;
}

// Função auxiliar «randomEmployeeNumber».
function randomEmployeeNumber() {
  return `41${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

// Gera um número interno único.
async function generateEmployeeNumber(userId) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const employeeNumber = randomEmployeeNumber();
    const existing = await UserData.findOne({ employeeNumber, user: { $ne: userId }});

    if (!existing) {
      return employeeNumber;
    }
  }

  throw new Error('Não foi possível gerar número interno.');
}

// Obtém o número interno do treinador.
async function getEmployeeNumber(user, userData) {
  if (!isFuncionario(user)) {
    return userData?.employeeNumber || '';
  }

  return userData?.employeeNumber || await generateEmployeeNumber(user._id);
}

// Verifica utilizador dados complete.
function isUserDataComplete(user, userData) {
  if (!userData) {
    return false;
  }
  if (isFuncionario(user)) {
    return !!( userData.name && userData.phone && userData.employeeNumber && userData.jobTitle && userData.addressType && userData.addressName && userData.doorNumber && userData.postalCode && userData.city);
  }
  return !!(userData.name && userData.phone && userData.addressType && userData.addressName && userData.doorNumber && userData.postalCode && userData.city);
}

// Função auxiliar «cleanOptionalEmployeeFields».
function cleanOptionalEmployeeFields(payload) {
  const nextPayload = { ...payload };
  if (!nextPayload.employeeNumber) {
    delete nextPayload.employeeNumber;
  }
  if (!nextPayload.jobTitle) {
    delete nextPayload.jobTitle;
  }
  if (!nextPayload.taxpayerNumber) {
    delete nextPayload.taxpayerNumber;
  }
  if (!nextPayload.address) {
    delete nextPayload.address;
  }
  if (!nextPayload.birthDate) {
    delete nextPayload.birthDate;
  }
  if (!nextPayload.emergencyContactName) {
    delete nextPayload.emergencyContactName;
  }
  if (!nextPayload.emergencyContactPhone) {
    delete nextPayload.emergencyContactPhone;
  }
  return nextPayload;
}

// Lista utilizadores.
exports.list = async (req, res) => {
  try {
    const filter = {};
    const requestedRole = String(req.query.role || '').trim();
    const isAthleteSearch = requestedRole === 'Atleta';
    if (isAthleteSearch) filter.role = 'Atleta';
    else if (requestedRole) filter.role = requestedRole;
    if (req.query.employeeRole) filter.employeeRole = req.query.employeeRole;
    if (req.query.excludeMe === 'true') filter._id = { $ne: req.userId };

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();
    const userIds = users.map(user => user._id);
    const dataList = await UserData.find({ user: { $in: userIds } }).lean();

    const dataByUser = dataList.reduce((acc, data) => { acc[String(data.user)] = data; return acc;}, {});

    let result = users.map(user => ({ ...user, hasUserData: isUserDataComplete(user, dataByUser[String(user._id)]), userData: dataByUser[String(user._id)] || null}));

    const opts = listing.options(req.query, ['createdAt', 'username', 'email', 'role'], 'createdAt');
    if (isAthleteSearch && opts.search && !isValidEmail(opts.search) && !/^\d{9}$/.test(opts.search)) {
      return res.status(400).json({ message: 'Pesquisa por um email valido ou por 9 digitos de telefone/NIF.' });
    }
    result = result.filter((user) => isAthleteSearch ? !opts.search || normalizeEmail(user.email) === normalizeEmail(opts.search) || String(user.userData?.phone || '') === opts.search || String(user.userData?.taxpayerNumber || '') === opts.search : listing.includesSearch([ user.username, user.email, user.role, user.employeeRole, user.userData?.name, user.userData?.phone, user.userData?.employeeNumber], opts.search)).sort((a, b) => listing.compare(a, b, opts.sortBy, opts.sortDir));
    listing.respond(res, result, opts.page, opts.limit);
  } catch (error) {
    console.error('Erro ao listar utilizadores:', error);
    res.status(500).json({ message: 'Erro ao listar utilizadores.' });
  }
};


// Cria atleta/aluno no centro de formação e regista a inscrição.
exports.createAthlete = async (req, res) => {
  let athlete = null;
  let userData = null;
  let reservedPlan = null;

  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = String(req.body.phone || '').trim();
    const taxpayerNumber = String(req.body.taxpayerNumber || '').trim();
    const birthDate = parseBirthDate(req.body.birthDate);
    const emergencyContactName = String(req.body.emergencyContactName || '').trim();
    const emergencyContactPhone = String(req.body.emergencyContactPhone || '').trim();
    const planId = String(req.body.planId || '').trim();
    const structuredAddress = addressUtils.normalizeAddress(req.body);

    if (!name || !email || !phone || !planId) {
      return res.status(400).json({ message: 'Nome, email, telefone e escalão são obrigatórios.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email inválido.' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'O telefone deve ter 9 dígitos e começar por 9 ou 2.' });
    }
    if (taxpayerNumber && !isValidTaxpayerNumber(taxpayerNumber)) {
      return res.status(400).json({ message: 'O NIF indicado não é válido.' });
    }
    if (birthDate && !isValidBirthDate(birthDate)) {
      return res.status(400).json({ message: 'Data de nascimento inválida.' });
    }
    const addressError = addressUtils.validateAddress(structuredAddress);
    if (addressError) return res.status(400).json({ message: addressError });
    if (emergencyContactPhone && !isValidPhone(emergencyContactPhone)) {
      return res.status(400).json({ message: 'O telefone de emergência deve ter 9 dígitos e começar por 9 ou 2.' });
    }

    const plan = await EnrolmentPlan.findById(planId);
    if (!plan || plan.active === false) {
      return res.status(404).json({ message: 'Escalão ativo não encontrado.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Já existe uma conta com este email.' });
    }

    const usernameBase = normalizeEmail(email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18) || 'atleta';
    let username = usernameBase;
    for (let attempt = 1; await User.exists({ username }); attempt++) {
      username = `${usernameBase}${attempt}`;
    }

    const password = await bcrypt.hash(`Atleta${Math.floor(100000 + Math.random() * 900000)}`, 10);
    athlete = await User.create({ username, email, password, role: 'Atleta', employeeRole: 'Normal', ativo: true, validado: true });
    userData = await UserData.create(cleanOptionalEmployeeFields({
      user: athlete._id,
      name,
      phone,
      taxpayerNumber,
      birthDate,
      ...structuredAddress,
      emergencyContactName,
      emergencyContactPhone
    }));

    reservedPlan = await EnrolmentPlan.findOneAndUpdate(
      { _id: plan._id, active: true, vacancies: { $gt: 0 } },
      { $inc: { vacancies: -1 } },
      { new: true }
    );
    if (!reservedPlan) {
      const vacancyError = new Error('Este escalão já não tem vagas disponíveis.');
      vacancyError.status = 400;
      throw vacancyError;
    }

    const mainImage = (reservedPlan.images || []).find((image) => image.isMain) || (reservedPlan.images || [])[0];
    const totalCents = Number(reservedPlan.feeCents || 0);
    const enrolment = await EnrolmentRequest.create({
      user: athlete._id,
      status: 'pendente',
      registrationChannel: 'secretaria',
      athleteAddress: {
        addressType: userData.addressType || '',
        addressName: userData.addressName || '',
        doorNumber: userData.doorNumber || '',
        postalCode: userData.postalCode || '',
        city: userData.city || ''
      },
      billing: {
        useAthleteAddress: true,
        taxpayerRequested: !!userData.taxpayerNumber,
        taxpayerNumber: userData.taxpayerNumber || '',
        addressType: userData.addressType || '',
        addressName: userData.addressName || '',
        doorNumber: userData.doorNumber || '',
        postalCode: userData.postalCode || '',
        city: userData.city || ''
      },
      items: [{
        plan: reservedPlan._id,
        planCode: reservedPlan.code,
        planName: reservedPlan.name,
        planImageUrl: mainImage?.imageUrl || '',
        monthlyFeeCents: totalCents,
        quantity: 1,
        lineTotalCents: totalCents
      }],
      subtotalCents: totalCents,
      totalCents,
      discountCents: 0,
      statusHistory: [{ changedByUser: req.userId, newStatus: 'pendente', note: 'Inscrição criada na secretaria.' }]
    });

    res.status(201).json({
      message: 'Atleta criado e inscrito com sucesso.',
      athlete: { _id: athlete._id, id: athlete._id, username: athlete.username, email: athlete.email, role: athlete.role, ativo: athlete.ativo, validado: athlete.validado, userData },
      enrolment
    });
  } catch (error) {
    if (reservedPlan && athlete && !error?.enrolmentCommitted) {
      await EnrolmentPlan.findByIdAndUpdate(reservedPlan._id, { $inc: { vacancies: 1 } }).catch(() => {});
    }
    if (athlete) {
      await UserData.deleteMany({ user: athlete._id }).catch(() => {});
      await User.findByIdAndDelete(athlete._id).catch(() => {});
    }
    console.error('Erro ao criar atleta:', error);
    if (error?.code === 11000) return res.status(400).json({ message: 'Já existe um atleta com estes dados.' });
    res.status(error?.status || 500).json({ message: error?.status ? error.message : 'Erro ao criar atleta.' });
  }
};// Cria treinador.
exports.createEmployee = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = normalizeEmail(req.body.email);
    let name = String(req.body.name || '').trim();
    let phone = String(req.body.phone || '').trim();
    const jobTitle = String(req.body.jobTitle || 'Treinador').trim();

    if (!username || !email) {
      return res.status(400).json({ message: 'Username e email são obrigatórios.' });
    }

    if (username.length < 7) {
      return res.status(400).json({ message: 'O nome de utilizador deve conter pelo menos 7 caracteres.' });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({ message: 'O nome de utilizador só pode conter letras, números e underscores.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email inválido.' });
    }

    if (email.endsWith('@example.com')) {
      return res.status(400).json({ message: 'Usa um email real para o treinador.' });
    }

    const existing = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existing) {
      return res.status(400).json({ message: 'Já existe um utilizador com esse nome de utilizador ou email.' });
    }

    const temporaryPassword = 'Temp12345';
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const employeeNumber = await generateEmployeeNumber(null);

    const employee = await User.create({ username, email, password: hashedPassword, role: 'Funcionario', employeeRole: 'Normal', ativo: true, validado: false});

    const userData = await UserData.create({ user: employee._id, employeeNumber, name, phone, jobTitle});

    res.status(201).json({ message: `Treinador criado com sucesso. Número interno: ${employeeNumber}. Password temporária: ${temporaryPassword}`, temporaryPassword, employee: { _id: employee._id, id: employee._id, username: employee.username, email: employee.email, role: employee.role, employeeRole: employee.employeeRole, validado: employee.validado, userData}});
  } catch (error) {
    console.error('Erro ao criar treinador:', error);
    res.status(500).json({ message: 'Erro ao criar treinador.' });
  }
};

// Atualiza own perfil.
exports.updateOwnProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    const updates = req.body || {};
    const hasUsername = Object.prototype.hasOwnProperty.call(updates, 'username');
    const hasEmail = Object.prototype.hasOwnProperty.call(updates, 'email');
    const hasName = Object.prototype.hasOwnProperty.call(updates, 'name');
    const hasPhone = Object.prototype.hasOwnProperty.call(updates, 'phone');
    const hasTaxpayerNumber = Object.prototype.hasOwnProperty.call(updates, 'taxpayerNumber');
    const hasAddress = Object.prototype.hasOwnProperty.call(updates, 'address');
    const hasJobTitle = Object.prototype.hasOwnProperty.call(updates, 'jobTitle');
    const addressFields = ['street', 'addressType', 'addressName', 'doorNumber', 'postalCode', 'city'];
    const hasStructuredAddress = addressFields.some(field => Object.prototype.hasOwnProperty.call(updates, field));

    if (hasUsername) {
      const username = String(updates.username || '').trim();

      if (!username) {
        return res.status(400).json({ message: 'Username é obrigatório.' });
      }

      if (username.length < 7) {
        return res.status(400).json({ message: 'O nome de utilizador deve conter pelo menos 7 caracteres.' });
      }

      if (!isValidUsername(username)) {
        return res.status(400).json({ message: 'O nome de utilizador só pode conter letras, números e underscores.' });
      }

      const existingUsername = await User.findOne({ _id: { $ne: user._id }, username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username já está em uso.' });
      }

      user.username = username;
    }

    if (hasEmail) {
      const email = normalizeEmail(updates.email);

      if (!email) {
        return res.status(400).json({ message: 'Email é obrigatório.' });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Email inválido.' });
      }

      if (email.endsWith('@example.com')) {
        return res.status(400).json({ message: 'Usa um email real.' });
      }

      const existingEmail = await User.findOne({ _id: { $ne: user._id }, email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email já está em uso.' });
      }

      user.email = email;
    }

    await user.save();

    let userData = await UserData.findOne({ user: user._id });

    if (hasName || hasPhone || hasTaxpayerNumber || hasAddress || hasJobTitle || hasStructuredAddress) {
      const structuredAddress = addressUtils.normalizeAddress({
        street: Object.prototype.hasOwnProperty.call(updates, 'street') ? updates.street : '',
        addressType: Object.prototype.hasOwnProperty.call(updates, 'addressType') ? updates.addressType : userData?.addressType,
        addressName: Object.prototype.hasOwnProperty.call(updates, 'addressName') ? updates.addressName : userData?.addressName,
        doorNumber: Object.prototype.hasOwnProperty.call(updates, 'doorNumber') ? updates.doorNumber : userData?.doorNumber,
        postalCode: Object.prototype.hasOwnProperty.call(updates, 'postalCode') ? updates.postalCode : userData?.postalCode,
        city: Object.prototype.hasOwnProperty.call(updates, 'city') ? updates.city : userData?.city
      });
      const nextUserData = {
        name: hasName ? String(updates.name || '').trim() : String(userData?.name || '').trim(),
        phone: hasPhone ? String(updates.phone || '').trim() : String(userData?.phone || '').trim(),
        taxpayerNumber: hasTaxpayerNumber ? String(updates.taxpayerNumber || '').trim() : String(userData?.taxpayerNumber || '').trim(),
        address: hasAddress ? String(updates.address || '').trim() : String(userData?.address || '').trim(),
        ...structuredAddress,
        employeeNumber: await getEmployeeNumber(user, userData),
        jobTitle: hasJobTitle ? String(updates.jobTitle || '').trim() : String(userData?.jobTitle || '').trim()
      };

      if (hasName && !nextUserData.name) {
        return res.status(400).json({ message: 'Nome é obrigatório.' });
      }

      if (hasPhone && !isValidPhone(nextUserData.phone)) {
        return res.status(400).json({ message: 'O telefone deve ter 9 dígitos e começar por 9 ou 2.' });
      }

      if (hasTaxpayerNumber && nextUserData.taxpayerNumber && !isValidTaxpayerNumber(nextUserData.taxpayerNumber)) {
        return res.status(400).json({ message: 'O NIF indicado não é válido.' });
      }

      if (!isFuncionario(user) && hasAddress && !isValidAddress(nextUserData.address)) {
        return res.status(400).json({ message: 'A address deve começar por Rua, Avenida, Praça, Largo ou outro tipo de via válido.' });
      }

      if (hasStructuredAddress) {
        const addressError = addressUtils.validateAddress(structuredAddress);
        if (addressError) return res.status(400).json({ message: addressError });
      }

      if (isFuncionario(user) && hasJobTitle && !nextUserData.jobTitle) {
        return res.status(400).json({ message: 'Cargo/função é obrigatório.' });
      }

      userData = await UserData.findOneAndUpdate(
        { user: user._id },
        cleanOptionalEmployeeFields({ user: user._id, ...nextUserData }),
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Perfil atualizado com sucesso.', userData, user: { _id: user._id, id: user._id, username: user.username, email: user.email, role: user.role, employeeRole: user.employeeRole, validado: user.validado, ativo: user.ativo, hasUserData: isUserDataComplete(user, userData), name: userData ? userData.name : user.username}});
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Este NIF ja esta associado a outra conta.' });
    }
    res.status(500).json({ message: 'Erro ao atualizar perfil.' });
  }
};

// Altera initial palavra-passe.
exports.changeInitialPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Preenche a nova password e a confirmação.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'A nova password deve ter pelo menos 8 caracteres.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'A confirmação da password não coincide.' });
    }

    if (newPassword === 'Temp12345') {
      return res.status(400).json({ message: 'A nova password não pode ser igual à password temporária.' });
    }

    const user = await User.findById(req.userId);

    if (!isFuncionario(user)) {
      return res.status(403).json({ message: 'Apenas contas internas podem alterar a password inicial.' });
    }

    const userData = await UserData.findOne({ user: user._id });

    user.password = await bcrypt.hash(newPassword, 10);
    user.validado = true;
    await user.save();

    res.json({ message: 'Password alterada com sucesso.', user: { _id: user._id, id: user._id, username: user.username, email: user.email, role: user.role, employeeRole: user.employeeRole, validado: user.validado, hasUserData: isUserDataComplete(user, userData)}});
  } catch (error) {
    console.error('Erro ao alterar password inicial:', error);
    res.status(500).json({ message: 'Erro ao alterar password inicial.' });
  }
};

// Altera palavra-passe.
exports.changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Preenche a password atual, a nova password e a confirmação.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'A nova password deve ter pelo menos 8 caracteres.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'A confirmação da password não coincide.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'A nova password deve ser diferente da password atual.' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado.' });
    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(400).json({ message: 'A password atual está incorreta.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password alterada com sucesso.' });
  } catch (error) {
    console.error('Erro ao alterar password:', error);
    res.status(500).json({ message: 'Erro ao alterar password.' });
  }
};

// Guarda pessoais dados.
exports.savePersonalData = async (req, res) => {
  try {
    let name = String(req.body.name || '').trim();
    let phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const structuredAddress = addressUtils.normalizeAddress(req.body);
    const jobTitle = String(req.body.jobTitle || '').trim();
    const birthDate = parseBirthDate(req.body.birthDate);
    const emergencyContactName = String(req.body.emergencyContactName || '').trim();
    const emergencyContactPhone = String(req.body.emergencyContactPhone || '').trim();

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    const existingUserData = await UserData.findOne({ user: user._id });
    const taxpayerNumber = String(req.body.taxpayerNumber || existingUserData?.taxpayerNumber || '').trim();
    if (!isFuncionario(user)) {
      name = name || String(existingUserData?.name || '').trim();
      phone = phone || String(existingUserData?.phone || '').trim();
    }

    if (!name || !phone) {
      return res.status(400).json({ message: 'Nome e telefone são obrigatórios.' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'O telefone deve ter 9 dígitos e começar por 9 ou 2.' });
    }

    if (taxpayerNumber && !isValidTaxpayerNumber(taxpayerNumber)) {
      return res.status(400).json({ message: 'O NIF indicado não é válido.' });
    }

    const addressError = addressUtils.validateAddress(structuredAddress);
    if (addressError) return res.status(400).json({ message: addressError });

    if (isFuncionario(user) && !jobTitle) {
      return res.status(400).json({ message: 'Cargo/função é obrigatório para treinadores.' });
    }

    const employeeNumber = await getEmployeeNumber(user, existingUserData);
    const payload = isFuncionario(user)
      ? {
          user: user._id,
          name,
          phone,
          taxpayerNumber,
          ...structuredAddress,
          birthDate: existingUserData?.birthDate || null,
          emergencyContactName: existingUserData?.emergencyContactName || '',
          emergencyContactPhone: existingUserData?.emergencyContactPhone || '',
          employeeNumber,
          jobTitle
        }
      : {
          user: user._id,
          name,
          phone,
          taxpayerNumber,
          ...structuredAddress,
          birthDate: existingUserData?.birthDate || null,
          emergencyContactName: existingUserData?.emergencyContactName || '',
          emergencyContactPhone: existingUserData?.emergencyContactPhone || '',
          employeeNumber: existingUserData?.employeeNumber || '',
          jobTitle: existingUserData?.jobTitle || ''
        };

    const userData = await UserData.findOneAndUpdate(
      { user: user._id },
      cleanOptionalEmployeeFields(payload),
      { upsert: true, new: true }
    );

    res.json({ message: 'Dados pessoais guardados com sucesso.', userData, user: { _id: user._id, id: user._id, username: user.username, email: user.email, role: user.role, employeeRole: user.employeeRole, validado: user.validado, hasUserData: isUserDataComplete(user, userData), name: userData.name}});
  } catch (error) {
    console.error('Erro ao guardar dados pessoais:', error);
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors || {})[0]?.message || 'Existem dados pessoais inválidos.' });
    }
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Já existe um registo com estes dados.' });
    }
    res.status(500).json({ message: 'Erro ao guardar dados pessoais. Consulta o terminal do backend para mais detalhes.' });
  }
};

// Alterna ativos.
exports.toggleActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    if (String(user._id) === String(req.userId)) {
      return res.status(400).json({ message: 'Não podes desativar a tua própria conta.' });
    }

    user.ativo = !user.ativo;
    await user.save();

    res.json({ message: 'Estado do utilizador atualizado.', user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error('Erro ao alterar estado do utilizador:', error);
    res.status(500).json({ message: 'Erro ao alterar estado do utilizador.' });
  }
};

// Remove utilizador.
exports.removeUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    if (String(user._id) === String(req.userId)) {
      return res.status(400).json({ message: 'Não podes remover a tua própria conta.' });
    }

    if (user.ativo) {
      return res.status(400).json({ message: 'Só podes remover utilizadores inativos.' });
    }

    await UserData.deleteMany({ user: user._id });
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'Utilizador removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover utilizador:', error);
    res.status(500).json({ message: 'Erro ao remover utilizador.' });
  }
};

// Atualiza conta do treinador.
exports.updateEmployeeAccount = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const jobTitle = String(req.body.jobTitle || '').trim();

    if (!username || !email) {
      return res.status(400).json({ message: 'Username e email são obrigatórios.' });
    }

    if (username.length < 7) {
      return res.status(400).json({ message: 'O nome de utilizador deve conter pelo menos 7 caracteres.' });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({ message: 'O nome de utilizador só pode conter letras, números e underscores.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email inválido.' });
    }

    const employee = await User.findById(req.params.id);

    if (!employee || employee.role !== 'Funcionario') {
      return res.status(404).json({ message: 'Treinador não encontrado.' });
    }

    const existing = await User.findOne({ _id: { $ne: employee._id }, $or: [{ username }, { email }]});

    if (existing) {
      return res.status(400).json({ message: 'Já existe um utilizador com esse nome de utilizador ou email.' });
    }

    employee.username = username;
    employee.email = email;

    await employee.save();
    const userData = await UserData.findOneAndUpdate({ user: employee._id }, { user: employee._id, name, phone, jobTitle, employeeNumber: await getEmployeeNumber(employee, await UserData.findOne({ user: employee._id })) }, { upsert: true, new: true });

    res.json({
      message: 'Dados de acesso do treinador atualizados.',
      employee: { _id: employee._id, id: employee._id, username: employee.username, email: employee.email, role: employee.role, employeeRole: employee.employeeRole, validado: employee.validado, ativo: employee.ativo, createdAt: employee.createdAt, updatedAt: employee.updatedAt, userData}});
  } catch (error) {
    console.error('Erro ao atualizar treinador:', error);
    res.status(500).json({ message: 'Erro ao atualizar treinador.' });
  }
};

// Atualiza fotografia e documentos do atleta.
exports.updateAthleteFiles = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'Atleta') {
      return res.status(404).json({ message: 'Atleta não encontrado.' });
    }

    const payload = {};
    if (req.body.athletePhotoUrl !== undefined) payload.athletePhotoUrl = String(req.body.athletePhotoUrl || '').trim();
    if (req.body.healthCertificateUrl !== undefined) payload.healthCertificateUrl = String(req.body.healthCertificateUrl || '').trim();
    if (req.body.healthCertificateName !== undefined) payload.healthCertificateName = String(req.body.healthCertificateName || '').trim();
    if (req.body.healthCertificateMimeType !== undefined) payload.healthCertificateMimeType = String(req.body.healthCertificateMimeType || '').trim();
    if (payload.healthCertificateUrl) payload.healthCertificateUploadedAt = new Date();

    const userData = await UserData.findOneAndUpdate(
      { user: user._id },
      { $set: payload, $setOnInsert: { user: user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Ficheiros do atleta atualizados com sucesso.', userData });
  } catch (error) {
    console.error('Erro ao atualizar ficheiros do atleta:', error);
    res.status(500).json({ message: 'Erro ao atualizar ficheiros do atleta.' });
  }
};