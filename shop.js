// HomeWeb – Product Modal + Cart + Checkout + Search + Login //

// PRODUCT DATA — now loaded live from Supabase (see loadProducts()) //
let products = [];

var CATEGORY_META = {
  vegetable: { title: 'Vegetable',      bg: '#F0FFF4', color: '#22C55E', icon: 'fa-carrot' },
  meat:      { title: 'Meat',           bg: '#FFF0F0', color: '#EF4444', icon: 'fa-drumstick-bite' },
  seafood:   { title: 'Sea Food',       bg: '#F0F8FF', color: '#3B82F6', icon: 'fa-fish-fins' },
  sarisari:  { title: 'Sari-sari Store',bg: '#FFFBEB', color: '#F59E0B', icon: 'fa-store' },
  drinks:    { title: 'Drinks',         bg: '#EFF6FF', color: '#0EA5E9', icon: 'fa-bottle-water' },
  other:     { title: 'Other',          bg: '#F9F9F9', color: '#888888', icon: 'fa-box' }
};
var DEFAULT_CATEGORY_META = { bg: '#F9F9F9', color: '#CBD5E1', icon: 'fa-box' };

function getProductImage(id) {
  var p = products.find(function(x) { return x.id === id; });
  return (p && p.image_url) ? p.image_url : null;
}

var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Bolanteros stores only trade on specific days; permanent stores are open daily //
function isStoreOpenToday(merchant) {
  if (!merchant) return true;
  if (merchant.merchant_type !== 'bolanteros') return true;
  var days = merchant.open_days || [];
  return days.indexOf(new Date().getDay()) !== -1;
}

function openDaysLabel(merchant) {
  if (!merchant || merchant.merchant_type !== 'bolanteros') return 'Open daily';
  var days = (merchant.open_days || []).slice().sort(function(a, b) { return a - b; });
  if (!days.length) return 'No open days set';
  return 'Open ' + days.map(function(d) { return DAY_SHORT[d]; }).join(', ');
}

// Fetch all active products (with seller info) from Supabase //
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*, merchants(id, store_name, merchant_type, open_days, is_verified, is_suspended)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not load products:', error.message);
    products = [];
    return;
  }

  products = (data || [])
    .filter(function(p) {
      // Suspended merchants disappear from the storefront entirely //
      if (p.merchants && p.merchants.is_suspended) return false;
      // Bolanteros stores disappear from the storefront on their closed days //
      return isStoreOpenToday(p.merchants);
    })
    .map(function(p) {
    var meta = CATEGORY_META[p.category] || DEFAULT_CATEGORY_META;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      oldPrice: null,
      discount: 0,
      rating: Math.round(p.rating_avg || 0) || 0,
      ratingAvg: p.rating_avg || 0,
      ratingCount: p.rating_count || 0,
      soldCount: p.sold_count || 0,
      icon: meta.icon,
      location: (p.merchants && p.merchants.store_name) || 'HomeWeb Seller',
      category: p.category,
      image_url: p.image_url,
      stock_qty: p.stock_qty,
      merchant_id: p.merchant_id,
      merchantVerified: !!(p.merchants && p.merchants.is_verified),
      unit: p.unit || 'pc'
    };
  });
}

// Shared label for a product's social proof: rating + review count + units sold //
function productStatsLabel(p) {
  var parts = [];
  if (p.ratingCount > 0) parts.push(p.ratingAvg + ' (' + p.ratingCount + ')');
  parts.push((p.soldCount || 0) + ' sold');
  return parts.join(' \u2022 ');
}

function fmtPrice(n) {
  return '\u20B1' + Number(n).toLocaleString();
}

// Renders a star rating with pixel-precise fractional fill (4.5 shows as
// 4 full + exactly half; 3.8 shows as 3 full + exactly 3/4, not just
// rounded to the nearest half-star) by overlaying a full-color star row
// clipped to the exact percentage on top of a grey empty-star row. //
// Renders a star rating with genuinely precise fractional fill (4.5
// shows as 4 solid stars + exactly half; 3.8 shows as 3 solid stars +
// exactly 3/4). The previous version clipped a percentage-width overlay
// against a 5-character string inside a shrink-to-fit container — that's
// a real CSS ambiguity (the containing block's computed width for the
// percentage can subtly disagree with the shrink-to-fit content width,
// especially with letter-spacing on multi-glyph text), and in practice
// it was silently rounding up to look like 5 full stars regardless of
// the actual rating. This version sidesteps that entirely: full and
// empty stars are just individually-colored characters — no clipping,
// no ambiguity — and at most ONE character ever needs a partial fill,
// using an explicit fixed pixel width instead of a percentage of an
// unreliable shrink-to-fit parent. //
// Renders a star rating using real SVG star shapes, not clipped text
// characters. This matters: a Unicode ★ glyph's internal shape varies by
// font and has uneven padding around its points, so clipping it at a
// mathematically-correct 50% width doesn't visually read as "half a
// star" — the clip cuts through an irregular shape, not a clean vector
// path, and mixing plain text glyphs with absolutely-positioned wrapper
// spans is also what caused the misalignment. Every position here is the
// exact same SVG element with only its fill-clip percentage changed, so
// all 5 are guaranteed to sit on the same baseline, and a real vector
// star clips predictably at any percentage — this is the same technique
// Google/Amazon-style rating widgets use, not a shortcut. //
// Renders a star rating using real Font Awesome star icons — full, half,
// and empty — instead of clipping a custom star shape by percentage.
// Three previous attempts at continuous-precision clipping each fixed
// one visual artifact but exposed another (misaligned partial star, then
// a partial fill that visually read as fuller than its true percentage,
// then a diagonal-looking clip boundary). That last one turned out to be
// a genuine geometric limitation, not a bug: a 5-pointed star's outline
// is diagonal almost everywhere, so any straight clip through it will
// visually appear to follow a slant, no matter how carefully the
// percentage is calculated. Real half-star icons don't have this
// problem — they're professionally drawn to look correct, not derived
// by cutting a full star in half. The tradeoff: precision drops from
// continuous/quarter-star to half-star (3.8 now shows as 4 stars, not
// "3 full + 3/4"), but every rating renders cleanly with zero artifacts,
// and it uses the same icon font already relied on everywhere else in
// the app, guaranteeing consistent baseline alignment for free. //
function starsHTML(n) {
  n = Math.max(0, Math.min(5, Number(n) || 0));
  var rounded = Math.round(n * 2) / 2; // snap to nearest half star
  var full = Math.floor(rounded + 0.001);
  var hasHalf = (rounded - full) >= 0.49;
  var empty = 5 - full - (hasHalf ? 1 : 0);

  var html = '<span style="display:inline-flex;align-items:center;gap:2px;vertical-align:middle;">';
  for (var i = 0; i < full; i++) {
    html += '<i class="fas fa-star" style="color:#F59E0B;font-size:14px;"></i>';
  }
  if (hasHalf) {
    html += '<i class="fas fa-star-half-stroke" style="color:#F59E0B;font-size:14px;"></i>';
  }
  for (var j = 0; j < empty; j++) {
    html += '<i class="far fa-star" style="color:#ddd;font-size:14px;"></i>';
  }
  html += '</span>';
  return html;
}

function stars(n) { return starsHTML(n); }

// Shared product card markup used by both the homepage and category page //
function renderProductCardHtml(p) {
  var meta = CATEGORY_META[p.category] || DEFAULT_CATEGORY_META;
  var badge = p.discount
    ? '<div class="product-badge sale-badge">-' + p.discount + '%</div>'
    : (p.ratingCount >= 10 && p.ratingAvg >= 4.7 ? '<div class="product-badge free-badge">Best Seller</div>' : '');
  var oldPriceHtml = p.oldPrice ? '<span class="price-old">' + fmtPrice(p.oldPrice) + '</span>' : '';
  var imgSrc = getProductImage(p.id);
  var imgHtml = imgSrc
    ? '<div class="product-img" style="background:' + meta.bg + ';"><img src="' + imgSrc + '" alt="' + p.name + '" loading="lazy"/></div>'
    : '<div class="product-img" style="background:' + meta.bg + ';"><i class="fas ' + p.icon + '" style="color:' + meta.color + ';font-size:32px;"></i></div>';

  var stockNote = stockLabelHtml(p.stock_qty);

  return '<div class="product-card" data-product-id="' + p.id + '">' +
    badge +
    '<div class="wishlist-btn"><i class="far fa-heart"></i></div>' +
    imgHtml +
    '<div class="product-info">' +
    '<p class="product-name">' + p.name + '</p>' +
    '<div class="product-prices"><span class="price-now">' + fmtPrice(p.price) + '</span>' + oldPriceHtml + ' <span style="color:#999;font-size:11.5px;font-weight:400;">/ ' + p.unit + '</span></div>' +
    '<div class="product-stars">' + starsHTML(p.ratingAvg) + '<span>' + productStatsLabel(p) + '</span></div>' +
    '<p class="product-location"><i class="fas fa-store"></i> ' + p.location + '</p>' +
    stockNote +
    '</div></div>';
}

// Shared stock indicator — used on cards, in the product modal, and in store views //
function stockLabelHtml(qty) {
  if (typeof qty !== 'number') return '';
  if (qty <= 0) {
    return '<p class="product-location" style="color:#DC2626;font-weight:600;"><i class="fas fa-ban"></i> Out of stock</p>';
  }
  if (qty <= 5) {
    return '<p class="product-location" style="color:#DC2626;font-weight:600;"><i class="fas fa-box"></i> Only ' + qty + ' left</p>';
  }
  if (qty <= 20) {
    return '<p class="product-location" style="color:#B45309;"><i class="fas fa-box"></i> ' + qty + ' left in stock</p>';
  }
  return '<p class="product-location" style="color:#15803D;"><i class="fas fa-box"></i> ' + qty + ' in stock</p>';
}

// Render the homepage "Recommended For You" grid //
function renderHomeProducts() {
  var grid = document.getElementById('home-product-grid');
  if (!grid) return;
  var list = products.slice(0, 8);
  grid.innerHTML = list.length
    ? list.map(renderProductCardHtml).join('')
    : '<p style="color:#999;padding:2rem;">No products available yet.</p>';
  attachCardClicks();
}

// Render the category page grid, filtered by ?cat= param //
function renderCategoryPage() {
  var grid = document.getElementById('cat-product-grid');
  if (!grid) return;

  var params = new URLSearchParams(window.location.search);
  var cat = params.get('cat');
  var showAll = !cat;
  var meta = showAll ? { title: 'All Products' } : (CATEGORY_META[cat] || { title: 'All Products' });

  var titleEl = document.getElementById('cat-title');
  if (titleEl) titleEl.textContent = meta.title;

  var list = showAll ? products.slice() : products.filter(function(p) { return p.category === cat; });
  var empty = document.getElementById('cat-empty');

  if (!list.length) {
    grid.innerHTML = '';
    if (empty) { empty.style.display = 'block'; empty.innerHTML = '<i class="fas fa-box-open" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.4"></i><p>No products found in this category yet.</p>'; }
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = list.map(renderProductCardHtml).join('');
  attachCardClicks();
}


//  STATE //
let cart = JSON.parse(localStorage.getItem('shopnow_cart') || '[]');
let currentProduct = null;    
let checkoutStep = 1;         
let currentUser = null;
var pendingPasswordRecovery = false;

// Subscribed immediately, at the top of the script — not nested inside an
// async function called later from DOMContentLoaded. This matters: Supabase
// starts scanning the URL for a password-reset token the instant the client
// is created, and fires PASSWORD_RECOVERY as soon as that async check
// resolves. If our listener isn't already registered by then, the event
// fires on an empty listener list and is silently missed — which is
// exactly what caused the reset link to log the user in normally instead
// of prompting for a new password. //
supabase.auth.onAuthStateChange(function(event, session) {
  currentUser = session ? session.user : null;
  updateAuthUI();
  updateNotifBadge();
  updateChatBadge();
  if (currentUser) startRiderAlertPolling(); else stopRiderAlertPolling();

  if (event === 'PASSWORD_RECOVERY') {
    // The reset-password modal is injected dynamically by injectModals(),
    // which only runs once DOMContentLoaded fires — this event can arrive
    // before that. If the modal isn't in the DOM yet, flag it and let the
    // init block show it right after injecting modals instead. //
    if (document.getElementById('sn-resetModal')) {
      openSetNewPasswordModal();
    } else {
      pendingPasswordRecovery = true;
    }
  }
});

let userRoles = [];
let currentNotifList = [];
let activeRole = 'customer';
let currentTrackingOrder = null; 
let shippingInfo = {
  firstName: '', lastName: '', phone: '',
  street: '', barangay: '', city: 'Sta. Barbara', zip: '5002',
  delivery: 'standard'
};
let gcashStep = 1; // 1: mobile number, 2: mpin, 3: processing, 4: success
let gcashMobile = '';
let selectedPaymentMethod = 'cod';

//  ORDERS (TRACKING) — now fetched from Supabase, this is just an in-memory cache //
let orders = [];

//  HELPERS //
const fmt = n => '\u20B1' + Number(n).toLocaleString();

// Star rating icons //

// Save cart localStorage //
function saveCart() {
  localStorage.setItem('shopnow_cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const total = cart.reduce((a, b) => a + b.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = total;
    el.style.display = total ? 'inline' : 'none';
  });
}

// Toast notifications //
function showToast(msg, type) {
  type = type || 'success';
  const t = document.getElementById('sn-toast');
  t.textContent = msg;
  t.className = 'sn-toast sn-toast--' + type + ' sn-toast--show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('sn-toast--show'), 2800);
}

// SEARCH // 

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query) {
  if (!query) return text;
  return text.replace(
    new RegExp('(' + escapeRegex(query) + ')', 'gi'),
    '<mark style="background:#ffe680;color:#5a4000;border-radius:2px;padding:0 1px">$1</mark>'
  );
}

// Main search filter function //
function filterProducts(query) {
  const q = query.trim().toLowerCase();
  let shown = 0;

  // Check each product card //
  document.querySelectorAll('.product-card').forEach(function(card) {
    const id = card.dataset.productId;
    const product = products.find(function(p) { return String(p.id) === String(id); });
    if (!product) return;

    const matches = !q || product.name.toLowerCase().includes(q);
    card.style.display = matches ? '' : 'none';
    if (matches) shown++;

    const nameEl = card.querySelector('.product-name, .product-title, h3, h4, p.name, [class*="name"]');
    if (nameEl) {
      if (nameEl.dataset.originalText === undefined) {
        nameEl.dataset.originalText = nameEl.textContent;
      }
      nameEl.innerHTML = (matches && q)
        ? highlightText(nameEl.dataset.originalText, query.trim())
        : nameEl.dataset.originalText;
    }
  });

  // Hide section headings //
  ['flash-sale', 'recommended'].forEach(function(sectionClass) {
    const section = document.querySelector('.' + sectionClass);
    if (!section) return;
    const visibleCards = section.querySelectorAll('.product-card:not([style*="display: none"])');
    const heading = section.querySelector('h2, h3, .section-title');
    if (heading) heading.style.display = visibleCards.length === 0 ? 'none' : '';
  });

  // Empty state message //
  var emptyMsg = document.getElementById('sn-search-empty');
  if (!emptyMsg) {
    emptyMsg = document.createElement('div');
    emptyMsg.id = 'sn-search-empty';
    emptyMsg.style.cssText = [
      'text-align:center',
      'padding:3rem 1rem',
      'color:#999',
      'font-size:15px',
      'display:none'
    ].join(';');
    emptyMsg.innerHTML =
      '<i class="fas fa-search" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.4"></i>' +
      'No products found for "<span id="sn-search-term"></span>"';
    var lastSection = document.querySelector('.recommended') || document.querySelector('.flash-sale');
    if (lastSection) lastSection.after(emptyMsg);
    else document.body.appendChild(emptyMsg);
  }

  if (shown === 0 && q) {
    emptyMsg.style.display = 'block';
    var termEl = document.getElementById('sn-search-term');
    if (termEl) termEl.textContent = query.trim();
  } else {
    emptyMsg.style.display = 'none';
  }

  // Result count //
  var hint = document.getElementById('sn-search-count');
  if (hint) {
    hint.textContent = q
      ? (shown + ' result' + (shown !== 1 ? 's' : '') + ' found')
      : '';
  }
}

function initSearch() {
  var input = document.querySelector(
    'input[type="search"], ' +
    '.search-bar input, ' +
    '.search-input, ' +
    'input[placeholder*="earch"]'
  );

  if (!input) {
    console.warn('HomeWeb search: walang search input na nahanap. Check mo yung selector.');
    return;
  }

  // Live filter //
  input.addEventListener('input', function() {
    filterProducts(this.value);
  });

  // Enter key: filter, then jump straight to the results //
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      filterProducts('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filterProducts(this.value);
      scrollToProductGrid();
    }
  });

  // Clear search //
  input.addEventListener('search', function() {
    filterProducts(this.value);
  });

  // Clicking the search button does the same thing as pressing Enter //
  var searchBtn = document.querySelector('.search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function(e) {
      e.preventDefault();
      filterProducts(input.value);
      scrollToProductGrid();
    });
  }
}

// Scrolls to wherever the product grid actually lives — the homepage's
// "Recommended For You" grid, or category.html's results grid. //
function scrollToProductGrid() {
  var target = document.getElementById('home-product-grid') || document.getElementById('cat-product-grid');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// INJECT DATA-IDS onto existing cards //
//  ATTACH CLICK TO ALL PRODUCT CARDS  //
function attachCardClicks() {
  document.querySelectorAll('.product-card').forEach(function(card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function(e) {
      if (e.target.closest('.wishlist-btn')) return;
      const idx = this.dataset.productId;
      if (idx) openProductModal(idx);
    });
  });

  // Wishlist toggle //
  document.querySelectorAll('.wishlist-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const icon = this.querySelector('i');
      if (icon.classList.contains('far')) {
        icon.classList.replace('far', 'fas');
        icon.style.color = '#EE4D2D';
        showToast('Added to wishlist \u2665');
      } else {
        icon.classList.replace('fas', 'far');
        icon.style.color = '';
        showToast('Removed from wishlist', 'info');
      }
    });
  });
}

// PRODUCT MODAL //
function openProductModal(id) {
  const p = products.find(function(x) { return x.id === id; });
  if (!p) return;
  currentProduct = Object.assign({}, p, { qty: 1 });

  // If opened from within a store view, hide it first so the product
  // modal is never stuck stacking behind it //
  var storeModal = document.getElementById('sn-storeModal');
  if (storeModal && storeModal.classList.contains('active')) {
    document.getElementById('sn-storeOverlay').classList.remove('active');
    storeModal.classList.remove('active');
  }

  const m = document.getElementById('sn-productModal');
  var imgSrc = getProductImage(p.id);
  if (imgSrc) {
    m.querySelector('.pm-icon').innerHTML = '<img src="' + imgSrc + '" alt="' + p.name + '" />';
  } else {
    m.querySelector('.pm-icon').innerHTML = '<i class="fas ' + p.icon + '"></i>';
  }
  m.querySelector('.pm-name').textContent = p.name;
  m.querySelector('.pm-stars').innerHTML = stars(p.ratingAvg) + '<span>' + productStatsLabel(p) + '</span>';
  m.querySelector('.pm-price-now').textContent = fmt(p.price);
  var pmUnit = m.querySelector('.pm-unit');
  if (pmUnit) pmUnit.textContent = ' / ' + p.unit;
  m.querySelector('.pm-price-old').textContent = p.oldPrice ? fmt(p.oldPrice) : '';
  const disc = m.querySelector('.pm-discount');
  disc.textContent = p.discount ? '-' + p.discount + '%' : '';
  disc.style.display = p.discount ? 'inline' : 'none';
  m.querySelector('.pm-location').innerHTML = '<i class="fas fa-store"></i> Sold by <span onclick="closeProductModal(); openMerchantStorefront(\'' + p.merchant_id + '\')" style="text-decoration:underline;cursor:pointer;color:var(--primary,#22C55E);font-weight:600;">' + p.location + '</span>' +
    (p.merchantVerified ? ' <i class="fas fa-badge-check" title="Verified Seller" style="color:var(--primary,#22C55E);"></i>' : '') +
    ' <i class="fas fa-chevron-right" style="font-size:10px;color:#999;"></i>';
  m.querySelector('.pm-qty-val').value = 1;

  var pmStock = m.querySelector('.pm-stock');
  if (pmStock) pmStock.innerHTML = stockLabelHtml(p.stock_qty);
  updateBuyButtonsState(p.stock_qty);

  document.getElementById('sn-overlay').classList.add('active');
  m.classList.add('active');
  document.body.style.overflow = 'hidden'; 

  loadAndRenderReviews(p.id);
  refreshProductStats(p.id);
}

// The global `products` cache is loaded once at page load, so ratings and
// sold counts go stale as soon as anyone else reviews or buys the item.
// Re-fetch the live numbers whenever a product is actually opened. //
async function refreshProductStats(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('rating_avg, rating_count, sold_count, stock_qty, price')
    .eq('id', productId)
    .single();

  if (error || !data) return;

  var cached = products.find(function(x) { return x.id === productId; });
  if (cached) {
    cached.rating = Math.round(data.rating_avg || 0) || 0;
    cached.ratingAvg = data.rating_avg || 0;
    cached.ratingCount = data.rating_count || 0;
    cached.soldCount = data.sold_count || 0;
    cached.stock_qty = data.stock_qty;
    cached.price = data.price;
  }

  // Only update the DOM if this product's modal is still the one open //
  if (!currentProduct || currentProduct.id !== productId) return;
  currentProduct.rating = Math.round(data.rating_avg || 0) || 0;
  currentProduct.ratingAvg = data.rating_avg || 0;
  currentProduct.ratingCount = data.rating_count || 0;
  currentProduct.soldCount = data.sold_count || 0;

  var starsEl = document.querySelector('#sn-productModal .pm-stars');
  if (starsEl) starsEl.innerHTML = stars(currentProduct.ratingAvg) + '<span>' + productStatsLabel(currentProduct) + '</span>';

  currentProduct.stock_qty = data.stock_qty;
  var stockEl = document.querySelector('#sn-productModal .pm-stock');
  if (stockEl) stockEl.innerHTML = stockLabelHtml(data.stock_qty);
  updateBuyButtonsState(data.stock_qty);
}

function reviewRowHtml(r) {
  var name = r.is_anonymous ? 'Anonymous Customer' : (r.reviewer_name || 'HomeWeb Customer');
  var avatarHtml = (!r.is_anonymous && r.reviewer_avatar_url)
    ? '<img src="' + r.reviewer_avatar_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
    : '<i class="fas ' + (r.is_anonymous ? 'fa-user-secret' : 'fa-user') + '"></i>';

  return '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f5f5f5;">' +
    '<div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:#F3F4F6;color:#999;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:13px;">' + avatarHtml + '</div>' +
    '<div style="flex:1;">' +
    '<p style="margin:0;font-weight:600;font-size:12.5px;">' + name + '</p>' +
    '<div style="color:#F59E0B;font-size:13px;">' + stars(r.rating) + '</div>' +
    (r.comment ? '<p style="margin:4px 0 0;font-size:12.5px;color:#555;">' + r.comment + '</p>' : '') +
    '<p style="margin:2px 0 0;font-size:11px;color:#aaa;">' + formatDate(r.created_at) + '</p>' +
    '</div></div>';
}

let currentProductReviews = [];

async function loadAndRenderReviews(productId) {
  var container = document.getElementById('pm-reviews');
  if (!container) return;
  container.innerHTML = '<p style="color:#999;font-size:12.5px;">Loading reviews...</p>';

  const { data, error } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, is_anonymous, reviewer_name, reviewer_avatar_url')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data || !data.length) {
    currentProductReviews = [];
    container.innerHTML = '<h3 style="margin:0 0 8px;font-size:14px;">Customer Reviews</h3><p style="color:#999;font-size:12.5px;">No reviews yet.</p>';
    return;
  }

  currentProductReviews = data;
  renderReviewsList(false);
}

function renderReviewsList(showAll) {
  var container = document.getElementById('pm-reviews');
  if (!container) return;
  var data = currentProductReviews;

  var visible = showAll ? data : data.slice(0, 3);
  var rowsHtml = visible.map(reviewRowHtml).join('');

  var toggleHtml = '';
  if (!showAll && data.length > 3) {
    toggleHtml = '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:8px;padding:8px;" onclick="renderReviewsList(true)">Show all ' + data.length + ' reviews</button>';
  } else if (showAll && data.length > 3) {
    toggleHtml = '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:8px;padding:8px;" onclick="renderReviewsList(false)">Show fewer reviews</button>';
  }

  // Scrollable box for the review rows themselves — keeps the product info
  // above from getting pushed out of view when there are many/long reviews.
  // The toggle button sits outside this box so it's always reachable
  // without needing to scroll to the bottom first.
  container.innerHTML = '<h3 style="margin:0 0 8px;font-size:14px;">Customer Reviews (' + data.length + ')</h3>' +
    '<div style="max-height:280px;overflow-y:auto;">' + rowsHtml + '</div>' +
    toggleHtml;
}

// ============================================================
// MERCHANT STOREFRONT (customer-facing view of a seller's shop)
// ============================================================

// ============================================================
// REPORTS — customers, merchants, and riders can report each other
// ============================================================

var REPORT_REASONS = {
  merchant: ['Item not as described', 'Never received order', 'Fraud or scam', 'Rude or unprofessional', 'Fake or inappropriate listing', 'Other'],
  rider: ['Never delivered', 'Rude or unprofessional', 'Damaged items on arrival', 'Unsafe behavior', 'Other'],
  customer: ['Harassment or abuse', 'Fraudulent order', 'Refused to pay (COD)', 'Fake report/complaint', 'Other']
};

var currentReportContext = null;

function openReportModal(reportedType, reportedId, reportedName, orderId) {
  if (!currentUser) {
    showToast('Please log in to submit a report', 'info');
    openLoginModal();
    return;
  }
  currentReportContext = { reportedType: reportedType, reportedId: reportedId, reportedName: reportedName, orderId: orderId || null };

  var reasons = REPORT_REASONS[reportedType] || ['Other'];
  var body = document.getElementById('sn-report-body');
  body.innerHTML =
    '<div class="login-icon" style="color:#DC2626;"><i class="fas fa-flag"></i></div>' +
    '<h2>Report ' + (reportedType === 'merchant' ? 'Store' : capitalize(reportedType)) + '</h2>' +
    '<p class="login-sub">Reporting: ' + reportedName + '</p>' +
    '<div class="co-field"><label>Reason <span class="co-required">*</span></label>' +
    '<select id="report-reason">' +
    reasons.map(function(r) { return '<option value="' + r + '">' + r + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="co-field"><label>Additional Details (optional)</label>' +
    '<textarea id="report-details" placeholder="Anything else that would help us look into this..." style="width:100%;border:1px solid #e5e5e5;border-radius:8px;padding:10px;font-size:13px;resize:vertical;min-height:70px;font-family:var(--font);"></textarea></div>' +
    '<button class="co-btn co-btn--next" id="report-submit-btn" style="width:100%;" onclick="submitReport()">Submit Report</button>' +
    '<p style="margin:10px 0 0;font-size:11px;color:#999;text-align:center;">Reports are reviewed by HomeWeb admins and kept confidential.</p>';

  document.getElementById('sn-reportOverlay').classList.add('active');
  document.getElementById('sn-reportModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeReportModal() {
  document.getElementById('sn-reportOverlay').classList.remove('active');
  document.getElementById('sn-reportModal').classList.remove('active');
  // Deliberately not touching document.body.style.overflow here — report
  // always opens on top of another already-open modal, which remains
  // responsible for that state until it's closed too.
  currentReportContext = null;
}

async function submitReport() {
  if (!currentReportContext) return;
  var reason = document.getElementById('report-reason').value;
  var details = document.getElementById('report-details').value.trim();
  var btn = document.getElementById('report-submit-btn');

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  const { error } = await supabase.from('reports').insert({
    reporter_id: currentUser.id,
    reported_type: currentReportContext.reportedType,
    reported_id: currentReportContext.reportedId,
    reported_name: currentReportContext.reportedName,
    order_id: currentReportContext.orderId,
    reason: reason,
    details: details || null
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Submit Report'; }

  if (error) {
    showToast('Could not submit report: ' + error.message, 'error');
    return;
  }

  showToast('Report submitted. Our team will review it.', 'info');
  closeReportModal();
}

// ============================================================
// CHAT — order-scoped messaging between customer/seller/rider,
// whichever pairing is actually relevant to a given order. No open
// messaging between strangers; RLS enforces real order relationships.
// ============================================================

var currentChatOrderId = null;
var currentChatOtherUserId = null;
var currentChatOtherName = null;
var chatThreadPollId = null;

// Every async chat render checks this token after its await, before
// touching the DOM. Any view switch bumps the token, so a slow render
// from a view the user already navigated away from can never land on
// top of whatever's actually showing now — this is what "Back" was
// racing against before. //
var chatViewToken = 0;

function chatCloseBtnHtml() {
  return '<button class="chat-close-btn" onclick="closeChatModal()"><i class="fas fa-times"></i></button>';
}

function openChatThread(orderId, otherUserId, otherName) {
  if (!currentUser) { showToast('Please log in to send a message', 'info'); openLoginModal(); return; }
  var myToken = ++chatViewToken;

  currentChatOrderId = orderId;
  currentChatOtherUserId = otherUserId;
  currentChatOtherName = otherName;

  document.getElementById('sn-chatOverlay').classList.add('active');
  document.getElementById('sn-chatModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('sn-chat-header').innerHTML =
    '<button class="chat-back-btn" onclick="openChatInbox()"><i class="fas fa-arrow-left"></i></button>' +
    '<div class="chat-avatar" onclick="openContactProfileModal(\'' + otherUserId + '\')" style="cursor:pointer;"><i class="fas fa-user"></i></div>' +
    '<div class="chat-header-title" onclick="openContactProfileModal(\'' + otherUserId + '\')" style="cursor:pointer;"><h3>' + otherName + '</h3></div>' +
    chatCloseBtnHtml();

  document.getElementById('sn-chat-scroll').innerHTML = '<div class="chat-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading messages...</p></div>';

  var composer = document.getElementById('sn-chat-composer');
  composer.style.display = 'flex';
  composer.innerHTML =
    '<input type="text" class="chat-input" id="chat-message-input" placeholder="Type a message..." ' +
    'oninput="document.getElementById(\'chat-send-btn\').disabled = !this.value.trim();" ' +
    'onkeydown="if(event.key===\'Enter\'){sendChatMessage();}"/>' +
    '<button class="chat-send-btn" id="chat-send-btn" disabled onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>';

  renderChatThread(myToken);
  if (chatThreadPollId) clearInterval(chatThreadPollId);
  chatThreadPollId = setInterval(function() { renderChatThread(chatViewToken); }, 5000);
}

function closeChatModal() {
  chatViewToken++; // invalidate any in-flight renders
  document.getElementById('sn-chatOverlay').classList.remove('active');
  document.getElementById('sn-chatModal').classList.remove('active');
  document.body.style.overflow = '';
  if (chatThreadPollId) { clearInterval(chatThreadPollId); chatThreadPollId = null; }
  currentChatOrderId = null;
  currentChatOtherUserId = null;
}

// Groups consecutive messages under one timestamp when they're close
// together in time, instead of stamping every single bubble. //
function formatChatDivider(iso) {
  var d = new Date(iso);
  var now = new Date();
  var sameDay = d.toDateString() === now.toDateString();
  var time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' \u00b7 ' + time;
}

async function renderChatThread(myToken) {
  if (myToken === undefined) myToken = ++chatViewToken;
  if (!currentChatOrderId || !currentChatOtherUserId) return;

  var scrollEl = document.getElementById('sn-chat-scroll');
  var wasScrolledToBottom = true;
  if (scrollEl && scrollEl.dataset.loaded) {
    wasScrolledToBottom = (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) < 40;
  }

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('*')
    .eq('order_id', currentChatOrderId)
    .or('sender_id.eq.' + currentUser.id + ',recipient_id.eq.' + currentUser.id)
    .order('created_at', { ascending: true });

  if (myToken !== chatViewToken) return; // a newer view has taken over — discard this stale render

  var thread = (msgs || []).filter(function(m) {
    return (m.sender_id === currentUser.id && m.recipient_id === currentChatOtherUserId) ||
           (m.sender_id === currentChatOtherUserId && m.recipient_id === currentUser.id);
  });

  var unreadIds = thread.filter(function(m) { return m.recipient_id === currentUser.id && !m.read_at; }).map(function(m) { return m.id; });
  if (unreadIds.length) {
    supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(function() {
      if (myToken === chatViewToken) updateChatBadge();
    });
  }

  if (error) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-triangle-exclamation"></i><p>Could not load messages: ' + error.message + '</p></div>';
    return;
  }

  if (!thread.length) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>No messages yet. Say hello!</p></div>';
    scrollEl.dataset.loaded = '1';
    return;
  }

  var html = '';
  var lastDividerTime = null;
  thread.forEach(function(m) {
    // New time divider if this message is >20 min after the last one shown //
    if (!lastDividerTime || (new Date(m.created_at) - lastDividerTime) > 20 * 60 * 1000) {
      html += '<div class="chat-bubble-time">' + formatChatDivider(m.created_at) + '</div>';
      lastDividerTime = new Date(m.created_at);
    }
    var mine = m.sender_id === currentUser.id;
    html += '<div class="chat-bubble-row" style="justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';">' +
      (mine ? '<button class="chat-del-btn" onclick="deleteChatMessage(\'' + m.id + '\')" title="Delete message"><i class="fas fa-trash"></i></button>' : '') +
      '<div class="chat-bubble" style="background:' + (mine ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (mine ? '#fff' : '#333') + ';' + (mine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;') + '">' +
      m.body.replace(/</g, '&lt;') +
      '</div></div>';
  });

  scrollEl.innerHTML = html;
  scrollEl.dataset.loaded = '1';
  if (wasScrolledToBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
}

async function deleteChatMessage(messageId) {
  if (!confirm('Delete this message? This can\'t be undone.')) return;
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  if (error) { showToast('Could not delete message: ' + error.message, 'error'); return; }
  renderChatThread(chatViewToken);
}

async function sendChatMessage() {
  var input = document.getElementById('chat-message-input');
  var text = input.value.trim();
  if (!text || !currentChatOrderId || !currentChatOtherUserId) return;

  input.value = '';
  document.getElementById('chat-send-btn').disabled = true;

  const { error } = await supabase.from('messages').insert({
    order_id: currentChatOrderId, sender_id: currentUser.id, recipient_id: currentChatOtherUserId, body: text
  });

  if (error) {
    showToast('Could not send message: ' + error.message, 'error');
    input.value = text;
    document.getElementById('chat-send-btn').disabled = false;
    return;
  }
  renderChatThread(chatViewToken);
  input.focus();
}

// Inbox — lists every conversation this account has across all their
// orders (as customer, merchant, or rider), most recent first. //
async function openChatInbox(e) {
  if (e) e.preventDefault();
  if (!currentUser) { showToast('Please log in to view messages', 'info'); openLoginModal(); return; }

  var myToken = ++chatViewToken;
  currentChatOrderId = null;
  currentChatOtherUserId = null;
  if (chatThreadPollId) { clearInterval(chatThreadPollId); chatThreadPollId = null; }

  document.getElementById('sn-chatOverlay').classList.add('active');
  document.getElementById('sn-chatModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('sn-chat-header').innerHTML =
    '<div class="chat-header-title" style="flex:1;"><h3>Messages</h3></div>' +
    '<button class="chat-header-action" onclick="openNewMessagePicker()"><i class="fas fa-square-pen"></i> New</button>' +
    chatCloseBtnHtml();
  document.getElementById('sn-chat-composer').style.display = 'none';

  var scrollEl = document.getElementById('sn-chat-scroll');
  scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading conversations...</p></div>';

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('*, orders(order_code)')
    .or('sender_id.eq.' + currentUser.id + ',recipient_id.eq.' + currentUser.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (myToken !== chatViewToken) return;

  if (error) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-triangle-exclamation"></i><p>Could not load messages: ' + error.message + '</p></div>';
    return;
  }

  var convos = {};
  var order = [];
  (msgs || []).forEach(function(m) {
    var otherId = m.sender_id === currentUser.id ? m.recipient_id : m.sender_id;
    var key = m.order_id + '_' + otherId;
    if (!convos[key]) {
      convos[key] = { orderId: m.order_id, orderCode: m.orders ? m.orders.order_code : '', otherId: otherId, lastMsg: m, unread: 0 };
      order.push(key);
    }
    if (m.recipient_id === currentUser.id && !m.read_at) convos[key].unread++;
  });

  var hidden = getHiddenConversations();
  var convoList = order.map(function(k) { return convos[k]; }).filter(function(c) { return hidden.indexOf(c.orderId + '_' + c.otherId) === -1; });

  if (!convoList.length) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-inbox"></i><p>No conversations yet. Tap "New" above to reach a seller or rider you\'ve transacted with.</p></div>';
    return;
  }

  var otherIds = Array.from(new Set(convoList.map(function(c) { return c.otherId; })));
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', otherIds);
  if (myToken !== chatViewToken) return;

  var nameById = {};
  (profiles || []).forEach(function(p) { nameById[p.id] = p.full_name; });

  scrollEl.innerHTML = convoList.map(function(c) {
    var name = nameById[c.otherId] || 'HomeWeb User';
    var isUnread = c.unread > 0;
    var convoKey = c.orderId + '_' + c.otherId;
    return '<div class="chat-list-row' + (isUnread ? ' unread' : '') + '">' +
      '<div class="chat-avatar" onclick="event.stopPropagation(); openContactProfileModal(\'' + c.otherId + '\')" style="cursor:pointer;"><i class="fas fa-user"></i></div>' +
      '<div onclick="openChatThread(\'' + c.orderId + '\', \'' + c.otherId + '\', \'' + name.replace(/'/g, "\\'") + '\')" style="flex:1;min-width:0;cursor:pointer;">' +
      '<p class="chat-list-name" style="font-weight:' + (isUnread ? '800' : '500') + ';">' + name + (isUnread ? '<span class="chat-unread-dot">' + c.unread + '</span>' : '') + '</p>' +
      '<p class="chat-list-preview" style="color:' + (isUnread ? '#333' : '#999') + ';font-weight:' + (isUnread ? '600' : '400') + ';">' + (c.orderCode ? '#' + c.orderCode + ' \u00b7 ' : '') + (c.lastMsg.sender_id === currentUser.id ? 'You: ' : '') + c.lastMsg.body.slice(0, 36) + (c.lastMsg.body.length > 36 ? '\u2026' : '') + '</p>' +
      '</div>' +
      '<span style="font-size:10.5px;color:#bbb;flex-shrink:0;">' + timeAgo(c.lastMsg.created_at) + '</span>' +
      '<button class="chat-row-delete" onclick="event.stopPropagation(); deleteConversation(\'' + convoKey + '\')" title="Delete conversation"><i class="fas fa-trash"></i></button>' +
      '</div>';
  }).join('');
}

// Deleting a conversation only hides it from YOUR inbox — the other
// person's copy of the messages is untouched, and it reappears if they
// send something new. Consistent with how notification-clearing works. //
function chatHiddenKey() {
  return currentUser ? ('homeweb_hidden_convos_' + currentUser.id) : null;
}

function getHiddenConversations() {
  var raw = localStorage.getItem(chatHiddenKey());
  return raw ? JSON.parse(raw) : [];
}

function deleteConversation(convoKey) {
  if (!confirm('Remove this conversation from your inbox? It\'ll come back if they message you again.')) return;
  var hidden = getHiddenConversations();
  if (hidden.indexOf(convoKey) === -1) hidden.push(convoKey);
  localStorage.setItem(chatHiddenKey(), JSON.stringify(hidden));
  openChatInbox();
}

// "New Message" — shows every real transaction partner (seller, rider,
// or customer) this account has ever shared an order with, so a
// conversation can be started even if none exists yet. //
async function openNewMessagePicker() {
  var myToken = ++chatViewToken;

  document.getElementById('sn-chat-header').innerHTML =
    '<button class="chat-back-btn" onclick="openChatInbox()"><i class="fas fa-arrow-left"></i></button>' +
    '<div class="chat-header-title" style="flex:1;"><h3>New Message</h3></div>' +
    chatCloseBtnHtml();
  document.getElementById('sn-chat-composer').style.display = 'none';

  var scrollEl = document.getElementById('sn-chat-scroll');
  scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading contacts...</p></div>';

  var contacts = await fetchMyContacts();
  if (myToken !== chatViewToken) return;

  if (!contacts.length) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-address-book"></i><p>No contacts yet \u2014 you can message someone once you\'ve placed, sold, or delivered an order with them.</p></div>';
    return;
  }

  var roleIcon = { seller: 'fa-store', rider: 'fa-motorcycle', customer: 'fa-user' };
  var roleLabel = { seller: 'Seller', rider: 'Rider', customer: 'Customer' };

  scrollEl.innerHTML = contacts.map(function(c) {
    return '<div class="chat-list-row" onclick="openChatThread(\'' + c.orderId + '\', \'' + c.userId + '\', \'' + c.name.replace(/'/g, "\\'") + '\')">' +
      '<div class="chat-avatar" onclick="event.stopPropagation(); openContactProfileModal(\'' + c.userId + '\')" style="cursor:pointer;"><i class="fas ' + (roleIcon[c.role] || 'fa-user') + '"></i></div>' +
      '<div style="flex:1;min-width:0;">' +
      '<p class="chat-list-name" style="font-weight:600;">' + c.name + '</p>' +
      '<p class="chat-list-preview" style="color:#999;">' + roleLabel[c.role] + ' \u00b7 Order #' + c.orderCode + '</p>' +
      '</div>' +
      '</div>';
  }).join('');
}

// Shows a contact's profile card — avatar, name, phone (if set), and
// role tags. Reachable by tapping their avatar in an inbox row or a
// chat thread's header. Only works for people you actually share an
// order with, same as the profiles RLS boundary. //
async function openContactProfileModal(userId) {
  if (!userId) return;

  document.getElementById('sn-contactProfileOverlay').classList.add('active');
  document.getElementById('sn-contactProfileModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var body = document.getElementById('sn-contact-profile-body');
  body.innerHTML = '<div class="track-empty"><p>Loading profile...</p></div>';

  const [{ data: profile, error: profileErr }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', userId).single(),
    supabase.from('user_roles').select('role').eq('user_id', userId)
  ]);

  if (profileErr || !profile) {
    body.innerHTML = '<p style="color:#999;text-align:center;padding:20px 0;">Could not load this profile.</p>';
    return;
  }

  var roleList = (roles || []).map(function(r) { return r.role; }).filter(function(r) { return r !== 'admin'; });
  var roleTagColors = { customer: '#3B82F6', merchant: '#15803D', rider: '#B45309' };
  var roleTagsHtml = roleList.map(function(r) {
    return '<span style="display:inline-block;background:' + (roleTagColors[r] || '#999') + '1A;color:' + (roleTagColors[r] || '#999') + ';font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:capitalize;margin:0 4px 4px 0;">' + r + '</span>';
  }).join('');

  var avatarHtml = profile.avatar_url
    ? '<img src="' + profile.avatar_url + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;"/>'
    : '<div style="width:72px;height:72px;border-radius:50%;background:#F0FFF4;color:var(--primary,#22C55E);display:flex;align-items:center;justify-content:center;font-size:28px;"><i class="fas fa-user"></i></div>';

  var storeSectionHtml = '';
  if (roleList.indexOf('merchant') !== -1) {
    const { data: merchantRow } = await supabase.from('merchants').select('id, store_name').eq('user_id', userId).single();
    if (merchantRow) {
      storeSectionHtml = '<button class="co-btn co-btn--next" style="width:100%;margin-top:14px;" onclick="closeContactProfileModal(); openMerchantStorefront(\'' + merchantRow.id + '\')"><i class="fas fa-store"></i> Visit ' + merchantRow.store_name.replace(/</g, '&lt;') + '</button>';
    }
  }

  body.innerHTML =
    '<div style="text-align:center;">' +
    avatarHtml +
    '<h2 style="margin:12px 0 6px;">' + (profile.full_name || 'HomeWeb User') + '</h2>' +
    '<div style="margin-bottom:6px;">' + (roleTagsHtml || '<span style="color:#999;font-size:12px;">No roles on file</span>') + '</div>' +
    (profile.phone
      ? '<p style="margin:8px 0 0;font-size:13.5px;color:#555;"><i class="fas fa-phone" style="color:var(--primary,#22C55E);"></i> ' + profile.phone + '</p>'
      : '<p style="margin:8px 0 0;font-size:12.5px;color:#aaa;">No phone number on file</p>') +
    storeSectionHtml +
    '</div>';
}

function closeContactProfileModal() {
  document.getElementById('sn-contactProfileOverlay').classList.remove('active');
  document.getElementById('sn-contactProfileModal').classList.remove('active');
  // Deliberately not touching document.body.style.overflow — this always
  // opens on top of the chat modal, which remains open underneath and
  // stays responsible for that state until it's closed too.
}

async function fetchMyContacts() {
  var contacts = {}; // keyed by userId -> {userId, name, role, orderId, orderCode, lastAt}

  function noteContact(userId, name, role, orderId, orderCode, at) {
    if (!userId || userId === currentUser.id) return;
    var existing = contacts[userId];
    if (!existing || new Date(at) > new Date(existing.lastAt)) {
      contacts[userId] = { userId: userId, name: name || 'HomeWeb User', role: role, orderId: orderId, orderCode: orderCode, lastAt: at };
    }
  }

  // As customer: my own orders give me their rider + seller //
  const { data: myOrders } = await supabase
    .from('orders')
    .select('id, order_code, created_at, rider_user_id, rider_name, order_items(products(merchant_id, merchants(user_id, store_name)))')
    .eq('user_id', currentUser.id);

  (myOrders || []).forEach(function(o) {
    if (o.rider_user_id) noteContact(o.rider_user_id, o.rider_name, 'rider', o.id, o.order_code, o.created_at);
    (o.order_items || []).forEach(function(oi) {
      if (oi.products && oi.products.merchants) {
        noteContact(oi.products.merchants.user_id, oi.products.merchants.store_name, 'seller', o.id, o.order_code, o.created_at);
      }
    });
  });

  // As rider: deliveries I've handled give me their customer + seller //
  if (userRoles.indexOf('rider') !== -1) {
    const { data: myDeliveries } = await supabase
      .from('orders')
      .select('id, order_code, created_at, user_id, order_items(products(merchant_id, merchants(user_id, store_name)))')
      .eq('rider_user_id', currentUser.id);

    var customerIds = Array.from(new Set((myDeliveries || []).map(function(o) { return o.user_id; })));
    var customerNames = {};
    if (customerIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', customerIds);
      (profiles || []).forEach(function(p) { customerNames[p.id] = p.full_name; });
    }

    (myDeliveries || []).forEach(function(o) {
      noteContact(o.user_id, customerNames[o.user_id] || 'Customer', 'customer', o.id, o.order_code, o.created_at);
      (o.order_items || []).forEach(function(oi) {
        if (oi.products && oi.products.merchants) {
          noteContact(oi.products.merchants.user_id, oi.products.merchants.store_name, 'seller', o.id, o.order_code, o.created_at);
        }
      });
    });
  }

  // As merchant: orders containing my products give me their customer + rider //
  if (userRoles.indexOf('merchant') !== -1) {
    if (!myMerchantId) {
      const { data: merchantRow } = await supabase.from('merchants').select('id').eq('user_id', currentUser.id).single();
      if (merchantRow) myMerchantId = merchantRow.id;
    }
  }

  if (userRoles.indexOf('merchant') !== -1 && myMerchantId) {
    const { data: myStoreItems } = await supabase
      .from('order_items')
      .select('orders(id, order_code, created_at, user_id, rider_user_id, rider_name), products!inner(merchant_id)')
      .eq('products.merchant_id', myMerchantId);

    var storeCustomerIds = Array.from(new Set((myStoreItems || []).map(function(r) { return r.orders ? r.orders.user_id : null; }).filter(Boolean)));
    var storeCustomerNames = {};
    if (storeCustomerIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', storeCustomerIds);
      (profiles || []).forEach(function(p) { storeCustomerNames[p.id] = p.full_name; });
    }

    (myStoreItems || []).forEach(function(r) {
      if (!r.orders) return;
      noteContact(r.orders.user_id, storeCustomerNames[r.orders.user_id] || 'Customer', 'customer', r.orders.id, r.orders.order_code, r.orders.created_at);
      if (r.orders.rider_user_id) noteContact(r.orders.rider_user_id, r.orders.rider_name, 'rider', r.orders.id, r.orders.order_code, r.orders.created_at);
    });
  }

  return Object.values(contacts).sort(function(a, b) { return new Date(b.lastAt) - new Date(a.lastAt); });
}

function openHelpCenterModal(e) {
  if (e) e.preventDefault();
  var body = document.getElementById('sn-help-body');
  body.innerHTML =
    '<div class="login-icon"><i class="fas fa-headset"></i></div>' +
    '<h2>Help Center</h2>' +
    '<p class="login-sub">Reach the HomeWeb admin directly</p>' +
    '<div style="text-align:left;background:#F9FAFB;border-radius:10px;padding:16px;margin-top:12px;">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
    '<i class="fab fa-facebook" style="color:#1877F2;font-size:20px;width:22px;text-align:center;"></i>' +
    '<div><p style="margin:0;font-size:11px;color:#999;">Facebook</p><p style="margin:0;font-weight:600;font-size:13.5px;">Alexis Dinsay</p></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
    '<i class="fas fa-envelope" style="color:var(--primary,#22C55E);font-size:18px;width:22px;text-align:center;"></i>' +
    '<div><p style="margin:0;font-size:11px;color:#999;">Email</p><p style="margin:0;font-weight:600;font-size:13.5px;">alexisdinsay18@gmail.com</p></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;">' +
    '<i class="fas fa-phone" style="color:#F59E0B;font-size:16px;width:22px;text-align:center;"></i>' +
    '<div><p style="margin:0;font-size:11px;color:#999;">Contact Number</p><p style="margin:0;font-weight:600;font-size:13.5px;">0969 123 4567</p></div>' +
    '</div>' +
    '</div>';

  document.getElementById('sn-helpOverlay').classList.add('active');
  document.getElementById('sn-helpModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeHelpCenterModal() {
  document.getElementById('sn-helpOverlay').classList.remove('active');
  document.getElementById('sn-helpModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function messageSellerForOrder(orderId, productId) {
  if (!productId) { showToast('Could not find seller info for this order', 'error'); return; }

  const { data, error } = await supabase
    .from('products')
    .select('merchants(user_id, store_name)')
    .eq('id', productId)
    .single();

  if (error || !data || !data.merchants) {
    showToast('Could not load seller info', 'error');
    return;
  }

  openChatThread(orderId, data.merchants.user_id, data.merchants.store_name);
}

async function openMerchantStorefront(merchantId) {
  if (!merchantId) { showToast('This product has no store information', 'info'); return; }

  document.getElementById('sn-storeOverlay').classList.add('active');
  document.getElementById('sn-storeModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var body = document.getElementById('sn-store-body');
  body.innerHTML = '<div class="track-empty"><p>Loading store...</p></div>';

  const { data: merchant, error } = await supabase.from('merchants').select('*').eq('id', merchantId).single();
  if (error || !merchant) {
    body.innerHTML = '<div class="track-empty"><p>Could not load this store.</p></div>';
    return;
  }

  const { data: storeProducts } = await supabase
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  var mapped = (storeProducts || []).map(function(p) {
    var meta = CATEGORY_META[p.category] || DEFAULT_CATEGORY_META;
    return {
      id: p.id, name: p.name, description: p.description, price: p.price, oldPrice: null, discount: 0,
      rating: Math.round(p.rating_avg || 0) || 0, ratingAvg: p.rating_avg || 0,
      ratingCount: p.rating_count || 0, soldCount: p.sold_count || 0,
      icon: meta.icon, location: merchant.store_name, category: p.category,
      image_url: p.image_url, stock_qty: p.stock_qty, merchant_id: p.merchant_id
    };
  });

  // Merge into the global products cache so clicking a card here can
  // reuse the normal openProductModal lookup by id //
  mapped.forEach(function(p) {
    if (!products.find(function(x) { return x.id === p.id; })) products.push(p);
  });

  var totalReviews = 0, weightedSum = 0;
  (storeProducts || []).forEach(function(p) { totalReviews += p.rating_count; weightedSum += p.rating_avg * p.rating_count; });
  var storeRatingAvg = totalReviews > 0 ? (weightedSum / totalReviews).toFixed(1) : 0;

  var productsHtml = mapped.length
    ? '<div class="store-product-grid">' + mapped.map(renderProductCardHtml).join('') + '</div>'
    : '<p style="color:#999;padding:1rem 0;text-align:center;">This store has no products listed yet.</p>';

  var verifiedBadge = (merchant.is_verified && totalReviews >= 5 && storeRatingAvg >= 4)
    ? '<span style="display:inline-block;background:#F0FFF4;color:var(--primary,#22C55E);font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-top:8px;"><i class="fas fa-shield-check"></i> Trusted Seller</span>'
    : '';

  var openToday = isStoreOpenToday(merchant);
  var scheduleBadge = '<div style="margin-top:10px;">' +
    '<span style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;font-size:11.5px;font-weight:600;padding:4px 12px;border-radius:999px;">' +
    '<i class="fas ' + (merchant.merchant_type === 'bolanteros' ? 'fa-calendar-days' : 'fa-shop') + '"></i> ' +
    (merchant.merchant_type === 'bolanteros' ? 'Bolanteros' : 'Permanent') + ' \u2022 ' + openDaysLabel(merchant) +
    '</span>' +
    (merchant.merchant_type === 'bolanteros'
      ? '<p style="margin:8px 0 0;font-size:12px;color:' + (openToday ? '#DCFCE7' : '#FEE2E2') + ';font-weight:600;">' +
        (openToday ? '<i class="fas fa-circle-check"></i> Open today (' + DAY_NAMES[new Date().getDay()] + ')'
                   : '<i class="fas fa-circle-xmark"></i> Closed today (' + DAY_NAMES[new Date().getDay()] + ')') + '</p>'
      : '') +
    '</div>';

  document.getElementById('sn-storeModal').style.width = 'min(820px, 95vw)';

  body.innerHTML =
    '<div style="text-align:center;margin:-8px -4px 20px;padding:28px 20px 22px;background:linear-gradient(135deg, var(--primary,#22C55E), #16A34A);border-radius:16px 16px 0 0;color:#fff;">' +
    '<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.4);color:#fff;font-size:28px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><i class="fas fa-store"></i></div>' +
    '<h2 style="margin:0;color:#fff;">' + merchant.store_name +
    (merchant.is_verified ? ' <i class="fas fa-badge-check" title="Verified Seller" style="color:#93F6D2;"></i>' : '') +
    '</h2>' +
    '<p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">' + (CATEGORY_META[merchant.business_type] ? CATEGORY_META[merchant.business_type].title : merchant.business_type) + '</p>' +
    (merchant.store_description ? '<p style="color:rgba(255,255,255,0.9);margin:10px auto 0;font-size:13px;max-width:420px;">' + merchant.store_description + '</p>' : '') +
    '<div style="margin-top:10px;color:#FEF3C7;font-size:13px;font-weight:600;">' +
    (totalReviews > 0 ? stars(storeRatingAvg) + ' ' + storeRatingAvg + ' <span style="color:rgba(255,255,255,0.85);font-weight:400;">(' + totalReviews + ' reviews)</span>' : '<span style="color:rgba(255,255,255,0.85);font-weight:400;">No reviews yet</span>') +
    '</div>' +
    verifiedBadge +
    scheduleBadge +
    (merchant.business_permit_url
      ? '<a href="' + merchant.business_permit_url + '" target="_blank" style="display:inline-block;margin-top:10px;color:#fff;font-size:11.5px;text-decoration:underline;"><i class="fas fa-file-shield"></i> View Business Permit</a>'
      : '') +
    '<div style="margin-top:10px;">' +
    '<a href="#" onclick="openReportModal(\'merchant\', \'' + merchant.user_id + '\', \'' + merchant.store_name.replace(/'/g, "\\'") + '\'); return false;" style="color:rgba(255,255,255,0.75);font-size:11px;text-decoration:underline;"><i class="fas fa-flag"></i> Report this store</a>' +
    '</div>' +
    '</div>' +
    '<div style="padding:0 4px;">' +
    '<h3 style="margin:0 0 14px;font-size:14.5px;display:flex;align-items:center;gap:8px;"><i class="fas fa-shopping-basket" style="color:var(--primary,#22C55E);"></i> ' + mapped.length + ' Product' + (mapped.length === 1 ? '' : 's') + ' Available</h3>' +
    productsHtml +
    '</div>';

  attachCardClicks();
}

function closeMerchantStorefront() {
  document.getElementById('sn-storeOverlay').classList.remove('active');
  document.getElementById('sn-storeModal').classList.remove('active');
  document.body.style.overflow = '';
}

function closeProductModal() {
  document.getElementById('sn-overlay').classList.remove('active');
  document.getElementById('sn-productModal').classList.remove('active');
  document.body.style.overflow = '';
}

// buttons sa product modal //
// Keep the Add to Cart / Buy Now buttons and quantity controls in sync
// with real stock — this can change while the modal is already open. //
function updateBuyButtonsState(stockQty) {
  var outOfStock = typeof stockQty === 'number' && stockQty <= 0;
  var cartBtn = document.querySelector('#sn-productModal .pm-btn--cart');
  var buyBtn = document.querySelector('#sn-productModal .pm-btn--buy');
  var qtyMinus = document.querySelector('#sn-productModal .pm-qty button:first-child');
  var qtyPlus = document.querySelector('#sn-productModal .pm-qty button:last-child');

  [cartBtn, buyBtn, qtyMinus, qtyPlus].forEach(function(btn) {
    if (!btn) return;
    btn.disabled = outOfStock;
    btn.style.opacity = outOfStock ? '0.4' : '';
    btn.style.cursor = outOfStock ? 'not-allowed' : '';
  });

  if (cartBtn) cartBtn.innerHTML = outOfStock ? '<i class="fas fa-ban"></i> Out of Stock' : '<i class="fas fa-cart-plus"></i> Add to Cart';
  if (buyBtn) buyBtn.innerHTML = outOfStock ? '<i class="fas fa-ban"></i> Out of Stock' : '<i class="fas fa-bolt"></i> Buy Now';
}

function changeQty(delta) {
  var max = typeof currentProduct.stock_qty === 'number' ? Math.min(99, currentProduct.stock_qty) : 99;
  var attempted = currentProduct.qty + delta;
  currentProduct.qty = Math.max(1, Math.min(max, attempted));
  document.querySelector('.pm-qty-val').value = currentProduct.qty;
  if (delta > 0 && attempted > max) showToast('Only ' + max + ' left in stock', 'info');
}

// Lets the customer type a quantity directly instead of clicking +/- repeatedly //
function setQtyDirect(value) {
  var max = typeof currentProduct.stock_qty === 'number' ? Math.min(99, currentProduct.stock_qty) : 99;
  var n = parseInt(value, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > max) {
    n = max;
    showToast('Only ' + max + ' left in stock', 'info');
  }
  currentProduct.qty = n;
  document.querySelector('.pm-qty-val').value = n;
}

// Add to cart //
function addToCart(andCheckout) {
  if (!currentUser) {
    closeProductModal();
    showToast('Please log in to add items to your cart', 'info');
    openLoginModal();
    return;
  }

  const p = currentProduct;
  const existing = cart.find(function(x) { return x.id === p.id; });
  if (existing) existing.qty += p.qty;
  else cart.push({ id: p.id, name: p.name, price: p.price, icon: p.icon, qty: p.qty, unit: p.unit, merchant_id: p.merchant_id, merchantName: p.location, stock_qty: p.stock_qty });
  saveCart();
  updateCartBadge();

  if (andCheckout) {
    closeProductModal();
    openCheckout();
  } else {
    closeProductModal();
    showToast(p.name + ' added to cart \uD83D\uDED2');
  }
}

// CHECKOUT FLOW //

function openCheckout() {
  if (!currentUser) {
    showToast('Please log in to check out', 'info');
    openLoginModal();
    return;
  }
  if (!cart.length) { showToast('Your cart is empty', 'info'); return; }
  checkoutStep = 1;
  selectedPaymentMethod = 'cod';
  renderCheckout();
  document.getElementById('sn-coOverlay').classList.add('active');
  document.getElementById('sn-checkoutModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('sn-coOverlay').classList.remove('active');
  document.getElementById('sn-checkoutModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Render the entire checkout //
function renderCheckout() {
  const modal = document.getElementById('sn-checkoutModal');

  // Step indicator bar — Cart > Shipping > Payment > Confirm //
  const stepNames = ['Cart', 'Shipping', 'Payment', 'Confirm'];
  const stepBar = stepNames.map(function(s, i) {
    return '<div class="co-step ' + (i + 1 === checkoutStep ? 'active' : '') + ' ' + (i + 1 < checkoutStep ? 'done' : '') + '">' +
      '<div class="co-step-num">' + (i + 1 < checkoutStep ? '<i class="fas fa-check"></i>' : (i + 1)) + '</div>' +
      '<span>' + s + '</span></div>' +
      (i < stepNames.length - 1 ? '<div class="co-step-line"></div>' : '');
  }).join('');

  let body = '';

  // STEP 1: CART //
  if (checkoutStep === 1) {
    const rows = cart.map(function(item) {
      var cartImgSrc = getProductImage(item.id);
      var cartIconHtml = cartImgSrc
        ? '<img src="' + cartImgSrc + '" alt="' + item.name + '" />'
        : '<i class="fas ' + item.icon + '"></i>';
      var atMax = typeof item.stock_qty === 'number' && item.qty >= item.stock_qty;
      return '<div class="co-cart-row" data-id="' + item.id + '">' +
        '<div class="co-cart-icon">' + cartIconHtml + '</div>' +
        '<div class="co-cart-info"><p class="co-cart-name">' + item.name + ' <span style="color:#999;font-size:11px;">/ ' + (item.unit || 'pc') + '</span></p>' +
        (item.merchantName ? '<p style="margin:2px 0 0;font-size:11px;color:#999;"><i class="fas fa-store"></i> ' + item.merchantName + '</p>' : '') +
        '<div class="co-cart-controls">' +
        '<button onclick="changeCartQty(\'' + item.id + '\',-1)">&#8722;</button>' +
        '<input type="number" value="' + item.qty + '" min="1" step="1" ' +
        'style="width:48px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:3px 2px;font-size:13px;" ' +
        'onchange="setCartQtyDirect(\'' + item.id + '\', this.value)" onclick="this.select()"/>' +
        '<button onclick="changeCartQty(\'' + item.id + '\',1)"' + (atMax ? ' disabled style="opacity:0.4;"' : '') + '>+</button>' +
        '<button class="co-remove" onclick="removeCartItem(\'' + item.id + '\')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
        (atMax ? '<p style="margin:4px 0 0;font-size:11px;color:#DC2626;">Max stock reached</p>' : '') +
        '</div>' +
        '<div class="co-cart-price">' + fmt(item.price * item.qty) + '</div></div>';
    }).join('');

    const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    const ship = calcDeliveryFee(sub);

    body = '<div class="co-cart-list">' + rows + '</div>' +
      '<div class="co-summary">' +
      '<div class="co-summary-row"><span>Subtotal</span><span>' + fmt(sub) + '</span></div>' +
      '<div class="co-summary-row"><span>Delivery Fee</span><span>' + (ship === 0 ? '<span class="free-tag">FREE</span>' : fmt(ship)) + '</span></div>' +
      '<div class="co-summary-row total"><span>Total</span><span>' + fmt(sub + ship) + '</span></div>' +
      '</div>';

  // STEP 2: DELIVERY //
  } else if (checkoutStep === 2) {
    body = '<div class="co-form">' +
      '<h3>Delivery Address</h3>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>First Name <span class="co-required">*</span></label><input type="text" id="co-firstName" placeholder="First Name" value="' + shippingInfo.firstName + '"/><span class="co-field-error">First name is required</span></div>' +
      '<div class="co-field"><label>Last Name <span class="co-required">*</span></label><input type="text" id="co-lastName" placeholder="Last Name" value="' + shippingInfo.lastName + '"/><span class="co-field-error">Last name is required</span></div>' +
      '</div>' +
      '<div class="co-field"><label>Phone Number <span class="co-required">*</span></label><input type="tel" id="co-phone" placeholder="+63 9XX XXX XXXX" value="' + shippingInfo.phone + '"/><span class="co-field-error">Phone number is required</span></div>' +
      '<div class="co-field"><label>Street Address <span class="co-required">*</span></label><input type="text" id="co-street" placeholder="House No., Street" value="' + shippingInfo.street + '"/><span class="co-field-error">Street address is required</span></div>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>Barangay <span class="co-required">*</span></label><input type="text" id="co-barangay" placeholder="e.g. Cabalabaguan" value="' + (shippingInfo.barangay || '') + '"/><span class="co-field-error">Barangay is required \u2014 used to match you with nearby riders</span></div>' +
      '<div class="co-field"><label>City / Municipality <span class="co-required">*</span></label><input type="text" id="co-city" placeholder="Sta. Barbara" value="' + shippingInfo.city + '"/><span class="co-field-error">City is required</span></div>' +
      '</div>' +
      '<div class="co-field"><label>ZIP Code <span class="co-required">*</span></label><input type="text" id="co-zip" placeholder="5002" value="' + shippingInfo.zip + '"/><span class="co-field-error">ZIP code is required</span></div>' +
      '<div class="co-field"><label>Estimated Delivery Time</label>' +
      '<div style="background:#F0FFF4;border-radius:10px;padding:12px 14px;font-size:13px;color:#15803D;">' +
      '<i class="fas fa-motorcycle"></i> 10\u201315 minutes, depending on distance from the seller</div></div></div>';

  // STEP 3: PAYMENT //
  } else if (checkoutStep === 3) {
    body = '<div class="co-form">' +
      '<h3>Payment Method</h3>' +
      '<div class="co-pay-opts">' +
      '<label class="co-radio co-pay-radio"><input type="radio" name="payment" value="cod" checked/>' +
      '<span><i class="fas fa-money-bill-wave"></i><strong>Cash on Delivery</strong></span></label>' +
      '</div>' +
      '<div id="sn-cardFields" style="display:none" class="co-card-fields">' +
      '<div class="co-field"><label>Card Number</label><input type="text" placeholder="1234 5678 9012 3456" maxlength="19"/></div>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>Expiry</label><input type="text" placeholder="MM/YY" maxlength="5"/></div>' +
      '<div class="co-field"><label>CVV</label><input type="text" placeholder="123" maxlength="3"/></div>' +
      '</div>' +
      '<div class="co-field"><label>Name on Card</label><input type="text" placeholder="JUAN DELA CRUZ"/></div>' +
      '</div></div>';

  // STEP 4: CONFIRM ORDER //
  } else if (checkoutStep === 4) {
    var groups = groupCartByMerchant();
    var grandTotal = 0;

    var groupsHtml = groups.map(function(g) {
      var sub = g.items.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
      var ship = calcDeliveryFee(sub);
      grandTotal += sub + ship;
      var itemList = g.items.map(function(i) {
        return '<li><span>' + i.name + ' (' + (i.unit || 'pc') + ') \u00D7 ' + i.qty + '</span><span>' + fmt(i.price * i.qty) + '</span></li>';
      }).join('');

      return '<div style="background:#F9FAFB;border-radius:10px;padding:14px;margin-bottom:12px;">' +
        '<p style="margin:0 0 8px;font-weight:700;font-size:13px;"><i class="fas fa-store"></i> ' + g.merchantName +
        (groups.length > 1 ? '<span style="float:right;font-weight:400;color:#999;font-size:11.5px;">Separate order</span>' : '') + '</p>' +
        '<ul class="co-confirm-items">' + itemList + '</ul>' +
        '<div class="co-summary" style="margin-top:8px;">' +
        '<div class="co-summary-row"><span>Subtotal</span><span>' + fmt(sub) + '</span></div>' +
        '<div class="co-summary-row"><span>Delivery Fee</span><span>' + (ship === 0 ? '<span class="free-tag">FREE</span>' : fmt(ship)) + '</span></div>' +
        '<div class="co-summary-row total"><span>Order Total</span><span>' + fmt(sub + ship) + '</span></div>' +
        '</div></div>';
    }).join('');

    body = '<div class="co-confirm">' +
      '<div class="co-confirm-icon"><i class="fas fa-clipboard-check"></i></div>' +
      '<h3>Review Your Order' + (groups.length > 1 ? 's (' + groups.length + ')' : '') + '</h3>' +
      (groups.length > 1 ? '<p class="co-note" style="margin-bottom:12px;"><i class="fas fa-info-circle"></i> Your items are from ' + groups.length + ' different sellers, so this will place ' + groups.length + ' separate orders — each tracked independently.</p>' : '') +
      groupsHtml +
      (groups.length > 1 ? '<div class="co-summary" style="border-top:2px solid #eee;padding-top:10px;"><div class="co-summary-row total"><span>Grand Total</span><span>' + fmt(grandTotal) + '</span></div></div>' : '') +
      '<p class="co-note"><i class="fas fa-shield-alt"></i> Your payment is protected by HomeWeb Guarantee.</p>' +
      '</div>';
  }

  // Footer buttons //
  const nextLabel = checkoutStep === 4 ? 'Place Order' : 'Continue';
  const nextIcon  = checkoutStep === 4 ? 'fa-check-circle' : 'fa-arrow-right';
  const backBtn   = checkoutStep > 1
    ? '<button class="co-btn co-btn--back" onclick="goStep(-1)"><i class="fas fa-arrow-left"></i> Back</button>'
    : '<button class="co-btn co-btn--back" onclick="closeCheckout()">Cancel</button>';

  modal.innerHTML =
    '<div class="co-header">' +
    '<h2><i class="fas fa-shopping-bag"></i> Checkout</h2>' +
    '<button class="co-close" onclick="closeCheckout()"><i class="fas fa-times"></i></button>' +
    '</div>' +
    '<div class="co-steps">' + stepBar + '</div>' +
    '<div class="co-body">' + body + '</div>' +
    '<div class="co-footer">' + backBtn +
    '<button class="co-btn co-btn--next" onclick="goStep(1)">' + nextLabel + ' <i class="fas ' + nextIcon + '"></i></button>' +
    '</div>';

  // shipping step //
  if (checkoutStep === 2) {
    modal.querySelectorAll('.co-field input').forEach(function(input) {
      input.addEventListener('input', function() {
        this.closest('.co-field').classList.remove('co-field--error');
      });
    });
  }

  // Payment step //
  if (checkoutStep === 3) {
    modal.querySelectorAll('input[name="payment"]').forEach(function(r) {
      r.addEventListener('change', function() {
        selectedPaymentMethod = this.value;
        var cf = document.getElementById('sn-cardFields');
        if (cf) cf.style.display = this.value === 'card' ? 'block' : 'none';
      });
    });
  }
}

// Validate shipping form //
function validateShippingForm() {
  const requiredIds = ['co-firstName', 'co-lastName', 'co-phone', 'co-street', 'co-barangay', 'co-city', 'co-zip'];
  let isValid = true;
  let firstInvalidEl = null;

  requiredIds.forEach(function(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const field = input.closest('.co-field');
    if (!input.value.trim()) {
      isValid = false;
      if (field) field.classList.add('co-field--error');
      if (!firstInvalidEl) firstInvalidEl = input;
    } else if (field) {
      field.classList.remove('co-field--error');
    }
  });

  if (firstInvalidEl) firstInvalidEl.focus();
  return isValid;
}

function saveShippingForm() {
  const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  shippingInfo.firstName = get('co-firstName');
  shippingInfo.lastName  = get('co-lastName');
  shippingInfo.phone     = get('co-phone');
  shippingInfo.street    = get('co-street');
  shippingInfo.barangay  = get('co-barangay');
  shippingInfo.city      = get('co-city');
  shippingInfo.zip       = get('co-zip');
  const deliveryEl = document.querySelector('input[name="delivery"]:checked');
  if (deliveryEl) shippingInfo.delivery = deliveryEl.value;
}

// Navigate between checkout steps //
function goStep(delta) {
  if (delta === 1 && checkoutStep === 4) {
    if (selectedPaymentMethod === 'gcash') {
      openGcashPayment();
    } else {
      placeOrder();
    }
    return;
  }

  if (delta === 1 && checkoutStep === 2) {
    saveShippingForm();
    if (!validateShippingForm()) {
      showToast('Please fill in all required shipping fields', 'info');
      return;
    }
  }

  checkoutStep = Math.max(1, Math.min(4, checkoutStep + delta));
  renderCheckout();
}

// Change quantity inside checkout cart //
function changeCartQty(id, delta) {
  var item = cart.find(function(x) { return x.id === id; });
  if (!item) return;
  var max = typeof item.stock_qty === 'number' ? item.stock_qty : 99;
  var attempted = item.qty + delta;
  if (delta > 0 && attempted > max) {
    showToast('Only ' + max + ' ' + (item.unit || 'pc') + ' left in stock', 'info');
    return;
  }
  item.qty = Math.max(1, attempted);
  saveCart();
  updateCartBadge();
  renderCheckout();
}

// Lets the customer type a cart quantity directly instead of clicking +/- repeatedly //
function setCartQtyDirect(id, value) {
  var item = cart.find(function(x) { return x.id === id; });
  if (!item) return;
  var max = typeof item.stock_qty === 'number' ? item.stock_qty : 99;
  var n = parseInt(value, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > max) {
    n = max;
    showToast('Only ' + max + ' ' + (item.unit || 'pc') + ' left in stock', 'info');
  }
  item.qty = n;
  saveCart();
  updateCartBadge();
  renderCheckout();
}

// Remove item from cart
function removeCartItem(id) {
  cart = cart.filter(function(x) { return x.id !== id; });
  saveCart();
  updateCartBadge();
  if (!cart.length) { closeCheckout(); showToast('Cart is empty', 'info'); return; }
  renderCheckout();
}

// ============================================================
// MOCK GCASH PAYMENT FLOW
// (Simulated — no real GCash API integration; for demo purposes)
// ============================================================

function openGcashPayment() {
  gcashStep = 1;
  gcashMobile = shippingInfo.phone ? shippingInfo.phone.replace(/[^0-9]/g, '').slice(-10) : '';
  renderGcashStep();
  document.getElementById('sn-gcashOverlay').classList.add('active');
  document.getElementById('sn-gcashModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeGcashModal() {
  document.getElementById('sn-gcashOverlay').classList.remove('active');
  document.getElementById('sn-gcashModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Cancel out of GCash flow entirely, back to the checkout payment step //
function cancelGcashPayment() {
  if (gcashStep === 3) return; // don't allow cancel mid "processing"
  closeGcashModal();
}

function gcashOrderTotal() {
  var groups = groupCartByMerchant();
  return groups.reduce(function(total, g) {
    var sub = g.items.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    return total + sub + calcDeliveryFee(sub);
  }, 0);
}

function renderGcashStep() {
  var body = document.getElementById('gcash-body');
  if (!body) return;
  var total = gcashOrderTotal();
  var header = '<div class="login-icon" style="color:#0072BC"><i class="fas fa-mobile-alt"></i></div>' +
    '<h2 style="color:#0072BC">GCash Payment</h2>';

  if (gcashStep === 1) {
    body.innerHTML = header +
      '<p class="login-sub">You are paying <strong>' + fmt(total) + '</strong> to HomeWeb</p>' +
      '<div class="co-field"><label>GCash Mobile Number <span class="co-required">*</span></label>' +
      '<input type="tel" id="gcash-mobile" placeholder="09XXXXXXXXX" maxlength="11" value="' + gcashMobile + '"/>' +
      '<span class="co-field-error">Enter a valid 11-digit GCash number</span></div>' +
      '<button class="co-btn co-btn--next login-submit" onclick="submitGcashMobile()">Continue <i class="fas fa-arrow-right"></i></button>';

    var input = document.getElementById('gcash-mobile');
    if (input) {
      input.addEventListener('input', function() {
        this.closest('.co-field').classList.remove('co-field--error');
      });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitGcashMobile(); });
      input.focus();
    }

  } else if (gcashStep === 2) {
    body.innerHTML = header +
      '<p class="login-sub">Enter the MPIN for <strong>' + gcashMobile + '</strong></p>' +
      '<div class="co-field"><label>MPIN <span class="co-required">*</span></label>' +
      '<input type="password" id="gcash-mpin" inputmode="numeric" placeholder="\u2022\u2022\u2022\u2022" maxlength="6"/>' +
      '<span class="co-field-error">Enter your 4\u20136 digit MPIN</span></div>' +
      '<button class="co-btn co-btn--next login-submit" onclick="submitGcashMpin()">Confirm Payment <i class="fas fa-lock"></i></button>' +
      '<p class="login-signup"><a href="#" onclick="gcashStep=1; renderGcashStep(); return false;">Use a different number</a></p>';

    var mpin = document.getElementById('gcash-mpin');
    if (mpin) {
      mpin.addEventListener('input', function() {
        this.closest('.co-field').classList.remove('co-field--error');
      });
      mpin.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitGcashMpin(); });
      mpin.focus();
    }

  } else if (gcashStep === 3) {
    body.innerHTML = header +
      '<div class="gcash-spinner" style="margin:24px auto;width:40px;height:40px;border:4px solid #e0f0ff;border-top-color:#0072BC;border-radius:50%;animation:gcashspin 0.8s linear infinite;"></div>' +
      '<p class="login-sub">Processing your payment of ' + fmt(total) + '...</p>' +
      '<style>@keyframes gcashspin { to { transform: rotate(360deg); } }</style>';

  } else if (gcashStep === 4) {
    body.innerHTML =
      '<div class="login-icon" style="color:#22C55E"><i class="fas fa-check-circle"></i></div>' +
      '<h2 style="color:#22C55E">Payment Successful</h2>' +
      '<p class="login-sub">' + fmt(total) + ' paid via GCash. Placing your order...</p>';
  }
}

// Step 1 -> 2: validate mobile number //
function submitGcashMobile() {
  var input = document.getElementById('gcash-mobile');
  var val = input.value.trim();
  var ok = /^09[0-9]{9}$/.test(val);
  if (!ok) {
    input.closest('.co-field').classList.add('co-field--error');
    input.focus();
    return;
  }
  gcashMobile = val;
  gcashStep = 2;
  renderGcashStep();
}

// Step 2 -> 3 -> 4: validate MPIN, "process" payment, then finalize //
function submitGcashMpin() {
  var input = document.getElementById('gcash-mpin');
  var val = input.value.trim();
  var ok = /^[0-9]{4,6}$/.test(val);
  if (!ok) {
    input.closest('.co-field').classList.add('co-field--error');
    input.focus();
    return;
  }

  gcashStep = 3;
  renderGcashStep();

  setTimeout(function() {
    gcashStep = 4;
    renderGcashStep();

    setTimeout(function() {
      closeGcashModal();
      placeOrder();
    }, 1200);
  }, 1600);
}

var ORDER_STATUS_MAP = {
  'placed':                { label: 'Order Placed',          desc: 'Your order has been received and is being reviewed.' },
  'preparing':              { label: 'Preparing Your Order',  desc: 'The seller is packing your items with care.' },
  'out_for_delivery':        { label: 'Out for Delivery',      desc: 'Your rider is on the way to deliver your order!' },
  'awaiting_confirmation':   { label: 'Delivered — Awaiting Your Confirmation', desc: 'Your rider marked this as delivered. Please confirm you received it.' },
  'delivered':              { label: 'Delivered',             desc: 'Your order has been delivered. Enjoy!' },
  'cancelled':              { label: 'Cancelled',             desc: 'No rider accepted this order within 30 minutes, so it was automatically cancelled.' }
};

// Groups cart items by seller — each group becomes its own separate order,
// since a single checkout can span multiple independent merchants. //
function groupCartByMerchant() {
  var groups = {};
  var order = [];
  cart.forEach(function(item) {
    var key = item.merchant_id || 'unknown';
    if (!groups[key]) {
      groups[key] = { merchant_id: item.merchant_id, merchantName: item.merchantName || 'Seller', items: [] };
      order.push(key);
    }
    groups[key].items.push(item);
  });
  return order.map(function(k) { return groups[k]; });
}

// Delivery fee: free at ₱200+, otherwise a small fee that's capped at the
// subtotal itself so it can never cost more than the products being bought. //
function calcDeliveryFee(sub) {
  if (sub >= 200) return 0;
  return Math.min(49, Math.round(sub));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function capitalize(str) {
  if (!str) return 'Motorcycle';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Place order — writes to Supabase (orders, order_items, order_status_history) //
async function placeOrder() {
  if (!currentUser) {
    showToast('Please log in to place an order', 'info');
    closeCheckout();
    openLoginModal();
    return;
  }

  const nextBtn = document.querySelector('#sn-checkoutModal .co-btn--next');
  if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Checking stock...'; }

  // Validate against LIVE stock right before placing — the cart may have
  // been sitting open while stock changed (another customer bought it,
  // the merchant adjusted it, etc). This is the authoritative check. //
  var productIds = cart.map(function(i) { return i.id; });
  const { data: freshProducts, error: stockErr } = await supabase.from('products').select('id, name, stock_qty, cost_price').in('id', productIds);

  if (stockErr) {
    if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = 'Place Order <i class="fas fa-check-circle"></i>'; }
    showToast('Could not verify stock: ' + stockErr.message, 'error');
    return;
  }

  var stockById = {};
  var costPriceById = {};
  (freshProducts || []).forEach(function(p) { stockById[p.id] = p.stock_qty; costPriceById[p.id] = p.cost_price; });

  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var avail = stockById[item.id];
    if (avail === undefined) {
      if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = 'Place Order <i class="fas fa-check-circle"></i>'; }
      showToast(item.name + ' is no longer available', 'error');
      return;
    }
    if (item.qty > avail) {
      if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = 'Place Order <i class="fas fa-check-circle"></i>'; }
      showToast(item.name + ' only has ' + avail + ' ' + (item.unit || 'pc') + ' left. Please update your cart.', 'error');
      checkoutStep = 1;
      renderCheckout();
      return;
    }
  }

  if (nextBtn) { nextBtn.textContent = 'Placing order...'; }

  var paymentMethod = selectedPaymentMethod;
  var baseCode = 'HW' + String(Date.now()).slice(-8).toUpperCase();
  var groups = groupCartByMerchant();
  var placedOrders = []; // { id, code, merchantName, total }

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    var sub = group.items.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    var shipFee = calcDeliveryFee(sub);
    var orderCode = groups.length > 1 ? baseCode + '-' + String.fromCharCode(65 + g) : baseCode;

    const { data: orderRow, error: orderErr } = await supabase.from('orders').insert({
      order_code: orderCode,
      batch_code: groups.length > 1 ? baseCode : null,
      user_id: currentUser.id,
      status: 'placed',
      subtotal: sub,
      shipping_fee: shipFee,
      total: sub + shipFee,
      payment_method: paymentMethod,
      shipping_first_name: shippingInfo.firstName,
      shipping_last_name: shippingInfo.lastName,
      shipping_phone: shippingInfo.phone,
      shipping_street: shippingInfo.street,
      shipping_barangay: shippingInfo.barangay,
      shipping_city: shippingInfo.city,
      shipping_zip: shippingInfo.zip,
      delivery_option: shippingInfo.delivery
    }).select().single();

    if (orderErr) {
      showToast('Could not place order for ' + group.merchantName + ': ' + orderErr.message, 'error');
      continue; // keep trying the other sellers' orders rather than losing everything
    }

    const itemRows = group.items.map(function(item) {
      return { order_id: orderRow.id, product_id: item.id, product_name: item.name, price: item.price, qty: item.qty, unit: item.unit || 'pc', cost_price: costPriceById[item.id] !== undefined ? costPriceById[item.id] : null };
    });
    await supabase.from('order_items').insert(itemRows);

    await supabase.from('order_status_history').insert({
      order_id: orderRow.id,
      status: 'placed',
      label: ORDER_STATUS_MAP.placed.label,
      description: ORDER_STATUS_MAP.placed.desc
    });

    placedOrders.push({ id: orderRow.id, code: orderCode, merchantName: group.merchantName, total: sub + shipFee });
  }

  updateNotifBadge();

  if (!placedOrders.length) {
    if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = 'Place Order <i class="fas fa-check-circle"></i>'; }
    showToast('Could not place your order. Please try again.', 'error');
    return;
  }

  // Clear cart
  closeCheckout();
  cart = [];
  saveCart();
  updateCartBadge();

  // A real rider now needs to claim each order — see openRiderSearchModal()
  // and acceptOrder() for how that happens.
  if (placedOrders.length === 1) {
    openRiderSearchModal(placedOrders[0].id, placedOrders[0].code);
  } else {
    showMultiOrderSuccess(placedOrders);
  }
}

function showMultiOrderSuccess(placedOrders) {
  var body = document.getElementById('sn-rider-body');
  var rowsHtml = placedOrders.map(function(o) {
    return '<div style="display:flex;justify-content:space-between;padding:10px 4px;border-bottom:1px solid #f0f0f0;">' +
      '<span style="font-size:13px;"><i class="fas fa-store"></i> ' + o.merchantName + '<br/><span style="color:#999;font-size:11.5px;">Order #' + o.code + '</span></span>' +
      '<span style="font-weight:700;font-size:13px;">' + fmt(o.total) + '</span></div>';
  }).join('');

  body.innerHTML =
    '<div style="text-align:center;">' +
    '<div class="login-icon" style="color:#22C55E"><i class="fas fa-check-circle"></i></div>' +
    '<h2 style="margin:6px 0;">' + placedOrders.length + ' Orders Placed!</h2>' +
    '<p class="login-sub">Your items were from different sellers, so each is tracked separately.</p>' +
    '</div>' +
    rowsHtml +
    '<button class="co-btn co-btn--next" style="width:100%;margin-top:16px;" onclick="closeRiderModal(); openOrderTracking();">Track My Orders</button>' +
    '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;" onclick="closeRiderModal()">Continue Shopping</button>';

  document.getElementById('sn-riderOverlay').classList.add('active');
  document.getElementById('sn-riderModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Advance an order's status in Supabase + log it to the timeline //
async function advanceOrderStatus(orderDbId, newStatus) {
  const info = ORDER_STATUS_MAP[newStatus];
  if (!info) return;

  const { data: existing } = await supabase.from('orders').select('status, rider_user_id').eq('id', orderDbId).single();
  if (!existing || existing.status === 'delivered') return;
  if (existing.status === newStatus) return; // already in this status — don't log a duplicate

  await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderDbId);
  await supabase.from('order_status_history').insert({
    order_id: orderDbId,
    status: newStatus,
    label: info.label,
    description: info.desc
  });

  if (newStatus === 'awaiting_confirmation' && existing.rider_user_id) {
    await supabase.from('riders').update({ is_available: true }).eq('user_id', existing.rider_user_id);
  }

  updateNotifBadge();

  if (currentTrackingOrder && currentTrackingOrder.id === orderDbId) {
    openTrackingDetail(orderDbId);
  }
  var listEl = document.getElementById('sn-tracking-list');
  if (listEl && listEl.style.display !== 'none') renderOrderList();
}

// Customer confirms they actually received the order — this is the
// ONLY way an order becomes fully 'delivered' and unlocks reviews.
// Independent from the rider's "Mark Delivered" action on purpose,
// so a rider can't unilaterally close out an order they never delivered.
// Customer fetches a short-lived signed URL for their assigned rider's
// license — RLS on storage only allows this if this rider is actually
// assigned to one of this customer's orders, so access is enforced
// server-side, not just hidden in the UI. //
async function viewRiderLicenseForOrder(orderId) {
  const { data: order, error: orderErr } = await supabase.from('orders').select('rider_license_path').eq('id', orderId).single();
  if (orderErr || !order || !order.rider_license_path) {
    showToast('No ID on file for this rider', 'info');
    return;
  }

  const { data, error } = await supabase.storage.from('rider-docs').createSignedUrl(order.rider_license_path, 300);
  if (error || !data) {
    showToast('Could not open rider ID: ' + (error ? error.message : 'unknown error'), 'error');
    return;
  }
  window.open(data.signedUrl, '_blank');
}

async function confirmDelivery(orderDbId) {
  const { data: existing } = await supabase.from('orders').select('status, rider_user_id').eq('id', orderDbId).single();
  if (!existing || existing.status !== 'awaiting_confirmation') {
    showToast('This order isn\'t ready to confirm yet', 'info');
    return;
  }

  await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', orderDbId);
  await supabase.from('order_status_history').insert({
    order_id: orderDbId, status: 'delivered', label: 'Delivered', description: 'Confirmed received by customer. Thank you for shopping with HomeWeb!'
  });

  updateNotifBadge();
  showToast('Delivery confirmed \u2705 You can now leave a review!');
  openTrackingDetail(orderDbId);
}

// Customer reports non-delivery after the grace period — this does NOT
// change the order's core status (still awaiting_confirmation), it just
// flags it prominently for the merchant and rider to see and follow up. //
async function reportNotArrived(orderDbId) {
  const { data: existing } = await supabase.from('orders').select('status, order_code, not_arrived_reported_at').eq('id', orderDbId).single();
  if (!existing || existing.status !== 'awaiting_confirmation') {
    showToast('This order isn\'t eligible to report right now', 'info');
    return;
  }
  if (existing.not_arrived_reported_at) {
    showToast('You already reported this order', 'info');
    return;
  }
  if (!confirm('Report Order #' + existing.order_code + ' as not received? This notifies the seller and rider.')) return;

  await supabase.from('orders').update({ not_arrived_reported_at: new Date().toISOString() }).eq('id', orderDbId);
  await supabase.from('order_status_history').insert({
    order_id: orderDbId, status: 'awaiting_confirmation',
    label: 'Customer Reported Non-Delivery',
    description: 'The customer reported not having received this order. The seller and rider have been notified.'
  });

  showToast('Reported. The seller and rider have been notified.', 'info');
  openTrackingDetail(orderDbId);
}

// Lets the customer who filed a non-delivery report retract it once the
// order genuinely does arrive — without this, a dispute would be a
// permanent dead end even after the rider successfully delivers. Only
// the customer who filed it can retract it (enforced by orders RLS,
// same as confirmDelivery/reportNotArrived). //
async function retractNotArrivedAndConfirm(orderDbId) {
  const { data: existing } = await supabase.from('orders').select('status, order_code, not_arrived_reported_at').eq('id', orderDbId).single();
  if (!existing || existing.status !== 'awaiting_confirmation' || !existing.not_arrived_reported_at) {
    showToast('This order has no active dispute to resolve', 'info');
    return;
  }
  if (!confirm('Confirm you received Order #' + existing.order_code + '? This withdraws your non-delivery report and completes the order.')) return;

  await supabase.from('orders').update({
    status: 'delivered', not_arrived_reported_at: null, updated_at: new Date().toISOString()
  }).eq('id', orderDbId);
  await supabase.from('order_status_history').insert({
    order_id: orderDbId, status: 'delivered',
    label: 'Delivery Confirmed \u2014 Dispute Resolved',
    description: 'The customer withdrew their non-delivery report and confirmed the order was received.'
  });

  showToast('Order confirmed as delivered \u2705');
  updateNotifBadge();
  openTrackingDetail(orderDbId);
}

// Mark order as delivered (manual override, e.g. for demo purposes) //
// ============================================================
// REVIEWS & RATINGS
// ============================================================

function setStarRating(productId, n) {
  var input = document.getElementById('review-rating-' + productId);
  if (input) input.value = n;

  var picker = document.getElementById('star-picker-' + productId);
  if (!picker) return;
  picker.querySelectorAll('i').forEach(function(star, i) {
    star.classList.toggle('fas', i < n);
    star.classList.toggle('far', i >= n);
    star.style.color = i < n ? '#F59E0B' : '#ccc';
  });
}

async function submitReview(orderId, productId) {
  var ratingInput = document.getElementById('review-rating-' + productId);
  var rating = ratingInput ? parseInt(ratingInput.value, 10) : 0;
  if (!rating) { showToast('Please select a star rating first', 'info'); return; }

  var comment = document.getElementById('review-comment-' + productId).value.trim();
  var isAnonymous = document.getElementById('review-anon-' + productId).checked;

  var reviewerName = null, reviewerAvatar = null;
  if (!isAnonymous) {
    const { data: myProfile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', currentUser.id).single();
    reviewerName = (myProfile && myProfile.full_name) || 'HomeWeb Customer';
    reviewerAvatar = myProfile ? myProfile.avatar_url : null;
  }

  const { error } = await supabase.from('reviews').insert({
    order_id: orderId, product_id: productId, customer_id: currentUser.id,
    rating: rating, comment: comment || null,
    is_anonymous: isAnonymous, reviewer_name: reviewerName, reviewer_avatar_url: reviewerAvatar
  });

  if (error) {
    showToast('Could not submit review: ' + error.message, 'error');
    return;
  }

  showToast('Thanks for your review! \u2b50');
  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();
  openTrackingDetail(orderId);
}

async function submitRiderRating(orderId, riderUserId) {
  var riderKey = 'rider-' + orderId;
  var ratingInput = document.getElementById('review-rating-' + riderKey);
  var rating = ratingInput ? parseInt(ratingInput.value, 10) : 0;
  if (!rating) { showToast('Please select a star rating first', 'info'); return; }

  var comment = document.getElementById('review-comment-' + riderKey).value.trim();

  const { error } = await supabase.from('rider_ratings').insert({
    order_id: orderId, rider_user_id: riderUserId, customer_id: currentUser.id,
    rating: rating, comment: comment || null
  });

  if (error) {
    showToast('Could not submit rider rating: ' + error.message, 'error');
    return;
  }

  showToast('Thanks for rating your rider! \u2b50');
  openTrackingDetail(orderId);
}

// Show order success modal with generated order code //
function showOrderSuccess(orderCode) {
  document.getElementById('sn-orderId').textContent = orderCode;
  document.getElementById('sn-successOverlay').classList.add('active');
  document.getElementById('sn-successModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ============================================================
// RIDER SEARCH
// Real riders only — assignment happens exclusively through a rider
// manually accepting via the alert popup or "Available Orders" list
// (see acceptOrder()). This modal just waits and polls for that to
// happen; it never assigns anyone itself.
// ============================================================

let riderSearchOrderId = null;
let riderSearchStep = 1; // 1: searching, 2: rider found

let riderPollIntervalId = null;

function openRiderSearchModal(orderId, orderCode) {
  riderSearchOrderId = orderId;
  riderSearchStep = 1;
  renderRiderStep(orderCode, null);

  document.getElementById('sn-riderOverlay').classList.add('active');
  document.getElementById('sn-riderModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  // Poll for a rider claiming this order — from their own dashboard or the
  // alert popup, on a different device/session. No live realtime
  // connection here, so polling is how this screen catches that update. //
  if (riderPollIntervalId) clearInterval(riderPollIntervalId);
  riderPollIntervalId = setInterval(async function() {
    if (riderSearchStep !== 1 || riderSearchOrderId !== orderId) {
      clearInterval(riderPollIntervalId);
      return;
    }
    const { data: order } = await supabase
      .from('orders')
      .select('rider_name, rider_phone, rider_vehicle, rider_plate, rider_rating, rider_license_path')
      .eq('id', orderId)
      .single();

    if (order && order.rider_name) {
      clearInterval(riderPollIntervalId);
      riderSearchStep = 2;
      renderRiderStep(orderCode, {
        name: order.rider_name, phone: order.rider_phone, vehicle: order.rider_vehicle,
        plate: order.rider_plate, rating: order.rider_rating, eta: randomBetween(15, 30),
        licensePath: order.rider_license_path
      });
    }
  }, 4000);
}

function closeRiderModal() {
  document.getElementById('sn-riderOverlay').classList.remove('active');
  document.getElementById('sn-riderModal').classList.remove('active');
  document.body.style.overflow = '';
  if (riderPollIntervalId) { clearInterval(riderPollIntervalId); riderPollIntervalId = null; }
}

function renderRiderStep(orderCode, rider) {
  var body = document.getElementById('sn-rider-body');
  if (!body) return;

  if (riderSearchStep === 1) {
    body.innerHTML =
      '<div style="text-align:center;padding:8px 4px;">' +
      '<div class="gcash-spinner" style="margin:8px auto 20px;width:48px;height:48px;border:4px solid #eef7ee;border-top-color:var(--primary,#22C55E);border-radius:50%;animation:gcashspin 0.9s linear infinite;"></div>' +
      '<h2 style="margin:0 0 6px;">Finding a rider near you...</h2>' +
      '<p class="login-sub">Order #' + orderCode + ' has been placed. We\'re matching you with a nearby rider.</p>' +
      '<p style="color:#aaa;font-size:12.5px;margin-top:16px;">You can close this and keep shopping — we\'ll notify you once a rider is found.</p>' +
      '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;" onclick="closeRiderModal()">Continue Shopping</button>' +
      '</div>' +
      '<style>@keyframes gcashspin { to { transform: rotate(360deg); } }</style>';

  } else if (riderSearchStep === 2) {
    body.innerHTML =
      '<div style="text-align:center;padding:4px;">' +
      '<div class="login-icon" style="color:#22C55E"><i class="fas fa-check-circle"></i></div>' +
      '<h2 style="margin:6px 0;">Rider Found!</h2>' +
      '<p class="login-sub">Order #' + orderCode + ' is being prepared for pickup.</p>' +
      '</div>' +
      '<div style="display:flex;gap:14px;align-items:center;background:#F9FAFB;border-radius:12px;padding:16px;margin:12px 0;">' +
      '<div style="flex-shrink:0;width:56px;height:56px;border-radius:50%;background:var(--primary,#22C55E);color:#fff;font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + rider.name.charAt(0) + '</div>' +
      '<div style="flex:1;">' +
      '<p style="margin:0;font-weight:700;">' + rider.name + '</p>' +
      '<p style="margin:2px 0;color:#777;font-size:13px;"><i class="fas fa-motorcycle"></i> ' + rider.vehicle + ' \u2022 ' + rider.plate + '</p>' +
      '<p style="margin:2px 0;color:#777;font-size:13px;">' + (rider.rating ? '<i class="fas fa-star" style="color:#F59E0B;"></i> ' + rider.rating + ' rating' : 'New rider') + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="track-summary-rows">' +
      '<div class="track-summary-row"><span>Rider Phone</span><span>' + rider.phone + '</span></div>' +
      '<div class="track-summary-row"><span>Estimated Arrival</span><span>' + rider.eta + ' mins</span></div>' +
      '</div>' +
      (rider.licensePath
        ? '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:12px;padding:8px;" onclick="viewRiderLicenseForOrder(\'' + riderSearchOrderId + '\')"><i class="fas fa-id-card"></i> View Rider\'s ID for Safety Verification</button>'
        : '') +
      '<button class="co-btn co-btn--next" style="width:100%;margin-top:10px;" onclick="closeRiderModal(); viewOrderNow(\'' + riderSearchOrderId + '\');">Track This Order</button>' +
      '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;" onclick="closeRiderModal()">Continue Shopping</button>';
  }
}

function closeSuccess() {
  document.getElementById('sn-successOverlay').classList.remove('active');
  document.getElementById('sn-successModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ORDER TRACKING //
let trackingDetailPollIntervalId = null;

async function openOrderTracking(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in to view your orders', 'info');
    openLoginModal();
    return;
  }

  if (trackingDetailPollIntervalId) { clearInterval(trackingDetailPollIntervalId); trackingDetailPollIntervalId = null; }

  document.getElementById('sn-trackingOverlay').classList.add('active');
  document.getElementById('sn-trackingModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var listEl = document.getElementById('sn-tracking-list');
  if (listEl) listEl.innerHTML = '<div class="track-empty"><p>Loading your orders...</p></div>';

  await fetchOrders();
  renderOrderList();
}

// Fetch this user's orders (with their items) from Supabase //
async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(merchant_id, merchants(store_name)))')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Could not load orders: ' + error.message, 'error');
    orders = [];
    return;
  }
  orders = (data || []).map(function(o) {
    o._storeName = (o.order_items && o.order_items[0] && o.order_items[0].products && o.order_items[0].products.merchants)
      ? o.order_items[0].products.merchants.store_name
      : null;
    return o;
  });
}

function closeOrderTracking() {
  document.getElementById('sn-trackingOverlay').classList.remove('active');
  document.getElementById('sn-trackingModal').classList.remove('active');
  document.getElementById('sn-tracking-list').style.display = '';
  document.getElementById('sn-tracking-detail').style.display = 'none';
  currentTrackingOrder = null;
  document.body.style.overflow = '';
  if (trackingDetailPollIntervalId) { clearInterval(trackingDetailPollIntervalId); trackingDetailPollIntervalId = null; }
}

function renderOrderList() {
  var container = document.getElementById('sn-tracking-list');
  if (!container) return;

  if (!orders.length) {
    container.innerHTML =
      '<div class="track-empty">' +
      '<h3>No orders yet</h3>' +
      '<p>When you place an order, it will appear here.</p>' +
      '<button class="co-btn co-btn--next" onclick="closeOrderTracking()">Start Shopping</button>' +
      '</div>';
    return;
  }

  var html = '<div class="track-order-list">';
  orders.forEach(function(order) {
    var statusInfo = getOrderStatusInfo(order.status);
    var dateStr = formatDate(order.created_at);

    var itemNames = (order.order_items || []).map(function(item) {
      return item.product_name + (item.qty > 1 ? ' x' + item.qty : '');
    }).join(', ');

    html += '<div class="track-order-card" onclick="openTrackingDetail(\'' + order.id + '\')">' +
      '<div class="track-card-top">' +
      '<div class="track-card-id">' + order.order_code + '</div>' +
      '<span class="track-status-text"> - ' + statusInfo.label + '</span>' +
      '</div>' +
      (order._storeName ? '<div style="font-size:11.5px;color:#999;margin-top:2px;"><i class="fas fa-store"></i> ' + order._storeName + '</div>' : '') +
      '<div class="track-card-items-text">' + itemNames + '</div>' +
      '<div class="track-card-bottom">' +
      '<span class="track-card-date">' + dateStr + '</span>' +
      '<span class="track-card-total">' + fmt(order.total) + '</span>' +
      '</div>' +
      '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
}

// Lets a customer cancel their own order while still waiting for a rider
// to accept — reachable from Track Orders even if they navigated away
// from the "finding a rider" screen and come back later. //
async function cancelOrderByCustomer(orderId, orderCode) {
  if (!confirm('Cancel Order #' + orderCode + '? This can\'t be undone.')) return;

  const { data, error } = await supabase.rpc('cancel_order_by_customer', { order_id_param: orderId });

  if (error) {
    showToast('Could not cancel order: ' + error.message, 'error');
    return;
  }
  if (!data) {
    showToast('This order can no longer be cancelled — a rider may have already accepted it.', 'info');
    openTrackingDetail(orderId);
    return;
  }

  showToast('Order cancelled \u2705');
  updateNotifBadge();
  openTrackingDetail(orderId);
}

async function openTrackingDetail(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(merchant_id, merchants(store_name))), order_status_history(*)')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    showToast('Could not load order details', 'error');
    return;
  }

  // Orders are single-merchant (split at checkout), so the first item's
  // seller is the order's seller. //
  order._storeName = (order.order_items && order.order_items[0] && order.order_items[0].products && order.order_items[0].products.merchants)
    ? order.order_items[0].products.merchants.store_name
    : null;

  var myReviews = {};
  if (order.status === 'delivered') {
    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('product_id, rating, comment, is_anonymous')
      .eq('order_id', orderId)
      .eq('customer_id', currentUser.id);
    (reviewRows || []).forEach(function(r) { myReviews[r.product_id] = r; });
  }
  order._myReviews = myReviews;

  var myRiderRating = null;
  if (order.status === 'delivered' && order.rider_user_id) {
    const { data: riderRatingRow } = await supabase
      .from('rider_ratings')
      .select('rating, comment')
      .eq('order_id', orderId)
      .maybeSingle();
    myRiderRating = riderRatingRow || null;
  }
  order._myRiderRating = myRiderRating;

  currentTrackingOrder = order;
  renderTrackingDetail(order);
  document.getElementById('sn-tracking-list').style.display = 'none';
  document.getElementById('sn-tracking-detail').style.display = '';

  // Live-update this view while it's open — catches status changes made
  // from other sessions (a rider's dashboard, the auto-timer, etc.) //
  if (trackingDetailPollIntervalId) clearInterval(trackingDetailPollIntervalId);
  trackingDetailPollIntervalId = setInterval(async function() {
    if (!currentTrackingOrder || currentTrackingOrder.id !== orderId) {
      clearInterval(trackingDetailPollIntervalId);
      return;
    }
    const { data: latest } = await supabase.from('orders').select('status, updated_at').eq('id', orderId).single();
    if (latest && (latest.status !== currentTrackingOrder.status || latest.updated_at !== currentTrackingOrder.updated_at)) {
      openTrackingDetail(orderId);
    }
  }, 5000);
}

function renderTrackingDetail(order) {
  var container = document.getElementById('sn-tracking-detail');
  if (!container) return;

  // This view is reachable by anyone with a legitimate reason to see the
  // order (customer, merchant, rider — RLS correctly allows all three to
  // fetch it), but actions like reviewing a product, rating the rider, or
  // messaging/reporting the rider only make sense from the customer's
  // side. A rider viewing their own delivery shouldn't be able to rate
  // themselves or message themselves. Compute this once, use everywhere. //
  var isCustomerViewer = order.user_id === currentUser.id;

  var statusInfo = getOrderStatusInfo(order.status);
  var dateStr = formatDate(order.created_at);

  // Build simple text timeline (most recent first)
  var timelineHtml = '<div class="track-timeline">';
  var sortedHistory = (order.order_status_history || []).slice().sort(function(a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  });
  sortedHistory.forEach(function(entry) {
    timelineHtml += '<div class="track-tl-row">' +
      '<span class="track-tl-label">' + entry.label + '</span>' +
      '<span class="track-tl-time">' + formatTime(entry.created_at) + '</span>' +
      '</div>' +
      '<div class="track-tl-desc">' + entry.description + '</div>';
  });
  timelineHtml += '</div>';

  // Items list
  var itemsHtml = (order.order_items || []).map(function(item) {
    return '<div class="track-detail-item">' +
      '<span class="track-detail-item-name">' + item.product_name + '</span>' +
      '<span class="track-detail-item-qty">' + item.qty + ' x ' + fmt(item.price) + '</span>' +
      '<span class="track-detail-item-sub">' + fmt(item.price * item.qty) + '</span>' +
      '</div>';
  }).join('');

  // Review section (only for delivered orders, and only the customer can review) //
  var reviewsHtml = '';
  if (order.status === 'delivered' && isCustomerViewer) {
    var myReviews = order._myReviews || {};
    reviewsHtml = (order.order_items || []).map(function(item) {
      var existing = myReviews[item.product_id];
      if (existing) {
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<p style="margin:0 0 4px;font-weight:600;font-size:13px;">' + item.product_name + '</p>' +
          '<div style="color:#F59E0B;font-size:14px;">' + starsHTML(existing.rating) + '</div>' +
          (existing.comment ? '<p style="margin:4px 0 0;color:#777;font-size:12.5px;">"' + existing.comment + '"</p>' : '') +
          '<p style="margin:4px 0 0;color:#aaa;font-size:11px;">Posted as ' + (existing.is_anonymous ? 'Anonymous' : 'yourself') + '</p>' +
          '</div>';
      }
      return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;" data-review-product="' + item.product_id + '">' +
        '<p style="margin:0 0 6px;font-weight:600;font-size:13px;">' + item.product_name + '</p>' +
        '<div class="star-picker" id="star-picker-' + item.product_id + '" style="font-size:20px;color:#ccc;cursor:pointer;margin-bottom:8px;">' +
        [1, 2, 3, 4, 5].map(function(n) {
          return '<i class="far fa-star" onclick="setStarRating(\'' + item.product_id + '\', ' + n + ')" style="margin-right:4px;"></i>';
        }).join('') +
        '<input type="hidden" id="review-rating-' + item.product_id + '" value="0"/></div>' +
        '<textarea id="review-comment-' + item.product_id + '" placeholder="Optional comment..." style="width:100%;border:1px solid #e5e5e5;border-radius:8px;padding:8px;font-size:12.5px;resize:vertical;min-height:44px;"></textarea>' +
        '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#666;cursor:pointer;">' +
        '<input type="checkbox" id="review-anon-' + item.product_id + '"/> Post anonymously</label>' +
        '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;padding:8px;" onclick="submitReview(\'' + order.id + '\', \'' + item.product_id + '\')">Submit Review</button>' +
        '</div>';
    }).join('');
  }

  var riderRatingHtml = '';
  if (order.status === 'delivered' && order.rider_user_id && isCustomerViewer) {
    var riderKey = 'rider-' + order.id;
    var existingRiderRating = order._myRiderRating;
    if (existingRiderRating) {
      riderRatingHtml = '<div style="padding:12px 4px;">' +
        '<div style="color:#F59E0B;font-size:14px;">' + starsHTML(existingRiderRating.rating) + '</div>' +
        (existingRiderRating.comment ? '<p style="margin:4px 0 0;color:#777;font-size:12.5px;">"' + existingRiderRating.comment + '"</p>' : '') +
        '</div>';
    } else {
      riderRatingHtml = '<div style="padding:12px 4px;">' +
        '<div class="star-picker" id="star-picker-' + riderKey + '" style="font-size:20px;color:#ccc;cursor:pointer;margin-bottom:8px;">' +
        [1, 2, 3, 4, 5].map(function(n) {
          return '<i class="far fa-star" onclick="setStarRating(\'' + riderKey + '\', ' + n + ')" style="margin-right:4px;"></i>';
        }).join('') +
        '<input type="hidden" id="review-rating-' + riderKey + '" value="0"/></div>' +
        '<textarea id="review-comment-' + riderKey + '" placeholder="Optional comment about your delivery..." style="width:100%;border:1px solid #e5e5e5;border-radius:8px;padding:8px;font-size:12.5px;resize:vertical;min-height:44px;"></textarea>' +
        '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;padding:8px;" onclick="submitRiderRating(\'' + order.id + '\', \'' + order.rider_user_id + '\')">Submit Rider Rating</button>' +
        '</div>';
    }
  }

  // Delivery address
  var addressStr = (order.shipping_street || '') + ', ' + (order.shipping_city || '') + ' ' + (order.shipping_zip || '');

  var html =
    '<div class="track-detail-back" onclick="openOrderTracking()">Back to orders</div>' +

    '<h3>' + statusInfo.label + ' — Order #' + order.order_code + '</h3>' +
    (order._storeName ? '<p style="margin:2px 0 12px;font-size:12.5px;color:#777;"><i class="fas fa-store"></i> ' + order._storeName + '</p>' : '') +

    (order.status === 'placed' && !order.rider_user_id
      ? '<button class="co-btn" style="background:#FEE2E2;color:#DC2626;width:100%;margin-bottom:14px;" onclick="cancelOrderByCustomer(\'' + order.id + '\', \'' + order.order_code + '\')"><i class="fas fa-ban"></i> Cancel Order</button>'
      : '') +

    // Timeline
    '<div class="track-detail-section">' +
    '<h4>Tracking Timeline</h4>' +
    timelineHtml +
    '</div>' +

    (order.proof_of_delivery_url
      ? '<div class="track-detail-section">' +
        '<h4>Proof of Delivery</h4>' +
        '<a href="' + order.proof_of_delivery_url + '" target="_blank">' +
        '<img src="' + order.proof_of_delivery_url + '" style="width:100%;max-width:280px;border-radius:10px;border:1px solid #eee;"/>' +
        '</a>' +
        '<p style="margin:6px 0 0;font-size:11.5px;color:#999;">Photo taken by your rider when the order was marked delivered.</p>' +
        '</div>'
      : '') +

    // Items
    '<div class="track-detail-section">' +
    '<h4>Order Items</h4>' +
    '<div class="track-detail-items">' + itemsHtml + '</div>' +
    ((order.order_items && order.order_items.length && isCustomerViewer)
      ? '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;padding:8px;" onclick="messageSellerForOrder(\'' + order.id + '\', \'' + order.order_items[0].product_id + '\')"><i class="fas fa-comment-dots"></i> Message Seller</button>'
      : '') +
    '</div>' +

    (reviewsHtml ? (
      '<div class="track-detail-section">' +
      '<h4>Rate & Review</h4>' +
      reviewsHtml +
      '</div>'
    ) : '') +

    (riderRatingHtml ? (
      '<div class="track-detail-section">' +
      '<h4>Rate Your Rider</h4>' +
      riderRatingHtml +
      '</div>'
    ) : '') +

    (order.rider_name ? (
      '<div class="track-detail-section">' +
      '<h4>Your Rider</h4>' +
      '<div style="display:flex;gap:12px;align-items:center;">' +
      '<div style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--primary,#22C55E);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;">' + order.rider_name.charAt(0) + '</div>' +
      '<div>' +
      '<p style="margin:0;font-weight:600;">' + order.rider_name + '</p>' +
      '<p style="margin:2px 0;color:#777;font-size:13px;">' + order.rider_vehicle + ' \u2022 ' + order.rider_plate + ' \u2022 ' + (order.rider_rating ? '<i class="fas fa-star" style="color:#F59E0B;"></i> ' + order.rider_rating : 'New rider') + '</p>' +
      '<p style="margin:0;color:#777;font-size:13px;">' + order.rider_phone + '</p>' +
      '</div></div>' +
      (order.rider_license_path && isCustomerViewer
        ? '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;padding:8px;" onclick="viewRiderLicenseForOrder(\'' + order.id + '\')"><i class="fas fa-id-card"></i> View Rider\'s ID for Safety Verification</button>'
        : '') +
      (order.rider_user_id && isCustomerViewer
        ? '<button class="co-btn co-btn--next" style="width:100%;margin-top:10px;padding:8px;" onclick="openChatThread(\'' + order.id + '\', \'' + order.rider_user_id + '\', \'' + order.rider_name.replace(/'/g, "\\'") + '\')"><i class="fas fa-comment-dots"></i> Message Rider</button>'
        : '') +
      (order.rider_user_id && isCustomerViewer
        ? '<a href="#" onclick="openReportModal(\'rider\', \'' + order.rider_user_id + '\', \'' + order.rider_name.replace(/'/g, "\\'") + '\', \'' + order.id + '\'); return false;" style="display:block;margin-top:10px;text-align:center;color:#999;font-size:11.5px;text-decoration:underline;"><i class="fas fa-flag"></i> Report this rider</a>'
        : '') +
      '</div>'
    ) : '') +

    // Summary + Address
    '<div class="track-detail-section">' +
    '<h4>Delivery Address</h4>' +
    '<p>' + (order.shipping_first_name || '') + ' ' + (order.shipping_last_name || '') + '</p>' +
    '<p>' + addressStr + '</p>' +
    '<p>' + (order.shipping_phone || '') + '</p>' +
    '</div>' +

    '<div class="track-detail-section">' +
    '<h4>Order Summary</h4>' +
    '<div class="track-summary-rows">' +
    '<div class="track-summary-row"><span>Subtotal</span><span>' + fmt(order.subtotal) + '</span></div>' +
    '<div class="track-summary-row"><span>Shipping</span><span>' + (Number(order.shipping_fee) === 0 ? 'FREE' : fmt(order.shipping_fee)) + '</span></div>' +
    '<div class="track-summary-row total"><span>Total</span><span>' + fmt(order.total) + '</span></div>' +
    '<div class="track-summary-row"><span>Payment</span><span>' + (order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'gcash' ? 'GCash' : order.payment_method) + '</span></div>' +
    '<div class="track-summary-row"><span>Placed on</span><span>' + dateStr + '</span></div>' +
    '</div>' +
    '</div>';

  // Customer confirms receipt — only appears once the rider has actually
  // marked it delivered, never at any earlier status. This is the only
  // way an order finalizes as 'delivered' and unlocks reviews.
  //
  // Merchants and riders can legitimately load this same order (they're
  // real participants and RLS correctly allows it), but these actions
  // belong to the customer alone — finalizing receipt or disputing
  // non-delivery isn't something a seller or rider should be able to do
  // on the customer's behalf. Gate the whole block on actually being
  // the customer; everyone else just sees a plain status line instead.
  if (order.status === 'awaiting_confirmation') {
    if (order.user_id !== currentUser.id) {
      html += '<div style="background:#FFFBEB;border-radius:10px;padding:14px;margin-top:16px;">' +
        '<p style="margin:0;font-size:13px;color:#92400E;"><i class="fas fa-info-circle"></i> ' +
        (order.not_arrived_reported_at
          ? 'The customer has reported this order as not received. Awaiting resolution.'
          : 'Delivered by the rider — awaiting the customer\'s confirmation.') +
        '</p></div>';
    } else if (order.not_arrived_reported_at) {
      // Disputed — Confirm Receipt is hidden by default (confirming right
      // after claiming non-receipt would be self-contradictory), but the
      // customer needs a way forward if the rider does show up afterward.
      // Only the person who filed the report can retract it. //
      html += '<div style="background:#FEE2E2;border-radius:10px;padding:14px;margin-top:16px;">' +
        '<p style="margin:0 0 10px;font-size:13px;color:#DC2626;"><i class="fas fa-flag"></i> You reported this order as not received. The seller and rider have been notified.</p>' +
        '<button class="co-btn co-btn--next" style="width:100%;" onclick="retractNotArrivedAndConfirm(\'' + order.id + '\')">Actually, I Received It \u2014 Confirm Receipt</button>' +
        '</div>';
    } else {
      var elapsedSinceDelivered = Date.now() - new Date(order.updated_at).getTime();
      var gracePeriodPassed = elapsedSinceDelivered >= CONFIRMATION_GRACE_PERIOD_MS;

      html += '<div style="background:#FFFBEB;border-radius:10px;padding:14px;margin-top:16px;">' +
        '<p style="margin:0 0 10px;font-size:13px;color:#92400E;"><i class="fas fa-info-circle"></i> Your rider marked this order as delivered. Please confirm you actually received it.</p>' +
        '<button class="co-btn co-btn--next track-mark-delivered" onclick="confirmDelivery(\'' + order.id + '\')">Confirm Receipt</button>';

      if (gracePeriodPassed) {
        html += '<button class="co-btn" style="background:#FEE2E2;color:#DC2626;width:100%;margin-top:10px;" onclick="reportNotArrived(\'' + order.id + '\')">Did Not Arrive Yet</button>';
      } else {
        var minsLeft = Math.ceil((CONFIRMATION_GRACE_PERIOD_MS - elapsedSinceDelivered) / 1000 / 60) || 1;
        html += '<p style="margin:10px 0 0;font-size:11.5px;color:#92400E;">Didn\'t receive it? You can report this in about ' + minsLeft + ' minute' + (minsLeft === 1 ? '' : 's') + '.</p>';
      }

      html += '</div>';
    }
  }

  container.innerHTML = html;
}

// Helpers for order tracking
function getOrderStatusInfo(status) {
  var map = {
    'placed':                { label: 'Order Placed',        icon: '' },
    'preparing':             { label: 'Preparing',           icon: '' },
    'out_for_delivery':      { label: 'Out for Delivery',    icon: '' },
    'awaiting_confirmation': { label: 'Awaiting Confirmation', icon: '' },
    'delivered':             { label: 'Delivered',           icon: '' },
    'cancelled':             { label: 'Cancelled',           icon: '' }
  };
  return map[status] || map['placed'];
}

function formatDate(isoStr) {
  var d = new Date(isoStr);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function formatTime(isoStr) {
  var d = new Date(isoStr);
  var h = d.getHours();
  var m = String(d.getMinutes()).padStart(2, '0');
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ampm;
}

// LOGIN MODAL //

// Open login modal //
function openLoginModal(e) {
  if (e) e.preventDefault();
  if (currentUser) return; 

  // Clear form fields
  ['login-email', 'login-password'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.closest('.co-field').classList.remove('co-field--error'); }
  });
  var remember = document.getElementById('login-remember');
  if (remember) remember.checked = false;

  document.getElementById('sn-loginOverlay').classList.add('active');
  document.getElementById('sn-loginModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
  document.getElementById('sn-loginOverlay').classList.remove('active');
  document.getElementById('sn-loginModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

function openForgotPasswordModal(e) {
  if (e) e.preventDefault();
  closeLoginModal();

  var body = document.getElementById('sn-forgot-body');
  body.innerHTML =
    '<div class="login-icon"><i class="fas fa-key"></i></div>' +
    '<h2>Reset Password</h2>' +
    '<p class="login-sub">Enter the email on your account and we\'ll send a reset link.</p>' +
    '<div class="co-field"><label>Email <span class="co-required">*</span></label>' +
    '<input type="email" id="forgot-email" placeholder="you@example.com"/>' +
    '<span class="co-field-error">Enter a valid email address</span></div>' +
    '<button class="co-btn co-btn--next login-submit" id="forgot-submit-btn" onclick="submitForgotPassword()">Send Reset Link</button>' +
    '<p class="login-signup"><a href="#" onclick="closeForgotPasswordModal(); openLoginModal(event); return false;">Back to Log In</a></p>';

  document.getElementById('forgot-email').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') submitForgotPassword(); });

  document.getElementById('sn-forgotOverlay').classList.add('active');
  document.getElementById('sn-forgotModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeForgotPasswordModal() {
  document.getElementById('sn-forgotOverlay').classList.remove('active');
  document.getElementById('sn-forgotModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function submitForgotPassword() {
  var emailEl = document.getElementById('forgot-email');
  var email = emailEl.value.trim();
  var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailOk) {
    emailEl.closest('.co-field').classList.add('co-field--error');
    return;
  }

  var btn = document.getElementById('forgot-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  btn.disabled = false;
  btn.textContent = 'Send Reset Link';

  // Deliberately vague on success either way — confirming or denying that
  // an email exists in the system is an account-enumeration leak. //
  var body = document.getElementById('sn-forgot-body');
  body.innerHTML =
    '<div class="login-icon" style="color:#22C55E;"><i class="fas fa-envelope-circle-check"></i></div>' +
    '<h2>Check Your Email</h2>' +
    '<p class="login-sub">If an account exists for <strong>' + email.replace(/</g, '&lt;') + '</strong>, a password reset link is on its way. It may take a minute — check spam too.</p>' +
    '<button class="co-btn co-btn--next login-submit" onclick="closeForgotPasswordModal()">Done</button>';

  if (error) console.error('resetPasswordForEmail error:', error.message);
}

// ============================================================
// SET NEW PASSWORD (after clicking the emailed reset link)
// ============================================================

function openSetNewPasswordModal() {
  var body = document.getElementById('sn-reset-body');
  body.innerHTML =
    '<div class="login-icon"><i class="fas fa-lock"></i></div>' +
    '<h2>Set a New Password</h2>' +
    '<p class="login-sub">Choose a new password for your account.</p>' +
    '<div class="co-field"><label>New Password <span class="co-required">*</span></label>' +
    '<input type="password" id="reset-new-password" placeholder="At least 6 characters"/>' +
    '<span class="co-field-error">Password must be at least 6 characters</span></div>' +
    '<div class="co-field"><label>Confirm Password <span class="co-required">*</span></label>' +
    '<input type="password" id="reset-confirm-password" placeholder="Re-enter password"/>' +
    '<span class="co-field-error">Passwords do not match</span></div>' +
    '<button class="co-btn co-btn--next login-submit" id="reset-submit-btn" onclick="submitNewPassword()">Update Password</button>' +
    '<p class="login-signup"><a href="#" onclick="cancelPasswordReset(); return false;">Cancel</a></p>';

  document.getElementById('sn-resetOverlay').classList.add('active');
  document.getElementById('sn-resetModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function cancelPasswordReset() {
  // The reset link leaves the browser in a temporary authenticated
  // "recovery" session — sign out rather than leaving that dangling. //
  await supabase.auth.signOut();
  document.getElementById('sn-resetOverlay').classList.remove('active');
  document.getElementById('sn-resetModal').classList.remove('active');
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname);
}

async function submitNewPassword() {
  var pass1El = document.getElementById('reset-new-password');
  var pass2El = document.getElementById('reset-confirm-password');
  var pass1 = pass1El.value;
  var pass2 = pass2El.value;
  var ok = true;

  pass1El.closest('.co-field').classList.remove('co-field--error');
  pass2El.closest('.co-field').classList.remove('co-field--error');

  if (pass1.length < 6) { pass1El.closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (pass1 !== pass2) { pass2El.closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (!ok) return;

  var btn = document.getElementById('reset-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  const { error } = await supabase.auth.updateUser({ password: pass1 });

  btn.disabled = false;
  btn.textContent = 'Update Password';

  if (error) {
    showToast('Could not update password: ' + error.message, 'error');
    return;
  }

  document.getElementById('sn-resetOverlay').classList.remove('active');
  document.getElementById('sn-resetModal').classList.remove('active');
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname);
  showToast('Password updated \u2705 You\'re now logged in.');
  updateAuthUI();
}

// Validate login form //
function validateLoginForm() {
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  let isValid = true;
  let firstInvalidEl = null;

  const emailField = emailEl.closest('.co-field');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim());
  if (!emailOk) {
    isValid = false;
    emailField.classList.add('co-field--error');
    firstInvalidEl = firstInvalidEl || emailEl;
  } else {
    emailField.classList.remove('co-field--error');
  }

  const passField = passEl.closest('.co-field');
  if (!passEl.value) {
    isValid = false;
    passField.classList.add('co-field--error');
    firstInvalidEl = firstInvalidEl || passEl;
  } else {
    passField.classList.remove('co-field--error');
  }

  if (firstInvalidEl) firstInvalidEl.focus();
  return isValid;
}

// Submit login //
async function submitLogin() {
  if (!validateLoginForm()) {
    showToast('Please fix the errors below', 'info');
    return;
  }
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const btn = document.querySelector('#sn-loginModal .login-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

  const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });

  if (btn) { btn.disabled = false; btn.innerHTML = 'Log In <i class="fas fa-arrow-right"></i>'; }

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  currentUser = data.user;
  closeLoginModal();
  await fetchUserRoles();
  updateAuthUI();
  showToast('Welcome back, ' + (currentUser.email || '').split('@')[0] + '!');
}

// Logout //
// ============================================================
// ADMIN (hidden — reached only via #admin in the URL)
// ============================================================

var ADMIN_EMAIL = 'admin@homeweb.internal';

function openAdminLoginModal() {
  var body = document.getElementById('sn-admin-login-body');
  body.innerHTML =
    '<div class="login-icon"><i class="fas fa-user-shield"></i></div>' +
    '<h2>Admin Access</h2>' +
    '<p class="login-sub">Restricted area</p>' +
    '<div class="co-field"><label>Username</label>' +
    '<input type="text" id="admin-access-code" name="admin_access_code" autocomplete="off" data-lpignore="true" data-1p-ignore/></div>' +
    '<div class="co-field"><label>Password</label>' +
    '<input type="password" id="admin-access-secret" name="admin_access_secret" autocomplete="new-password" data-lpignore="true" data-1p-ignore/></div>' +
    '<button class="co-btn co-btn--next login-submit" id="admin-login-btn" onclick="submitAdminLogin()">Log In</button>';

  document.getElementById('admin-access-secret').addEventListener('keydown', function(e) { if (e.key === 'Enter') submitAdminLogin(); });

  document.getElementById('sn-adminLoginOverlay').classList.add('active');
  document.getElementById('sn-adminLoginModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAdminLoginModal() {
  document.getElementById('sn-adminLoginOverlay').classList.remove('active');
  document.getElementById('sn-adminLoginModal').classList.remove('active');
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

async function submitAdminLogin() {
  var username = document.getElementById('admin-access-code').value.trim().toLowerCase();
  var password = document.getElementById('admin-access-secret').value;
  var btn = document.getElementById('admin-login-btn');

  if (username !== 'admin') {
    showToast('Invalid credentials', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }
  const { data, error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: password });
  if (btn) { btn.disabled = false; btn.textContent = 'Log In'; }

  if (error) {
    showToast('Invalid credentials', 'error');
    return;
  }

  currentUser = data.user;
  await fetchUserRoles();

  if (userRoles.indexOf('admin') === -1) {
    showToast('This account is not authorized as admin', 'error');
    await supabase.auth.signOut();
    currentUser = null;
    return;
  }

  closeAdminLoginModal();
  updateAuthUI();
  openAdminDashboard();
}

let adminView = 'overview'; // 'overview' | 'merchants' | 'riders'

async function openAdminDashboard() {
  document.getElementById('sn-adminOverlay').classList.add('active');
  document.getElementById('sn-adminModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  adminView = 'overview';
  renderAdminDashboard();
}

function closeAdminDashboard() {
  document.getElementById('sn-adminOverlay').classList.remove('active');
  document.getElementById('sn-adminModal').classList.remove('active');
  document.body.style.overflow = '';
}

function adminTabsHtml() {
  function tab(id, label) {
    var active = adminView === id;
    return '<button class="co-btn" style="flex:1;background:' + (active ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (active ? '#fff' : '#333') + ';" onclick="switchAdminView(\'' + id + '\')">' + label + '</button>';
  }
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">' + tab('overview', 'Overview') + tab('merchants', 'Merchants') + tab('riders', 'Riders') + tab('customers', 'Customers') + tab('orders', 'Orders') + tab('reports', 'Reports') + '</div>';
}

function switchAdminView(view) {
  adminView = view;
  renderAdminDashboard();
}

async function renderAdminDashboard() {
  var body = document.getElementById('sn-admin-body');
  body.innerHTML = '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml() + '<div class="track-empty"><p>Loading...</p></div>';

  if (adminView === 'overview') return renderAdminOverview();
  if (adminView === 'merchants') return renderAdminMerchants();
  if (adminView === 'riders') return renderAdminRiders();
  if (adminView === 'customers') return renderAdminCustomers();
  if (adminView === 'orders') return renderAdminOrders();
  if (adminView === 'reports') return renderAdminReports();
}

async function renderAdminOverview() {
  var body = document.getElementById('sn-admin-body');

  const [{ count: merchantCount }, { count: riderCount }, { count: customerCount }, { count: orderCount }, { count: productCount }, { count: pendingPermits }, { count: pendingReports }] = await Promise.all([
    supabase.from('merchants').select('id', { count: 'exact', head: true }),
    supabase.from('riders').select('id', { count: 'exact', head: true }),
    supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('merchants').select('id', { count: 'exact', head: true }).not('business_permit_url', 'is', null).eq('is_verified', false),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  function card(label, value, color) {
    return '<div style="flex:1;min-width:110px;background:#F9FAFB;border-radius:10px;padding:14px;text-align:center;">' +
      '<p style="margin:0;font-size:11px;color:#666;">' + label + '</p>' +
      '<p style="margin:4px 0 0;font-weight:700;font-size:18px;color:' + color + ';">' + value + '</p></div>';
  }

  var body2 =
    '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml() +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">' +
    card('Merchants', merchantCount || 0, '#15803D') +
    card('Riders', riderCount || 0, '#3B82F6') +
    card('Customers', customerCount || 0, '#854F0B') +
    card('Products', productCount || 0, '#0F6E56') +
    card('Orders', orderCount || 0, '#B45309') +
    '</div>' +
    (pendingReports > 0
      ? '<div style="background:#FEE2E2;border-radius:10px;padding:14px;margin-bottom:10px;">' +
        '<p style="margin:0;font-weight:700;color:#DC2626;font-size:13px;"><i class="fas fa-flag"></i> ' + pendingReports + ' report(s) awaiting review</p>' +
        '<button class="co-btn" style="background:#fff;color:#DC2626;margin-top:8px;padding:6px 12px;" onclick="switchAdminView(\'reports\')">Review Now</button>' +
        '</div>'
      : '') +
    (pendingPermits > 0
      ? '<div style="background:#FFFBEB;border-radius:10px;padding:14px;margin-bottom:10px;">' +
        '<p style="margin:0;font-weight:700;color:#B45309;font-size:13px;"><i class="fas fa-clock"></i> ' + pendingPermits + ' business permit(s) awaiting review</p>' +
        '<button class="co-btn" style="background:#fff;color:#B45309;margin-top:8px;padding:6px 12px;" onclick="switchAdminView(\'merchants\')">Review Now</button>' +
        '</div>'
      : '<p style="color:#999;font-size:13px;">No pending permit reviews.</p>');

  body.innerHTML = body2;
}

let adminMerchantFilter = 'all'; // 'all' | 'pending' | 'suspended'
let adminMerchantTypeFilter = 'all';
let adminMerchantSearch = '';

async function renderAdminMerchants() {
  var body = document.getElementById('sn-admin-body');
  const { data: allMerchants, error } = await supabase.from('merchants').select('*').order('created_at', { ascending: false });

  var merchants = allMerchants || [];
  if (adminMerchantFilter === 'pending') {
    merchants = merchants.filter(function(m) { return m.business_permit_url && !m.is_verified; });
  } else if (adminMerchantFilter === 'suspended') {
    merchants = merchants.filter(function(m) { return m.is_suspended; });
  }
  if (adminMerchantTypeFilter !== 'all') {
    merchants = merchants.filter(function(m) { return m.business_type === adminMerchantTypeFilter; });
  }
  if (adminMerchantSearch.trim()) {
    var q = adminMerchantSearch.trim().toLowerCase();
    merchants = merchants.filter(function(m) { return (m.store_name || '').toLowerCase().indexOf(q) !== -1; });
  }

  var merchantUserIds = merchants.map(function(m) { return m.user_id; });
  var merchantEmailById = {};
  if (merchantUserIds.length) {
    const { data: mProfiles } = await supabase.from('profiles').select('id, email').in('id', merchantUserIds);
    (mProfiles || []).forEach(function(p) { merchantEmailById[p.id] = p.email; });
  }

  var suspendedCount = (allMerchants || []).filter(function(m) { return m.is_suspended; }).length;
  var pendingCount = (allMerchants || []).filter(function(m) { return m.business_permit_url && !m.is_verified; }).length;

  var searchBar = '<input type="text" placeholder="Search store name..." value="' + adminMerchantSearch.replace(/"/g, '&quot;') + '" ' +
    'oninput="adminMerchantSearch=this.value; renderAdminMerchants();" ' +
    'style="width:100%;padding:9px 14px;border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:10px;"/>';

  var typeOptions = ['all'].concat(Object.keys(CATEGORY_META)).map(function(t) {
    var label = t === 'all' ? 'All Store Types' : (CATEGORY_META[t] ? CATEGORY_META[t].title : t);
    return '<option value="' + t + '"' + (adminMerchantTypeFilter === t ? ' selected' : '') + '>' + label + '</option>';
  }).join('');

  var filterBar = '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (adminMerchantFilter === 'all' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (adminMerchantFilter === 'all' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminMerchantFilter=\'all\'; renderAdminMerchants();">All (' + (allMerchants ? allMerchants.length : 0) + ')</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (adminMerchantFilter === 'pending' ? '#B45309' : '#F3F4F6') + ';color:' + (adminMerchantFilter === 'pending' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminMerchantFilter=\'pending\'; renderAdminMerchants();">Pending (' + pendingCount + ')</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (adminMerchantFilter === 'suspended' ? '#DC2626' : '#F3F4F6') + ';color:' + (adminMerchantFilter === 'suspended' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminMerchantFilter=\'suspended\'; renderAdminMerchants();">Suspended (' + suspendedCount + ')</button>' +
    '<select onchange="adminMerchantTypeFilter=this.value; renderAdminMerchants();" style="padding:6px 10px;border-radius:8px;border:1px solid #e5e5e5;font-size:12.5px;">' + typeOptions + '</select>' +
    '</div>';

  var rows = (error || !merchants.length)
    ? '<p style="color:#999;font-size:13px;">' + (adminMerchantSearch.trim() ? 'No stores match your search.' : 'Nothing here.') + '</p>'
    : merchants.map(function(m) {
        var typeColor = m.merchant_type === 'bolanteros' ? '#B45309' : '#3B82F6';
        var escapedName = m.store_name.replace(/'/g, "\\'");
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;' + (m.is_suspended ? 'opacity:0.65;' : '') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
          '<span style="font-weight:700;font-size:13px;">' + m.store_name + (m.is_verified ? ' <i class="fas fa-badge-check" style="color:var(--primary,#22C55E);"></i>' : '') + '</span>' +
          '<span style="font-size:11px;color:' + typeColor + ';font-weight:600;">' + (m.merchant_type === 'bolanteros' ? 'Bolanteros' : 'Permanent') + '</span>' +
          '</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#777;">' + (CATEGORY_META[m.business_type] ? CATEGORY_META[m.business_type].title : m.business_type) + '</p>' +
          '<p style="margin:2px 0 0;font-size:11.5px;color:#999;">' + (merchantEmailById[m.user_id] || 'No email on file') + '</p>' +
          (m.is_suspended ? '<p style="margin:6px 0 0;background:#FEE2E2;color:#DC2626;padding:6px 8px;border-radius:6px;font-size:11.5px;font-weight:600;"><i class="fas fa-ban"></i> Suspended: ' + (m.suspended_reason || 'No reason given') + '</p>' : '') +
          '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
          (m.business_permit_url
            ? '<a href="' + m.business_permit_url + '" target="_blank" class="co-btn" style="padding:6px 12px;background:#F3F4F6;color:#333;text-decoration:none;font-size:12px;">View Permit</a>'
            : '<span style="font-size:11.5px;color:#aaa;padding:6px 0;">No permit uploaded</span>') +
          (m.business_permit_url
            ? (m.is_verified
                ? '<button class="co-btn" style="padding:6px 12px;background:#FEE2E2;color:#DC2626;font-size:12px;" onclick="adminSetMerchantVerified(\'' + m.id + '\', false)">Revoke Verification</button>'
                : '<button class="co-btn" style="padding:6px 12px;background:#F0FFF4;color:#15803D;font-size:12px;" onclick="adminSetMerchantVerified(\'' + m.id + '\', true)">Approve & Verify</button>')
            : '') +
          (m.is_suspended
            ? '<button class="co-btn" style="padding:6px 12px;background:#F0FFF4;color:#15803D;font-size:12px;" onclick="adminReinstateMerchant(\'' + m.id + '\', \'' + escapedName + '\')">Reinstate</button>'
            : '<button class="co-btn" style="padding:6px 12px;background:#1F2937;color:#fff;font-size:12px;" onclick="adminSuspendMerchant(\'' + m.id + '\', \'' + escapedName + '\')"><i class="fas fa-ban"></i> Suspend Store</button>') +
          '</div></div>';
      }).join('');

  body.innerHTML = '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml() +
    '<h3 style="margin:0 0 8px;font-size:14px;">Merchants</h3>' + searchBar + filterBar + rows;
}

async function adminSetMerchantVerified(merchantId, verified) {
  const { error } = await supabase.from('merchants').update({ is_verified: verified }).eq('id', merchantId);
  if (error) { showToast('Could not update: ' + error.message, 'error'); return; }
  showToast(verified ? 'Merchant verified \u2705' : 'Verification revoked', 'info');
  renderAdminMerchants();
}

// Suspends a merchant's store — hides their products from the storefront
// and blocks new listings, without deleting their real order history
// (which would break every past order's product references). //
async function adminSuspendMerchant(merchantId, storeName) {
  var reason = prompt('Reason for suspending "' + storeName + '"? (shown in admin logs, required)');
  if (!reason || !reason.trim()) { showToast('A reason is required to suspend a store', 'info'); return; }

  const { error } = await supabase.from('merchants').update({
    is_suspended: true, suspended_reason: reason.trim(), suspended_at: new Date().toISOString()
  }).eq('id', merchantId);
  if (error) { showToast('Could not suspend: ' + error.message, 'error'); return; }

  showToast('Store suspended \u2705');
  renderAdminMerchants();
}

async function adminReinstateMerchant(merchantId, storeName) {
  if (!confirm('Reinstate "' + storeName + '"? Their products will become visible again.')) return;

  const { error } = await supabase.from('merchants').update({
    is_suspended: false, suspended_reason: null, suspended_at: null
  }).eq('id', merchantId);
  if (error) { showToast('Could not reinstate: ' + error.message, 'error'); return; }

  showToast('Store reinstated \u2705');
  renderAdminMerchants();
}

let adminRiderSearch = '';

async function renderAdminRiders() {
  var body = document.getElementById('sn-admin-body');
  const { data: riders, error } = await supabase.from('riders').select('*').order('created_at', { ascending: false });

  var riderUserIds = (riders || []).map(function(r) { return r.user_id; });
  var riderEmailById = {};
  var riderNameById = {};
  if (riderUserIds.length) {
    const { data: rProfiles } = await supabase.from('profiles').select('id, email, full_name').in('id', riderUserIds);
    (rProfiles || []).forEach(function(p) { riderEmailById[p.id] = p.email; riderNameById[p.id] = p.full_name; });
  }

  var shownRiders = riders || [];
  if (adminRiderSearch.trim()) {
    var rq = adminRiderSearch.trim().toLowerCase();
    shownRiders = shownRiders.filter(function(r) {
      return (riderNameById[r.user_id] || '').toLowerCase().indexOf(rq) !== -1 ||
        (r.plate_number || '').toLowerCase().indexOf(rq) !== -1 ||
        (riderEmailById[r.user_id] || '').toLowerCase().indexOf(rq) !== -1;
    });
  }

  var searchBar = '<input type="text" placeholder="Search by name, plate, or email..." value="' + adminRiderSearch.replace(/"/g, '&quot;') + '" ' +
    'oninput="adminRiderSearch=this.value; renderAdminRiders();" ' +
    'style="width:100%;padding:9px 14px;border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:10px;"/>';

  var rows = (error || !shownRiders.length)
    ? '<p style="color:#999;font-size:13px;">' + (adminRiderSearch.trim() ? 'No riders match your search.' : 'No riders yet.') + '</p>'
    : shownRiders.map(function(r) {
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
          '<span style="font-weight:700;font-size:13px;">' + (riderNameById[r.user_id] || capitalize(r.vehicle_type)) + '</span>' +
          '<span style="font-size:11px;color:' + (r.is_available ? '#15803D' : '#999') + ';">' + (r.is_available ? 'Online' : 'Offline') + '</span>' +
          '</div>' +
          '<p style="margin:2px 0 0;font-size:11.5px;color:#999;">' + capitalize(r.vehicle_type) + (r.plate_number ? ' \u2022 ' + r.plate_number : '') + ' \u2022 ' + (riderEmailById[r.user_id] || 'No email on file') + '</p>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#777;">' +
          (r.rating_count > 0 ? r.rating_avg + ' \u2605 (' + r.rating_count + ')' : 'No ratings yet') +
          (r.rejection_penalty > 0 ? ' \u2022 <span style="color:#DC2626;">-' + r.rejection_penalty.toFixed(1) + ' penalty</span>' : '') +
          '</p>' +
          (r.license_path
            ? '<button class="co-btn" style="padding:6px 12px;background:#F3F4F6;color:#333;font-size:12px;margin-top:8px;" onclick="adminViewRiderLicense(\'' + r.user_id + '\')">View License</button>'
            : '<span style="font-size:11.5px;color:#aaa;">No license uploaded</span>') +
          '</div>';
      }).join('');

  body.innerHTML = '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml() +
    '<h3 style="margin:0 0 8px;font-size:14px;">All Riders (' + (riders ? riders.length : 0) + ')</h3>' + searchBar + rows;
}

let adminReportFilter = 'pending'; // 'pending' | 'all'

async function renderAdminReports() {
  var body = document.getElementById('sn-admin-body');
  var header = '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml();

  const { data: allReports, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  var reports = allReports || [];
  var shown = adminReportFilter === 'pending' ? reports.filter(function(r) { return r.status === 'pending'; }) : reports;

  // Reporter names aren't directly joinable, fetch separately //
  var reporterIds = Array.from(new Set(shown.map(function(r) { return r.reporter_id; }).filter(Boolean)));
  var nameById = {};
  if (reporterIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', reporterIds);
    (profiles || []).forEach(function(p) { nameById[p.id] = p.full_name; });
  }

  var pendingCount = reports.filter(function(r) { return r.status === 'pending'; }).length;
  var filterBar = '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    '<button class="co-btn" style="flex:1;background:' + (adminReportFilter === 'pending' ? '#DC2626' : '#F3F4F6') + ';color:' + (adminReportFilter === 'pending' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminReportFilter=\'pending\'; renderAdminReports();">Pending (' + pendingCount + ')</button>' +
    '<button class="co-btn" style="flex:1;background:' + (adminReportFilter === 'all' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (adminReportFilter === 'all' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminReportFilter=\'all\'; renderAdminReports();">All (' + reports.length + ')</button>' +
    '</div>';

  var typeIcon = { merchant: 'fa-store', rider: 'fa-motorcycle', customer: 'fa-user' };
  var statusColor = { pending: '#B45309', reviewed: '#15803D', dismissed: '#999' };

  var rows = shown.length
    ? shown.map(function(r) {
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
          '<span style="font-weight:700;font-size:13px;"><i class="fas ' + (typeIcon[r.reported_type] || 'fa-flag') + '"></i> ' + (r.reported_name || 'Unknown') + '</span>' +
          '<span style="font-size:11px;color:' + (statusColor[r.status] || '#999') + ';font-weight:700;text-transform:uppercase;">' + r.status + '</span>' +
          '</div>' +
          '<p style="margin:4px 0 0;font-size:12.5px;color:#DC2626;font-weight:600;">' + r.reason + '</p>' +
          (r.details ? '<p style="margin:4px 0 0;font-size:12.5px;color:#666;">"' + r.details + '"</p>' : '') +
          '<p style="margin:6px 0 0;font-size:11.5px;color:#999;">Reported by ' + (nameById[r.reporter_id] || 'Unknown') + ' \u2022 ' + formatDate(r.created_at) + (r.order_id ? ' \u2022 Order-linked' : '') + '</p>' +
          (r.status === 'pending'
            ? '<div style="display:flex;gap:6px;margin-top:8px;">' +
              '<button class="co-btn" style="padding:6px 12px;background:#F0FFF4;color:#15803D;font-size:12px;" onclick="adminUpdateReportStatus(\'' + r.id + '\', \'reviewed\')">Mark Reviewed</button>' +
              '<button class="co-btn" style="padding:6px 12px;background:#F3F4F6;color:#333;font-size:12px;" onclick="adminUpdateReportStatus(\'' + r.id + '\', \'dismissed\')">Dismiss</button>' +
              '</div>'
            : '') +
          (r.order_id
            ? '<a href="#" onclick="adminViewReportedConversation(\'' + r.order_id + '\', \'' + (r.reported_name || 'this report').replace(/'/g, "\\'") + '\'); return false;" style="display:inline-block;margin-top:8px;font-size:11.5px;color:#3B82F6;text-decoration:underline;"><i class="fas fa-comments"></i> View Conversation</a>'
            : '') +
          '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">' + (adminReportFilter === 'pending' ? 'No pending reports.' : 'No reports yet.') + '</p>';

  body.innerHTML = header + '<h3 style="margin:0 0 8px;font-size:14px;">Reports</h3>' + filterBar + rows;
}

// Admin views the message history for a reported order — RLS only allows
// this because a report referencing that order_id exists; there is no
// general admin access to messages otherwise. Read-only, no composer. //
async function adminViewReportedConversation(orderId, reportedName) {
  document.getElementById('sn-chatOverlay').classList.add('active');
  document.getElementById('sn-chatModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('sn-chat-header').innerHTML =
    '<button class="chat-back-btn" onclick="closeChatModal()"><i class="fas fa-arrow-left"></i></button>' +
    '<div class="chat-header-title" style="flex:1;"><h3>Conversation Log</h3><p>Re: ' + reportedName + '</p></div>' +
    chatCloseBtnHtml();
  document.getElementById('sn-chat-composer').style.display = 'none';

  var scrollEl = document.getElementById('sn-chat-scroll');
  scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading conversation...</p></div>';

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-lock"></i><p>Could not load this conversation: ' + error.message + '</p></div>';
    return;
  }
  if (!msgs || !msgs.length) {
    scrollEl.innerHTML = '<div class="chat-empty"><i class="fas fa-comment-slash"></i><p>No messages were exchanged for this order.</p></div>';
    return;
  }

  var senderIds = Array.from(new Set(msgs.map(function(m) { return m.sender_id; })));
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
  var nameById = {};
  (profiles || []).forEach(function(p) { nameById[p.id] = p.full_name || 'HomeWeb User'; });

  scrollEl.innerHTML = '<div style="background:#FFFBEB;color:#92400E;font-size:11.5px;padding:8px 10px;border-radius:8px;margin-bottom:10px;"><i class="fas fa-shield-halved"></i> Admin view \u2014 visible only because a report references this order.</div>' +
    msgs.map(function(m) {
      return '<div class="chat-bubble-row" style="justify-content:flex-start;">' +
        '<div class="chat-bubble" style="background:#F3F4F6;color:#333;max-width:85%;">' +
        '<p style="margin:0 0 3px;font-size:10.5px;font-weight:700;color:#666;">' + (nameById[m.sender_id] || 'Unknown') + '</p>' +
        m.body.replace(/</g, '&lt;') +
        '<p style="margin:3px 0 0;font-size:10px;opacity:0.6;">' + formatDate(m.created_at) + '</p>' +
        '</div></div>';
    }).join('');
}

async function adminUpdateReportStatus(reportId, status) {
  const { error } = await supabase.from('reports').update({ status: status }).eq('id', reportId);
  if (error) { showToast('Could not update report: ' + error.message, 'error'); return; }
  showToast('Report marked as ' + status, 'info');
  renderAdminReports();
}

async function adminViewRiderLicense(riderUserId) {
  const { data: riderRow } = await supabase.from('riders').select('license_path').eq('user_id', riderUserId).single();
  if (!riderRow || !riderRow.license_path) { showToast('No license on file', 'info'); return; }

  const { data, error } = await supabase.storage.from('rider-docs').createSignedUrl(riderRow.license_path, 300);
  if (error || !data) { showToast('Could not open license: ' + (error ? error.message : 'unknown error'), 'error'); return; }
  window.open(data.signedUrl, '_blank');
}

let adminCustomerSearch = '';

async function renderAdminCustomers() {
  var body = document.getElementById('sn-admin-body');
  var header = '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml();

  const { data: customerRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'customer');
  var userIds = (customerRoles || []).map(function(r) { return r.user_id; });

  if (!userIds.length) {
    body.innerHTML = header + '<h3 style="margin:0 0 8px;font-size:14px;">Customers</h3><p style="color:#999;font-size:13px;">No customers yet.</p>';
    return;
  }

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, phone, created_at, is_suspended, suspended_reason').in('id', userIds);
  const { data: orders } = await supabase.from('orders').select('user_id, total, status').in('user_id', userIds);

  var statsById = {};
  (orders || []).forEach(function(o) {
    if (!statsById[o.user_id]) statsById[o.user_id] = { count: 0, total: 0, disputes: 0 };
    statsById[o.user_id].count++;
    statsById[o.user_id].total += o.total;
  });

  var shownProfiles = profiles || [];
  if (adminCustomerSearch.trim()) {
    var cq = adminCustomerSearch.trim().toLowerCase();
    shownProfiles = shownProfiles.filter(function(p) {
      return (p.full_name || '').toLowerCase().indexOf(cq) !== -1 || (p.email || '').toLowerCase().indexOf(cq) !== -1;
    });
  }

  var searchBar = '<input type="text" placeholder="Search by name or email..." value="' + adminCustomerSearch.replace(/"/g, '&quot;') + '" ' +
    'oninput="adminCustomerSearch=this.value; renderAdminCustomers();" ' +
    'style="width:100%;padding:9px 14px;border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:10px;"/>';

  var rows = shownProfiles.length ? shownProfiles
    .sort(function(a, b) { return ((statsById[b.id] && statsById[b.id].total) || 0) - ((statsById[a.id] && statsById[a.id].total) || 0); })
    .map(function(p) {
      var s = statsById[p.id] || { count: 0, total: 0 };
      return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;font-family:var(--font, system-ui, sans-serif);' + (p.is_suspended ? 'opacity:0.65;' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
        '<p style="margin:0;font-weight:700;font-size:13px;">' + (p.full_name || 'Unnamed Customer') + (p.is_suspended ? ' <span style="color:#DC2626;font-size:10.5px;font-weight:700;">SUSPENDED</span>' : '') + '</p>' +
        '<p style="margin:2px 0 0;font-size:12px;color:#777;">' + (p.email || 'No email on file') + '</p>' +
        '<p style="margin:2px 0 0;font-size:12px;color:#777;">' + (p.phone || 'No phone on file') + ' \u2022 Joined ' + formatDate(p.created_at) + '</p>' +
        (p.is_suspended && p.suspended_reason ? '<p style="margin:4px 0 0;font-size:11px;color:#DC2626;">' + p.suspended_reason + '</p>' : '') +
        '</div>' +
        '<div style="text-align:right;">' +
        '<p style="margin:0;font-weight:700;font-size:13px;">' + fmt(s.total) + '</p>' +
        '<p style="margin:2px 0 0;font-size:11.5px;color:#999;">' + s.count + ' order' + (s.count === 1 ? '' : 's') + '</p>' +
        '</div></div>';
    }).join('') : '<p style="color:#999;font-size:13px;">No customers match your search.</p>';

  body.innerHTML = header + '<h3 style="margin:0 0 8px;font-size:14px;">Customers (' + (profiles || []).length + ')</h3>' +
    searchBar + rows;
}

let adminOrderFilter = 'all'; // 'all' | 'disputed'
let adminOrderDateFilter = 'all'; // 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all'

function orderMatchesDateFilter(order, filter) {
  if (filter === 'all') return true;
  var created = new Date(order.created_at);
  var now = new Date();
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') return created >= startOfToday;
  if (filter === 'yesterday') {
    var startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    return created >= startOfYesterday && created < startOfToday;
  }
  if (filter === 'week') return (now - created) <= 7 * 24 * 60 * 60 * 1000;
  if (filter === 'month') return (now - created) <= 30 * 24 * 60 * 60 * 1000;
  if (filter === 'year') return (now - created) <= 365 * 24 * 60 * 60 * 1000;
  return true;
}

async function renderAdminOrders() {
  var body = document.getElementById('sn-admin-body');
  var header = '<h2 style="margin:0 0 4px;"><i class="fas fa-user-shield"></i> Admin</h2>' + adminTabsHtml();

  const { data: allOrders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(150);
  var orders = allOrders || [];

  var disputedCount = orders.filter(function(o) { return o.not_arrived_reported_at; }).length;
  var shown = adminOrderFilter === 'disputed' ? orders.filter(function(o) { return o.not_arrived_reported_at; }) : orders;
  shown = shown.filter(function(o) { return orderMatchesDateFilter(o, adminOrderDateFilter); });

  // Names aren't directly joinable (sibling FKs to auth.users), fetch separately //
  var userIds = Array.from(new Set(shown.map(function(o) { return o.user_id; }).filter(Boolean)));
  var riderIds = Array.from(new Set(shown.map(function(o) { return o.rider_user_id; }).filter(Boolean)));
  var allIds = Array.from(new Set(userIds.concat(riderIds)));
  var nameById = {};
  if (allIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', allIds);
    (profiles || []).forEach(function(p) { nameById[p.id] = p.full_name; });
  }

  var dateOptions = [
    ['all', 'All Time'], ['today', 'Today'], ['yesterday', 'Yesterday'],
    ['week', 'Within a Week'], ['month', 'Within a Month'], ['year', 'Within a Year']
  ].map(function(d) { return '<option value="' + d[0] + '"' + (adminOrderDateFilter === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('');

  var filterBar = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (adminOrderFilter === 'all' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (adminOrderFilter === 'all' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminOrderFilter=\'all\'; renderAdminOrders();">All (' + orders.length + ')</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (adminOrderFilter === 'disputed' ? '#DC2626' : '#F3F4F6') + ';color:' + (adminOrderFilter === 'disputed' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="adminOrderFilter=\'disputed\'; renderAdminOrders();">Disputed (' + disputedCount + ')</button>' +
    '<select onchange="adminOrderDateFilter=this.value; renderAdminOrders();" style="padding:6px 10px;border-radius:8px;border:1px solid #e5e5e5;font-size:12.5px;">' + dateOptions + '</select>' +
    '</div>';

  var rows = shown.length
    ? shown.map(function(o) {
        var statusInfo = getOrderStatusInfo(o.status);
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
          '<span style="font-weight:700;font-size:13px;">Order #' + o.order_code + '</span>' +
          '<span style="font-weight:700;font-size:13px;">' + fmt(o.total) + '</span></div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#777;">' + statusInfo.label + ' \u2022 ' + (o.payment_method === 'cod' ? 'COD' : 'GCash') + ' \u2022 ' + formatDate(o.created_at) + '</p>' +
          '<p style="margin:2px 0 0;font-size:12px;color:#777;"><i class="fas fa-user"></i> ' + (nameById[o.user_id] || 'Customer') +
          (o.rider_user_id ? ' \u2022 <i class="fas fa-motorcycle"></i> ' + (nameById[o.rider_user_id] || o.rider_name || 'Rider') : '') + '</p>' +
          (o.not_arrived_reported_at
            ? '<p style="margin:6px 0 0;background:#FEE2E2;color:#DC2626;padding:6px 8px;border-radius:6px;font-size:11.5px;font-weight:600;"><i class="fas fa-exclamation-triangle"></i> Customer reported non-delivery</p>' +
              (o.proof_of_delivery_url
                ? '<a href="' + o.proof_of_delivery_url + '" target="_blank" class="co-btn" style="display:inline-block;background:#F3F4F6;color:#333;font-size:12px;padding:6px 12px;margin-top:8px;text-decoration:none;"><i class="fas fa-camera"></i> View Delivery Photo</a>'
                : '<p style="margin:6px 0 0;font-size:11px;color:#999;">No delivery photo on file for this order.</p>') +
              '<button class="co-btn" style="background:#F0FFF4;color:#15803D;font-size:12px;padding:6px 12px;margin-top:8px;" onclick="adminResolveDispute(\'' + o.id + '\', \'' + o.order_code + '\')">Mark Resolved \u2014 Delivered</button>'
            : '') +
          '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">' + (adminOrderFilter === 'disputed' ? 'No disputed orders.' : 'No orders yet.') + '</p>';

  body.innerHTML = header + '<h3 style="margin:0 0 8px;font-size:14px;">Orders (last 150)</h3>' + filterBar + rows;
}

// Admin resolution — for disputes the customer doesn't or can't retract
// themselves (e.g. the rider confirms delivery happened, investigation
// resolves it another way). Requires the "Admin can update all orders"
// policy, since admin has never had order-write access before this. //
async function adminResolveDispute(orderId, orderCode) {
  if (!confirm('Mark Order #' + orderCode + ' as resolved and delivered? This clears the dispute and finalizes the order.')) return;

  const { error } = await supabase.from('orders').update({
    status: 'delivered', not_arrived_reported_at: null, updated_at: new Date().toISOString()
  }).eq('id', orderId);

  if (error) { showToast('Could not resolve: ' + error.message, 'error'); return; }

  await supabase.from('order_status_history').insert({
    order_id: orderId, status: 'delivered',
    label: 'Delivery Confirmed \u2014 Resolved by Admin',
    description: 'An admin reviewed this dispute and confirmed the order as delivered.'
  });

  showToast('Order marked resolved \u2705');
  renderAdminOrders();
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  userRoles = [];
  activeRole = 'customer';
  stopRiderAlertPolling();
  updateAuthUI();
  showToast('Logged out', 'info');
}

// ============================================================
// SIGNUP MODAL
// ============================================================

let signupRole = 'customer';
let signupMerchantType = 'permanent';
let signupOpenDays = [2, 3, 5];

function merchantTypeCardHtml(type, icon, label, sub) {
  var active = signupMerchantType === type;
  return '<div onclick="selectMerchantType(\'' + type + '\')" ' +
    'style="flex:1;text-align:center;padding:12px 6px;border-radius:10px;cursor:pointer;user-select:none;' +
    'border:2px solid ' + (active ? 'var(--primary,#22C55E)' : '#e5e5e5') + ';' +
    'background:' + (active ? '#F0FFF4' : '#fff') + ';">' +
    '<i class="fas ' + icon + '" style="font-size:17px;color:' + (active ? 'var(--primary,#22C55E)' : '#999') + ';"></i>' +
    '<p style="margin:5px 0 0;font-size:12.5px;font-weight:' + (active ? '700' : '500') + ';color:' + (active ? '#111' : '#777') + ';">' + label + '</p>' +
    '<p style="margin:2px 0 0;font-size:10.5px;color:#999;">' + sub + '</p>' +
    '</div>';
}

function selectMerchantType(type) {
  var keep = {
    name: getVal('signup-name'), email: getVal('signup-email'),
    pass: getVal('signup-password'), pass2: getVal('signup-password2'),
    store: getVal('signup-store-name'), biz: getVal('signup-business-type')
  };
  signupMerchantType = type;
  renderSignupForm();
  setVal('signup-name', keep.name); setVal('signup-email', keep.email);
  setVal('signup-password', keep.pass); setVal('signup-password2', keep.pass2);
  setVal('signup-store-name', keep.store); setVal('signup-business-type', keep.biz);
}

function toggleSignupDay(dayIndex) {
  var i = signupOpenDays.indexOf(dayIndex);
  if (i === -1) signupOpenDays.push(dayIndex); else signupOpenDays.splice(i, 1);

  var keep = {
    name: getVal('signup-name'), email: getVal('signup-email'),
    pass: getVal('signup-password'), pass2: getVal('signup-password2'),
    store: getVal('signup-store-name'), biz: getVal('signup-business-type')
  };
  renderSignupForm();
  setVal('signup-name', keep.name); setVal('signup-email', keep.email);
  setVal('signup-password', keep.pass); setVal('signup-password2', keep.pass2);
  setVal('signup-store-name', keep.store); setVal('signup-business-type', keep.biz);
}

var BUSINESS_TYPES = [
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'meat', label: 'Meat' },
  { value: 'seafood', label: 'Sea Food' },
  { value: 'sarisari', label: 'Sari-sari Store' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'other', label: 'Other' }
];

var VEHICLE_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'tricycle', label: 'Tricycle' },
  { value: 'bicycle', label: 'Bicycle' }
];

function getVal(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}
function setVal(id, val) {
  var el = document.getElementById(id);
  if (el && val) el.value = val;
}

function openSignupModal(e) {
  if (e) e.preventDefault();
  if (currentUser) return;

  signupRole = 'customer';
  renderSignupForm();

  document.getElementById('sn-signupOverlay').classList.add('active');
  document.getElementById('sn-signupModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSignupModal() {
  document.getElementById('sn-signupOverlay').classList.remove('active');
  document.getElementById('sn-signupModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Switch the role selector without losing what's already typed //
function selectSignupRole(role) {
  var name = getVal('signup-name'), email = getVal('signup-email'),
      pass = getVal('signup-password'), pass2 = getVal('signup-password2');
  signupRole = role;
  renderSignupForm();
  setVal('signup-name', name); setVal('signup-email', email);
  setVal('signup-password', pass); setVal('signup-password2', pass2);
}

function roleCardHtml(role, icon, label) {
  var active = signupRole === role;
  return '<div class="signup-role-card" onclick="selectSignupRole(\'' + role + '\')" ' +
    'style="flex:1;text-align:center;padding:14px 6px;border-radius:10px;cursor:pointer;' +
    'border:2px solid ' + (active ? 'var(--primary,#22C55E)' : '#e5e5e5') + ';' +
    'background:' + (active ? '#F0FFF4' : '#fff') + ';">' +
    '<i class="fas ' + icon + '" style="font-size:20px;color:' + (active ? 'var(--primary,#22C55E)' : '#999') + ';"></i>' +
    '<p style="margin:6px 0 0;font-size:12.5px;font-weight:' + (active ? '700' : '500') + ';color:' + (active ? '#111' : '#777') + ';">' + label + '</p>' +
    '</div>';
}

function renderSignupForm() {
  var body = document.getElementById('sn-signup-body');
  if (!body) return;

  var roleCards = '<div style="display:flex;gap:10px;margin-bottom:18px;">' +
    roleCardHtml('customer', 'fa-user', 'Customer') +
    roleCardHtml('merchant', 'fa-store', 'Merchant') +
    roleCardHtml('rider', 'fa-motorcycle', 'Rider') +
    '</div>';

  var roleFields = '';
  if (signupRole === 'merchant') {
    roleFields =
      '<div class="co-field"><label>Store Name <span class="co-required">*</span></label>' +
      '<input type="text" id="signup-store-name" placeholder="e.g. Aling Nena\'s Vegetable Stall"/>' +
      '<span class="co-field-error">Store name is required</span></div>' +
      '<div class="co-field"><label>Business Classification <span class="co-required">*</span></label>' +
      '<select id="signup-business-type">' +
      BUSINESS_TYPES.map(function(b) { return '<option value="' + b.value + '">' + b.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="co-field"><label>Merchant Type <span class="co-required">*</span></label>' +
      '<div style="display:flex;gap:10px;">' +
      merchantTypeCardHtml('permanent', 'fa-shop', 'Permanent', 'Open 7 days a week') +
      merchantTypeCardHtml('bolanteros', 'fa-calendar-days', 'Bolanteros', 'Open on selected days') +
      '</div></div>' +
      (signupMerchantType === 'bolanteros'
        ? '<div class="co-field"><label>Open Days <span class="co-required">*</span></label>' +
          '<div id="signup-open-days" style="display:flex;gap:6px;flex-wrap:wrap;">' +
          DAY_SHORT.map(function(d, i) {
            var on = signupOpenDays.indexOf(i) !== -1;
            return '<span onclick="toggleSignupDay(' + i + ')" style="cursor:pointer;user-select:none;padding:7px 11px;border-radius:8px;font-size:12px;font-weight:600;' +
              'border:2px solid ' + (on ? 'var(--primary,#22C55E)' : '#e5e5e5') + ';' +
              'background:' + (on ? '#F0FFF4' : '#fff') + ';color:' + (on ? '#15803D' : '#888') + ';">' + d + '</span>';
          }).join('') +
          '</div>' +
          '<span class="co-field-error">Pick at least one open day</span></div>'
        : '');
  } else if (signupRole === 'rider') {
    roleFields =
      '<div class="co-field"><label>Vehicle Type <span class="co-required">*</span></label>' +
      '<select id="signup-vehicle-type">' +
      VEHICLE_TYPES.map(function(v) { return '<option value="' + v.value + '">' + v.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="co-field"><label>Plate Number <span class="co-required">*</span></label>' +
      '<input type="text" id="signup-plate-number" placeholder="e.g. NBC 1234"/>' +
      '<span class="co-field-error">Plate number is required</span></div>';
  }

  body.innerHTML =
    '<div class="login-icon"><i class="fas fa-user-plus"></i></div>' +
    '<h2>Create Your Account</h2>' +
    '<p class="login-sub">Choose how you\'ll use HomeWeb</p>' +
    roleCards +
    '<div class="co-field"><label>Full Name <span class="co-required">*</span></label>' +
    '<input type="text" id="signup-name" placeholder="Juan Dela Cruz"/>' +
    '<span class="co-field-error">Full name is required</span></div>' +
    '<div class="co-field"><label>Email <span class="co-required">*</span></label>' +
    '<input type="email" id="signup-email" placeholder="you@example.com"/>' +
    '<span class="co-field-error">Enter a valid email address</span></div>' +
    '<div class="co-field"><label>Password <span class="co-required">*</span></label>' +
    '<input type="password" id="signup-password" placeholder="At least 6 characters"/>' +
    '<span class="co-field-error">Password must be at least 6 characters</span></div>' +
    '<div class="co-field"><label>Confirm Password <span class="co-required">*</span></label>' +
    '<input type="password" id="signup-password2" placeholder="Re-enter your password"/>' +
    '<span class="co-field-error">Passwords do not match</span></div>' +
    roleFields +
    '<button class="co-btn co-btn--next login-submit" id="signup-submit-btn" onclick="submitSignup()">Sign Up <i class="fas fa-arrow-right"></i></button>' +
    '<p class="login-signup">Already have an account? <a href="#" onclick="closeSignupModal(); openLoginModal(event); return false;">Log In</a></p>';

  ['signup-name', 'signup-email', 'signup-password', 'signup-password2', 'signup-store-name', 'signup-plate-number'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.closest('.co-field').classList.remove('co-field--error');
    });
    el.addEventListener('keydown', function(e2) { if (e2.key === 'Enter') submitSignup(); });
  });
}

function validateSignupForm() {
  const nameEl = document.getElementById('signup-name');
  const emailEl = document.getElementById('signup-email');
  const passEl = document.getElementById('signup-password');
  const pass2El = document.getElementById('signup-password2');
  let isValid = true;
  let firstInvalidEl = null;

  function markError(el, ok) {
    const field = el.closest('.co-field');
    if (!ok) {
      isValid = false;
      field.classList.add('co-field--error');
      firstInvalidEl = firstInvalidEl || el;
    } else {
      field.classList.remove('co-field--error');
    }
  }

  markError(nameEl, nameEl.value.trim().length > 0);
  markError(emailEl, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim()));
  markError(passEl, passEl.value.length >= 6);
  markError(pass2El, pass2El.value === passEl.value && pass2El.value.length >= 6);

  if (signupRole === 'merchant') {
    var storeNameEl = document.getElementById('signup-store-name');
    markError(storeNameEl, storeNameEl.value.trim().length > 0);
    if (signupMerchantType === 'bolanteros' && !signupOpenDays.length) {
      isValid = false;
      var daysField = document.getElementById('signup-open-days');
      if (daysField) daysField.closest('.co-field').classList.add('co-field--error');
      showToast('Bolanteros stores need at least one open day', 'info');
    }
  } else if (signupRole === 'rider') {
    var plateEl = document.getElementById('signup-plate-number');
    markError(plateEl, plateEl.value.trim().length > 0);
  }

  if (firstInvalidEl) firstInvalidEl.focus();
  return isValid;
}

async function submitSignup() {
  if (!validateSignupForm()) {
    showToast('Please fix the errors below', 'info');
    return;
  }

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  var metadata = { full_name: name, role: signupRole };
  if (signupRole === 'merchant') {
    metadata.store_name = document.getElementById('signup-store-name').value.trim();
    metadata.business_type = document.getElementById('signup-business-type').value;
    metadata.merchant_type = signupMerchantType;
    metadata.open_days = signupMerchantType === 'bolanteros'
      ? signupOpenDays.slice().sort(function(a, b) { return a - b; })
      : [0, 1, 2, 3, 4, 5, 6];
  } else if (signupRole === 'rider') {
    metadata.vehicle_type = document.getElementById('signup-vehicle-type').value;
    metadata.plate_number = document.getElementById('signup-plate-number').value.trim();
  }

  const btn = document.getElementById('signup-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: { data: metadata }
  });

  if (btn) { btn.disabled = false; btn.innerHTML = 'Sign Up <i class="fas fa-arrow-right"></i>'; }

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  if (data.session) {
    currentUser = data.user;
    closeSignupModal();
    await fetchUserRoles();
    updateAuthUI();
    showToast('Account created! Welcome, ' + name.split(' ')[0] + '!');
  } else {
    closeSignupModal();
    showToast('Account created! Please check your email to confirm.', 'info');
  }
}

// Restore session on page load (so refreshing doesn't log the user out) //
async function restoreSession() {
  // Check for an existing session on load — this can safely happen
  // after the listener above is already subscribed. //
  const { data } = await supabase.auth.getSession();
  if (data.session && !pendingPasswordRecovery) {
    currentUser = data.session.user;
    await fetchUserRoles();
    updateAuthUI();
    updateNotifBadge();
    updateChatBadge();
    startRiderAlertPolling();
  }
}

// ============================================================
// ACCOUNT ROLES (customer / merchant / rider) & switching
// ============================================================

var ROLE_LABELS = { customer: 'Customer', merchant: 'Merchant', rider: 'Rider' };
var ROLE_ICONS = { customer: 'fa-user', merchant: 'fa-store', rider: 'fa-motorcycle' };

function activeRoleKey() {
  return currentUser ? ('homeweb_active_role_' + currentUser.id) : null;
}

async function fetchUserRoles() {
  if (!currentUser) { userRoles = []; return; }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id);

  if (error || !data) { userRoles = ['customer']; return; }

  userRoles = data.map(function(r) { return r.role; });
  if (!userRoles.length) userRoles = ['customer'];

  var savedRole = localStorage.getItem(activeRoleKey());
  activeRole = (savedRole && userRoles.indexOf(savedRole) !== -1) ? savedRole : userRoles[0];
}

function switchActiveRole(role) {
  if (userRoles.indexOf(role) === -1) return;
  activeRole = role;
  localStorage.setItem(activeRoleKey(), role);
  showToast('Switched to ' + ROLE_LABELS[role] + ' account \uD83D\uDD04');
  updateNotifBadge();
  if (document.getElementById('sn-profileModal').classList.contains('active')) {
    openProfileModal();
  }
}

// Register an additional role (merchant or rider) on the existing account //
async function addAccountRole(role) {
  if (userRoles.indexOf(role) !== -1) {
    showToast('You already have a ' + ROLE_LABELS[role] + ' account', 'info');
    return;
  }

  if (role === 'merchant') {
    var storeName = prompt('Store name:');
    if (!storeName) return;
    var businessType = prompt('Business classification (vegetable, meat, seafood, sarisari, drinks, other):', 'other') || 'other';

    const { error: merchErr } = await supabase.from('merchants').insert({
      user_id: currentUser.id, store_name: storeName, business_type: businessType
    });
    if (merchErr) { showToast('Could not create merchant account: ' + merchErr.message, 'error'); return; }

  } else if (role === 'rider') {
    var vehicle = prompt('Vehicle type (motorcycle, tricycle, bicycle):', 'motorcycle') || 'motorcycle';
    var plate = prompt('Plate number:');
    if (!plate) return;

    const { error: riderErr } = await supabase.from('riders').insert({
      user_id: currentUser.id, vehicle_type: vehicle, plate_number: plate
    });
    if (riderErr) { showToast('Could not create rider account: ' + riderErr.message, 'error'); return; }
  }

  await supabase.from('user_roles').insert({ user_id: currentUser.id, role: role }).select();
  await fetchUserRoles();
  switchActiveRole(role);
  if (role === 'rider') startRiderAlertPolling();
  showToast(ROLE_LABELS[role] + ' account added \u2705');
  openProfileModal();
}


// Update topbar login link //
function updateAuthUI() {
  document.querySelectorAll('.sn-login-link').forEach(function(link) {
    if (currentUser) {
      link.innerHTML = '<i class="fas fa-user-check"></i> ' + currentUser.email.split('@')[0];
      link.onclick = function(e) { e.preventDefault(); openProfileModal(e); };
    } else {
      link.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
      link.onclick = function(e) { e.preventDefault(); openLoginModal(e); };
    }
  });

  document.querySelectorAll('.sn-signup-link').forEach(function(link) {
    link.style.display = currentUser ? 'none' : '';
  });
}

function initLoginModal() {
  updateAuthUI();

  ['login-email', 'login-password'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.closest('.co-field').classList.remove('co-field--error');
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitLogin();
    });
  });

  ['signup-name', 'signup-email', 'signup-password', 'signup-password2'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.closest('.co-field').classList.remove('co-field--error');
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitSignup();
    });
  });
}

// INJECT MODAL HTML //
function injectModals() {
  var html =
    // Toast notification
    '<div id="sn-toast" class="sn-toast"></div>' +

    // Overlay pra sa product modal
    '<div id="sn-overlay" class="sn-overlay" onclick="closeProductModal()"></div>' +

    // Product modal
    '<div id="sn-productModal" class="sn-product-modal">' +
    '<button class="pm-close" onclick="closeProductModal()"><i class="fas fa-times"></i></button>' +
    '<div class="pm-body">' +
    '<div class="pm-icon"><i class="fas fa-box"></i></div>' +
    '<div class="pm-details">' +
    '<p class="pm-name"></p>' +
    '<div class="pm-stars"></div>' +
    '<div class="pm-prices">' +
    '<span class="pm-price-now"></span>' +
    '<span class="pm-price-old"></span>' +
    '<span class="pm-discount"></span>' +
    '<span class="pm-unit" style="color:#999;font-size:12.5px;font-weight:400;"></span>' +
    '</div>' +
    '<p class="pm-location"></p>' +
    '<p class="pm-stock"></p>' +
    '<div class="pm-qty">' +
    '<span>Quantity:</span>' +
    '<button onclick="changeQty(-1)">&#8722;</button>' +
    '<input type="number" class="pm-qty-val" value="1" min="1" step="1" ' +
    'style="width:52px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:4px 2px;font-size:14px;" ' +
    'onchange="setQtyDirect(this.value)" onclick="this.select()"/>' +
    '<button onclick="changeQty(1)">+</button>' +
    '</div>' +
    '<div class="pm-actions">' +
    '<button class="pm-btn pm-btn--cart" onclick="addToCart(false)"><i class="fas fa-cart-plus"></i> Add to Cart</button>' +
    '<button class="pm-btn pm-btn--buy" onclick="addToCart(true)"><i class="fas fa-bolt"></i> Buy Now</button>' +
    '</div>' +
    '<div class="pm-reviews" id="pm-reviews" style="grid-column:1/-1;margin-top:16px;padding-top:16px;border-top:1px solid #eee;"></div>' +
    '</div></div></div>' +

    // Checkout overlay + modal
    '<div id="sn-coOverlay" class="sn-overlay" onclick="closeCheckout()"></div>' +
    '<div id="sn-checkoutModal" class="sn-checkout-modal"></div>' +

    // Success overlay + modal
    '<div id="sn-successOverlay" class="sn-overlay"></div>' +
    '<div id="sn-successModal" class="sn-success-modal">' +
    '<div class="success-icon"><i class="fas fa-check-circle"></i></div>' +
    '<h2>Order Placed!</h2>' +
    '<p>Thank you for shopping with HomeWeb.</p>' +
    '<p class="order-id-label">Order ID: <strong id="sn-orderId"></strong></p>' +
    '<div class="success-sub">You\'ll receive a confirmation SMS shortly.</div>' +
    '<div class="success-btns">' +
    '<button class="co-btn co-btn--next" onclick="closeSuccess(); openOrderTracking();">Track My Order</button>' +
    '<button class="co-btn co-btn--back" onclick="closeSuccess()">Continue Shopping <i class="fas fa-arrow-right"></i></button>' +
    '</div>' +
    '</div>' +

    // Tracking overlay + modal
    '<div id="sn-trackingOverlay" class="sn-overlay" onclick="closeOrderTracking()"></div>' +
    '<div id="sn-trackingModal" class="sn-tracking-modal">' +
    '<div class="track-header">' +
    '<h2>My Orders</h2>' +
    '<button class="co-close" onclick="closeOrderTracking()"><i class="fas fa-times"></i></button>' +
    '</div>' +
    '<div class="track-body">' +
    '<div id="sn-tracking-list"></div>' +
    '<div id="sn-tracking-detail" style="display:none"></div>' +
    '</div>' +
    '</div>' +
    // Login overlay + modal
    '<div id="sn-loginOverlay" class="sn-overlay" onclick="closeLoginModal()"></div>' +
    '<div id="sn-loginModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeLoginModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body">' +
    '<div class="login-icon"><i class="fas fa-user-circle"></i></div>' +
    '<h2>Welcome Back</h2>' +
    '<p class="login-sub">Log in to your HomeWeb account</p>' +
    '<div class="co-field"><label>Email <span class="co-required">*</span></label>' +
    '<input type="email" id="login-email" placeholder="you@example.com"/>' +
    '<span class="co-field-error">Enter a valid email address</span></div>' +
    '<div class="co-field"><label>Password <span class="co-required">*</span></label>' +
    '<input type="password" id="login-password" placeholder="Enter your password"/>' +
    '<span class="co-field-error">Password is required</span></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
    '<label class="login-remember" style="margin:0;"><input type="checkbox" id="login-remember"/> <span>Remember me</span></label>' +
    '<a href="#" onclick="openForgotPasswordModal(event)" style="font-size:12.5px;color:var(--primary,#22C55E);text-decoration:underline;">Forgot password?</a>' +
    '</div>' +
    '<button class="co-btn co-btn--next login-submit" onclick="submitLogin()">Log In <i class="fas fa-arrow-right"></i></button>' +
    '<p class="login-signup">Don\'t have an account? <a href="#" onclick="closeLoginModal(); openSignupModal(event); return false;">Sign Up</a></p>' +
    '</div></div>' +

    // Signup overlay + modal
    '<div id="sn-signupOverlay" class="sn-overlay" onclick="closeSignupModal()"></div>' +
    '<div id="sn-signupModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeSignupModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-signup-body"></div>' +
    '</div>' +

    // GCash mock payment overlay + modal
    '<div id="sn-gcashOverlay" class="sn-overlay" onclick="cancelGcashPayment()"></div>' +
    '<div id="sn-gcashModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="cancelGcashPayment()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="gcash-body"></div>' +
    '</div>' +

    // Profile overlay + modal
    '<div id="sn-profileOverlay" class="sn-overlay" onclick="closeProfileModal()"></div>' +
    '<div id="sn-profileModal" class="sn-tracking-modal">' +
    '<button class="pm-close" onclick="closeProfileModal()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-profile-body" style="padding:8px 4px;"></div>' +
    '</div>' +

    // Merchant dashboard overlay + modal
    '<div id="sn-merchantOverlay" class="sn-overlay" onclick="closeMerchantDashboard()"></div>' +
    '<div id="sn-merchantModal" class="sn-dashboard-modal">' +
    '<button class="pm-close" onclick="closeMerchantDashboard()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-merchant-body" class="dashboard-body-inner"></div>' +
    '</div>' +

    // Rider dashboard overlay + modal
    '<div id="sn-riderDashOverlay" class="sn-overlay" onclick="closeRiderDashboard()"></div>' +
    '<div id="sn-riderDashModal" class="sn-dashboard-modal">' +
    '<button class="pm-close" onclick="closeRiderDashboard()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-rider-dash-body" class="dashboard-body-inner"></div>' +
    '</div>' +

    // Rider order-alert overlay + modal (pops up regardless of screen while online)
    '<div id="sn-riderAlertOverlay" class="sn-overlay"></div>' +
    '<div id="sn-riderAlertModal" class="sn-login-modal">' +
    '<div class="login-body" id="sn-rider-alert-body"></div>' +
    '</div>' +

    // Report overlay + modal (reusable across contexts - reporting a store, rider, or customer)
    '<div id="sn-reportOverlay" class="sn-overlay" onclick="closeReportModal()"></div>' +
    '<div id="sn-reportModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeReportModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-report-body"></div>' +
    '</div>' +

    // Chat overlay + modal (inbox list <-> thread view, order-scoped)
    '<div id="sn-chatOverlay" class="sn-overlay" onclick="closeChatModal()"></div>' +
    '<div id="sn-chatModal" class="sn-chat-modal">' +
    '<div class="chat-panel">' +
    '<div class="chat-header" id="sn-chat-header"></div>' +
    '<div class="chat-scroll" id="sn-chat-scroll"></div>' +
    '<div class="chat-composer" id="sn-chat-composer" style="display:none;"></div>' +
    '</div>' +
    '</div>' +

    // Help Center overlay + modal
    '<div id="sn-helpOverlay" class="sn-overlay" onclick="closeHelpCenterModal()"></div>' +
    '<div id="sn-helpModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeHelpCenterModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-help-body"></div>' +
    '</div>' +

    // Stock In overlay + modal
    '<div id="sn-stockInOverlay" class="sn-overlay" onclick="closeStockInModal()"></div>' +
    '<div id="sn-stockInModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeStockInModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-stock-in-body"></div>' +
    '</div>' +

    // Forgot password overlay + modal
    '<div id="sn-forgotOverlay" class="sn-overlay" onclick="closeForgotPasswordModal()"></div>' +
    '<div id="sn-forgotModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeForgotPasswordModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-forgot-body"></div>' +
    '</div>' +

    // Set new password overlay + modal (opens automatically after clicking the reset link in email)
    '<div id="sn-resetOverlay" class="sn-overlay"></div>' +
    '<div id="sn-resetModal" class="sn-login-modal">' +
    '<div class="login-body" id="sn-reset-body"></div>' +
    '</div>' +

    // Contact profile popup (from chat - shows who you're messaging)
    '<div id="sn-contactProfileOverlay" class="sn-overlay" onclick="closeContactProfileModal()" style="z-index:500;"></div>' +
    '<div id="sn-contactProfileModal" class="sn-login-modal" style="z-index:501;">' +
    '<button class="pm-close" onclick="closeContactProfileModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-contact-profile-body"></div>' +
    '</div>' +

    // Merchant storefront overlay + modal
    '<div id="sn-storeOverlay" class="sn-overlay" onclick="closeMerchantStorefront()"></div>' +
    '<div id="sn-storeModal" class="sn-tracking-modal">' +
    '<button class="pm-close" onclick="closeMerchantStorefront()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-store-body" style="padding:8px 4px;"></div>' +
    '</div>' +

    // Admin login overlay + modal (only ever opened via #admin URL hash)
    '<div id="sn-adminLoginOverlay" class="sn-overlay" onclick="closeAdminLoginModal()"></div>' +
    '<div id="sn-adminLoginModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeAdminLoginModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body" id="sn-admin-login-body"></div>' +
    '</div>' +

    // Admin dashboard overlay + modal
    '<div id="sn-adminOverlay" class="sn-overlay" onclick="closeAdminDashboard()"></div>' +
    '<div id="sn-adminModal" class="sn-dashboard-modal">' +
    '<button class="pm-close" onclick="closeAdminDashboard()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-admin-body" class="dashboard-body-inner dashboard-body-inner--wide"></div>' +
    '</div>' +

    // Notifications overlay + modal
    '<div id="sn-notifOverlay" class="sn-overlay" onclick="closeNotificationsModal()"></div>' +
    '<div id="sn-notifModal" class="sn-tracking-modal">' +
    '<button class="pm-close" onclick="closeNotificationsModal()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-notif-body" style="padding:8px 4px;"><h3 style="margin:0 0 16px;">Notifications</h3><div id="sn-notif-list"></div></div>' +
    '</div>' +

    // Rider search overlay + modal
    '<div id="sn-riderOverlay" class="sn-overlay" onclick="closeRiderModal()"></div>' +
    '<div id="sn-riderModal" class="sn-login-modal">' +
    '<div class="login-body" id="sn-rider-body"></div>' +
    '</div>';

  var div = document.createElement('div');
  div.innerHTML = html;
  while (div.firstChild) document.body.appendChild(div.firstChild);
}

// ============================================================
// NOTIFICATIONS (summarizes order status history for this user)
// ============================================================

var NOTIF_ICON_MAP = {
  'placed':                'fa-receipt',
  'preparing':              'fa-box-open',
  'out_for_delivery':        'fa-truck',
  'awaiting_confirmation':   'fa-clock',
  'delivered':              'fa-check-circle'
};

var CONFIRMATION_GRACE_PERIOD_MS = 60000; // 1 minute grace period before nudging the customer

function notifSeenKey() {
  return currentUser ? ('homeweb_notif_seen_' + currentUser.id + '_' + activeRole) : null;
}

// Relative time like "5m ago", "2h ago", "3d ago" //
function timeAgo(isoString) {
  var diffMs = Date.now() - new Date(isoString).getTime();
  var mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  return days + 'd ago';
}

// Notifications are scoped to whichever role is currently active — a
// customer/merchant/rider account only ever sees notifications relevant
// to that role, never a mixed feed. //
async function fetchNotifications() {
  if (activeRole === 'merchant') return await fetchMerchantNotifications();
  if (activeRole === 'rider') return await fetchRiderNotifications();
  return await fetchCustomerNotifications();
}

async function fetchCustomerNotifications() {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('*, orders!inner(order_code, user_id)')
    .eq('orders.user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) { console.error('fetchCustomerNotifications error:', error); return []; }
  var notifs = data || [];

  // Reminder: nudge the customer if any of their orders have been sitting
  // in "awaiting confirmation" past the grace period without action. //
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('id, order_code, updated_at')
    .eq('user_id', currentUser.id)
    .eq('status', 'awaiting_confirmation');

  (pendingOrders || []).forEach(function(o) {
    var elapsed = Date.now() - new Date(o.updated_at).getTime();
    if (elapsed >= CONFIRMATION_GRACE_PERIOD_MS) {
      notifs.unshift({
        order_id: o.id,
        status: 'awaiting_confirmation',
        label: 'Please Confirm Your Order',
        description: 'Your rider marked Order #' + o.order_code + ' as delivered. Please confirm you received it, or let us know if it hasn\'t arrived.',
        created_at: o.updated_at,
        orders: { order_code: o.order_code }
      });
    }
  });

  notifs.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  return notifs;
}

async function fetchMerchantNotifications() {
  const { data: merchant } = await supabase.from('merchants').select('id').eq('user_id', currentUser.id).single();
  if (!merchant) return [];

  const { data: lineItems, error: liErr } = await supabase
    .from('order_items')
    .select('order_id, products!inner(merchant_id), orders(order_code)')
    .eq('products.merchant_id', merchant.id);

  if (liErr) { console.error('fetchMerchantNotifications items error:', liErr); return []; }

  var codeByOrder = {};
  (lineItems || []).forEach(function(li) {
    if (li.orders) codeByOrder[li.order_id] = li.orders.order_code;
  });
  var orderIds = Object.keys(codeByOrder);
  if (!orderIds.length) return [];

  const { data: statusRows, error: shErr } = await supabase
    .from('order_status_history')
    .select('order_id, status, label, description, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
    .limit(150);

  if (shErr) { console.error('fetchMerchantNotifications status error:', shErr); return []; }

  var notifs = (statusRows || []).map(function(s) {
    return {
      order_id: s.order_id,
      status: s.status,
      label: s.label,
      description: merchantNotifDescription(s, codeByOrder[s.order_id]),
      created_at: s.created_at,
      orders: { order_code: codeByOrder[s.order_id] },
      isMerchantNotif: true
    };
  });

  notifs.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  return notifs;
}

// Rider-side: status updates on deliveries they're assigned to, worded
// from the rider's point of view, plus non-delivery disputes. //
async function fetchRiderNotifications() {
  const { data: statusRows, error } = await supabase
    .from('order_status_history')
    .select('*, orders!inner(order_code, rider_user_id)')
    .eq('orders.rider_user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) { console.error('fetchRiderNotifications error:', error); return []; }

  var notifs = (statusRows || []).map(function(s) {
    return {
      order_id: s.order_id,
      status: s.status,
      label: s.label,
      description: riderNotifDescription(s, s.orders.order_code),
      created_at: s.created_at,
      orders: { order_code: s.orders.order_code },
      isRiderNotif: true
    };
  });

  // Also flag disputes explicitly, since those need a rider's attention
  // even though they don't add a new status_history row. //
  const { data: disputedOrders } = await supabase
    .from('orders')
    .select('id, order_code, not_arrived_reported_at')
    .eq('rider_user_id', currentUser.id)
    .not('not_arrived_reported_at', 'is', null);

  (disputedOrders || []).forEach(function(o) {
    notifs.push({
      order_id: o.id,
      status: 'awaiting_confirmation',
      label: 'Customer Reported Non-Delivery',
      description: 'The customer for Order #' + o.order_code + ' reported not receiving it. Please follow up.',
      created_at: o.not_arrived_reported_at,
      orders: { order_code: o.order_code },
      isRiderNotif: true
    });
  });

  notifs.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  return notifs;
}

// Reword customer-facing status copy from the seller's point of view //
function merchantNotifDescription(s, orderCode) {
  var code = orderCode || '';
  switch (s.status) {
    case 'placed':
      return 'New order #' + code + ' was placed for your products.';
    case 'preparing':
      return 'A rider accepted order #' + code + ' and is heading over for pickup.';
    case 'out_for_delivery':
      return 'Order #' + code + ' has been picked up and is on the way to the customer.';
    case 'awaiting_confirmation':
      return 'Order #' + code + ' was marked delivered by the rider, awaiting customer confirmation.';
    case 'delivered':
      return 'Order #' + code + ' was confirmed received by the customer.';
    default:
      return s.description;
  }
}

// Reword status copy from the rider's point of view //
function riderNotifDescription(s, orderCode) {
  var code = orderCode || '';
  switch (s.status) {
    case 'preparing':
      return 'You accepted Order #' + code + '. Head to the seller for pickup.';
    case 'out_for_delivery':
      return 'You picked up Order #' + code + '. On the way to the customer.';
    case 'awaiting_confirmation':
      return 'You marked Order #' + code + ' as delivered, awaiting customer confirmation.';
    case 'delivered':
      return 'Customer confirmed receipt of Order #' + code + '. Delivery complete!';
    default:
      return s.description;
  }
}

function notifClearedKey() {
  return currentUser ? ('homeweb_notif_cleared_' + currentUser.id + '_' + activeRole) : null;
}

var ROLE_NOTIF_LABEL = { customer: 'Customer', merchant: 'Store', rider: 'Delivery' };

async function openNotificationsModal(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in to view notifications', 'info');
    openLoginModal();
    return;
  }

  notifShowingLogs = false;
  document.getElementById('sn-notifOverlay').classList.add('active');
  document.getElementById('sn-notifModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var list = document.getElementById('sn-notif-list');
  list.innerHTML = '<div class="track-empty"><p>Loading notifications...</p></div>';

  const notifs = await fetchNotifications();
  currentNotifList = notifs;
  renderNotifications(notifs);

  // Mark as seen: remember the timestamp of the newest notification —
  // this only affects the red badge dot, not what's visible in the list.
  if (notifs.length) {
    var newestTimestamp = notifs.reduce(function(max, n) { return new Date(n.created_at) > new Date(max) ? n.created_at : max; }, notifs[0].created_at);
    localStorage.setItem(notifSeenKey(), newestTimestamp);
  }
  updateNotifBadge();
}

// Hides the notification list going forward — purely a per-device display
// filter. The underlying order_status_history / order records are never
// touched, so nothing is lost from the seller's sales report, the rider's
// delivery history, or the order timeline itself. //
function clearAllNotifications() {
  localStorage.setItem(notifClearedKey(), new Date().toISOString());
  localStorage.setItem(notifSeenKey(), new Date().toISOString());
  // Deliberately NOT touching currentNotifList here — the Logs view reads
  // from this same cached list, and clearing the main view should never
  // affect what Logs can show. The main view's own render logic already
  // filters against the cleared timestamp; the underlying data (and this
  // cache) stays untouched. //
  renderNotifications(currentNotifList);
  updateNotifBadge();
  showToast('Notifications cleared', 'info');
}

function closeNotificationsModal() {
  document.getElementById('sn-notifOverlay').classList.remove('active');
  document.getElementById('sn-notifModal').classList.remove('active');
  document.body.style.overflow = '';
}

var NOTIF_MAIN_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours - keeps the main list clean
var notifShowingLogs = false;

function renderNotifications(notifs) {
  var list = document.getElementById('sn-notif-list');

  if (notifShowingLogs) {
    var logsHeader = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<span style="font-size:11.5px;color:#999;text-transform:uppercase;letter-spacing:0.03em;">All Logs \u2014 ' + (ROLE_NOTIF_LABEL[activeRole] || 'Customer') + '</span>' +
      '<button class="co-btn" style="padding:4px 10px;background:#F3F4F6;color:#333;font-size:11.5px;" onclick="notifShowingLogs=false; renderNotifications(currentNotifList);">Back</button>' +
      '</div>';
    if (!notifs.length) {
      list.innerHTML = logsHeader + '<div class="track-empty"><p>No notification history yet.</p></div>';
      return;
    }
    list.innerHTML = logsHeader + notifs.map(notifItemHtml).join('');
    return;
  }

  var clearedAt = localStorage.getItem(notifClearedKey());
  var cutoff = new Date(Date.now() - NOTIF_MAIN_WINDOW_MS);
  var visible = notifs.filter(function(n) {
    if (clearedAt && new Date(n.created_at) <= new Date(clearedAt)) return false;
    return new Date(n.created_at) > cutoff;
  });

  var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
    '<span style="font-size:11.5px;color:#999;text-transform:uppercase;letter-spacing:0.03em;">' + (ROLE_NOTIF_LABEL[activeRole] || 'Customer') + ' notifications</span>' +
    (visible.length ? '<button class="co-btn" style="padding:4px 10px;background:#F3F4F6;color:#333;font-size:11.5px;" onclick="clearAllNotifications()">Clear All</button>' : '') +
    '</div>' +
    '<div style="margin-bottom:10px;">' +
    '<a href="#" onclick="notifShowingLogs=true; renderNotifications(currentNotifList); return false;" style="font-size:11.5px;color:var(--primary,#22C55E);text-decoration:underline;"><i class="fas fa-clock-rotate-left"></i> View all previous logs</a>' +
    '<span style="font-size:11px;color:#ccc;"> \u2014 notifications older than 3 hours move here automatically</span>' +
    '</div>';

  if (!visible.length) {
    list.innerHTML = header + '<div class="track-empty"><p>No recent notifications. Check the logs above for older ones.</p></div>';
    return;
  }

  list.innerHTML = header + visible.map(notifItemHtml).join('');
}

function notifItemHtml(n) {
  var icon = NOTIF_ICON_MAP[n.status] || 'fa-bell';
  return '<div class="notif-item" style="display:flex;gap:12px;padding:12px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;" ' +
    'onclick="closeNotificationsModal(); viewOrderNow(\'' + n.order_id + '\');">' +
    '<div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#F0FFF4;color:var(--primary,#22C55E);display:flex;align-items:center;justify-content:center;"><i class="fas ' + icon + '"></i></div>' +
    '<div style="flex:1;">' +
    '<p style="margin:0;font-weight:600;font-size:13.5px;">Order #' + n.orders.order_code + ' — ' + n.label + '</p>' +
    '<p style="margin:2px 0 0;color:#777;font-size:12.5px;">' + n.description + '</p>' +
    '<p style="margin:4px 0 0;color:#aaa;font-size:11.5px;">' + timeAgo(n.created_at) + '</p>' +
    '</div></div>';
}

// Show/hide the red dot on the bell icon based on unseen, uncleared notifications //
async function updateNotifBadge() {
  var badges = document.querySelectorAll('.notif-badge');
  if (!currentUser) {
    badges.forEach(function(b) { b.style.display = 'none'; });
    return;
  }

  var notifs = await fetchNotifications();
  var clearedAt = localStorage.getItem(notifClearedKey());
  if (clearedAt) notifs = notifs.filter(function(n) { return new Date(n.created_at) > new Date(clearedAt); });

  if (!notifs.length) {
    badges.forEach(function(b) { b.style.display = 'none'; });
    return;
  }

  var latest = notifs.reduce(function(max, n) { return new Date(n.created_at) > new Date(max) ? n.created_at : max; }, notifs[0].created_at);
  var seen = localStorage.getItem(notifSeenKey());
  var isUnseen = !seen || new Date(latest) > new Date(seen);
  badges.forEach(function(b) { b.style.display = isUnseen ? 'inline-block' : 'none'; });
}

// Shows/hides the red dot on the Messages icon based on real unread messages //
async function updateChatBadge() {
  var badges = document.querySelectorAll('.msg-badge');
  if (!currentUser) {
    badges.forEach(function(b) { b.style.display = 'none'; });
    return;
  }

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', currentUser.id)
    .is('read_at', null);

  badges.forEach(function(b) { b.style.display = (count > 0) ? 'inline-block' : 'none'; });
}

// Open the tracking modal directly on a specific order's detail view //
function viewOrderNow(orderId) {
  document.getElementById('sn-trackingOverlay').classList.add('active');
  document.getElementById('sn-trackingModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  openTrackingDetail(orderId);
}



async function openProfileModal(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in to view your profile', 'info');
    openLoginModal();
    return;
  }

  document.getElementById('sn-profileOverlay').classList.add('active');
  document.getElementById('sn-profileModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var body = document.getElementById('sn-profile-body');
  body.innerHTML = '<div class="track-empty"><p>Loading your profile...</p></div>';

  if (!userRoles.length) await fetchUserRoles();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    body.innerHTML = '<div class="track-empty"><p>Could not load profile: ' + error.message + '</p></div>';
    return;
  }

  // Pull role-specific stats to show on the profile //
  var roleStats = {};
  if (userRoles.indexOf('merchant') !== -1) {
    const { data: merchant } = await supabase.from('merchants').select('id, store_name, business_type, merchant_type, open_days').eq('user_id', currentUser.id).single();
    if (merchant) {
      const { data: myProducts } = await supabase.from('products').select('rating_avg, rating_count').eq('merchant_id', merchant.id);
      var totalReviews = 0, weightedSum = 0;
      (myProducts || []).forEach(function(p) { totalReviews += p.rating_count; weightedSum += p.rating_avg * p.rating_count; });
      roleStats.merchant = {
        storeName: merchant.store_name,
        businessType: merchant.business_type,
        merchantType: merchant.merchant_type,
        openDays: merchant.open_days,
        openToday: isStoreOpenToday(merchant),
        scheduleLabel: openDaysLabel(merchant),
        productCount: (myProducts || []).length,
        ratingAvg: totalReviews > 0 ? (weightedSum / totalReviews).toFixed(1) : 0,
        ratingCount: totalReviews
      };
    }
  }
  if (userRoles.indexOf('rider') !== -1) {
    const { data: rider } = await supabase.from('riders').select('vehicle_type, plate_number, rating_avg, rating_count, is_available, rejection_penalty').eq('user_id', currentUser.id).single();
    if (rider) roleStats.rider = rider;
  }

  renderProfileForm(profile, roleStats);
}

function closeProfileModal() {
  document.getElementById('sn-profileOverlay').classList.remove('active');
  document.getElementById('sn-profileModal').classList.remove('active');
  document.body.style.overflow = '';
}

function renderProfileForm(profile, roleStats) {
  var body = document.getElementById('sn-profile-body');
  var initial = (profile.full_name || currentUser.email || '?').trim().charAt(0).toUpperCase();
  roleStats = roleStats || {};

  var roleChips = '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 4px;">' +
    userRoles.map(function(r) {
      var active = r === activeRole;
      return '<span onclick="switchActiveRole(\'' + r + '\')" style="cursor:pointer;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;' +
        'background:' + (active ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (active ? '#fff' : '#555') + ';">' +
        '<i class="fas ' + ROLE_ICONS[r] + '"></i> ' + ROLE_LABELS[r] + (active ? ' \u2713' : '') + '</span>';
    }).join('') + '</div>';

  var dashboardButton = '';
  if (userRoles.indexOf('merchant') !== -1) {
    dashboardButton += '<button class="co-btn co-btn--next" style="width:100%;margin-bottom:10px;" onclick="closeProfileModal(); openMerchantDashboard();">' +
      '<i class="fas fa-store"></i> My Store Dashboard</button>';
  }
  if (userRoles.indexOf('rider') !== -1) {
    dashboardButton += '<button class="co-btn co-btn--next" style="width:100%;margin-bottom:10px;" onclick="closeProfileModal(); openRiderDashboard();">' +
      '<i class="fas fa-motorcycle"></i> My Deliveries</button>';
  }
  if (userRoles.indexOf('admin') !== -1) {
    dashboardButton += '<button class="co-btn co-btn--next" style="width:100%;margin-bottom:10px;background:#1F2937;" onclick="closeProfileModal(); openAdminDashboard();">' +
      '<i class="fas fa-user-shield"></i> Admin Dashboard</button>';
  }

  var addRoleButtons = '';
  if (userRoles.indexOf('merchant') === -1) {
    addRoleButtons += '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-bottom:8px;" onclick="addAccountRole(\'merchant\')">' +
      '<i class="fas fa-store"></i> Register as Merchant</button>';
  }
  if (userRoles.indexOf('rider') === -1) {
    addRoleButtons += '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-bottom:8px;" onclick="addAccountRole(\'rider\')">' +
      '<i class="fas fa-motorcycle"></i> Register as Rider</button>';
  }

  var statsHtml = '';
  if (roleStats.merchant) {
    var m = roleStats.merchant;
    statsHtml += '<div style="background:#F0FFF4;border-radius:10px;padding:14px;margin-bottom:10px;">' +
      '<p style="margin:0;font-weight:700;font-size:13px;"><i class="fas fa-store"></i> ' + m.storeName + '</p>' +
      '<p style="margin:4px 0 0;font-size:12px;color:#666;">' + (CATEGORY_META[m.businessType] ? CATEGORY_META[m.businessType].title : m.businessType) + ' \u2022 ' + m.productCount + ' product(s)</p>' +
      '<p style="margin:4px 0 0;font-size:12px;color:#666;"><i class="fas ' + (m.merchantType === 'bolanteros' ? 'fa-calendar-days' : 'fa-shop') + '"></i> ' +
      (m.merchantType === 'bolanteros' ? 'Bolanteros' : 'Permanent') + ' \u2022 ' + m.scheduleLabel + '</p>' +
      (m.merchantType === 'bolanteros'
        ? '<p style="margin:4px 0 0;font-size:12px;font-weight:600;color:' + (m.openToday ? '#15803D' : '#DC2626') + ';">' +
          (m.openToday ? 'Your store is visible today' : 'Your store is hidden today (closed)') + '</p>'
        : '') +
      '<p style="margin:4px 0 0;font-size:12px;color:#F59E0B;">' +
      (m.ratingCount > 0 ? stars(m.ratingAvg) + ' ' + m.ratingAvg + ' (' + m.ratingCount + ' reviews)' : 'No reviews yet') +
      '</p></div>';
  }
  if (roleStats.rider) {
    var r = roleStats.rider;
    var rEffectiveRating = Math.max(0, r.rating_avg - (r.rejection_penalty || 0));
    statsHtml += '<div style="background:#F0F8FF;border-radius:10px;padding:14px;margin-bottom:10px;">' +
      '<p style="margin:0;font-weight:700;font-size:13px;"><i class="fas fa-motorcycle"></i> ' + capitalize(r.vehicle_type) + (r.plate_number ? ' \u2022 ' + r.plate_number : '') + '</p>' +
      '<p style="margin:4px 0 0;font-size:12px;color:' + (r.is_available ? '#22C55E' : '#999') + ';">' + (r.is_available ? 'Online' : 'Offline') + '</p>' +
      '<p style="margin:4px 0 0;font-size:12px;color:#F59E0B;">' +
      (r.rating_count > 0 ? stars(rEffectiveRating) + ' ' + rEffectiveRating.toFixed(1) + ' (' + r.rating_count + ' ratings)' : 'New rider, no ratings yet') +
      (r.rejection_penalty > 0 ? '<span style="color:#DC2626;"> \u2014 ' + r.rejection_penalty.toFixed(1) + ' rejection penalty</span>' : '') +
      '</p></div>';
  }

  var avatarHtml = profile.avatar_url
    ? '<img src="' + profile.avatar_url + '" style="width:100%;height:100%;object-fit:cover;"/>'
    : initial;

  body.innerHTML =
    '<div style="text-align:center;margin-bottom:12px;">' +
    '<div style="position:relative;width:64px;height:64px;margin:0 auto 10px;">' +
    '<div style="width:64px;height:64px;border-radius:50%;background:var(--primary,#22C55E);color:#fff;font-size:26px;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;">' + avatarHtml + '</div>' +
    '<button onclick="document.getElementById(\'avatar-file-input\').click()" title="Change photo" style="position:absolute;bottom:-2px;right:-2px;width:24px;height:24px;border-radius:50%;background:#fff;border:1px solid #ddd;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:#555;"><i class="fas fa-camera"></i></button>' +
    '<input type="file" id="avatar-file-input" accept="image/*" style="display:none;" onchange="uploadAvatar(this.files[0])"/>' +
    '</div>' +
    '<h2 style="margin:0;">' + (profile.full_name || 'HomeWeb Shopper') + '</h2>' +
    '<p style="color:#888;margin:4px 0 0;">' + currentUser.email + '</p>' +
    roleChips +
    '</div>' +

    '<div class="co-field"><label>Full Name</label>' +
    '<input type="text" id="profile-name" value="' + (profile.full_name || '') + '"/></div>' +

    '<div class="co-field"><label>Phone Number</label>' +
    '<input type="tel" id="profile-phone" placeholder="09XXXXXXXXX" value="' + (profile.phone || '') + '"/></div>' +

    '<button class="co-btn co-btn--next" id="profile-save-btn" onclick="saveProfileChanges()">Save Changes</button>' +

    '<div style="margin:20px 0;border-top:1px solid #eee;"></div>' +

    statsHtml +
    dashboardButton +
    addRoleButtons +

    '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-bottom:10px;" onclick="closeProfileModal(); openOrderTracking();">' +
    '<i class="fas fa-receipt"></i> View Order History</button>' +

    '<button class="co-btn" style="background:#FEE2E2;color:#DC2626;width:100%;" onclick="closeProfileModal(); logout();">' +
    '<i class="fas fa-sign-out-alt"></i> Log Out</button>';
}

async function saveProfileChanges() {
  var name = document.getElementById('profile-name').value.trim();
  var phone = document.getElementById('profile-phone').value.trim();
  var btn = document.getElementById('profile-save-btn');

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: name, phone: phone })
    .eq('id', currentUser.id);

  if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

  if (error) {
    showToast('Could not save changes: ' + error.message, 'error');
    return;
  }

  showToast('Profile updated \u2705');
}

async function uploadAvatar(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }

  showToast('Uploading photo...', 'info');
  var ext = file.name.split('.').pop();
  var path = 'avatars/' + currentUser.id + '/' + Date.now() + '.' + ext;

  const { error: uploadErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
  if (uploadErr) { showToast('Could not upload photo: ' + uploadErr.message, 'error'); return; }

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);

  const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', currentUser.id);
  if (updateErr) { showToast('Could not save photo: ' + updateErr.message, 'error'); return; }

  showToast('Profile photo updated \u2705');
  openProfileModal();
}

// ============================================================
// MERCHANT DASHBOARD (Phase 2: tenant product management)
// ============================================================

let myMerchantId = null;
let myMerchantProducts = [];
let myMerchantSales = null;
let merchantDashboardView = 'products'; // 'products' | 'sales'
let merchantSalesDateFilter = 'all';

function changeMerchantSalesDateFilter(value) {
  merchantSalesDateFilter = value;
  fetchMerchantSales(merchantSalesDateFilter).then(renderMerchantSalesView);
}
let editingProductId = null;
let pendingProductImageFile = null;

async function openMerchantDashboard(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in first', 'info');
    openLoginModal();
    return;
  }
  if (userRoles.indexOf('merchant') === -1) {
    showToast('You need a Merchant account first — register one from your profile', 'info');
    openProfileModal();
    return;
  }

  if (activeRole !== 'merchant') switchActiveRole('merchant');

  document.getElementById('sn-merchantOverlay').classList.add('active');
  document.getElementById('sn-merchantModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var body = document.getElementById('sn-merchant-body');
  body.innerHTML = '<div class="track-empty"><p>Loading your store...</p></div>';

  if (!myMerchantId) {
    const { data: merchant, error } = await supabase
      .from('merchants').select('id, is_suspended, suspended_reason').eq('user_id', currentUser.id).single();
    if (error || !merchant) {
      body.innerHTML = '<div class="track-empty"><p>Could not load your merchant profile.</p></div>';
      return;
    }
    if (merchant.is_suspended) {
      body.innerHTML = '<h2 style="margin:0 0 12px;">My Store</h2>' +
        '<div style="background:#FEE2E2;border-radius:10px;padding:16px;">' +
        '<p style="margin:0;font-weight:700;color:#DC2626;"><i class="fas fa-ban"></i> Your store has been suspended</p>' +
        '<p style="margin:8px 0 0;font-size:13px;color:#7F1D1D;">' + (merchant.suspended_reason || 'No reason was given.') + '</p>' +
        '<p style="margin:10px 0 0;font-size:12.5px;color:#7F1D1D;">Your listings are hidden and you can\'t add or edit products while suspended. Contact HomeWeb support if you believe this is a mistake.</p>' +
        '</div>';
      return;
    }
    myMerchantId = merchant.id;
  }

  await loadMyMerchantProducts();
  renderMerchantDashboard();
}

function closeMerchantDashboard() {
  document.getElementById('sn-merchantOverlay').classList.remove('active');
  document.getElementById('sn-merchantModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function loadMyMerchantProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('merchant_id', myMerchantId)
    .order('created_at', { ascending: false });
  myMerchantProducts = error ? [] : (data || []);
}

// Pull every order_item that belongs to one of this merchant's products,
// along with the parent order's status/date/payment — then aggregate client-side.
async function fetchMerchantSales(dateFilter) {
  dateFilter = dateFilter || 'all';
  const { data, error } = await supabase
    .from('order_items')
    .select('qty, price, cost_price, product_id, product_name, products!inner(name, merchant_id, category), orders(id, status, created_at, payment_method, order_code, not_arrived_reported_at, user_id)')
    .eq('products.merchant_id', myMerchantId);

  console.log('fetchMerchantSales:', { merchantId: myMerchantId, rows: data, error: error });

  if (error) {
    myMerchantSales = { error: error.message };
    return myMerchantSales;
  }

  var rows = (data || []).filter(function(r) {
    return r.orders && orderMatchesDateFilter(r.orders, dateFilter);
  });
  var totalRevenue = 0, totalItems = 0;
  var byProduct = {};
  var byCategory = {};
  var orderIdSet = {};
  var byOrder = {};
  var knownProfit = 0, itemsWithCost = 0, itemsWithoutCost = 0;

  rows.forEach(function(r) {
    var lineTotal = r.price * r.qty;
    totalRevenue += lineTotal;
    totalItems += r.qty;

    var pname = r.products ? r.products.name : 'Unknown product';
    if (!byProduct[pname]) byProduct[pname] = { name: pname, qty: 0, revenue: 0, profit: 0, cost: 0, itemsWithCost: 0, itemsWithoutCost: 0 };
    byProduct[pname].qty += r.qty;
    byProduct[pname].revenue += lineTotal;

    var cat = r.products ? r.products.category : 'other';
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += lineTotal;

    // Only counts toward profit if this merchant actually entered a cost
    // price for this product — otherwise we honestly don't know it. //
    var costPrice = r.cost_price;
    if (costPrice !== null && costPrice !== undefined) {
      var lineProfit = (r.price - costPrice) * r.qty;
      knownProfit += lineProfit;
      itemsWithCost += r.qty;
      byProduct[pname].profit += lineProfit;
      byProduct[pname].cost += costPrice * r.qty;
      byProduct[pname].itemsWithCost += r.qty;
    } else {
      itemsWithoutCost += r.qty;
      byProduct[pname].itemsWithoutCost += r.qty;
    }

    if (r.orders) {
      orderIdSet[r.orders.id] = r.orders.order_code;
      if (!byOrder[r.orders.id]) {
        byOrder[r.orders.id] = {
          orderId: r.orders.id, orderCode: r.orders.order_code, status: r.orders.status,
          createdAt: r.orders.created_at, paymentMethod: r.orders.payment_method,
          notArrived: r.orders.not_arrived_reported_at, customerId: r.orders.user_id,
          items: [], total: 0
        };
      }
      byOrder[r.orders.id].items.push({ name: r.product_name || pname, qty: r.qty, price: r.price });
      byOrder[r.orders.id].total += lineTotal;
    }
  });

  var topProducts = Object.values(byProduct).sort(function(a, b) { return b.revenue - a.revenue; }).slice(0, 5);
  var productProfits = Object.values(byProduct).sort(function(a, b) { return b.profit - a.profit; });
  var orderIds = Object.keys(orderIdSet);

  var recentOrders = Object.values(byOrder).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 15);

  // Attach customer names — profiles isn't directly joinable from orders via
  // PostgREST (sibling FKs to auth.users), so fetch them separately. //
  var customerIds = Array.from(new Set(recentOrders.map(function(o) { return o.customerId; }).filter(Boolean)));
  if (customerIds.length) {
    const { data: custProfiles } = await supabase.from('profiles').select('id, full_name').in('id', customerIds);
    var nameById = {};
    (custProfiles || []).forEach(function(p) { nameById[p.id] = p.full_name; });
    recentOrders.forEach(function(o) { o.customerName = nameById[o.customerId] || 'Customer'; });
  }

  var activity = await fetchMerchantActivity(orderIds, orderIdSet);

  // Order completion rate: real, computed from actual order statuses //
  var deliveredCount = Object.values(byOrder).filter(function(o) { return o.status === 'delivered'; }).length;
  var completionRate = orderIds.length > 0 ? Math.round((deliveredCount / orderIds.length) * 100) : null;

  // Sell-through rate: units sold vs units ever stocked (sold + current stock) —
  // a genuine operational metric, not fabricated. //
  const { data: myProducts } = await supabase.from('products').select('stock_qty, sold_count').eq('merchant_id', myMerchantId);
  var totalSold = 0, totalEverStocked = 0;
  (myProducts || []).forEach(function(p) { totalSold += p.sold_count || 0; totalEverStocked += (p.sold_count || 0) + (p.stock_qty || 0); });
  var sellThroughRate = totalEverStocked > 0 ? Math.round((totalSold / totalEverStocked) * 100) : null;

  // Week-over-week comparison — real, using actual order timestamps.
  // (Not year-over-year: the store hasn't been live a full year, so that
  // comparison would be meaningless or fabricated.) //
  var now = Date.now();
  var weekMs = 7 * 24 * 60 * 60 * 1000;
  var thisWeekRevenue = 0, lastWeekRevenue = 0;
  Object.values(byOrder).forEach(function(o) {
    var age = now - new Date(o.createdAt).getTime();
    if (age <= weekMs) thisWeekRevenue += o.total;
    else if (age <= weekMs * 2) lastWeekRevenue += o.total;
  });
  var wowChange = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : null;

  myMerchantSales = {
    totalRevenue: totalRevenue,
    totalItems: totalItems,
    orderCount: orderIds.length,
    topProducts: topProducts,
    productProfits: productProfits,
    dateFilter: dateFilter,
    recentOrders: recentOrders,
    activity: activity,
    byCategory: byCategory,
    knownProfit: knownProfit,
    itemsWithCost: itemsWithCost,
    itemsWithoutCost: itemsWithoutCost,
    completionRate: completionRate,
    sellThroughRate: sellThroughRate,
    thisWeekRevenue: thisWeekRevenue,
    lastWeekRevenue: lastWeekRevenue,
    wowChange: wowChange
  };
  return myMerchantSales;
}

// Build a merged, chronological log of everything that happened across this
// merchant's store: order status changes, stock in/out, and new reviews. //
async function fetchMerchantActivity(orderIds, orderCodeMap) {
  var events = [];

  const { data: reviewRows, error: reviewErr } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, is_anonymous, reviewer_name, products!inner(name, merchant_id)')
    .eq('products.merchant_id', myMerchantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (reviewErr) console.error('activity: reviews error', reviewErr);

  (reviewRows || []).forEach(function(r) {
    events.push({
      type: 'review',
      icon: 'fa-star',
      color: '#F59E0B',
      title: 'New ' + r.rating + '-star review — ' + r.products.name,
      detail: (r.is_anonymous ? 'Anonymous Customer' : (r.reviewer_name || 'A customer')) + (r.comment ? ': "' + r.comment + '"' : ''),
      at: r.created_at
    });
  });

  events.sort(function(a, b) { return new Date(b.at) - new Date(a.at); });
  return events.slice(0, 60);
}

// ============================================================
// INVENTORY (separate from Sales Report — current stock levels
// plus a full stock in/out ledger)
// ============================================================

let merchantOrdersGroupBy = 'date'; // 'date' | 'product'

async function fetchMerchantOrdersFull() {
  const { data, error } = await supabase
    .from('order_items')
    .select('qty, price, product_id, product_name, products!inner(name, merchant_id), orders(id, order_code, status, created_at, payment_method, user_id)')
    .eq('products.merchant_id', myMerchantId)
    .order('orders(created_at)', { ascending: false });

  if (error) { console.error('fetchMerchantOrdersFull error:', error); return { error: error.message }; }

  var byOrder = {};
  var order = [];
  (data || []).forEach(function(r) {
    if (!r.orders) return;
    var oid = r.orders.id;
    if (!byOrder[oid]) {
      byOrder[oid] = { orderId: oid, orderCode: r.orders.order_code, status: r.orders.status, createdAt: r.orders.created_at, paymentMethod: r.orders.payment_method, items: [], total: 0 };
      order.push(oid);
    }
    byOrder[oid].items.push({ name: r.product_name || (r.products ? r.products.name : 'Item'), qty: r.qty, price: r.price });
    byOrder[oid].total += r.price * r.qty;
  });

  var allOrders = order.map(function(k) { return byOrder[k]; }).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return { orders: allOrders };
}

function dateGroupLabel(iso) {
  var d = new Date(iso);
  var now = new Date();
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfToday) return 'Today';
  if (d >= startOfYesterday) return 'Yesterday';
  return formatDate(iso);
}

function renderMerchantOrdersView(data) {
  var body = document.getElementById('sn-merchant-body');
  var tabs = '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'products\')">Products</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'inventory\')">Inventory</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:var(--primary,#22C55E);color:#fff;font-size:12.5px;" onclick="switchMerchantView(\'orders\')">Orders</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'sales\')">Sales Report</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'verify\')">Verification</button>' +
    '</div>';

  if (data.error || !data.orders) {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<p style="color:#999;">Could not load orders' + (data.error ? ': ' + data.error : '') + '.</p>';
    return;
  }

  var groupToggle = '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
    '<button class="co-btn" style="flex:1;background:' + (merchantOrdersGroupBy === 'date' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantOrdersGroupBy === 'date' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="merchantOrdersGroupBy=\'date\'; renderMerchantOrdersView({orders:' + 'window.__lastMerchantOrders' + '});">Group by Date</button>' +
    '<button class="co-btn" style="flex:1;background:' + (merchantOrdersGroupBy === 'product' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantOrdersGroupBy === 'product' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="merchantOrdersGroupBy=\'product\'; renderMerchantOrdersView({orders:' + 'window.__lastMerchantOrders' + '});">Group by Product</button>' +
    '</div>';
  window.__lastMerchantOrders = data.orders;

  var content;
  if (!data.orders.length) {
    content = '<p style="color:#999;font-size:13px;">No orders yet.</p>';
  } else if (merchantOrdersGroupBy === 'date') {
    var byDate = {};
    var dateOrder = [];
    data.orders.forEach(function(o) {
      var label = dateGroupLabel(o.createdAt);
      if (!byDate[label]) { byDate[label] = []; dateOrder.push(label); }
      byDate[label].push(o);
    });
    content = dateOrder.map(function(label) {
      var rows = byDate[label].map(orderRowHtml).join('');
      return '<div style="margin-bottom:16px;"><p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#333;">' + label + '</p>' + rows + '</div>';
    }).join('');
  } else {
    var byProduct = {};
    var productOrder = [];
    data.orders.forEach(function(o) {
      o.items.forEach(function(item) {
        if (!byProduct[item.name]) { byProduct[item.name] = []; productOrder.push(item.name); }
        byProduct[item.name].push({ order: o, item: item });
      });
    });
    content = productOrder.map(function(pname) {
      var rows = byProduct[pname].map(function(entry) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #f5f5f5;font-size:12.5px;">' +
          '<span>Order #' + entry.order.orderCode + ' \u00d7' + entry.item.qty + '</span>' +
          '<span style="color:#999;">' + formatDate(entry.order.createdAt) + '</span></div>';
      }).join('');
      return '<div style="margin-bottom:16px;"><p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#333;">' + pname + '</p>' + rows + '</div>';
    }).join('');
  }

  body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
    '<p class="login-sub" style="margin:0 0 14px;">All orders \u2014 separate from the Sales Report summary</p>' +
    groupToggle + content;
}

function orderRowHtml(o) {
  var statusInfo = getOrderStatusInfo(o.status);
  var itemsSummary = o.items.map(function(it) { return it.name + ' x' + it.qty; }).join(', ');
  return '<div style="padding:10px 4px;border-bottom:1px solid #f5f5f5;">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
    '<span style="font-weight:600;font-size:13px;">Order #' + o.orderCode + '</span>' +
    '<span style="font-weight:700;font-size:13px;">' + fmt(o.total) + '</span></div>' +
    '<p style="margin:2px 0 0;font-size:12px;color:#777;">' + itemsSummary + '</p>' +
    '<p style="margin:2px 0 0;font-size:11.5px;color:#999;">' + statusInfo.label + ' \u2022 ' + (o.paymentMethod === 'cod' ? 'COD' : 'GCash') + '</p>' +
    '</div>';
}

let merchantInventoryProductFilter = 'all';

function changeInventoryProductFilter(value) {
  merchantInventoryProductFilter = value;
  renderMerchantDashboard();
}

async function fetchMerchantInventory() {
  const { data: myProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, unit, stock_qty, sold_count, is_active')
    .eq('merchant_id', myMerchantId)
    .order('name', { ascending: true });
  if (prodErr) console.error('inventory: products error', prodErr);

  const { data: movements, error: moveErr } = await supabase
    .from('stock_movements')
    .select('type, quantity, reason, created_at, supplier_name, unit_cost, receipt_number, reference_order_id, orders(order_code), products!inner(id, name, merchant_id)')
    .eq('products.merchant_id', myMerchantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (moveErr) console.error('inventory: stock_movements error', moveErr);

  return { products: myProducts || [], movements: movements || [] };
}

function renderMerchantInventoryView(data) {
  var body = document.getElementById('sn-merchant-body');
  var tabs = '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'products\')">Products</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:var(--primary,#22C55E);color:#fff;font-size:12.5px;" onclick="switchMerchantView(\'inventory\')">Inventory</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'orders\')">Orders</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'sales\')">Sales Report</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'verify\')">Verification</button>' +
    '</div>';

  var totalUnits = data.products.reduce(function(a, p) { return a + (p.stock_qty || 0); }, 0);
  var lowStockCount = data.products.filter(function(p) { return p.stock_qty > 0 && p.stock_qty <= 5; }).length;
  var outOfStockCount = data.products.filter(function(p) { return p.stock_qty <= 0; }).length;

  var summaryCards = '<div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">' +
    '<div style="flex:1;min-width:90px;background:#F0F8FF;border-radius:10px;padding:12px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Total Units</p><p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#3B82F6;">' + totalUnits + '</p></div>' +
    '<div style="flex:1;min-width:90px;background:#FFFBEB;border-radius:10px;padding:12px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Low Stock</p><p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#B45309;">' + lowStockCount + '</p></div>' +
    '<div style="flex:1;min-width:90px;background:#FEE2E2;border-radius:10px;padding:12px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Out of Stock</p><p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#DC2626;">' + outOfStockCount + '</p></div>' +
    '</div>';

  var stockTable = data.products.length
    ? '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
      '<thead><tr style="border-bottom:2px solid #eee;text-align:left;color:#999;font-size:11px;text-transform:uppercase;">' +
      '<th style="padding:6px 4px;">Product</th><th style="padding:6px 4px;">Unit</th><th style="padding:6px 4px;text-align:right;">In Stock</th><th style="padding:6px 4px;text-align:right;">Sold</th><th style="padding:6px 4px;">Status</th></tr></thead><tbody>' +
      data.products.map(function(p) {
        var statusHtml = p.stock_qty <= 0
          ? '<span style="color:#DC2626;font-weight:600;">Out of Stock</span>'
          : (p.stock_qty <= 5 ? '<span style="color:#B45309;font-weight:600;">Low</span>' : '<span style="color:#15803D;">OK</span>');
        return '<tr style="border-bottom:1px solid #f5f5f5;' + (p.is_active ? '' : 'opacity:0.5;') + '">' +
          '<td style="padding:8px 4px;">' + p.name + (p.is_active ? '' : ' <span style="color:#999;">(inactive)</span>') + '</td>' +
          '<td style="padding:8px 4px;color:#777;">' + (p.unit || 'pc') + '</td>' +
          '<td style="padding:8px 4px;text-align:right;font-weight:600;">' + p.stock_qty + '</td>' +
          '<td style="padding:8px 4px;text-align:right;color:#777;">' + (p.sold_count || 0) + '</td>' +
          '<td style="padding:8px 4px;">' + statusHtml + '</td></tr>';
      }).join('') +
      '</tbody></table></div>'
    : '<p style="color:#999;font-size:13px;">No products yet.</p>';

  // Group by product so the dropdown can filter to just one at a time —
  // same interaction pattern as the Sales Report's date filter. //
  var byProduct = {};
  var productOrder = [];
  data.movements.forEach(function(m) {
    var pname = m.products ? m.products.name : 'Unknown product';
    if (!byProduct[pname]) { byProduct[pname] = []; productOrder.push(pname); }
    byProduct[pname].push(m);
  });
  productOrder.sort();

  var productFilterDropdown = '<select onchange="changeInventoryProductFilter(this.value)" style="width:100%;padding:9px 14px;border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:14px;">' +
    '<option value="all"' + (merchantInventoryProductFilter === 'all' ? ' selected' : '') + '>All Products</option>' +
    productOrder.map(function(pname) {
      return '<option value="' + pname.replace(/"/g, '&quot;') + '"' + (merchantInventoryProductFilter === pname ? ' selected' : '') + '>' + pname + '</option>';
    }).join('') +
    '</select>';

  var shownProducts = merchantInventoryProductFilter === 'all' ? productOrder : productOrder.filter(function(p) { return p === merchantInventoryProductFilter; });

  var ledgerHtml = shownProducts.length
    ? shownProducts.map(function(pname) {
        var entries = byProduct[pname];
        var entriesHtml = entries.map(function(m) {
          var detailLine = '';
          if (m.type === 'in') {
            var parts = [];
            if (m.supplier_name) parts.push('Supplier: ' + m.supplier_name);
            if (m.unit_cost !== null && m.unit_cost !== undefined) parts.push('Unit cost: ' + fmt(m.unit_cost));
            if (m.receipt_number) parts.push('Receipt #' + m.receipt_number);
            detailLine = parts.join(' \u2022 ');
          } else {
            detailLine = m.orders ? 'Order #' + m.orders.order_code : (m.reference_order_id ? 'Order-linked' : '');
          }
          return '<div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #f5f5f5;font-size:12.5px;">' +
            '<div><span style="font-weight:600;color:' + (m.type === 'in' ? '#15803D' : '#B45309') + ';"><i class="fas fa-' + (m.type === 'in' ? 'arrow-up' : 'arrow-down') + '"></i> ' + (m.type === 'in' ? 'Stock In' : 'Stock Out') + '</span>' +
            (detailLine ? '<p style="margin:2px 0 0;color:#999;font-size:11px;">' + detailLine + '</p>' : '') +
            (m.reason && m.type === 'in' ? '<p style="margin:2px 0 0;color:#bbb;font-size:10.5px;">' + m.reason + '</p>' : '') + '</div>' +
            '<div style="text-align:right;"><span style="font-weight:700;">' + (m.type === 'in' ? '+' : '\u2212') + m.quantity + '</span>' +
            '<p style="margin:2px 0 0;color:#aaa;font-size:11px;">' + timeAgo(m.created_at) + '</p></div></div>';
        }).join('');

        return '<div style="margin-bottom:16px;">' +
          (merchantInventoryProductFilter === 'all' ? '<p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#333;">' + pname + '</p>' : '') +
          entriesHtml + '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No stock movements' + (merchantInventoryProductFilter !== 'all' ? ' for ' + merchantInventoryProductFilter : '') + ' yet.</p>';

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
    '<p class="login-sub" style="margin:0 0 14px;">Inventory tracking \u2014 separate from sales revenue</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
    '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="downloadSalesReportPDF()"><i class="fas fa-file-pdf"></i> Download as PDF</button>' +
    '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="downloadSalesReportImage()"><i class="fas fa-image"></i> Download as Image</button>' +
    '</div>' +
    summaryCards +
    '<h3 style="margin:0 0 8px;font-size:14px;">Current Stock</h3>' + stockTable +
    '<h3 style="margin:18px 0 8px;font-size:14px;">Stock In / Out Ledger</h3>' + productFilterDropdown + ledgerHtml;
}

// Renders a circular percentage gauge as inline SVG — used only for
// metrics that are genuinely computable percentages (sell-through rate,
// order completion rate), never as decoration standing in for a real number. //
function gaugeSvg(pct, color, size) {
  size = size || 84;
  var r = size / 2 - 8;
  var c = 2 * Math.PI * r;
  var offset = c * (1 - pct / 100);
  var center = size / 2;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle cx="' + center + '" cy="' + center + '" r="' + r + '" fill="none" stroke="#F0F0EE" stroke-width="8"/>' +
    '<circle cx="' + center + '" cy="' + center + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" ' +
    'stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" ' +
    'transform="rotate(-90 ' + center + ' ' + center + ')"/>' +
    '<text x="' + center + '" y="' + (center + 5) + '" text-anchor="middle" font-size="17" font-weight="700" fill="' + color + '">' + pct + '%</text>' +
    '</svg>';
}

function renderMerchantSalesView() {
  var body = document.getElementById('sn-merchant-body');
  var tabs = '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'products\')">Products</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'inventory\')">Inventory</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'orders\')">Orders</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:var(--primary,#22C55E);color:#fff;font-size:12.5px;" onclick="switchMerchantView(\'sales\')">Sales Report</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="switchMerchantView(\'verify\')">Verification</button>' +
    '</div>';

  if (!myMerchantSales || myMerchantSales.error) {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
      '<div class="track-empty"><p>Could not load sales report' + (myMerchantSales && myMerchantSales.error ? ': ' + myMerchantSales.error : '') + '.</p></div>';
    return;
  }

  var s = myMerchantSales;

  var summaryCards = '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
    '<div style="flex:1;background:#F0FFF4;border-radius:10px;padding:14px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Total Revenue</p>' +
    '<p style="margin:4px 0 0;font-weight:700;font-size:16px;color:var(--primary,#22C55E);">' + fmt(s.totalRevenue) + '</p></div>' +
    '<div style="flex:1;background:#F0F8FF;border-radius:10px;padding:14px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Items Sold</p>' +
    '<p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#3B82F6;">' + s.totalItems + '</p></div>' +
    '<div style="flex:1;background:#FFFBEB;border-radius:10px;padding:14px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Orders</p>' +
    '<p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#F59E0B;">' + s.orderCount + '</p></div>' +
    '</div>';

  // Gauges — only rendered when there's actually enough data to compute
  // a meaningful percentage; otherwise shown as "not enough data yet". //
  var gaugesHtml = '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
    '<div style="flex:1;background:#fff;border:1px solid #eee;border-radius:10px;padding:14px;text-align:center;">' +
    (s.sellThroughRate === null
      ? '<p style="color:#999;font-size:12px;padding:20px 0;">No stock history yet</p>'
      : gaugeSvg(s.sellThroughRate, '#3B82F6')) +
    '<p style="margin:6px 0 0;font-size:11px;color:#666;">Sell-Through Rate</p>' +
    '<p style="margin:2px 0 0;font-size:10px;color:#aaa;">Units sold vs. ever stocked</p></div>' +
    '<div style="flex:1;background:#fff;border:1px solid #eee;border-radius:10px;padding:14px;text-align:center;">' +
    (s.completionRate === null
      ? '<p style="color:#999;font-size:12px;padding:20px 0;">No orders yet</p>'
      : gaugeSvg(s.completionRate, 'var(--primary,#22C55E)')) +
    '<p style="margin:6px 0 0;font-size:11px;color:#666;">Order Completion Rate</p>' +
    '<p style="margin:2px 0 0;font-size:10px;color:#aaa;">Delivered vs. all orders</p></div>' +
    '</div>';

  // Revenue by category — real data, since every product already has a category //
  var categoryEntries = Object.keys(s.byCategory).map(function(cat) {
    return { cat: cat, revenue: s.byCategory[cat], label: CATEGORY_META[cat] ? CATEGORY_META[cat].title : cat };
  }).sort(function(a, b) { return b.revenue - a.revenue; });
  var maxCatRevenue = categoryEntries.length ? categoryEntries[0].revenue : 1;
  var categoryChartHtml = categoryEntries.length
    ? categoryEntries.map(function(c) {
        var pct = Math.round((c.revenue / maxCatRevenue) * 100);
        return '<div style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>' + c.label + '</span><span style="font-weight:600;">' + fmt(c.revenue) + '</span></div>' +
          '<div style="background:#F0F0EE;border-radius:6px;height:8px;overflow:hidden;"><div style="background:var(--primary,#22C55E);height:100%;width:' + pct + '%;"></div></div>' +
          '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No sales yet.</p>';

  // Net profit — only shown for products where the merchant actually
  // entered a cost price. Never estimated or guessed. //
  var profitHtml;
  if (s.itemsWithCost === 0) {
    profitHtml = '<div style="background:#F9FAFB;border-radius:10px;padding:14px;">' +
      '<p style="margin:0;color:#777;font-size:12.5px;"><i class="fas fa-circle-info"></i> Add a cost price to your products (Products tab \u2192 Edit) to see real profit here.</p></div>';
  } else {
    var profitNote = s.itemsWithoutCost > 0
      ? '<p style="margin:4px 0 0;font-size:11px;color:#999;">Based on ' + s.itemsWithCost + ' of ' + (s.itemsWithCost + s.itemsWithoutCost) + ' items sold \u2014 the rest don\'t have a cost price set yet.</p>'
      : '<p style="margin:4px 0 0;font-size:11px;color:#999;">Based on all items sold.</p>';
    profitHtml = '<div style="background:#F0FFF4;border-radius:10px;padding:14px;">' +
      '<p style="margin:0;font-size:11px;color:#666;">Net Profit</p>' +
      '<p style="margin:4px 0 0;font-weight:700;font-size:20px;color:' + (s.knownProfit >= 0 ? 'var(--primary,#22C55E)' : '#DC2626') + ';">' + fmt(s.knownProfit) + '</p>' +
      profitNote + '</div>';
  }

  // Per-product profit breakdown, grouped exactly like the ledger — each
  // product's own margin, not just a platform-wide total. //
  var productsWithCost = (s.productProfits || []).filter(function(p) { return p.itemsWithCost > 0; });
  var productProfitHtml = productsWithCost.length
    ? '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
      '<thead><tr style="border-bottom:2px solid #eee;text-align:left;color:#999;font-size:11px;text-transform:uppercase;">' +
      '<th style="padding:6px 4px;">Product</th><th style="padding:6px 4px;text-align:right;">Units Sold</th><th style="padding:6px 4px;text-align:right;">Revenue</th><th style="padding:6px 4px;text-align:right;">Supplier Cost</th><th style="padding:6px 4px;text-align:right;">Profit</th></tr></thead><tbody>' +
      productsWithCost.map(function(p) {
        return '<tr style="border-bottom:1px solid #f5f5f5;">' +
          '<td style="padding:8px 4px;">' + p.name + (p.itemsWithoutCost > 0 ? ' <span style="color:#999;font-size:10.5px;">(partial data)</span>' : '') + '</td>' +
          '<td style="padding:8px 4px;text-align:right;">' + p.qty + '</td>' +
          '<td style="padding:8px 4px;text-align:right;">' + fmt(p.revenue) + '</td>' +
          '<td style="padding:8px 4px;text-align:right;color:#B45309;">' + fmt(p.cost) + '</td>' +
          '<td style="padding:8px 4px;text-align:right;font-weight:700;color:' + (p.profit >= 0 ? '#15803D' : '#DC2626') + ';">' + fmt(p.profit) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>'
    : '';

  var dateFilterDropdown = '<select onchange="changeMerchantSalesDateFilter(this.value)" style="padding:7px 12px;border-radius:8px;border:1px solid #e5e5e5;font-size:12.5px;margin-bottom:14px;">' +
    [['all', 'All Time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Within a Week'], ['month', 'Within a Month'], ['year', 'Within a Year']]
      .map(function(d) { return '<option value="' + d[0] + '"' + (s.dateFilter === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') +
    '</select>';

  // Week-over-week — real comparison using actual timestamps, not a
  // fabricated year-over-year figure the store has no history for. //
  var wowHtml;
  if (s.wowChange === null) {
    wowHtml = '<p style="color:#999;font-size:12px;">Not enough order history yet for a week-over-week comparison.</p>';
  } else {
    var up = s.wowChange >= 0;
    wowHtml = '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:22px;font-weight:700;color:' + (up ? 'var(--primary,#22C55E)' : '#DC2626') + ';"><i class="fas fa-arrow-' + (up ? 'up' : 'down') + '"></i> ' + Math.abs(s.wowChange) + '%</span>' +
      '<span style="font-size:12px;color:#777;">' + fmt(s.thisWeekRevenue) + ' this week vs ' + fmt(s.lastWeekRevenue) + ' last week</span>' +
      '</div>';
  }

  var topProductsHtml = s.topProducts.length
    ? s.topProducts.map(function(p, i) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<span style="font-size:13px;">' + (i + 1) + '. ' + p.name + '</span>' +
          '<span style="font-size:13px;color:#777;">' + p.qty + ' sold \u2022 ' + fmt(p.revenue) + '</span></div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No sales yet.</p>';

  var recentOrdersHtml = (s.recentOrders && s.recentOrders.length)
    ? s.recentOrders.map(function(o) {
        var itemsList = o.items.map(function(it) { return it.name + ' \u00d7' + it.qty + ' (' + fmt(it.price) + ' ea)'; }).join('<br/>');
        var statusInfo = getOrderStatusInfo(o.status);
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
          '<span style="font-weight:700;font-size:13px;">Order #' + o.orderCode + '</span>' +
          '<span style="font-size:11.5px;color:#777;">' + statusInfo.label + ' \u2022 ' + (o.paymentMethod === 'cod' ? 'COD' : 'GCash') + '</span>' +
          '</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#555;"><i class="fas fa-user"></i> ' + (o.customerName || 'Customer') + ' \u2022 ' + formatDate(o.createdAt) + '</p>' +
          '<p style="margin:6px 0 0;font-size:12px;color:#555;line-height:1.6;">' + itemsList + '</p>' +
          '<p style="margin:6px 0 0;font-size:12.5px;font-weight:700;color:var(--primary,#22C55E);">Total: ' + fmt(o.total) + '</p>' +
          (o.notArrived ? '<p style="margin:6px 0 0;background:#FEE2E2;color:#DC2626;padding:6px 8px;border-radius:6px;font-size:11.5px;font-weight:600;"><i class="fas fa-exclamation-triangle"></i> Customer reports non-delivery</p>' : '') +
          '<button class="co-btn" style="background:#F3F4F6;color:#333;font-size:11.5px;padding:5px 10px;margin-top:8px;" onclick="openChatThread(\'' + o.orderId + '\', \'' + o.customerId + '\', \'' + (o.customerName || 'Customer').replace(/'/g, "\\'") + '\')"><i class="fas fa-comment-dots"></i> Message Customer</button>' +
          '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No orders yet.</p>';

  var activityHtml = (s.activity && s.activity.length)
    ? s.activity.map(function(e) {
        return '<div style="display:flex;gap:10px;padding:10px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#F5F5F3;color:' + e.color + ';display:flex;align-items:center;justify-content:center;font-size:12px;"><i class="fas ' + e.icon + '"></i></div>' +
          '<div style="flex:1;min-width:0;">' +
          '<p style="margin:0;font-size:12.5px;font-weight:600;">' + e.title + '</p>' +
          (e.detail ? '<p style="margin:2px 0 0;font-size:12px;color:#777;">' + e.detail + '</p>' : '') +
          '<p style="margin:2px 0 0;font-size:11px;color:#aaa;">' + formatDate(e.at) + ' \u2022 ' + timeAgo(e.at) + '</p>' +
          '</div></div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No activity yet. Sales, stock changes, and reviews will appear here.</p>';

  var exportButtons = '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
    '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="downloadSalesReportPDF()"><i class="fas fa-file-pdf"></i> Download as PDF</button>' +
    '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;font-size:12.5px;" onclick="downloadSalesReportImage()"><i class="fas fa-image"></i> Download as Image</button>' +
    '</div>';

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
    exportButtons +
    dateFilterDropdown +
    summaryCards +
    gaugesHtml +
    '<h3 style="margin:0 0 8px;font-size:14px;">This Week vs Last Week</h3>' + wowHtml +
    '<h3 style="margin:18px 0 8px;font-size:14px;">Revenue by Category</h3>' + categoryChartHtml +
    '<h3 style="margin:18px 0 8px;font-size:14px;">Net Profit</h3>' + profitHtml +
    (productProfitHtml ? '<h3 style="margin:18px 0 8px;font-size:14px;">Profit by Product</h3>' + productProfitHtml : '') +
    '<h3 style="margin:18px 0 8px;font-size:14px;">Top Products</h3>' + topProductsHtml +
    '<h3 style="margin:18px 0 8px;font-size:14px;">Customer Feedback</h3>' +
    '<p style="margin:0 0 6px;font-size:11.5px;color:#999;">New reviews on your products \u2014 see the Inventory tab for stock activity</p>' +
    activityHtml;
}

// The old "Print / Save as PDF" button relied on window.print(), which
// doesn't work reliably here — the report lives inside a position:fixed,
// internally-scrolling modal, and browsers clip printed output to
// whatever's currently visible in that scroll area rather than the full
// content, producing blank pages beyond the first screen's worth.
// This generates an actual PDF file directly instead, using the same
// html2canvas capture as the image export, paired with jsPDF to paginate
// it properly if the report is taller than one page. //
function downloadSalesReportPDF() {
  var need = [];
  if (!window.html2canvas) need.push('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!window.jspdf) need.push('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

  if (!need.length) { captureSalesReportPDF(); return; }

  showToast('Preparing PDF export...', 'info');
  var loaded = 0;
  need.forEach(function(src) {
    var script = document.createElement('script');
    script.src = src;
    script.onload = function() {
      loaded++;
      if (loaded === need.length) captureSalesReportPDF();
    };
    script.onerror = function() { showToast('Could not load PDF export tool.', 'error'); };
    document.head.appendChild(script);
  });
}

function captureSalesReportPDF() {
  var target = document.getElementById('sn-merchant-body');
  if (!target) return;

  var toHide = target.querySelectorAll('button');
  toHide.forEach(function(b) { b.style.visibility = 'hidden'; });

  window.html2canvas(target, { backgroundColor: '#ffffff', scale: 2 }).then(function(canvas) {
    toHide.forEach(function(b) { b.style.visibility = ''; });

    var pdf = new window.jspdf.jsPDF('p', 'pt', 'a4');
    var pageWidth = pdf.internal.pageSize.getWidth();
    var pageHeight = pdf.internal.pageSize.getHeight();
    var imgWidth = pageWidth;
    var imgHeight = (canvas.height * imgWidth) / canvas.width;
    var imgData = canvas.toDataURL('image/png');

    var heightLeft = imgHeight;
    var position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save('HomeWeb_Report_' + new Date().toISOString().slice(0, 10) + '.pdf');
    showToast('PDF downloaded \u2705');
  }).catch(function(err) {
    toHide.forEach(function(b) { b.style.visibility = ''; });
    showToast('Could not generate PDF: ' + err.message, 'error');
  });
}

// Captures the report as a PNG using html2canvas, loaded on demand from
// a CDN so it doesn't add weight to every page load — only merchants who
// actually click this ever download it. //
function downloadSalesReportImage() {
  if (window.html2canvas) {
    captureSalesReportImage();
    return;
  }
  showToast('Preparing image export...', 'info');
  var script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.onload = captureSalesReportImage;
  script.onerror = function() { showToast('Could not load image export tool.', 'error'); };
  document.head.appendChild(script);
}

function captureSalesReportImage() {
  var target = document.getElementById('sn-merchant-body');
  if (!target) return;

  // Temporarily hide the export/tab buttons so they don't appear in the image //
  var toHide = target.querySelectorAll('button');
  toHide.forEach(function(b) { b.style.visibility = 'hidden'; });

  window.html2canvas(target, { backgroundColor: '#ffffff', scale: 2 }).then(function(canvas) {
    toHide.forEach(function(b) { b.style.visibility = ''; });
    var link = document.createElement('a');
    link.download = 'HomeWeb_Sales_Report_' + new Date().toISOString().slice(0, 10) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Report downloaded \u2705');
  }).catch(function(err) {
    toHide.forEach(function(b) { b.style.visibility = ''; });
    showToast('Could not generate image: ' + err.message, 'error');
  });
}


function renderMerchantDashboard() {
  var body = document.getElementById('sn-merchant-body');

  var tabs = '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (merchantDashboardView === 'products' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'products' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="switchMerchantView(\'products\')">Products</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (merchantDashboardView === 'inventory' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'inventory' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="switchMerchantView(\'inventory\')">Inventory</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (merchantDashboardView === 'orders' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'orders' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="switchMerchantView(\'orders\')">Orders</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (merchantDashboardView === 'sales' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'sales' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="switchMerchantView(\'sales\')">Sales Report</button>' +
    '<button class="co-btn" style="flex:1;min-width:80px;background:' + (merchantDashboardView === 'verify' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'verify' ? '#fff' : '#333') + ';font-size:12.5px;" onclick="switchMerchantView(\'verify\')">Verification</button>' +
    '</div>';

  if (merchantDashboardView === 'orders') {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<div class="track-empty"><p>Loading orders...</p></div>';
    fetchMerchantOrdersFull().then(renderMerchantOrdersView);
    return;
  }

  if (merchantDashboardView === 'sales') {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<div class="track-empty"><p>Loading sales report...</p></div>';
    fetchMerchantSales(merchantSalesDateFilter).then(renderMerchantSalesView);
    return;
  }

  if (merchantDashboardView === 'inventory') {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<div class="track-empty"><p>Loading inventory...</p></div>';
    fetchMerchantInventory().then(renderMerchantInventoryView);
    return;
  }

  if (merchantDashboardView === 'verify') {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<div class="track-empty"><p>Loading...</p></div>';
    renderMerchantVerificationView(tabs);
    return;
  }

  renderMerchantProductsView(tabs);
}

async function switchMerchantView(view) {
  merchantDashboardView = view;
  renderMerchantDashboard();
}

async function renderMerchantVerificationView(tabs) {
  var body = document.getElementById('sn-merchant-body');

  const { data: merchant, error } = await supabase.from('merchants').select('*').eq('id', myMerchantId).single();
  if (error || !merchant) {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<div class="track-empty"><p>Could not load verification status.</p></div>';
    return;
  }

  var statusBanner = merchant.is_verified
    ? '<div style="background:#F0FFF4;border-radius:10px;padding:14px;margin-bottom:16px;">' +
      '<p style="margin:0;font-weight:700;color:var(--primary,#22C55E);font-size:13.5px;"><i class="fas fa-badge-check"></i> Verified Seller</p>' +
      '<p style="margin:6px 0 0;font-size:12.5px;color:#555;">Your business permit has been reviewed and approved. A verified badge now shows next to your store name.</p>' +
      '</div>'
    : (merchant.business_permit_url
        ? '<div style="background:#FFFBEB;border-radius:10px;padding:14px;margin-bottom:16px;">' +
          '<p style="margin:0;font-weight:700;color:#B45309;font-size:13.5px;"><i class="fas fa-clock"></i> Pending Verification</p>' +
          '<p style="margin:6px 0 0;font-size:12.5px;color:#555;">Your permit was submitted and is awaiting admin review.</p>' +
          '</div>'
        : '<div style="background:#F3F4F6;border-radius:10px;padding:14px;margin-bottom:16px;">' +
          '<p style="margin:0;font-weight:700;color:#555;font-size:13.5px;"><i class="fas fa-circle-info"></i> Not Verified</p>' +
          '<p style="margin:6px 0 0;font-size:12.5px;color:#666;">Upload your business permit below to apply for a verified badge. Customers will be able to view it on your store page.</p>' +
          '</div>');

  var permitPreview = merchant.business_permit_url
    ? '<a href="' + merchant.business_permit_url + '" target="_blank" style="display:block;margin-bottom:12px;">' +
      '<img src="' + merchant.business_permit_url + '" style="max-width:100%;border-radius:8px;border:1px solid #eee;"/></a>'
    : '';

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
    '<h3 style="margin:16px 0 10px;font-size:14px;">Business Permit Verification</h3>' +
    statusBanner +
    permitPreview +
    '<button type="button" class="co-btn" style="background:#F3F4F6;color:#333;width:100%;" onclick="document.getElementById(\'permit-file-input\').click()">' +
    '<i class="fas fa-upload"></i> ' + (merchant.business_permit_url ? 'Replace Permit Photo' : 'Upload Business Permit') + '</button>' +
    '<input type="file" id="permit-file-input" accept="image/*,application/pdf" style="display:none;" onchange="uploadBusinessPermit(this.files[0])"/>' +
    '<p style="margin:10px 0 0;font-size:11.5px;color:#999;">Accepted: photo or scan of your DTI/BIR/Barangay business permit. Visible to customers and reviewed by HomeWeb admins.</p>';
}

async function uploadBusinessPermit(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { showToast('File must be under 8MB', 'error'); return; }

  showToast('Uploading permit...', 'info');
  var ext = file.name.split('.').pop();
  var path = 'permits/' + myMerchantId + '/' + Date.now() + '.' + ext;

  const { error: uploadErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
  if (uploadErr) { showToast('Could not upload permit: ' + uploadErr.message, 'error'); return; }

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);

  // Uploading a new permit resets verification — an admin needs to review the new document //
  const { error: updateErr } = await supabase.from('merchants')
    .update({ business_permit_url: urlData.publicUrl, is_verified: false })
    .eq('id', myMerchantId);
  if (updateErr) { showToast('Could not save permit: ' + updateErr.message, 'error'); return; }

  showToast('Permit uploaded \u2705 Awaiting admin review');
  renderMerchantDashboard();
}

async function viewProductReviews(productId, productName) {
  var body = document.getElementById('sn-merchant-body');
  body.innerHTML = '<div class="track-empty"><p>Loading reviews...</p></div>';

  const { data, error } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, is_anonymous, reviewer_name, reviewer_avatar_url')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  var rowsHtml = (!error && data && data.length)
    ? data.map(reviewRowHtml).join('')
    : '<p style="color:#999;font-size:13px;">No reviews yet for this product.</p>';

  body.innerHTML =
    '<div class="track-detail-back" onclick="renderMerchantDashboard()">Back to My Store</div>' +
    '<h2 style="margin:8px 0 16px;">Reviews \u2014 ' + productName + '</h2>' +
    rowsHtml;
}

function renderMerchantProductsView(tabs) {
  var body = document.getElementById('sn-merchant-body');

  var rows = myMerchantProducts.map(function(p) {
    var meta = CATEGORY_META[p.category] || DEFAULT_CATEGORY_META;
    return '<div style="display:flex;gap:12px;align-items:center;padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
      '<div style="flex-shrink:0;width:44px;height:44px;border-radius:8px;background:' + meta.bg + ';display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
      (p.image_url ? '<img src="' + p.image_url + '" style="width:100%;height:100%;object-fit:cover;"/>' : '<i class="fas ' + meta.icon + '" style="color:' + meta.color + ';"></i>') +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<p style="margin:0;font-weight:600;font-size:13.5px;">' + p.name + (p.is_active ? '' : ' <span style="color:#DC2626;font-size:11px;">(inactive)</span>') + '</p>' +
      '<p style="margin:2px 0 0;color:#777;font-size:12.5px;">' + fmt(p.price) + ' \u2022 Stock: ' + p.stock_qty + ' \u2022 ' + (p.sold_count || 0) + ' sold \u2022 ' + meta.title + '</p>' +
      '<p style="margin:2px 0 0;color:#F59E0B;font-size:12px;">' + stars(p.rating_avg || 0) + ' ' + (p.rating_avg > 0 ? p.rating_avg + ' ' : '') + '<span style="color:#999;">(' + (p.rating_count || 0) + ')</span></p>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0;">' +
      '<button class="co-btn" style="padding:6px 10px;background:#F3F4F6;color:#333;" onclick="viewProductReviews(\'' + p.id + '\', \'' + p.name.replace(/'/g, "\\'") + '\')" title="Reviews"><i class="fas fa-comment-dots"></i></button>' +
      '<button class="co-btn" style="padding:6px 10px;background:#F3F4F6;color:#333;" onclick="openStockInModal(\'' + p.id + '\')" title="Stock in"><i class="fas fa-plus"></i></button>' +
      '<button class="co-btn" style="padding:6px 10px;background:#F3F4F6;color:#333;" onclick="openProductForm(\'' + p.id + '\')" title="Edit"><i class="fas fa-edit"></i></button>' +
      '<button class="co-btn" style="padding:6px 10px;background:#F3F4F6;color:#333;" onclick="toggleProductActive(\'' + p.id + '\', ' + !p.is_active + ')" title="' + (p.is_active ? 'Deactivate' : 'Activate') + '"><i class="fas fa-' + (p.is_active ? 'eye-slash' : 'eye') + '"></i></button>' +
      '<button class="co-btn" style="padding:6px 10px;background:#FEE2E2;color:#DC2626;" onclick="deleteMyProduct(\'' + p.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
      '</div></div>';
  }).join('');

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Store</h2>' +
    tabs +
    '<p class="login-sub" style="margin:0 0 16px;">' + myMerchantProducts.length + ' product(s) listed</p>' +
    '<button class="co-btn co-btn--next" style="width:100%;margin-bottom:14px;" onclick="openProductForm(null)"><i class="fas fa-plus"></i> Add Product</button>' +
    (rows || '<div class="track-empty"><p>No products yet. Add your first one above.</p></div>');
}

// Add/Edit product form (shown inline in the same dashboard body) //
function openProductForm(productId) {
  editingProductId = productId;
  pendingProductImageFile = null;
  var body = document.getElementById('sn-merchant-body');
  var p = productId ? myMerchantProducts.find(function(x) { return x.id === productId; }) : null;

  body.innerHTML =
    '<h2 style="margin:0 0 16px;">' + (p ? 'Edit Product' : 'Add Product') + '</h2>' +
    '<div class="co-field"><label>Product Name <span class="co-required">*</span></label>' +
    '<input type="text" id="pf-name" value="' + (p ? p.name : '') + '"/>' +
    '<span class="co-field-error">Name is required</span></div>' +
    '<div class="co-field"><label>Description</label>' +
    '<input type="text" id="pf-desc" value="' + (p && p.description ? p.description : '') + '"/></div>' +
    '<div class="co-field"><label>Price (\u20B1) <span class="co-required">*</span></label>' +
    '<input type="number" id="pf-price" min="0" step="0.01" value="' + (p ? p.price : '') + '"/>' +
    '<span class="co-field-error">Enter a valid price</span></div>' +
    '<div class="co-field"><label>Cost Price (\u20B1) <span style="color:#999;font-weight:400;">\u2014 optional</span></label>' +
    '<input type="number" id="pf-cost-price" min="0" step="0.01" placeholder="What you paid for this, if you want profit tracked" value="' + (p && p.cost_price !== null && p.cost_price !== undefined ? p.cost_price : '') + '"/>' +
    '<span style="font-size:11px;color:#999;">Leave blank if you\'d rather not track this \u2014 your Sales Report just won\'t show profit for this item.</span></div>' +
    '<div class="co-field"><label>Unit of Measurement <span class="co-required">*</span></label>' +
    '<input type="text" id="pf-unit" placeholder="Type your own, e.g. 1kg, 350g, pack of 3, sack" value="' + (p && p.unit ? p.unit : '') + '"/>' +
    '<span class="co-field-error">Specify a unit (e.g. 1kg, pack)</span></div>' +
    '<div class="co-field"><label>Category</label>' +
    '<select id="pf-category">' +
    Object.keys(CATEGORY_META).filter(function(k) { return k !== 'other'; }).concat(['other']).map(function(k) {
      return '<option value="' + k + '"' + (p && p.category === k ? ' selected' : '') + '>' + CATEGORY_META[k].title + '</option>';
    }).join('') +
    '</select></div>' +
    '<div class="co-field"><label>Product Photo</label>' +
    '<div style="display:flex;gap:12px;align-items:center;">' +
    '<div id="pf-image-preview" style="width:56px;height:56px;border-radius:8px;background:#F3F4F6;overflow:hidden;flex-shrink:0;">' +
    (p && p.image_url ? '<img src="' + p.image_url + '" style="width:100%;height:100%;object-fit:cover;"/>' : '') +
    '</div>' +
    '<button type="button" class="co-btn" style="background:#F3F4F6;color:#333;" onclick="document.getElementById(\'pf-image-file\').click()">Choose Photo</button>' +
    '<input type="file" id="pf-image-file" accept="image/*" style="display:none;" onchange="previewProductImage(this.files[0])"/>' +
    '</div></div>' +
    (p ? '' :
      '<div class="co-field"><label>Initial Stock <span class="co-required">*</span></label>' +
      '<input type="number" id="pf-stock" min="0" value="0"/>' +
      '<span class="co-field-error">Enter a starting stock quantity</span></div>') +
    '<button class="co-btn co-btn--next" style="width:100%;margin-top:6px;" id="pf-save-btn" onclick="saveProduct()">' + (p ? 'Save Changes' : 'Add Product') + '</button>' +
    '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;" onclick="renderMerchantDashboard()">Cancel</button>';

  ['pf-name', 'pf-price', 'pf-cost-price', 'pf-stock', 'pf-unit'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function() { this.closest('.co-field').classList.remove('co-field--error'); });
  });
}

function previewProductImage(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }
  pendingProductImageFile = file;
  var preview = document.getElementById('pf-image-preview');
  preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="width:100%;height:100%;object-fit:cover;"/>';
}

async function saveProduct() {
  var name = document.getElementById('pf-name').value.trim();
  var price = parseFloat(document.getElementById('pf-price').value);
  var category = document.getElementById('pf-category').value;
  var desc = document.getElementById('pf-desc').value.trim();
  var unit = document.getElementById('pf-unit').value.trim();
  var costPriceRaw = document.getElementById('pf-cost-price').value.trim();
  var costPrice = costPriceRaw === '' ? null : parseFloat(costPriceRaw);

  var ok = true;
  if (!name) { document.getElementById('pf-name').closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (!(price >= 0)) { document.getElementById('pf-price').closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (!unit) { document.getElementById('pf-unit').closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (costPriceRaw !== '' && !(costPrice >= 0)) { document.getElementById('pf-cost-price').closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (!ok) { showToast('Please fix the errors above', 'info'); return; }

  var saveBtn = document.getElementById('pf-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  // Upload a new photo if one was chosen; otherwise keep whatever's already there //
  var imageUrl = null;
  var existingProduct = editingProductId ? myMerchantProducts.find(function(x) { return x.id === editingProductId; }) : null;
  if (existingProduct) imageUrl = existingProduct.image_url;

  if (pendingProductImageFile) {
    var ext = pendingProductImageFile.name.split('.').pop();
    var path = 'products/' + myMerchantId + '/' + Date.now() + '.' + ext;
    const { error: uploadErr } = await supabase.storage.from('uploads').upload(path, pendingProductImageFile, { upsert: true });
    if (uploadErr) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editingProductId ? 'Save Changes' : 'Add Product'; }
      showToast('Could not upload photo: ' + uploadErr.message, 'error');
      return;
    }
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
    imageUrl = urlData.publicUrl;
  }

  if (editingProductId) {
    const { error } = await supabase.from('products').update({
      name: name, description: desc, price: price, cost_price: costPrice, category: category, unit: unit, image_url: imageUrl, updated_at: new Date().toISOString()
    }).eq('id', editingProductId);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    if (error) { showToast('Could not save: ' + error.message, 'error'); return; }
    showToast('Product updated \u2705');
  } else {
    var stockEl = document.getElementById('pf-stock');
    var stock = stockEl ? parseInt(stockEl.value, 10) || 0 : 0;

    const { data: newProduct, error } = await supabase.from('products').insert({
      merchant_id: myMerchantId, name: name, description: desc, price: price, cost_price: costPrice,
      category: category, unit: unit, image_url: imageUrl, stock_qty: stock
    }).select().single();
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Add Product'; }
    if (error) { showToast('Could not add product: ' + error.message, 'error'); return; }

    if (stock > 0) {
      await supabase.from('stock_movements').insert({
        product_id: newProduct.id, type: 'in', quantity: stock, reason: 'Initial stock'
      });
    }
    showToast('Product added \u2705');
  }

  pendingProductImageFile = null;
  await loadMyMerchantProducts();
  renderMerchantDashboard();
  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();
}

var currentStockInProductId = null;

function openStockInModal(productId) {
  var product = myMerchantProducts.find(function(x) { return x.id === productId; });
  if (!product) return;
  currentStockInProductId = productId;

  var body = document.getElementById('sn-stock-in-body');
  body.innerHTML =
    '<div class="login-icon"><i class="fas fa-box"></i></div>' +
    '<h2>Stock In</h2>' +
    '<p class="login-sub">' + product.name + ' \u2014 currently ' + product.stock_qty + ' ' + (product.unit || 'pc') + ' in stock</p>' +
    '<div class="co-field"><label>Quantity to Add <span class="co-required">*</span></label>' +
    '<input type="number" id="stockin-qty" min="1" placeholder="e.g. 50"/></div>' +
    '<div class="co-field"><label>Supplier Name <span class="co-required">*</span></label>' +
    '<input type="text" id="stockin-supplier" placeholder="Who supplied this stock?"/></div>' +
    '<div class="co-form-row">' +
    '<div class="co-field"><label>Unit Cost (\u20B1)</label>' +
    '<input type="number" id="stockin-unitcost" min="0" step="0.01" placeholder="Cost per unit"/></div>' +
    '<div class="co-field"><label>Receipt Number</label>' +
    '<input type="text" id="stockin-receipt" placeholder="Official receipt #"/></div>' +
    '</div>' +
    '<div class="co-field"><label>Notes (optional)</label>' +
    '<input type="text" id="stockin-notes" placeholder="e.g. Weekly restock"/></div>' +
    '<label style="display:flex;align-items:flex-start;gap:8px;margin:10px 0;font-size:12.5px;color:#555;cursor:pointer;">' +
    '<input type="checkbox" id="stockin-update-cost" checked style="margin-top:2px;"/>' +
    '<span>Update this product\'s cost price to match the unit cost above, so profit calculations stay current</span></label>' +
    '<button class="co-btn co-btn--next login-submit" id="stockin-submit-btn" onclick="submitStockIn()">Add Stock</button>';

  document.getElementById('sn-stockInOverlay').classList.add('active');
  document.getElementById('sn-stockInModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeStockInModal() {
  document.getElementById('sn-stockInOverlay').classList.remove('active');
  document.getElementById('sn-stockInModal').classList.remove('active');
  document.body.style.overflow = '';
  currentStockInProductId = null;
}

async function submitStockIn() {
  var productId = currentStockInProductId;
  var product = myMerchantProducts.find(function(x) { return x.id === productId; });
  if (!product) return;

  var qty = parseInt(document.getElementById('stockin-qty').value, 10);
  var supplier = document.getElementById('stockin-supplier').value.trim();
  var unitCostRaw = document.getElementById('stockin-unitcost').value.trim();
  var unitCost = unitCostRaw === '' ? null : parseFloat(unitCostRaw);
  var receipt = document.getElementById('stockin-receipt').value.trim();
  var notes = document.getElementById('stockin-notes').value.trim();
  var updateCost = document.getElementById('stockin-update-cost').checked;

  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'info'); return; }
  if (!supplier) { showToast('Supplier name is required', 'info'); return; }

  var btn = document.getElementById('stockin-submit-btn');
  btn.disabled = true; btn.textContent = 'Adding...';

  const { error } = await supabase.from('products')
    .update({ stock_qty: product.stock_qty + qty, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) { showToast('Could not update stock: ' + error.message, 'error'); btn.disabled = false; btn.textContent = 'Add Stock'; return; }

  await supabase.from('stock_movements').insert({
    product_id: productId, type: 'in', quantity: qty,
    reason: notes || 'Restock',
    supplier_name: supplier,
    unit_cost: unitCost,
    receipt_number: receipt || null
  });

  if (updateCost && unitCost !== null) {
    await supabase.from('products').update({ cost_price: unitCost }).eq('id', productId);
  }

  showToast('Added ' + qty + ' units \u2705');
  closeStockInModal();
  await loadMyMerchantProducts();
  renderMerchantDashboard();
  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();
}

async function toggleProductActive(productId, newState) {
  const { error } = await supabase.from('products').update({ is_active: newState }).eq('id', productId);
  if (error) { showToast('Could not update: ' + error.message, 'error'); return; }
  await loadMyMerchantProducts();
  renderMerchantDashboard();
  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();
}

async function deleteMyProduct(productId) {
  if (!confirm('Delete this product? This cannot be undone.')) return;

  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) {
    showToast('Could not delete — it may already have orders. Try deactivating it instead.', 'error');
    return;
  }
  showToast('Product deleted', 'info');
  await loadMyMerchantProducts();
  renderMerchantDashboard();
  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();
}



// ============================================================
// RIDER ORDER ALERTS — first-accept-first-served popup that shows
// regardless of what screen the rider is on, while they're online
// ============================================================

let riderAlertPollIntervalId = null;
let riderAlertShownOrderIds = {}; // session-only, avoids re-popping the same dismissed order
let riderAlertCurrentOrderId = null;

function startRiderAlertPolling() {
  if (riderAlertPollIntervalId) return; // already running
  riderAlertPollIntervalId = setInterval(checkForRiderOrderAlert, 8000);
  checkForRiderOrderAlert(); // also check immediately, don't wait for the first interval
}

function stopRiderAlertPolling() {
  if (riderAlertPollIntervalId) { clearInterval(riderAlertPollIntervalId); riderAlertPollIntervalId = null; }
  riderAlertShownOrderIds = {};
  riderAlertCurrentOrderId = null;
  var overlay = document.getElementById('sn-riderAlertOverlay');
  if (overlay) { overlay.classList.remove('active'); document.getElementById('sn-riderAlertModal').classList.remove('active'); }
}

async function checkForRiderOrderAlert() {
  if (!currentUser || userRoles.indexOf('rider') === -1) {
    console.log('[rider-alert] skipped: not logged in as a rider on this device', { hasUser: !!currentUser, roles: userRoles });
    return;
  }

  if (riderAlertCurrentOrderId) {
    // An alert is already showing — use this poll to verify it's still
    // valid rather than just sitting idle. If another rider claimed it,
    // or the customer cancelled it, close the popup automatically so
    // riders aren't left staring at a dead order. //
    const { data: stillValid } = await supabase
      .from('orders')
      .select('status, rider_user_id')
      .eq('id', riderAlertCurrentOrderId)
      .single();

    if (!stillValid || stillValid.status !== 'placed' || stillValid.rider_user_id) {
      var reason = (stillValid && stillValid.status === 'cancelled')
        ? 'This order was cancelled by the customer.'
        : 'Another rider already accepted this order.';
      closeRiderAlertPopup(reason);
    }
    return;
  }

  const { data: riderRow, error: riderErr } = await supabase.from('riders').select('is_available').eq('user_id', currentUser.id).single();
  if (riderErr) console.error('[rider-alert] could not load rider row:', riderErr);
  if (!riderRow || !riderRow.is_available) {
    console.log('[rider-alert] skipped: this account is offline (is_available=false in the riders table). Toggle online in My Deliveries.', { riderRow: riderRow });
    return;
  }

  var cutoff = new Date(Date.now() - RIDER_ALERT_MAX_AGE_MS).toISOString();

  const { data: candidates, error: candErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'placed')
    .is('rider_user_id', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(10);

  if (candErr) console.error('[rider-alert] could not query candidate orders:', candErr);
  if (!candidates || !candidates.length) {
    console.log('[rider-alert] online and checked, but no unclaimed orders found right now.');
    return;
  }
  var order = candidates.find(function(o) { return !riderAlertShownOrderIds[o.id]; });
  if (!order) {
    console.log('[rider-alert] all current candidates were already shown to this session.', { candidateCount: candidates.length });
    return;
  }

  console.log('[rider-alert] showing alert for order', order.order_code);

  // Bundle in any other unclaimed orders in the same barangay so the
  // rider can accept a whole route at once — this naturally covers same-
  // checkout siblings too, since one checkout always shares one address. //
  var orderBarangay = (order.shipping_barangay || '').trim().toLowerCase();
  var siblings = orderBarangay
    ? candidates.filter(function(o) { return (o.shipping_barangay || '').trim().toLowerCase() === orderBarangay; })
    : [order];

  showRiderOrderAlert(siblings);
}

async function showRiderOrderAlert(orders) {
  var primary = orders[0];
  var isBatch = orders.length > 1;
  riderAlertCurrentOrderId = primary.id;
  var body = document.getElementById('sn-rider-alert-body');
  var allIds = orders.map(function(o) { return o.id; }).join(',');
  var grandTotal = orders.reduce(function(a, o) { return a + o.total; }, 0);

  var ordersHtml = orders.map(function(o) {
    var itemsSummary = (o.order_items || []).map(function(it) { return it.product_name + ' x' + it.qty; }).join(', ');
    return '<div style="background:#F9FAFB;border-radius:10px;padding:14px;margin:8px 0;">' +
      '<p style="margin:0;font-weight:700;">Order #' + o.order_code + ' \u2014 ' + fmt(o.total) + '</p>' +
      '<p style="margin:6px 0 0;font-size:12.5px;color:#666;">' + itemsSummary + '</p>' +
      '</div>';
  }).join('');

  const { count: rejectionsToday } = await supabase
    .from('rider_rejections')
    .select('id', { count: 'exact', head: true })
    .eq('rider_user_id', currentUser.id)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  var rejectionsLeft = Math.max(0, 3 - (rejectionsToday || 0));

  body.innerHTML =
    '<div style="text-align:center;">' +
    '<div class="login-icon" style="color:var(--primary,#22C55E);"><i class="fas fa-bell"></i></div>' +
    '<h2 style="margin:6px 0;">' + (isBatch ? orders.length + ' Deliveries Available!' : 'New Delivery Available!') + '</h2>' +
    '<p class="login-sub">' + (isBatch ? 'Same barangay \u2014 accept together for one efficient route' : 'First to accept gets it') + '</p>' +
    '</div>' +
    ordersHtml +
    '<p style="margin:6px 0 0;font-size:12.5px;color:#666;"><i class="fas fa-map-marker-alt"></i> ' + (primary.shipping_street || '') + ', ' + (primary.shipping_city || '') + '</p>' +
    (isBatch ? '<p style="margin:10px 0;font-weight:700;text-align:center;">Combined Total: ' + fmt(grandTotal) + '</p>' : '') +
    '<button class="co-btn co-btn--next" style="width:100%;margin-top:10px;margin-bottom:10px;" onclick="acceptOrderFromAlert(\'' + allIds + '\')">' + (isBatch ? 'Accept All (' + orders.length + ')' : 'Accept Delivery') + '</button>' +
    (rejectionsLeft > 0
      ? '<button class="co-btn" style="background:#FEE2E2;color:#DC2626;width:100%;" onclick="rejectOrderAlert(\'' + allIds + '\')">Reject (' + rejectionsLeft + ' left today)</button>'
      : '<p style="text-align:center;color:#999;font-size:12px;margin:0;">Daily rejection limit reached \u2014 accept or dismiss to wait for the next one</p>') +
    '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-top:10px;" onclick="dismissRiderAlert(\'' + allIds + '\')">Not Now</button>';

  document.getElementById('sn-riderAlertOverlay').classList.add('active');
  document.getElementById('sn-riderAlertModal').classList.add('active');
}

function dismissRiderAlert(orderIdsStr) {
  orderIdsStr.split(',').forEach(function(id) { riderAlertShownOrderIds[id] = true; });
  riderAlertCurrentOrderId = null;
  document.getElementById('sn-riderAlertOverlay').classList.remove('active');
  document.getElementById('sn-riderAlertModal').classList.remove('active');
}

// Auto-closes the alert popup when the order it's showing stops being
// valid (cancelled by the customer, or claimed by another rider) while
// this rider was still looking at it, rather than leaving them staring
// at a dead order until they try to accept it themselves. //
function closeRiderAlertPopup(reasonMessage) {
  if (riderAlertCurrentOrderId) riderAlertShownOrderIds[riderAlertCurrentOrderId] = true;
  riderAlertCurrentOrderId = null;
  document.getElementById('sn-riderAlertOverlay').classList.remove('active');
  document.getElementById('sn-riderAlertModal').classList.remove('active');
  if (reasonMessage) showToast(reasonMessage, 'info');
}

async function acceptOrderFromAlert(orderIdsStr) {
  var ids = orderIdsStr.split(',');
  var btn = document.querySelector('#sn-rider-alert-body .co-btn--next');
  if (btn) { btn.disabled = true; btn.textContent = ids.length > 1 ? 'Accepting all...' : 'Accepting...'; }

  try {
    for (var i = 0; i < ids.length; i++) {
      await acceptOrder(ids[i]);
    }
    // acceptOrder() already shows the correct toast for success / too-late / error,
    // and already refreshes the dashboard lists regardless of whether it's open.
  } finally {
    // Guaranteed to run even if acceptOrder somehow throws — the popup can
    // never get stuck on "Accepting..." forever. //
    dismissRiderAlert(orderIdsStr);
  }
}

async function rejectOrderAlert(orderIdsStr) {
  var ids = orderIdsStr.split(',');
  var primaryId = ids[0];
  var reason = prompt(ids.length > 1 ? 'Why are you rejecting these ' + ids.length + ' deliveries? (required)' : 'Why are you rejecting this delivery? (required)');
  if (!reason || !reason.trim()) { showToast('A reason is required to reject an order', 'info'); return; }

  const { count: rejectionsToday } = await supabase
    .from('rider_rejections')
    .select('id', { count: 'exact', head: true })
    .eq('rider_user_id', currentUser.id)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  if ((rejectionsToday || 0) >= 3) {
    showToast('Daily rejection limit reached (3/3)', 'error');
    dismissRiderAlert(orderIdsStr);
    return;
  }

  // One rejection logged against the batch's primary order — a batch is
  // one decision, not N separate strikes against the daily limit. //
  const { error } = await supabase.from('rider_rejections').insert({
    rider_user_id: currentUser.id, order_id: primaryId, reason: reason.trim()
  });

  if (error) {
    showToast('Could not log rejection: ' + error.message, 'error');
    return;
  }

  showToast('Order rejected. This affects your rating slightly \u2014 ' + (2 - (rejectionsToday || 0)) + ' rejections left today.', 'info');
  dismissRiderAlert(orderIdsStr);
}


// ============================================================
// RIDER DASHBOARD
// ============================================================

let myRiderProfile = null;
let myAssignedOrders = [];
let availableOrders = [];

async function openRiderDashboard(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in first', 'info');
    openLoginModal();
    return;
  }
  if (userRoles.indexOf('rider') === -1) {
    showToast('You need a Rider account first — register one from your profile', 'info');
    openProfileModal();
    return;
  }

  if (activeRole !== 'rider') switchActiveRole('rider');

  document.getElementById('sn-riderDashOverlay').classList.add('active');
  document.getElementById('sn-riderDashModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var body = document.getElementById('sn-rider-dash-body');
  body.innerHTML = '<div class="track-empty"><p>Loading your deliveries...</p></div>';

  const { data: riderRow } = await supabase.from('riders').select('*').eq('user_id', currentUser.id).single();
  myRiderProfile = riderRow;

  await loadMyAssignedOrders();
  await loadAvailableOrders();
  renderRiderDashboard();
}

function closeRiderDashboard() {
  document.getElementById('sn-riderDashOverlay').classList.remove('active');
  document.getElementById('sn-riderDashModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function loadMyAssignedOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('rider_user_id', currentUser.id)
    .order('created_at', { ascending: false });
  myAssignedOrders = error ? [] : (data || []);
}

// Orders that have been placed but no rider has claimed yet //
// Orders older than this stop showing up as "available" — prevents old
// abandoned test/demo orders from lingering and popping up unrealistically. //
var RIDER_ALERT_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

async function loadAvailableOrders() {
  var cutoff = new Date(Date.now() - RIDER_ALERT_MAX_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'placed')
    .is('rider_user_id', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });
  availableOrders = error ? [] : (data || []);
}

// Groups available orders by barangay so a rider can accept several
// nearby deliveries together — genuinely useful proximity batching (not
// just same-checkout siblings, though those are always included too,
// since one checkout always shares one delivery address). Sta. Barbara
// is a single municipality, so barangay is the right granularity —
// city/municipality alone would group the entire town together. //
function groupAvailableOrdersByBarangay() {
  var seen = {};
  var groups = [];
  availableOrders.forEach(function(o) {
    var key = (o.shipping_barangay || '').trim().toLowerCase() || ('order-' + o.id);
    if (seen[key]) { seen[key].push(o); return; }
    seen[key] = [o];
    groups.push(seen[key]);
  });
  return groups;
}

// Claim an unassigned order for this rider (handles the race where
// someone else — or the auto-assign fallback — grabbed it first) //
// Accepts one or more orders — used by the dashboard's "Accept All" button
// for batched sibling orders from the same checkout. //
async function acceptOrderBatch(orderIdsStr) {
  var ids = orderIdsStr.split(',');
  for (var i = 0; i < ids.length; i++) {
    await acceptOrder(ids[i]);
  }
}

async function acceptOrder(orderId) {
  try {
    // If the rider accepted straight from the alert popup without ever opening
    // "My Deliveries" this session, myRiderProfile won't be cached yet — fetch it. //
    if (!myRiderProfile) {
      const { data: riderRow, error: riderErr } = await supabase.from('riders').select('*').eq('user_id', currentUser.id).single();
      if (riderErr) console.error('acceptOrder: could not load own rider profile:', riderErr);
      myRiderProfile = riderRow;
    }

    const { data: myProfile } = await supabase.from('profiles').select('full_name, phone').eq('id', currentUser.id).single();

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'preparing',
        rider_user_id: currentUser.id,
        rider_name: (myProfile && myProfile.full_name) || 'Rider',
        rider_phone: (myProfile && myProfile.phone) || '',
        rider_vehicle: myRiderProfile ? capitalize(myRiderProfile.vehicle_type) : 'Motorcycle',
        rider_plate: myRiderProfile ? myRiderProfile.plate_number : '',
        rider_rating: (myRiderProfile && myRiderProfile.rating_count > 0) ? Math.max(0, myRiderProfile.rating_avg - (myRiderProfile.rejection_penalty || 0)).toFixed(1) : null,
        rider_license_path: myRiderProfile ? (myRiderProfile.license_path || null) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('status', 'placed')
      .is('rider_user_id', null)
      .select();

    console.log('acceptOrder result for', orderId, { data: data, error: error });

    if (error) {
      showToast('Could not accept order: ' + error.message, 'error');
      console.error('acceptOrder error:', error);
      return false;
    }
    if (!data || !data.length) {
      // The update matched zero rows — could mean someone else claimed it,
      // OR the customer cancelled it. Check which actually happened
      // instead of showing the same generic "too late" message either way. //
      const { data: currentState } = await supabase.from('orders').select('status, rider_user_id').eq('id', orderId).single();

      if (currentState && currentState.status === 'cancelled') {
        showToast('This order has been cancelled by the customer', 'info');
      } else if (currentState && currentState.rider_user_id) {
        showToast('Too late — another rider already claimed this order', 'info');
      } else {
        showToast('This order is no longer available', 'info');
      }

      await loadAvailableOrders();
      if (document.getElementById('sn-riderDashModal').classList.contains('active')) renderRiderDashboard();
      return false;
    }

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'preparing',
      label: 'Preparing Your Order',
      description: 'Your order has been accepted by a rider and is being prepared for pickup.'
    });

    // Deliberately NOT touching is_available here. A rider's online/offline
    // status is their own manual choice (the toggle switch), not something
    // that should flip automatically just because they accepted a
    // delivery — riders can legitimately handle several orders at once,
    // and this was exactly what was silently blocking them from getting
    // any further alerts until their current delivery finished. //

    showToast('Order accepted \uD83D\uDEF5');
    await loadMyAssignedOrders();
    await loadAvailableOrders();
    renderRiderDashboard();
    return true;

  } catch (ex) {
    // Guarantees the caller's UI (e.g. the alert popup's "Accepting..." button)
    // can never get stuck forever, no matter what goes wrong here. //
    console.error('acceptOrder threw an unexpected error:', ex);
    showToast('Could not accept order: ' + (ex && ex.message ? ex.message : 'unknown error') + '. Please try again.', 'error');
    return false;
  }
}

async function uploadRiderLicense(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please upload a photo of your license', 'error'); return; }
  if (file.size > 6 * 1024 * 1024) { showToast('Image must be under 6MB', 'error'); return; }

  showToast('Uploading license...', 'info');
  var ext = file.name.split('.').pop();
  // Path must start with the rider's own auth uid — this is what the
  // storage RLS policies check to control who can access it later. //
  var path = currentUser.id + '/license-' + Date.now() + '.' + ext;

  const { error: uploadErr } = await supabase.storage.from('rider-docs').upload(path, file, { upsert: true });
  if (uploadErr) { showToast('Could not upload license: ' + uploadErr.message, 'error'); return; }

  const { error: updateErr } = await supabase.from('riders').update({ license_path: path }).eq('user_id', currentUser.id);
  if (updateErr) { showToast('Could not save license: ' + updateErr.message, 'error'); return; }

  if (myRiderProfile) myRiderProfile.license_path = path;
  showToast('License uploaded \u2705 (private — only you, admins, and matched customers can view it)');
  renderRiderDashboard();
}

async function viewMyLicense() {
  if (!myRiderProfile || !myRiderProfile.license_path) return;
  const { data, error } = await supabase.storage.from('rider-docs').createSignedUrl(myRiderProfile.license_path, 300);
  if (error || !data) { showToast('Could not open license: ' + (error ? error.message : 'unknown error'), 'error'); return; }
  window.open(data.signedUrl, '_blank');
}

let riderHistoryDateFilter = 'all';

function changeRiderHistoryDateFilter(value) {
  riderHistoryDateFilter = value;
  renderRiderDashboard();
}

async function toggleMyAvailability(newState) {
  const { error } = await supabase.from('riders').update({ is_available: newState }).eq('user_id', currentUser.id);
  if (error) { showToast('Could not update availability: ' + error.message, 'error'); return; }
  myRiderProfile.is_available = newState;
  showToast(newState ? 'You\'re now available for deliveries' : 'You\'re now offline', 'info');
  if (newState) { await loadAvailableOrders(); checkForRiderOrderAlert(); }
  renderRiderDashboard();
}

function renderRiderDashboard() {
  var body = document.getElementById('sn-rider-dash-body');
  var available = myRiderProfile ? myRiderProfile.is_available : false;

  var licenseHtml = myRiderProfile && myRiderProfile.license_path
    ? '<div style="display:flex;align-items:center;justify-content:space-between;background:#F0FFF4;border-radius:10px;padding:12px 16px;margin-bottom:12px;">' +
      '<span style="font-weight:600;font-size:13px;color:#15803D;"><i class="fas fa-id-card"></i> License on file (private)</span>' +
      '<div style="display:flex;gap:6px;">' +
      '<button class="co-btn" style="padding:6px 12px;background:#fff;color:#333;" onclick="viewMyLicense()">View</button>' +
      '<button class="co-btn" style="padding:6px 12px;background:#fff;color:#333;" onclick="document.getElementById(\'license-file-input\').click()">Replace</button>' +
      '</div></div>'
    : '<div style="background:#FFFBEB;border-radius:10px;padding:12px 16px;margin-bottom:12px;">' +
      '<p style="margin:0 0 8px;font-weight:600;font-size:13px;color:#B45309;"><i class="fas fa-triangle-exclamation"></i> Driver\'s license required</p>' +
      '<p style="margin:0 0 8px;font-size:11.5px;color:#666;">Only visible to you, HomeWeb admins, and customers whose delivery you accept — for their safety verification.</p>' +
      '<button class="co-btn co-btn--next" style="width:100%;" onclick="document.getElementById(\'license-file-input\').click()">Upload License</button>' +
      '</div>';
  licenseHtml += '<input type="file" id="license-file-input" accept="image/*" style="display:none;" onchange="uploadRiderLicense(this.files[0])"/>';

  var toggleHtml = '<div style="display:flex;align-items:center;justify-content:space-between;background:#F9FAFB;border-radius:10px;padding:12px 16px;margin-bottom:18px;">' +
    '<span style="font-weight:600;font-size:13.5px;">' + (available ? 'Available for deliveries' : 'Offline') + '</span>' +
    '<button class="co-btn" style="padding:6px 14px;background:' + (available ? '#FEE2E2' : 'var(--primary,#22C55E)') + ';color:' + (available ? '#DC2626' : '#fff') + ';" onclick="toggleMyAvailability(' + !available + ')">' +
    (available ? 'Go Offline' : 'Go Online') + '</button></div>';

  var activeOrders = myAssignedOrders.filter(function(o) { return o.status === 'preparing' || o.status === 'out_for_delivery'; });
  var pastOrdersAll = myAssignedOrders.filter(function(o) { return o.status === 'awaiting_confirmation' || o.status === 'delivered'; });
  var pastOrders = pastOrdersAll.filter(function(o) { return orderMatchesDateFilter(o, riderHistoryDateFilter); });

  function orderCardHtml(o) {
    var itemsSummary = (o.order_items || []).map(function(it) { return it.product_name + ' x' + it.qty; }).join(', ');
    var statusInfo = getOrderStatusInfo(o.status);
    var actionBtn = '';
    if (o.status === 'preparing') {
      actionBtn = '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;" onclick="riderAdvanceOrder(\'' + o.id + '\', \'out_for_delivery\')">Mark Picked Up</button>';
    } else if (o.status === 'out_for_delivery') {
      actionBtn = '<input type="file" id="pod-input-' + o.id + '" accept="image/*" capture="environment" style="display:none;" onchange="submitProofOfDelivery(\'' + o.id + '\', this.files[0])"/>' +
        '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;" onclick="document.getElementById(\'pod-input-' + o.id + '\').click()"><i class="fas fa-camera"></i> Take Proof of Delivery Photo</button>';
    } else if (o.status === 'awaiting_confirmation') {
      actionBtn = '<p style="margin:8px 0 0;color:#F59E0B;font-size:12px;"><i class="fas fa-clock"></i> Waiting for customer to confirm receipt</p>';
    }

    return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
      '<p style="margin:0;font-weight:600;font-size:13.5px;">Order #' + o.order_code + ' \u2014 ' + statusInfo.label + '</p>' +
      '<p style="margin:2px 0 0;color:#999;font-size:11.5px;"><i class="fas fa-clock"></i> ' + formatDate(o.created_at) + ' \u2022 ' + new Date(o.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</p>' +
      '<p style="margin:4px 0 0;color:#777;font-size:12.5px;">' + itemsSummary + '</p>' +
      '<p style="margin:4px 0 0;color:#777;font-size:12.5px;"><i class="fas fa-map-marker-alt"></i> ' + (o.shipping_street || '') + ', ' + (o.shipping_city || '') + '</p>' +
      (o.not_arrived_reported_at ? '<p style="margin:8px 0 0;background:#FEE2E2;color:#DC2626;padding:8px;border-radius:6px;font-size:12px;font-weight:600;"><i class="fas fa-exclamation-triangle"></i> Customer reports this was NOT received. Please follow up.</p>' : '') +
      actionBtn +
      '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;font-size:12px;padding:6px;" onclick="openChatThread(\'' + o.id + '\', \'' + o.user_id + '\', \'Customer of Order #' + o.order_code + '\')"><i class="fas fa-comment-dots"></i> Customer</button>' +
      ((o.order_items && o.order_items.length)
        ? '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;font-size:12px;padding:6px;" onclick="messageSellerForOrder(\'' + o.id + '\', \'' + o.order_items[0].product_id + '\')"><i class="fas fa-comment-dots"></i> Seller</button>'
        : '') +
      '</div>' +
      '<a href="#" onclick="openReportModal(\'customer\', \'' + o.user_id + '\', \'Customer of Order #' + o.order_code + '\', \'' + o.id + '\'); return false;" style="display:block;margin-top:8px;text-align:right;color:#999;font-size:11px;text-decoration:underline;"><i class="fas fa-flag"></i> Report customer</a>' +
      '</div>';
  }

  var availableHtml = availableOrders.length
    ? groupAvailableOrdersByBarangay().map(function(group) {
        var isBatch = group.length > 1;
        var allIds = group.map(function(o) { return o.id; }).join(',');
        var groupTotal = group.reduce(function(a, o) { return a + o.total; }, 0);
        var primary = group[0];
        var barangayLabel = primary.shipping_barangay || 'Unspecified area';
        var ordersHtml = group.map(function(o) {
          var itemsSummary = (o.order_items || []).map(function(it) { return it.product_name + ' x' + it.qty; }).join(', ');
          return '<div style="' + (isBatch ? 'padding:8px 0;border-top:1px dashed #e5e5e5;' : '') + '">' +
            '<p style="margin:0;font-weight:600;font-size:13.5px;">Order #' + o.order_code + ' \u2014 ' + fmt(o.total) + '</p>' +
            '<p style="margin:4px 0 0;color:#777;font-size:12.5px;">' + itemsSummary + '</p>' +
            '<p style="margin:2px 0 0;color:#999;font-size:11.5px;">' + (o.shipping_street || '') + '</p>' +
            '</div>';
        }).join('');

        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          (isBatch
            ? '<p style="margin:0 0 6px;color:var(--primary,#22C55E);font-size:11.5px;font-weight:700;text-transform:uppercase;"><i class="fas fa-route"></i> ' + group.length + ' orders in Brgy. ' + barangayLabel + '</p>'
            : '<p style="margin:0 0 4px;color:#999;font-size:11px;"><i class="fas fa-map-marker-alt"></i> Brgy. ' + barangayLabel + '</p>') +
          ordersHtml +
          (isBatch ? '<p style="margin:6px 0 0;font-weight:700;font-size:12.5px;">Combined Total: ' + fmt(groupTotal) + '</p>' : '') +
          '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;" onclick="acceptOrderBatch(\'' + allIds + '\')">' + (isBatch ? 'Accept All ' + group.length + ' \u2014 Same Route' : 'Accept Delivery') + '</button>' +
          '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No orders waiting for a rider right now.</p>';

  var myEffectiveRating = myRiderProfile ? Math.max(0, myRiderProfile.rating_avg - (myRiderProfile.rejection_penalty || 0)) : 0;

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Deliveries</h2>' +
    '<p class="login-sub" style="margin:0 0 16px;">' + activeOrders.length + ' active \u2022 ' + pastOrders.length + ' completed' +
    (myRiderProfile && myRiderProfile.rating_count > 0
      ? ' \u2022 <span style="color:#F59E0B;">' + stars(myEffectiveRating) + '</span> ' + myEffectiveRating.toFixed(1) + ' (' + myRiderProfile.rating_count + ')'
      : ' \u2022 New rider, no ratings yet') +
    (myRiderProfile && myRiderProfile.rejection_penalty > 0 ? ' \u2022 <span style="color:#DC2626;">' + myRiderProfile.rejection_penalty.toFixed(1) + ' rejection penalty</span>' : '') +
    '</p>' +
    licenseHtml +
    toggleHtml +
    (available ? ('<h3 style="margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center;">Available Orders <button class="co-btn" style="padding:4px 10px;background:#F3F4F6;color:#333;font-size:12px;" onclick="loadAvailableOrders().then(renderRiderDashboard)"><i class="fas fa-sync"></i> Refresh</button></h3>' + availableHtml) : '') +
    '<h3 style="margin:16px 0 8px;font-size:14px;">Active Deliveries</h3>' +
    (activeOrders.length ? activeOrders.map(orderCardHtml).join('') : '<p style="color:#999;font-size:13px;">No active deliveries right now.</p>') +
    '<h3 style="margin:16px 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
    '<span>Completed</span>' +
    '<select onchange="changeRiderHistoryDateFilter(this.value)" style="padding:6px 10px;border-radius:8px;border:1px solid #e5e5e5;font-size:12.5px;">' +
    [['all', 'All Time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Within a Week'], ['month', 'Within a Month'], ['year', 'Within a Year']]
      .map(function(d) { return '<option value="' + d[0] + '"' + (riderHistoryDateFilter === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') +
    '</select></h3>' +
    (pastOrders.length ? pastOrders.map(orderCardHtml).join('') : '<p style="color:#999;font-size:13px;">No completed deliveries' + (riderHistoryDateFilter !== 'all' ? ' in this period' : ' yet') + '.</p>');
}

async function riderAdvanceOrder(orderId, newStatus) {
  await advanceOrderStatus(orderId, newStatus);
  showToast(newStatus === 'delivered' ? 'Order marked delivered \u2705' : 'Order marked picked up \uD83D\uDEF5');
  await loadMyAssignedOrders();
  renderRiderDashboard();
}

// Requires a photo before an order can move to "awaiting confirmation" —
// protects the rider from false non-delivery claims, and gives the
// customer/merchant/admin real evidence if a dispute happens later. //
async function submitProofOfDelivery(orderId, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose a photo', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { showToast('Photo must be under 8MB', 'error'); return; }

  showToast('Uploading proof of delivery...', 'info');
  var ext = file.name.split('.').pop();
  var path = 'delivery-proof/' + orderId + '/' + Date.now() + '.' + ext;

  const { error: uploadErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
  if (uploadErr) { showToast('Could not upload photo: ' + uploadErr.message, 'error'); return; }

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);

  const { error: updateErr } = await supabase.from('orders').update({ proof_of_delivery_url: urlData.publicUrl }).eq('id', orderId);
  if (updateErr) { showToast('Could not save photo: ' + updateErr.message, 'error'); return; }

  await riderAdvanceOrder(orderId, 'awaiting_confirmation');
}


// CART ICON CLICK //
function initCartClick() {
  document.querySelectorAll('.cart-icon').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      openCheckout();
    });
  });
}

// INIT //
document.addEventListener('DOMContentLoaded', async function() {
  injectModals();
  initCartClick();
  initLoginModal();
  updateCartBadge();
  initSearch();

  // Await this before touching the recovery flag below, so restoreSession()
  // can see it's still true and correctly skip treating this as a normal
  // login — otherwise the header would flash "logged in" for a moment
  // alongside the "set new password" prompt. //
  await restoreSession();

  if (pendingPasswordRecovery) {
    pendingPasswordRecovery = false;
    openSetNewPasswordModal();
  }

  if (window.location.hash === '#admin') openAdminLoginModal();

  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();

  // Keep product cards (ratings, stock, sold counts) live without needing
  // a manual refresh — useful when reviews/orders happen on another
  // device during a demo or in normal multi-user use. //
  setInterval(async function() {
    // Don't refresh while someone's actively browsing a product/cart/checkout —
    // re-rendering underneath them would be jarring mid-interaction. //
    var busyModals = ['sn-productModal', 'sn-checkoutModal', 'sn-storeModal'];
    var isBusy = busyModals.some(function(id) {
      var el = document.getElementById(id);
      return el && el.classList.contains('active');
    });
    if (isBusy) return;

    await loadProducts();
    renderHomeProducts();
    renderCategoryPage();
    if (currentUser) updateChatBadge();

    // The DB function existed but was never actually called anywhere —
    // this is what makes the 30-minute auto-cancel genuinely run. Safe
    // to call from any logged-in client; the function's own logic only
    // ever acts on orders that truly meet the stale condition. //
    if (currentUser) {
      supabase.rpc('check_and_cancel_stale_orders').then(function(res) {
        if (res.error) console.error('check_and_cancel_stale_orders error:', res.error);
      });
    }
  }, 30000);
});