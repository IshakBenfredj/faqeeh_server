function extractIdFromUrl(url) {
  const match = url.match(/\/lists\/([^\/]+)\.png$/);
  return match ? `lists/${match[1]}` : null;
}

module.exports = extractIdFromUrl;
