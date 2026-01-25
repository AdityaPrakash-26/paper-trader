const { supabaseAdmin } = require('../lib/supabase');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token.' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    req.user = data.user;
    req.accessToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requireAuth,
};
