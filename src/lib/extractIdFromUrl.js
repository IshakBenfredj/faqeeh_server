function extractIdFromUrl(url) {
  const match = url.match(/\/(?:video|image)\/upload\/v\d+\/(.+?)\.[a-z0-9]+$/i);
  return match ? match[1] : null;
}

module.exports = extractIdFromUrl;
