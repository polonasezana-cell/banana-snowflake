
const QUERIES = [
  "Sežana",
  "Sežana dogodki OR prireditve",
  "Sežana knjižnica OR kultura OR društva",
  "Sežana občina OR zapora ceste OR obvestilo"
];

const MAX_AGE_DAYS = 7;
const MAX_RESULTS = 20;

function decode(text = "") {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function field(xml, tag) {
  const match = xml.match(
    new RegExp(
      `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
      "i"
    )
  );
  return match ? decode(match[1].trim()) : "";
}

async function search(query) {
  const url = new URL(
    "https://news.google.com/rss/search"
  );

  url.searchParams.set("q", query + " when:7d");
  url.searchParams.set("hl", "sl");
  url.searchParams.set("gl", "SI");
  url.searchParams.set("ceid", "SI:sl");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 BananaSnowflake/4.1"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  const xml = await response.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(match => ({
      title: field(match[1], "title")
        .replace(/<[^>]*>/g, ""),
      link: field(match[1], "link"),
      date: field(match[1], "pubDate"),
      description: field(match[1], "description")
        .replace(/<[^>]*>/g, "").slice(0, 300),
      source: "Google News – Sežana"
    }))
    .filter(item => item.title && item.link);
}

exports.handler = async function () {
  try {
    const results = await Promise.allSettled(
      QUERIES.map(search)
    );

    const all = results.flatMap(result =>
      result.status === "fulfilled"
        ? result.value
        : []
    );

    const cutoff =
      Date.now() - MAX_AGE_DAYS * 86400000;

    const seen = new Set();

    const items = all
      .filter(item => {
        const timestamp = Date.parse(item.date);

        if (!Number.isFinite(timestamp)) return false;
        if (timestamp < cutoff || timestamp > Date.now()) {
          return false;
        }

        const key = item.title
          .toLocaleLowerCase("sl")
          .replace(/\s+-\s+[^-]+$/, "")
          .trim();

        if (seen.has(key)) return false;
        seen.add(key);

        return true;
      })
      .sort(
        (a, b) =>
          Date.parse(b.date) - Date.parse(a.date)
      )
      .slice(0, MAX_RESULTS);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        ok: true,
        items,
        news: items,
        count: items.length,
        source: "Google News – Sežana",
        maxAgeDays: MAX_AGE_DAYS,
        fetchedAt: new Date().toISOString(),
        warnings: results
          .filter(r => r.status === "rejected")
          .map(() => "Eden od virov ni bil dosegljiv.")
      })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        ok: false,
        error: String(error.message || error)
      })
    };
  }
};
