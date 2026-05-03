import { useState, useCallback, useMemo, useEffect } from "react";

const WEBHOOK_URL = "http://localhost:5678/webhook/price-compare";

const PREFERRED_STORES = [
  { key: "amazon",           label: "Amazon",           color: "#FF9900",  match: ["amazon"] },
  { key: "flipkart",         label: "Flipkart",         color: "#2874F0",  match: ["flipkart"] },
  { key: "snapdeal",         label: "Snapdeal",         color: "#E40046",  match: ["snapdeal"] },
  { key: "croma",            label: "Croma",            color: "#67AE3E",  match: ["croma"] },
  { key: "reliance_digital", label: "Reliance Digital", color: "#1A6EC0",  match: ["reliance", "reliancedigital", "jio"] },
];

function getCanonicalStore(source) {
  const s = (source || "").toLowerCase();
  const store = PREFERRED_STORES.find(p => p.match.some(m => s.includes(m)));
  return store ? store.label : source;
}

const SELLER_COLORS = ["#FF9900", "#2874F0", "#E40046", "#67AE3E", "#1A6EC0", "#9333EA", "#EC4899", "#14B8A6"];

const SORT_OPTIONS = [
  { key: "price_asc",  label: "Price: Low → High" },
  { key: "price_desc", label: "Price: High → Low" },
  { key: "rating",     label: "Best Rated" },
];

const SELLER_ICON = "🏪";

/* ── styles ──────────────────────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; color: #f0ede8; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  .app { min-height: 100vh; background: #0a0a0f; position: relative; overflow-x: hidden; }
  .bg-glow { position: fixed; top: -200px; left: 50%; transform: translateX(-50%); width: 800px; height: 500px; background: radial-gradient(ellipse, rgba(255,90,31,0.12) 0%, transparent 70%); pointer-events: none; z-index: 0; }
  .bg-grid { position: fixed; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; z-index: 0; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }

  /* header */
  .header { padding: 48px 0 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .logo-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,90,31,0.1); border: 1px solid rgba(255,90,31,0.25); border-radius: 100px; padding: 6px 16px; font-size: 12px; font-weight: 500; color: #ff5a1f; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 20px; }
  .logo-dot { width: 6px; height: 6px; background: #ff5a1f; border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
  .title { font-family: 'Syne', sans-serif; font-size: clamp(48px,8vw,88px); font-weight: 800; line-height: 0.95; letter-spacing: -0.03em; }
  .title span { color: #ff5a1f; }
  .subtitle { margin-top: 16px; font-size: 16px; font-weight: 300; color: rgba(240,237,232,0.45); }

  /* search */
  .search-section { margin: 48px auto 0; max-width: 660px; }
  .search-wrapper { display: flex; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 6px 6px 6px 24px; gap: 12px; transition: border-color .2s, box-shadow .2s; }
  .search-wrapper:focus-within { border-color: rgba(255,90,31,.5); box-shadow: 0 0 0 4px rgba(255,90,31,.08); }
  .search-icon { color: rgba(240,237,232,0.3); flex-shrink: 0; }
  .search-input { flex: 1; background: transparent; border: none; outline: none; font-family: 'DM Sans', sans-serif; font-size: 16px; color: #f0ede8; caret-color: #ff5a1f; }
  .search-input::placeholder { color: rgba(240,237,232,0.25); }
  .search-btn { background: #ff5a1f; color: #fff; border: none; border-radius: 11px; padding: 14px 28px; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: .02em; cursor: pointer; transition: background .2s, transform .15s, box-shadow .2s; white-space: nowrap; flex-shrink: 0; }
  .search-btn:hover:not(:disabled) { background: #e84d13; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(255,90,31,.35); }
  .search-btn:disabled { opacity: .6; cursor: not-allowed; }

  /* ── filter panel ───────────────────────────────────────────────── */
  .filter-panel { margin: 28px auto 0; max-width: 900px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }
  .filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .filter-label { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: rgba(240,237,232,0.35); min-width: 64px; }
  .store-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 100px; padding: 7px 14px; font-size: 13px; font-weight: 500; color: rgba(240,237,232,0.6); cursor: pointer; transition: all .18s; white-space: nowrap; }
  .store-btn:hover { border-color: rgba(255,255,255,0.25); color: #f0ede8; }
  .store-btn.active { color: #fff; }
  .sort-btn { display: inline-flex; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 100px; padding: 7px 16px; font-size: 13px; font-weight: 500; color: rgba(240,237,232,0.6); cursor: pointer; transition: all .18s; white-space: nowrap; }
  .sort-btn:hover { border-color: rgba(255,255,255,0.25); color: #f0ede8; }
  .sort-btn.active { background: rgba(255,90,31,0.15); border-color: rgba(255,90,31,0.4); color: #ff5a1f; }
  .price-inputs { display: flex; align-items: center; gap: 10px; }
  .price-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 7px 12px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #f0ede8; width: 110px; outline: none; transition: border-color .2s; }
  .price-input:focus { border-color: rgba(255,90,31,.5); }
  .price-input::placeholder { color: rgba(240,237,232,0.25); }
  .price-sep { color: rgba(240,237,232,0.3); font-size: 13px; }
  .filter-apply-btn { margin-left: auto; background: #ff5a1f; color: #fff; border: none; border-radius: 10px; padding: 8px 20px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; transition: background .2s, transform .15s; }
  .filter-apply-btn:hover { background: #e84d13; transform: translateY(-1px); }
  .filter-reset { background: transparent; border: 1px solid rgba(255,255,255,0.12); color: rgba(240,237,232,0.4); border-radius: 10px; padding: 8px 16px; font-size: 13px; cursor: pointer; transition: all .18s; }
  .filter-reset:hover { border-color: rgba(255,255,255,0.3); color: rgba(240,237,232,0.7); }

  /* skeleton */
  .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 20px; margin-top: 64px; }
  .skeleton-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; }
  .skeleton-img { width: 100%; aspect-ratio: 1/1; background: rgba(255,255,255,0.05); animation: shimmer 1.4s ease-in-out infinite; }
  .skeleton-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }
  .skeleton-line { height: 12px; border-radius: 6px; background: rgba(255,255,255,0.06); animation: shimmer 1.4s ease-in-out infinite; }
  .skeleton-line.short{width:40%} .skeleton-line.medium{width:70%}
  /* login */
  .login-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fadeIn .3s ease; }
  .login-modal { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; padding: 48px; width: 100%; max-width: 440px; box-shadow: 0 40px 100px rgba(0,0,0,0.5); position: relative; }
  .login-close { position: absolute; top: 24px; right: 24px; background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 20px; }
  .login-title { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 8px; text-align: center; }
  .login-subtitle { font-size: 14px; color: rgba(255,255,255,0.4); text-align: center; margin-bottom: 32px; }
  .login-form { display: flex; flex-direction: column; gap: 16px; }
  .login-input-group { display: flex; flex-direction: column; gap: 8px; }
  .login-input-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,0.3); }
  .login-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px; color: #fff; font-family: inherit; outline: none; transition: border-color .2s; }
  .login-input:focus { border-color: #ff5a1f; }
  .login-submit { background: #ff5a1f; color: #fff; border: none; border-radius: 12px; padding: 16px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; cursor: pointer; transition: transform .2s, background .2s; margin-top: 8px; }
  .login-submit:hover { background: #e84d13; transform: translateY(-2px); }
  .user-menu { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 6px 6px 6px 14px; border-radius: 100px; position: absolute; top: 40px; right: 40px; z-index: 10; transition: all .2s; }
  .user-menu:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
  .user-name { font-size: 13px; font-weight: 600; color: #f0ede8; }
  .user-avatar { width: 32px; height: 32px; background: #ff5a1f; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; }
  .logout-btn { background: none; border: none; color: rgba(255,60,60,0.6); font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer; padding: 0 8px; transition: color .2s; }
  .logout-btn:hover { color: #ff3c3c; }

  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }


  /* error */
  .error-banner { margin-top: 40px; background: rgba(255,60,60,0.08); border: 1px solid rgba(255,60,60,0.2); border-radius: 14px; padding: 20px 24px; text-align: center; }
  .error-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #ff5a5a; margin-bottom: 6px; }
  .error-sub { font-size: 13px; color: rgba(255,90,90,0.6); }

  /* results */
  .results-section { margin-top: 48px; padding-bottom: 80px; }
  .results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .results-label { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: rgba(240,237,232,0.3); }
  .results-count { font-size: 13px; color: rgba(240,237,232,0.3); }
  .results-count span { color: #ff5a1f; font-weight: 600; }
  .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 20px; }

  /* card */
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; transition: transform .25s, border-color .25s, box-shadow .25s; animation: fadeUp .4s ease both; position: relative; }
  .card:hover { transform: translateY(-6px); border-color: rgba(255,90,31,.3); box-shadow: 0 20px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(255,90,31,.1); }
  @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .card:nth-child(1){animation-delay:.05s} .card:nth-child(2){animation-delay:.10s} .card:nth-child(3){animation-delay:.15s}
  .card:nth-child(4){animation-delay:.20s} .card:nth-child(5){animation-delay:.25s} .card:nth-child(6){animation-delay:.30s}
  .best-badge { position: absolute; top: 12px; left: 12px; z-index: 2; background: #ff5a1f; color: #fff; font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; }
  .rank-badge { position: absolute; top: 12px; left: 12px; z-index: 2; background: rgba(255,255,255,0.08); color: rgba(240,237,232,0.5); font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
  .saving-tag { font-size: 11px; color: #4ade80; }
  .card-image-wrap { width: 100%; aspect-ratio: 1/1; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
  .card-image-wrap::after { content:''; position:absolute; inset:0; background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,.5)); pointer-events:none; }
  .card-image-wrap img { width:100%; height:100%; object-fit:contain; padding:20px; transition:transform .4s ease; }
  .card:hover .card-image-wrap img { transform: scale(1.05); }
  .card-no-img { font-size: 48px; opacity: .25; }
  .card-body { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .card-source { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: rgba(240,237,232,0.35); }
  .source-dot { width: 5px; height: 5px; border-radius: 50%; background: #ff5a1f; opacity: .7; }
  .card-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 600; color: #f0ede8; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-rating { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #fbbf24; }
  .card-rating span { color: rgba(240,237,232,0.35); font-size: 11px; }
  .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
  .card-price { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #ff5a1f; }
  .card-link { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,90,31,0.12); color: #ff5a1f; text-decoration: none; font-size: 12px; font-weight: 600; font-family: 'Syne', sans-serif; letter-spacing: .04em; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,90,31,.2); transition: background .2s, border-color .2s; }
  .card-link:hover { background: rgba(255,90,31,0.22); border-color: rgba(255,90,31,.4); }

  /* empty */
  .empty-state { text-align: center; padding: 80px 20px; }
  .empty-icon { font-size: 52px; margin-bottom: 16px; display: block; opacity: .4; }
  .empty-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: rgba(240,237,232,0.3); margin-bottom: 8px; }
  .empty-sub { font-size: 14px; color: rgba(240,237,232,0.18); }

  @media (max-width: 640px) {
    .container { padding: 0 16px; }
    .filter-panel { padding: 18px 16px; }
    .filter-row { gap: 8px; }
    .price-inputs { flex-wrap: wrap; }
  }
`;

/* ── helpers ─────────────────────────────────────────────────────────── */
function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {[...Array(6)].map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-img" style={{ animationDelay: `${i * 0.1}s` }} />
          <div className="skeleton-body">
            <div className="skeleton-line short" />
            <div className="skeleton-line medium" />
            <div className="skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StarRating({ rating }) {
  if (!rating) return null;
  const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  return <div className="card-rating">{stars} <span>({rating})</span></div>;
}

function LoginModal({ isOpen, onClose, onLogin }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !name) return;
    onLogin({ name, email });
    onClose();
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()} style={{animation: 'slideUp .4s ease'}}>
        <button className="login-close" onClick={onClose}>&times;</button>
        <h2 className="login-title">Welcome Back</h2>
        <p className="login-subtitle">Sign in to track prices and save your wishlist.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="login-input-label">Full Name</label>
            <input 
              type="text" 
              className="login-input" 
              placeholder="Enter your name" 
              value={name}
              onChange={e => setName(e.target.value)}
              required 
            />
          </div>
          <div className="login-input-group">
            <label className="login-input-label">Email Address</label>
            <input 
              type="email" 
              className="login-input" 
              placeholder="name@example.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="login-submit">Continue</button>
        </form>
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────────── */
export default function App() {
  const [query, setQuery]           = useState("");
  const [rawProducts, setRawProducts] = useState([]);  // unfiltered from backend
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [searched, setSearched]     = useState(false);
  
  const [showLogin, setShowLogin]   = useState(false);
  const [user, setUser]             = useState(null);

  // Load user from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("buywise_user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("buywise_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("buywise_user");
  };

  // filters (applied client-side, instant)
  const [selectedSellers, setSelectedSellers] = useState([]);
  const [sortBy, setSortBy]                   = useState("price_asc");
  const [minPrice, setMinPrice]               = useState("");
  const [maxPrice, setMaxPrice]               = useState("");

  const toggleSeller = (name) =>
    setSelectedSellers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );

  const resetFilters = () => {
    setSelectedSellers([]);
    setSortBy("price_asc");
    setMinPrice("");
    setMaxPrice("");
  };

  // Extract unique seller names from raw results
  const sellerStats = useMemo(() => {
    const counts = {};
    rawProducts.forEach(p => {
      const canonical = getCanonicalStore(p.source);
      counts[canonical] = (counts[canonical] || 0) + 1;
    });

    const major = PREFERRED_STORES.map(s => ({
      ...s,
      count: counts[s.label] || 0
    }));

    const other = Object.entries(counts)
      .filter(([name]) => !PREFERRED_STORES.some(p => p.label === name))
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return { major, other };
  }, [rawProducts]);

  const { major: majorStores, other: otherSellers } = sellerStats;

  // Client-side filtering + sorting via useMemo (instant, no re-fetch)
  const filteredProducts = useMemo(() => {
    let list = [...rawProducts];

    // Seller filter (uses canonical names)
    if (selectedSellers.length > 0) {
      list = list.filter(p => selectedSellers.includes(getCanonicalStore(p.source)));
    }

    // Price range filter
    const pMin = minPrice ? parseFloat(minPrice) : 0;
    const pMax = maxPrice ? parseFloat(maxPrice) : Infinity;
    if (pMin > 0 || pMax < Infinity) {
      list = list.filter(p => p.price >= pMin && p.price <= pMax);
    }

    // Sort
    if (sortBy === "price_desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      list.sort((a, b) => a.price - b.price);
    }

    // Recompute badges based on filtered+sorted list
    const best = list[0]?.price || 0;
    return list.map((r, i) => ({
      ...r,
      badge:  i === 0 ? "Best Price" : `#${i + 1}`,
      saving: i === 0 ? 0 : Math.abs(r.price - best),
    }));
  }, [rawProducts, selectedSellers, sortBy, minPrice, maxPrice]);

  const searchProducts = useCallback(async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setRawProducts([]);

    try {
      const res  = await fetch(WEBHOOK_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: q }),  // only send query, filters are client-side
      });
      const text = await res.text();
      console.log("[BuyWise] status:", res.status, "raw:", text.slice(0, 300));
      if (!text || text.trim() === "")
        throw new Error("Empty response from n8n — is the workflow active?");
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed)         ? parsed
                : Array.isArray(parsed?.data)    ? parsed.data
                : Array.isArray(parsed?.results) ? parsed.results
                : [];
      setRawProducts(arr);
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e) => { if (e.key === "Enter") searchProducts(); };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="bg-glow" />
        <div className="bg-grid" />
        <div className="container">

          {/* ── User Profile / Login ── */}
          {user ? (
            <div className="user-menu">
              <span className="user-name">{user.name.split(' ')[0]}</span>
              <div className="user-avatar">{user.name.charAt(0)}</div>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <button className="search-btn" style={{position:'absolute', top:'40px', right:'40px', padding:'10px 20px'}} onClick={() => setShowLogin(true)}>
              Sign In
            </button>
          )}

          {/* ── Header ── */}
          <header className="header">
            <div className="logo-badge"><span className="logo-dot" />Smart Shopping</div>
            <h1 className="title">Buy<span>Wise</span></h1>
            <p className="subtitle">Best prices from Amazon, Flipkart, Snapdeal, Croma &amp; Reliance Digital.</p>
          </header>

          {/* ── Search ── */}
          <div className="search-section">
            <div className="search-wrapper">
              <svg className="search-icon" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                id="search-input"
                className="search-input"
                type="text"
                placeholder="Search for any product…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button id="search-btn" className="search-btn" onClick={() => searchProducts()} disabled={loading}>
                {loading ? "Searching…" : "Search →"}
              </button>
            </div>
          </div>

          {/* ── Filter Panel ── */}
          <div className="filter-panel">
            {/* Seller toggles — dynamically generated from results */}
            <div className="filter-row">
              <span className="filter-label">Major Stores</span>
              {majorStores.map(s => {
                const active = selectedSellers.includes(s.label);
                return (
                  <button
                    key={s.key}
                    className={`store-btn${active ? " active" : ""}`}
                    style={active ? { background: `${s.color}22`, borderColor: s.color, color: s.color } : {}}
                    disabled={s.count === 0 && !active}
                    onClick={() => toggleSeller(s.label)}
                    title={s.count === 0 ? "No results found for this store" : ""}
                  >
                    {active ? "✅" : "🏪"} {s.label} {s.count > 0 && `(${s.count})`}
                  </button>
                );
              })}
            </div>

            {otherSellers.length > 0 && (
              <div className="filter-row">
                <span className="filter-label">Others</span>
                {otherSellers.map((s, idx) => {
                  const active = selectedSellers.includes(s.name);
                  const color = SELLER_COLORS[idx % SELLER_COLORS.length];
                  return (
                    <button
                      key={s.name}
                      className={`store-btn${active ? " active" : ""}`}
                      style={active ? { background: `${color}22`, borderColor: color, color } : {}}
                      onClick={() => toggleSeller(s.name)}
                    >
                      {active ? "✅" : "🏪"} {s.name} ({s.count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sort */}
            <div className="filter-row">
              <span className="filter-label">Sort by</span>
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.key}
                  id={`sort-btn-${o.key}`}
                  className={`sort-btn${sortBy === o.key ? " active" : ""}`}
                  onClick={() => setSortBy(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {/* Price range + actions */}
            <div className="filter-row">
              <span className="filter-label">Price ₹</span>
              <div className="price-inputs">
                <input
                  id="price-min"
                  className="price-input"
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  min="0"
                />
                <span className="price-sep">—</span>
                <input
                  id="price-max"
                  className="price-input"
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  min="0"
                />
              </div>
              <button id="filter-reset-btn" className="filter-reset" onClick={resetFilters}>Reset</button>
            </div>
          </div>

          {/* ── Loading skeleton ── */}
          {loading && <SkeletonGrid />}

          {/* ── Error ── */}
          {!loading && error && (
            <div className="error-banner">
              <p className="error-title">Something went wrong</p>
              <p className="error-sub">{error}</p>
            </div>
          )}

          {/* ── Results ── */}
          {!loading && !error && filteredProducts.length > 0 && (
            <section className="results-section">
              <div className="results-header">
                <span className="results-label">Results — {SORT_OPTIONS.find(o => o.key === sortBy)?.label}</span>
                <span className="results-count"><span>{filteredProducts.length}</span> products found{rawProducts.length !== filteredProducts.length ? ` (of ${rawProducts.length})` : ''}</span>
              </div>
              <div className="products-grid">
                {filteredProducts.map((p, i) => (
                  <div className="card" key={i} style={{ animationDelay: `${Math.min(i, 5) * 0.05 + 0.05}s` }}>
                    {i === 0 && <span className="best-badge">🏆 Best Price</span>}
                    {i > 0 && p.badge && <span className="rank-badge">{p.badge}</span>}
                    <div className="card-image-wrap">
                      {p.image
                        ? <img src={p.image} alt={p.title} onError={e => { e.target.style.display = "none"; }} />
                        : <span className="card-no-img">🏪</span>
                      }
                    </div>
                    <div className="card-body">
                      <div className="card-source"><span className="source-dot" />{getCanonicalStore(p.source)}</div>
                      <h4 className="card-title">{p.title}</h4>
                      <StarRating rating={p.rating} />
                      {p.saving > 0 && <p className="saving-tag">+₹{p.saving.toLocaleString("en-IN")} vs best price</p>}
                      <div className="card-footer">
                        <div className="card-price">{p.priceFmt || `₹${p.price}`}</div>
                        {p.link && (
                          <a className="card-link" href={p.link} target="_blank" rel="noreferrer">
                            View
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M7 17 17 7M7 7h10v10" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Empty after search ── */}
          {!loading && !error && searched && filteredProducts.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p className="empty-title">No results found</p>
              <p className="empty-sub">
                {rawProducts.length > 0
                  ? `${rawProducts.length} products fetched but none match your filters. Try resetting filters.`
                  : 'Try a different product name, or check the n8n workflow is active'}
              </p>
            </div>
          )}

          {/* ── Initial state ── */}
          {!searched && (
            <div className="empty-state">
              <span className="empty-icon">🛒</span>
              <p className="empty-title">Nothing here yet</p>
              <p className="empty-sub">Type a product name above and hit Search</p>
            </div>
          )}

        </div>
      </div>
      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLogin={handleLogin} 
      />
    </>
  );
}