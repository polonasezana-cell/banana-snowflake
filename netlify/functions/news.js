
const SOURCES = [
  {
    name: "Google News – Sežana",
    url: "https://news.google.com/rss/search?q=Se%C5%BEana&hl=sl&gl=SI&ceid=SI:sl"
  }
];

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function field(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return match ? decode(match[1].trim()) : "";
}

exports.handler = async function () {
  try {
    const response = await fetch(SOURCES[0].url, {
      headers: { "User-Agent": "BananaSnowflake/4.0" },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error("Vir je vrnil HTTP " + response.status);
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 12)
      .map((match) => ({
        title: field(match[1], "title").replace(/<[^>]*>/g, ""),
        link: field(match[1], "link"),
        date: field(match[1], "pubDate"),
        description: field(match[1], "description")
          .replace(/<[^>]*>/g, "").slice(0, 300),
        source: SOURCES[0].name
      }))
      .filter((item) => item.title && item.link);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, items, news: items })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: false,
        error: String(error.message || error)
      })
    };
  }
};
