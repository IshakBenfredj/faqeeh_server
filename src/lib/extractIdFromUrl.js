function extractIdFromUrl(url) {
  const match = url.match(/\/packs\/([^\/]+)\.png$/);
  return match ? `packs/${match[1]}` : null;
}

module.exports = extractIdFromUrl;
