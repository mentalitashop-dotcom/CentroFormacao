const allowedTypes = ['Rua', 'Avenida', 'Praca', 'Largo', 'Travessa', 'Alameda', 'Estrada', 'Caminho', 'Praceta', 'Urbanizacao', 'Rotunda', 'Beco', 'Bairro', 'Quinta', 'Lugar', 'Zona Industrial'];

// Função auxiliar «comparable».
function comparable(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT');
}

// Normaliza morada.
function normalizeAddress(body = {}) {
  const street = String(body.street || '').trim();
  let addressType = String(body.addressType || '').trim();
  let addressName = String(body.addressName || '').trim();

  if (street) {
    const normalizedStreet = comparable(street);
    const matchedType = allowedTypes.find(type => normalizedStreet.startsWith(`${comparable(type)} `));
    addressType = matchedType || '';
    addressName = matchedType ? street.slice(matchedType.length).trim() : street;
  }
  const doorNumber = String(body.doorNumber || '').trim().toUpperCase();
  const postalCode = String(body.postalCode || '').trim();
  const city = String(body.city || '').trim();
  return { addressType, addressName, doorNumber, postalCode, city, address: `${addressType} ${addressName}, ${doorNumber}, ${postalCode} ${city}`.trim() };
}

// Valida morada.
function validateAddress(address) {
  if (!allowedTypes.includes(address.addressType)) return 'A address deve comecar por Rua, Avenida ou outro tipo de via valido.';
  if (!/^[\p{L}\d][\p{L}\d .,'ºª()-]{2,159}$/u.test(address.addressName)) return 'Indica corretamente o nome da rua ou avenida.';
  if (!/^\d{1,5}[A-Z]?(?:[-/][0-9A-Z]+)?$/.test(address.doorNumber)) return 'O numero da porta deve conter numeros e, opcionalmente, uma letra.';
  if (!/^[1-9]\d{3}-\d{3}$/.test(address.postalCode)) return 'O codigo postal deve seguir o formato 1234-567.';
  if (!/^[\p{L}][\p{L} .'-]{1,99}$/u.test(address.city)) return 'Indica uma cidade valida.';
  return '';
}

module.exports = { allowedTypes, normalizeAddress, validateAddress };
