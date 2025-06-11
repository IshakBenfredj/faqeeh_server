function extractIdFromUrl(url) {
  try {
    url = url.replace(/^https?:\/\/\/*/, "https://");
    const urlObj = new URL(url);
    console.log(
      "key",
      urlObj.pathname.startsWith("/")
        ? urlObj.pathname.slice(1)
        : urlObj.pathname
    );
    return urlObj.pathname.startsWith("/")
      ? urlObj.pathname.slice(1)
      : urlObj.pathname;
  } catch (err) {
    console.error("Invalid URL passed to extractIdFromUrl:", url);
    return null;
  }
}

module.exports = extractIdFromUrl;
