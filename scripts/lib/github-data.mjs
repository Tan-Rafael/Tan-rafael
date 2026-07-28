const GRAPHQL_QUERY = `
query ($login: String!) {
  user(login: $login) {
    name
    login
    createdAt
    followers { totalCount }
    following { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
        forkCount
        primaryLanguage { name color }
        languages(first: 6, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount weekday }
        }
      }
    }
  }
}`;

function authHeaders(token) {
  const headers = { "Content-Type": "application/json", Accept: "application/vnd.github+json", "User-Agent": "github-profile-cyber-dashboard" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchGraphQl(login, token) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ query: GRAPHQL_QUERY, variables: { login } })
  });
  if (!response.ok) throw new Error(`GitHub GraphQL API returned ${response.status} ${response.statusText}.`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "));
  return payload.data.user;
}

async function fetchSearchCount(query, token) {
  const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=1`, { headers: authHeaders(token) });
  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload.total_count === "number" ? payload.total_count : null;
}

function aggregateLanguages(repositoryNodes) {
  const totals = new Map();
  repositoryNodes.forEach((repo) => {
    (repo.languages?.edges || []).forEach(({ size, node }) => {
      const entry = totals.get(node.name) || { name: node.name, color: node.color || "#8B949E", size: 0 };
      entry.size += size;
      totals.set(node.name, entry);
    });
  });
  const sorted = [...totals.values()].sort((a, b) => b.size - a.size).slice(0, 6);
  const grandTotal = sorted.reduce((sum, item) => sum + item.size, 0) || 1;
  return sorted.map((item) => ({ ...item, share: item.size / grandTotal }));
}

function summarizeCalendar(calendar) {
  const weeks = calendar?.weeks || [];
  const weeklyTotals = weeks.map((week) => week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0));
  const dayGrid = weeks.map((week) => week.contributionDays.map((day) => day.contributionCount));
  return { weeklyTotals, dayGrid, totalContributions: calendar?.totalContributions ?? weeklyTotals.reduce((a, b) => a + b, 0) };
}

export async function fetchGithubStats(username, token) {
  const user = await fetchGraphQl(username, token);
  if (!user) throw new Error(`GitHub user ${username} was not found.`);

  const repositoryNodes = user.repositories?.nodes || [];
  const totalStars = repositoryNodes.reduce((sum, repo) => sum + (repo.stargazerCount || 0), 0);
  const totalForks = repositoryNodes.reduce((sum, repo) => sum + (repo.forkCount || 0), 0);
  const languages = aggregateLanguages(repositoryNodes);
  const { weeklyTotals, dayGrid, totalContributions } = summarizeCalendar(user.contributionsCollection?.contributionCalendar);

  const [openIssues, totalIssues, openPulls, totalPulls] = await Promise.all([
    fetchSearchCount(`author:${username} type:issue state:open`, token),
    fetchSearchCount(`author:${username} type:issue`, token),
    fetchSearchCount(`author:${username} type:pr state:open`, token),
    fetchSearchCount(`author:${username} type:pr`, token)
  ]);

  return {
    login: user.login,
    repositories: user.repositories?.totalCount ?? repositoryNodes.length,
    followers: user.followers?.totalCount ?? 0,
    following: user.following?.totalCount ?? 0,
    stars: totalStars,
    forks: totalForks,
    contributions: totalContributions,
    weeklyTotals,
    dayGrid,
    languages,
    issues: { open: openIssues ?? 0, total: totalIssues ?? 0 },
    pulls: { open: openPulls ?? 0, total: totalPulls ?? 0 }
  };
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

export function buildSampleStats(username = "sample-user") {
  const random = seededRandom(42);
  const weeks = 52;
  const dayGrid = Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const wave = Math.sin((week / weeks) * Math.PI * 3.4) * 0.5 + 0.5;
    const weekend = day === 0 || day === 6 ? 0.4 : 1;
    const noise = random();
    return Math.round(clampNumber(wave * 8 * weekend + noise * 3, 0, 14));
  }));
  const weeklyTotals = dayGrid.map((week) => week.reduce((a, b) => a + b, 0));
  const totalContributions = weeklyTotals.reduce((a, b) => a + b, 0);

  return {
    login: username,
    repositories: 24,
    followers: 128,
    following: 41,
    stars: 356,
    forks: 58,
    contributions: totalContributions,
    weeklyTotals,
    dayGrid,
    languages: [
      { name: "JavaScript", color: "#F1E05A", share: 0.34 },
      { name: "TypeScript", color: "#3178C6", share: 0.24 },
      { name: "Python", color: "#3572A5", share: 0.18 },
      { name: "PHP", color: "#4F5D95", share: 0.12 },
      { name: "CSS", color: "#563D7C", share: 0.08 },
      { name: "HTML", color: "#E34C26", share: 0.04 }
    ],
    issues: { open: 6, total: 41 },
    pulls: { open: 3, total: 27 }
  };
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
