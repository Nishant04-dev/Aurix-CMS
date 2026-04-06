export const ok = (res, data, message = 'Success') =>
  res.status(200).json({ success: true, message, data });

export const created = (res, data, message = 'Created') =>
  res.status(201).json({ success: true, message, data });

export const badRequest = (res, message = 'Bad request') =>
  res.status(400).json({ success: false, error: message });

export const unauthorized = (res, message = 'Unauthorized') =>
  res.status(401).json({ success: false, error: message });

export const forbidden = (res, message = 'Forbidden') =>
  res.status(403).json({ success: false, error: message });

export const notFound = (res, message = 'Not found') =>
  res.status(404).json({ success: false, error: message });

export const tooManyRequests = (res, message = 'Rate limit exceeded') =>
  res.status(429).json({ success: false, error: message });

export const serverError = (res, message = 'Internal server error') =>
  res.status(500).json({ success: false, error: message });
