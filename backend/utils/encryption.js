const crypto = require("node:crypto");

function getEncryptionKey() {
    const key = process.env.TOKEN_ENCRYPTION_KEY;

    if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error("Invalid TOKEN_ENCRYPTION_KEY");
    }

    return Buffer.from(key, "hex");
}

function encrypt(text) {
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return [
        iv.toString("hex"),
        authTag.toString("hex"),
        encrypted.toString("hex")
    ].join(":");
}

function decrypt(encryptedText) {
    const [ivHex, authTagHex, dataHex] = encryptedText.split(":");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        Buffer.from(ivHex, "hex")
    );

    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, "hex")),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };