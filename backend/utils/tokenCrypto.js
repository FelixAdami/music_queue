
const crypto = require("node:crypto");

function getKey() {
    const hexKey = process.env.TOKEN_ENCRYPTION_KEY;

    if (!hexKey || !/^[0-9a-fA-F]{64}$/.test(hexKey)) {
        throw new Error("Invalid TOKEN_ENCRYPTION_KEY");
    }

    return Buffer.from(hexKey, "hex");
}

function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        getKey(),
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return [
        iv.toString("hex"),
        tag.toString("hex"),
        encrypted.toString("hex")
    ].join(":");
}

function decrypt(value) {
    const [ivHex, tagHex, encryptedHex] = value.split(":");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getKey(),
        Buffer.from(ivHex, "hex")
    );

    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
