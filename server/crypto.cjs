const crypto = require('crypto');

const ECDH_CURVE = 'prime256v1';
const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function generateEcdhKeyPair() {
  const ecdh = crypto.createECDH(ECDH_CURVE);
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey('base64'),
    privateKey: ecdh.getPrivateKey('base64'),
  };
}

function deriveSharedSecret(privateKeyBase64, theirPublicKeyBase64) {
  const ecdh = crypto.createECDH(ECDH_CURVE);
  ecdh.setPrivateKey(Buffer.from(privateKeyBase64, 'base64'));
  const sharedPoint = ecdh.computeSecret(Buffer.from(theirPublicKeyBase64, 'base64'));
  return crypto.createHash('sha256').update(sharedPoint).digest();
}

function decryptPayload(encryptedBase64, keyBuffer) {
  const packed = Buffer.from(encryptedBase64, 'base64');
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(AES_ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = {
  generateEcdhKeyPair,
  deriveSharedSecret,
  decryptPayload,
};
