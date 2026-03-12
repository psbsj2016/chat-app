// Sanitização de Banco de Dados (Anti-Injeção)
const sanitizeNoSQL = (obj) => {
    if (typeof obj !== 'object' || obj === null) return;
    Object.keys(obj).forEach(key => {
        if (key.includes('$')) delete obj[key];
        else sanitizeNoSQL(obj[key]);
    });
};

// Protocolo Aegis Nativo
const aegisMiddleware = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (req.body) sanitizeNoSQL(req.body);
    if (req.query) sanitizeNoSQL(req.query);
    if (req.params) sanitizeNoSQL(req.params);
    next();
};

// security.js - Limitador de Taxa Ajustado
const loginAttempts = new Map();

const rateLimiter = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const record = loginAttempts.get(ip);
    
    if (!record) { 
        loginAttempts.set(ip, { count: 1, first: now }); 
    } else {
        // Reinicia a contagem a cada 15 minutos
        if (now - record.first > 15 * 60 * 1000) { 
            loginAttempts.set(ip, { count: 1, first: now }); 
        } else {
            record.count++;
            // 💡 NOVA LÓGICA: Aumentámos para 1000 requisições por IP a cada 15 minutos.
            // Um chat dinâmico faz dezenas de requisições só para abrir, por isso 30 era muito baixo!
            if (record.count > 1000) { 
                return res.status(429).json({ error: 'Muitas tentativas. Bloqueio ativo. Aguarde 15 minutos.' });
            }
        }
    }
    next();
};

module.exports = { aegisMiddleware, rateLimiter };