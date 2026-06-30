const mongoose = require('mongoose');
const Image = require('../models/image');
const Document = require('../models/document');

// Função auxiliar «uploadImage».
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Imagem obrigatória.' });
    }

    const image = await Image.create({ originalName: String(req.file.originalname || '').trim(), mimeType: req.file.mimetype, size: req.file.size, data: req.file.buffer, uploadedBy: req.userId || null});

    res.status(201).json({ message: 'Imagem guardada na base de dados.', imageId: image._id, imageUrl: `/api/images/load/${image._id}`});
  } catch (error) {
    console.error('Erro ao guardar imagem na base de dados:', error);
    res.status(500).json({ message: 'Erro ao guardar imagem na base de dados.' });
  }
};

// Obtém imagem.
exports.getImage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).end();
    }

    const image = await Image.findById(req.params.id).select('mimeType data createdAt');
    if (!image) return res.status(404).end();

    res.set({'Content-Type': image.mimeType,'Content-Length': image.data.length,'Cache-Control': 'public, max-age=31536000, immutable'});
    res.send(image.data);
  } catch (error) {
    console.error('Erro ao carregar imagem da base de dados:', error);
    res.status(500).end();
  }
};

// Guarda documento na base de dados.
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Documento obrigatório.' });
    }

    const document = await Document.create({
      originalName: String(req.file.originalname || '').trim(),
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      documentType: String(req.body.documentType || 'certificado_saude').trim(),
      uploadedBy: req.userId || null
    });

    res.status(201).json({
      message: 'Documento guardado na base de dados.',
      documentId: document._id,
      documentUrl: `/api/documents/load/${document._id}`,
      originalName: document.originalName,
      mimeType: document.mimeType
    });
  } catch (error) {
    console.error('Erro ao guardar documento na base de dados:', error);
    res.status(500).json({ message: 'Erro ao guardar documento na base de dados.' });
  }
};

// Obtém documento.
exports.getDocument = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).end();
    }

    const document = await Document.findById(req.params.id).select('originalName mimeType data createdAt');
    if (!document) return res.status(404).end();

    res.set({
      'Content-Type': document.mimeType,
      'Content-Length': document.data.length,
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName || 'documento')}"`,
      'Cache-Control': 'private, max-age=0, no-cache'
    });
    res.send(document.data);
  } catch (error) {
    console.error('Erro ao carregar documento da base de dados:', error);
    res.status(500).end();
  }
};