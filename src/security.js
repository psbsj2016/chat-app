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

// Limitador de Taxa de Requisições (Preparado para migrar para Redis)
const loginAttempts = new Map();
const rateLimiter = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const record = loginAttempts.get(ip);
    
    if (!record) { 
        loginAttempts.set(ip, { count: 1, first: now }); 
    } else {
        if (now - record.first > 15 * 60 * 1000) { 
            loginAttempts.set(ip, { count: 1, first: now }); 
        } else {
            record.count++;
            if (record.count > 30) return res.status(429).json({ error: 'Muitas tentativas. Bloqueio ativo. Aguarde 15 minutos.' });
        }
    }
    next();
};

module.exports = { aegisMiddleware, rateLimiter };