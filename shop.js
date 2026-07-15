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

// Fetch all active products (with seller info) from Supabase //
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*, merchants(store_name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not load products:', error.message);
    products = [];
    return;
  }

  products = (data || []).map(function(p) {
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
      sold: (p.rating_count || 0) + (p.rating_count === 1 ? ' review' : ' reviews'),
      icon: meta.icon,
      location: (p.merchants && p.merchants.store_name) || 'HomeWeb Seller',
      category: p.category,
      image_url: p.image_url,
      stock_qty: p.stock_qty,
      merchant_id: p.merchant_id
    };
  });
}

function fmtPrice(n) {
  return '\u20B1' + Number(n).toLocaleString();
}

function starsHTML(n) {
  var s = '';
  for (var i = 1; i <= 5; i++) {
    s += '<i class="' + (i <= n ? 'fas' : 'far') + ' fa-star"></i>';
  }
  return s;
}

// Shared product card markup used by both the homepage and category page //
function renderProductCardHtml(p) {
  var meta = CATEGORY_META[p.category] || DEFAULT_CATEGORY_META;
  var badge = p.discount ? '<div class="product-badge sale-badge">-' + p.discount + '%</div>' : '';
  var oldPriceHtml = p.oldPrice ? '<span class="price-old">' + fmtPrice(p.oldPrice) + '</span>' : '';
  var imgSrc = getProductImage(p.id);
  var imgHtml = imgSrc
    ? '<div class="product-img" style="background:' + meta.bg + ';"><img src="' + imgSrc + '" alt="' + p.name + '" loading="lazy"/></div>'
    : '<div class="product-img" style="background:' + meta.bg + ';"><i class="fas ' + p.icon + '" style="color:' + meta.color + ';font-size:32px;"></i></div>';

  var stockNote = (typeof p.stock_qty === 'number' && p.stock_qty <= 0)
    ? '<p class="product-location" style="color:#DC2626;"><i class="fas fa-ban"></i> Out of stock</p>'
    : '<p class="product-location"><i class="fas fa-store"></i> ' + p.location + '</p>';

  return '<div class="product-card" data-product-id="' + p.id + '">' +
    badge +
    '<div class="wishlist-btn"><i class="far fa-heart"></i></div>' +
    imgHtml +
    '<div class="product-info">' +
    '<p class="product-name">' + p.name + '</p>' +
    '<div class="product-prices"><span class="price-now">' + fmtPrice(p.price) + '</span>' + oldPriceHtml + '</div>' +
    '<div class="product-stars">' + starsHTML(p.rating) + '<span>' + (p.ratingAvg > 0 ? p.ratingAvg + ' \u2022 ' : '') + p.sold + '</span></div>' +
    stockNote +
    '</div></div>';
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
let userRoles = [];
let activeRole = 'customer';
let currentTrackingOrder = null; 
let shippingInfo = {
  firstName: '', lastName: '', phone: '',
  street: '', city: 'Sta. Barbara', zip: '5002',
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
function stars(n) {
  let s = '';
  for (let i = 1; i <= 5; i++)
    s += '<i class="' + (i <= n ? 'fas' : 'far') + ' fa-star"></i>';
  return s;
}

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

  // Escape key to clear search //
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      filterProducts('');
    }
  });

  // Clear search //
  input.addEventListener('search', function() {
    filterProducts(this.value);
  });
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

  const m = document.getElementById('sn-productModal');
  var imgSrc = getProductImage(p.id);
  if (imgSrc) {
    m.querySelector('.pm-icon').innerHTML = '<img src="' + imgSrc + '" alt="' + p.name + '" />';
  } else {
    m.querySelector('.pm-icon').innerHTML = '<i class="fas ' + p.icon + '"></i>';
  }
  m.querySelector('.pm-name').textContent = p.name;
  m.querySelector('.pm-stars').innerHTML = stars(p.rating) + '<span>' + (p.ratingAvg > 0 ? p.ratingAvg + ' \u2022 ' : '') + p.sold + '</span>';
  m.querySelector('.pm-price-now').textContent = fmt(p.price);
  m.querySelector('.pm-price-old').textContent = p.oldPrice ? fmt(p.oldPrice) : '';
  const disc = m.querySelector('.pm-discount');
  disc.textContent = p.discount ? '-' + p.discount + '%' : '';
  disc.style.display = p.discount ? 'inline' : 'none';
  m.querySelector('.pm-location').innerHTML = '<i class="fas fa-map-marker-alt"></i> Ships from ' + p.location;
  m.querySelector('.pm-qty-val').textContent = 1;

  document.getElementById('sn-overlay').classList.add('active');
  m.classList.add('active');
  document.body.style.overflow = 'hidden'; 

  loadAndRenderReviews(p.id);
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

async function loadAndRenderReviews(productId) {
  var container = document.getElementById('pm-reviews');
  if (!container) return;
  container.innerHTML = '<p style="color:#999;font-size:12.5px;">Loading reviews...</p>';

  const { data, error } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, is_anonymous, reviewer_name, reviewer_avatar_url')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data || !data.length) {
    container.innerHTML = '<h3 style="margin:0 0 8px;font-size:14px;">Customer Reviews</h3><p style="color:#999;font-size:12.5px;">No reviews yet.</p>';
    return;
  }

  var rowsHtml = data.map(reviewRowHtml).join('');

  container.innerHTML = '<h3 style="margin:0 0 8px;font-size:14px;">Customer Reviews (' + data.length + ')</h3>' + rowsHtml;
}

function closeProductModal() {
  document.getElementById('sn-overlay').classList.remove('active');
  document.getElementById('sn-productModal').classList.remove('active');
  document.body.style.overflow = '';
}

// buttons sa product modal //
function changeQty(delta) {
  currentProduct.qty = Math.max(1, Math.min(99, currentProduct.qty + delta));
  document.querySelector('.pm-qty-val').textContent = currentProduct.qty;
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
  else cart.push({ id: p.id, name: p.name, price: p.price, icon: p.icon, qty: p.qty });
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
      return '<div class="co-cart-row" data-id="' + item.id + '">' +
        '<div class="co-cart-icon">' + cartIconHtml + '</div>' +
        '<div class="co-cart-info"><p class="co-cart-name">' + item.name + '</p>' +
        '<div class="co-cart-controls">' +
        '<button onclick="changeCartQty(' + item.id + ',-1)">&#8722;</button>' +
        '<span>' + item.qty + '</span>' +
        '<button onclick="changeCartQty(' + item.id + ',1)">+</button>' +
        '<button class="co-remove" onclick="removeCartItem(' + item.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div></div>' +
        '<div class="co-cart-price">' + fmt(item.price * item.qty) + '</div></div>';
    }).join('');

    const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    // Free shipping //
    const ship = sub >= 500 ? 0 : 79;

    body = '<div class="co-cart-list">' + rows + '</div>' +
      '<div class="co-summary">' +
      '<div class="co-summary-row"><span>Subtotal</span><span>' + fmt(sub) + '</span></div>' +
      '<div class="co-summary-row"><span>Shipping</span><span>' + (ship === 0 ? '<span class="free-tag">FREE</span>' : fmt(ship)) + '</span></div>' +
      '<div class="co-summary-row total"><span>Total</span><span>' + fmt(sub + ship) + '</span></div>' +
      '</div>';

  // STEP 2: SHIPPING //
  } else if (checkoutStep === 2) {
    body = '<div class="co-form">' +
      '<h3>Delivery Address</h3>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>First Name <span class="co-required">*</span></label><input type="text" id="co-firstName" placeholder="First Name" value="' + shippingInfo.firstName + '"/><span class="co-field-error">First name is required</span></div>' +
      '<div class="co-field"><label>Last Name <span class="co-required">*</span></label><input type="text" id="co-lastName" placeholder="Last Name" value="' + shippingInfo.lastName + '"/><span class="co-field-error">Last name is required</span></div>' +
      '</div>' +
      '<div class="co-field"><label>Phone Number <span class="co-required">*</span></label><input type="tel" id="co-phone" placeholder="+63 9XX XXX XXXX" value="' + shippingInfo.phone + '"/><span class="co-field-error">Phone number is required</span></div>' +
      '<div class="co-field"><label>Street Address <span class="co-required">*</span></label><input type="text" id="co-street" placeholder="House No., Street, Barangay" value="' + shippingInfo.street + '"/><span class="co-field-error">Street address is required</span></div>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>City / Municipality <span class="co-required">*</span></label><input type="text" id="co-city" placeholder="Sta. Barbara" value="' + shippingInfo.city + '"/><span class="co-field-error">City is required</span></div>' +
      '<div class="co-field"><label>ZIP Code <span class="co-required">*</span></label><input type="text" id="co-zip" placeholder="5002" value="' + shippingInfo.zip + '"/><span class="co-field-error">ZIP code is required</span></div>' +
      '</div>' +
      '<div class="co-field"><label>Delivery Option</label>' +
      '<div class="co-delivery-opts">' +
      '<label class="co-radio"><input type="radio" name="delivery" value="standard" ' + (shippingInfo.delivery === 'standard' ? 'checked' : '') + '/>' +
      '<span><strong>Standard Delivery</strong><em>3\u201320 minutes &nbsp;&bull;&nbsp; FREE on \u20B1200+</em></span></label>' +
      '<label class="co-radio"><input type="radio" name="delivery" value="Saver" ' + (shippingInfo.delivery === 'Saver' ? 'checked' : '') + '/>' +
      '<span><strong>Saver Delivery</strong><em>1\u201330 minutes &nbsp;&bull;&nbsp; \u20B1149</em></span></label>' +
      '</div></div></div>';

  // STEP 3: PAYMENT //
  } else if (checkoutStep === 3) {
    body = '<div class="co-form">' +
      '<h3>Payment Method</h3>' +
      '<div class="co-pay-opts">' +
      '<label class="co-radio co-pay-radio"><input type="radio" name="payment" value="cod" ' + (selectedPaymentMethod === 'cod' ? 'checked' : '') + '/>' +
      '<span><i class="fas fa-money-bill-wave"></i><strong>Cash on Delivery</strong></span></label>' +
      '<label class="co-radio co-pay-radio"><input type="radio" name="payment" value="gcash" ' + (selectedPaymentMethod === 'gcash' ? 'checked' : '') + '/>' +
      '<span><i class="fas fa-mobile-alt"></i><strong>GCash</strong></span></label>' +
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
    const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    const ship = sub >= 500 ? 0 : 79;
    const itemList = cart.map(function(i) {
      return '<li><span>' + i.name + ' \u00D7 ' + i.qty + '</span><span>' + fmt(i.price * i.qty) + '</span></li>';
    }).join('');

    body = '<div class="co-confirm">' +
      '<div class="co-confirm-icon"><i class="fas fa-clipboard-check"></i></div>' +
      '<h3>Review Your Order</h3>' +
      '<ul class="co-confirm-items">' + itemList + '</ul>' +
      '<div class="co-summary">' +
      '<div class="co-summary-row"><span>Subtotal</span><span>' + fmt(sub) + '</span></div>' +
      '<div class="co-summary-row"><span>Shipping</span><span>' + (ship === 0 ? '<span class="free-tag">FREE</span>' : fmt(ship)) + '</span></div>' +
      '<div class="co-summary-row total"><span>Total</span><span>' + fmt(sub + ship) + '</span></div>' +
      '</div>' +
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
  const requiredIds = ['co-firstName', 'co-lastName', 'co-phone', 'co-street', 'co-city', 'co-zip'];
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
  item.qty = Math.max(1, item.qty + delta);
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
  const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
  const ship = sub >= 500 ? 0 : 79;
  return sub + ship;
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
  'delivered':              { label: 'Delivered',             desc: 'Your order has been delivered. Enjoy!' }
};

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var MOCK_RIDER_NAMES = ['Jomar Santos', 'Kevin Reyes', 'Angelo Cruz', 'Mark Villanueva', 'Rico Fernandez', 'Paolo Ramos', 'Jayson Dela Peña', 'Nico Aquino'];
var MOCK_RIDER_VEHICLES = ['Motorcycle', 'Motorcycle', 'Motorcycle', 'Tricycle'];

function generateMockRider() {
  var name = MOCK_RIDER_NAMES[Math.floor(Math.random() * MOCK_RIDER_NAMES.length)];
  var vehicle = MOCK_RIDER_VEHICLES[Math.floor(Math.random() * MOCK_RIDER_VEHICLES.length)];
  var plateLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  var plateNumbers = randomBetween(1000, 9999);
  var phone = '09' + randomBetween(100000000, 999999999);
  var eta = randomBetween(15, 30);
  return {
    name: name,
    vehicle: vehicle,
    plate: plateLetters + ' ' + plateNumbers,
    phone: phone,
    rating: null, // no real account behind a mock rider, so no genuine rating exists
    ratingCount: 0,
    eta: eta
  };
}

// Place order — writes to Supabase (orders, order_items, order_status_history) //
async function placeOrder() {
  if (!currentUser) {
    showToast('Please log in to place an order', 'info');
    closeCheckout();
    openLoginModal();
    return;
  }

  const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
  const shipFee = sub >= 500 ? 0 : 79;

  var paymentMethod = selectedPaymentMethod;
  var orderCode = 'HW' + String(Date.now()).slice(-8).toUpperCase();

  const nextBtn = document.querySelector('#sn-checkoutModal .co-btn--next');
  if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Placing order...'; }

  // 1. Insert the order
  const { data: orderRow, error: orderErr } = await supabase.from('orders').insert({
    order_code: orderCode,
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
    shipping_city: shippingInfo.city,
    shipping_zip: shippingInfo.zip,
    delivery_option: shippingInfo.delivery
  }).select().single();

  if (orderErr) {
    if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = 'Place Order <i class="fas fa-check-circle"></i>'; }
    showToast('Could not place order: ' + orderErr.message, 'error');
    return;
  }

  // 2. Insert order items
  const itemRows = cart.map(function(item) {
    return { order_id: orderRow.id, product_id: item.id, product_name: item.name, price: item.price, qty: item.qty };
  });
  await supabase.from('order_items').insert(itemRows);

  // 3. Insert the first status history entry
  await supabase.from('order_status_history').insert({
    order_id: orderRow.id,
    status: 'placed',
    label: ORDER_STATUS_MAP.placed.label,
    description: ORDER_STATUS_MAP.placed.desc
  });

  // Rider search + realistic status progression begins here
  // (advanceOrderStatus/assignRider chain the rest of the timeline)

  // Clear cart
  closeCheckout();
  cart = [];
  saveCart();
  updateCartBadge();
  openRiderSearchModal(orderRow.id, orderCode);
}

// Advance an order's status in Supabase + log it to the timeline //
async function advanceOrderStatus(orderDbId, newStatus) {
  const info = ORDER_STATUS_MAP[newStatus];
  if (!info) return;

  const { data: existing } = await supabase.from('orders').select('status, rider_user_id').eq('id', orderDbId).single();
  if (!existing || existing.status === 'delivered') return;

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

  // Chain the next automatic step, spaced out to feel realistic //
  // Note: this stops at awaiting_confirmation, NOT delivered — the
  // customer must separately confirm receipt to finalize the order.
  if (newStatus === 'out_for_delivery') {
    setTimeout(function() { advanceOrderStatus(orderDbId, 'awaiting_confirmation'); }, randomBetween(15000, 20000));
  }
}

// Customer confirms they actually received the order — this is the
// ONLY way an order becomes fully 'delivered' and unlocks reviews.
// Independent from the rider's "Mark Delivered" action on purpose,
// so a rider can't unilaterally close out an order they never delivered.
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
// MOCK RIDER SEARCH
// (Simulated — no real logistics/dispatch integration)
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

  var searchDelay = randomBetween(30000, 60000);
  setTimeout(function() { assignRider(orderId, orderCode); }, searchDelay);

  // Poll for a rider claiming this order from a different session (e.g. a
  // real rider accepting it from their own dashboard) — there's no live
  // realtime connection here, so this is how we catch that update. //
  if (riderPollIntervalId) clearInterval(riderPollIntervalId);
  riderPollIntervalId = setInterval(async function() {
    if (riderSearchStep !== 1 || riderSearchOrderId !== orderId) {
      clearInterval(riderPollIntervalId);
      return;
    }
    const { data: order } = await supabase
      .from('orders')
      .select('rider_name, rider_phone, rider_vehicle, rider_plate, rider_rating')
      .eq('id', orderId)
      .single();

    if (order && order.rider_name) {
      clearInterval(riderPollIntervalId);
      riderSearchStep = 2;
      renderRiderStep(orderCode, {
        name: order.rider_name, phone: order.rider_phone, vehicle: order.rider_vehicle,
        plate: order.rider_plate, rating: order.rider_rating, eta: randomBetween(15, 30)
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

async function assignRider(orderId, orderCode) {
  // Skip auto-assign entirely if a real rider already claimed this order,
  // or if it's no longer sitting in 'placed' status for some other reason //
  const { data: currentOrder } = await supabase.from('orders').select('rider_user_id, status').eq('id', orderId).single();
  if (!currentOrder || currentOrder.rider_user_id || currentOrder.status !== 'placed') return;

  // If real riders are online, give them a fair chance to claim it manually
  // instead of racing them with a mock assignment. Keep deferring and
  // re-checking until either a real rider claims it, or nobody's online. //
  const { count: onlineRiders } = await supabase
    .from('riders')
    .select('user_id', { count: 'exact', head: true })
    .eq('is_available', true);

  if (onlineRiders && onlineRiders > 0) {
    setTimeout(function() { assignRider(orderId, orderCode); }, randomBetween(20000, 30000));
    return;
  }

  // No real riders online — fall back to the mock generator (demo purposes only) //
  var rider = generateMockRider();

  var updatePayload = {
    status: 'preparing',
    rider_name: rider.name,
    rider_phone: rider.phone,
    rider_vehicle: rider.vehicle,
    rider_plate: rider.plate,
    rider_rating: rider.rating,
    updated_at: new Date().toISOString()
  };
  if (rider.isReal) updatePayload.rider_user_id = rider.user_id;

  await supabase.from('orders').update(updatePayload).eq('id', orderId);

  if (rider.isReal) {
    await supabase.from('riders').update({ is_available: false }).eq('user_id', rider.user_id);
  }

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    status: 'preparing',
    label: 'Preparing Your Order',
    description: rider.name + ' has been assigned to your order and is heading to the seller for pickup.'
  });

  updateNotifBadge();

  var listEl = document.getElementById('sn-tracking-list');
  if (listEl && listEl.style.display !== 'none') renderOrderList();
  if (currentTrackingOrder && currentTrackingOrder.id === orderId) openTrackingDetail(orderId);

  // Only pop the "rider found" screen if the user still has this order's modal open //
  if (riderSearchOrderId === orderId) {
    riderSearchStep = 2;
    renderRiderStep(orderCode, rider);
  } else {
    showToast(rider.name + ' has been assigned to Order #' + orderCode + '! \uD83D\uDEF5');
  }

  // Continue the realistic timeline: out for delivery in another 15-20s //
  // (a real assigned rider can also do this manually from their dashboard)
  setTimeout(function() { advanceOrderStatus(orderId, 'out_for_delivery'); }, randomBetween(15000, 20000));
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
      '<button class="co-btn co-btn--next" style="width:100%;margin-top:16px;" onclick="closeRiderModal(); viewOrderNow(\'' + riderSearchOrderId + '\');">Track This Order</button>' +
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
    .select('*, order_items(*)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Could not load orders: ' + error.message, 'error');
    orders = [];
    return;
  }
  orders = data || [];
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

async function openTrackingDetail(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_status_history(*)')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    showToast('Could not load order details', 'error');
    return;
  }

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

  // Review section (only for delivered orders)
  var reviewsHtml = '';
  if (order.status === 'delivered') {
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
  if (order.status === 'delivered' && order.rider_user_id) {
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

    // Timeline
    '<div class="track-detail-section">' +
    '<h4>Tracking Timeline</h4>' +
    timelineHtml +
    '</div>' +

    // Items
    '<div class="track-detail-section">' +
    '<h4>Order Items</h4>' +
    '<div class="track-detail-items">' + itemsHtml + '</div>' +
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
      '</div></div></div>'
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
  if (order.status === 'awaiting_confirmation') {
    html += '<div style="background:#FFFBEB;border-radius:10px;padding:14px;margin-top:16px;">' +
      '<p style="margin:0 0 10px;font-size:13px;color:#92400E;"><i class="fas fa-info-circle"></i> Your rider marked this order as delivered. Please confirm you actually received it.</p>' +
      '<button class="co-btn co-btn--next track-mark-delivered" onclick="confirmDelivery(\'' + order.id + '\')">Confirm Receipt</button>' +
      '</div>';
  }

  container.innerHTML = html;
}

// Helpers for order tracking
function getOrderStatusInfo(status) {
  var map = {
    'placed':            { label: 'Order Placed',       icon: '' },
    'preparing':         { label: 'Preparing',          icon: '' },
    'out_for_delivery':  { label: 'Out for Delivery',   icon: '' },
    'delivered':         { label: 'Delivered',          icon: '' }
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
async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  userRoles = [];
  activeRole = 'customer';
  updateAuthUI();
  showToast('Logged out', 'info');
}

// ============================================================
// SIGNUP MODAL
// ============================================================

let signupRole = 'customer';

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
      '</select></div>';
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
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    await fetchUserRoles();
    updateAuthUI();
    updateNotifBadge();
  }

  supabase.auth.onAuthStateChange(function(event, session) {
    currentUser = session ? session.user : null;
    updateAuthUI();
    updateNotifBadge();
  });
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
    '</div>' +
    '<p class="pm-location"></p>' +
    '<div class="pm-qty">' +
    '<span>Quantity:</span>' +
    '<button onclick="changeQty(-1)">&#8722;</button>' +
    '<span class="pm-qty-val">1</span>' +
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
    '<label class="login-remember"><input type="checkbox" id="login-remember"/> <span>Remember me</span></label>' +
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
    '<div id="sn-merchantModal" class="sn-tracking-modal">' +
    '<button class="pm-close" onclick="closeMerchantDashboard()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-merchant-body" style="padding:8px 4px;"></div>' +
    '</div>' +

    // Rider dashboard overlay + modal
    '<div id="sn-riderDashOverlay" class="sn-overlay" onclick="closeRiderDashboard()"></div>' +
    '<div id="sn-riderDashModal" class="sn-tracking-modal">' +
    '<button class="pm-close" onclick="closeRiderDashboard()"><i class="fas fa-times"></i></button>' +
    '<div id="sn-rider-dash-body" style="padding:8px 4px;"></div>' +
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
  'placed':           'fa-receipt',
  'preparing':        'fa-box-open',
  'out_for_delivery': 'fa-truck',
  'delivered':        'fa-check-circle'
};

function notifSeenKey() {
  return currentUser ? ('homeweb_notif_seen_' + currentUser.id) : null;
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

async function fetchNotifications() {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('*, orders!inner(order_code, user_id)')
    .eq('orders.user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return [];
  return data || [];
}

async function openNotificationsModal(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in to view notifications', 'info');
    openLoginModal();
    return;
  }

  document.getElementById('sn-notifOverlay').classList.add('active');
  document.getElementById('sn-notifModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var list = document.getElementById('sn-notif-list');
  list.innerHTML = '<div class="track-empty"><p>Loading notifications...</p></div>';

  const notifs = await fetchNotifications();
  renderNotifications(notifs);

  // Mark as seen: remember the timestamp of the newest notification
  if (notifs.length) {
    localStorage.setItem(notifSeenKey(), notifs[0].created_at);
  }
  updateNotifBadge();
}

function closeNotificationsModal() {
  document.getElementById('sn-notifOverlay').classList.remove('active');
  document.getElementById('sn-notifModal').classList.remove('active');
  document.body.style.overflow = '';
}

function renderNotifications(notifs) {
  var list = document.getElementById('sn-notif-list');
  if (!notifs.length) {
    list.innerHTML = '<div class="track-empty"><p>No notifications yet. They will show up here as your orders progress.</p></div>';
    return;
  }

  list.innerHTML = notifs.map(function(n) {
    var icon = NOTIF_ICON_MAP[n.status] || 'fa-bell';
    return '<div class="notif-item" style="display:flex;gap:12px;padding:12px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;" ' +
      'onclick="closeNotificationsModal(); viewOrderNow(\'' + n.order_id + '\');">' +
      '<div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#F0FFF4;color:var(--primary,#22C55E);display:flex;align-items:center;justify-content:center;"><i class="fas ' + icon + '"></i></div>' +
      '<div style="flex:1;">' +
      '<p style="margin:0;font-weight:600;font-size:13.5px;">Order #' + n.orders.order_code + ' — ' + n.label + '</p>' +
      '<p style="margin:2px 0 0;color:#777;font-size:12.5px;">' + n.description + '</p>' +
      '<p style="margin:4px 0 0;color:#aaa;font-size:11.5px;">' + timeAgo(n.created_at) + '</p>' +
      '</div></div>';
  }).join('');
}

// Show/hide the red dot on the bell icon based on unseen notifications //
async function updateNotifBadge() {
  var badges = document.querySelectorAll('.notif-badge');
  if (!currentUser) {
    badges.forEach(function(b) { b.style.display = 'none'; });
    return;
  }

  const { data } = await supabase
    .from('order_status_history')
    .select('created_at, orders!inner(user_id)')
    .eq('orders.user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data || !data.length) {
    badges.forEach(function(b) { b.style.display = 'none'; });
    return;
  }

  var latest = data[0].created_at;
  var seen = localStorage.getItem(notifSeenKey());
  var isUnseen = !seen || new Date(latest) > new Date(seen);
  badges.forEach(function(b) { b.style.display = isUnseen ? 'inline-block' : 'none'; });
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

  renderProfileForm(profile);
}

function closeProfileModal() {
  document.getElementById('sn-profileOverlay').classList.remove('active');
  document.getElementById('sn-profileModal').classList.remove('active');
  document.body.style.overflow = '';
}

function renderProfileForm(profile) {
  var body = document.getElementById('sn-profile-body');
  var initial = (profile.full_name || currentUser.email || '?').trim().charAt(0).toUpperCase();

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

  var addRoleButtons = '';
  if (userRoles.indexOf('merchant') === -1) {
    addRoleButtons += '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-bottom:8px;" onclick="addAccountRole(\'merchant\')">' +
      '<i class="fas fa-store"></i> Register as Merchant</button>';
  }
  if (userRoles.indexOf('rider') === -1) {
    addRoleButtons += '<button class="co-btn" style="background:#F3F4F6;color:#333;width:100%;margin-bottom:8px;" onclick="addAccountRole(\'rider\')">' +
      '<i class="fas fa-motorcycle"></i> Register as Rider</button>';
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
      .from('merchants').select('id').eq('user_id', currentUser.id).single();
    if (error || !merchant) {
      body.innerHTML = '<div class="track-empty"><p>Could not load your merchant profile.</p></div>';
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
async function fetchMerchantSales() {
  const { data, error } = await supabase
    .from('order_items')
    .select('qty, price, product_id, products!inner(name, merchant_id), orders(status, created_at, payment_method)')
    .eq('products.merchant_id', myMerchantId);

  if (error) {
    myMerchantSales = { error: error.message };
    return myMerchantSales;
  }

  var rows = data || [];
  var totalRevenue = 0, totalItems = 0;
  var orderIds = {};
  var byProduct = {};

  rows.forEach(function(r) {
    var lineTotal = r.price * r.qty;
    totalRevenue += lineTotal;
    totalItems += r.qty;

    var pname = r.products ? r.products.name : 'Unknown product';
    if (!byProduct[pname]) byProduct[pname] = { name: pname, qty: 0, revenue: 0 };
    byProduct[pname].qty += r.qty;
    byProduct[pname].revenue += lineTotal;
  });

  rows.forEach(function(r) { if (r.orders) orderIds[JSON.stringify(r.orders.created_at) + r.price] = true; });

  var topProducts = Object.values(byProduct).sort(function(a, b) { return b.revenue - a.revenue; }).slice(0, 5);

  var recentOrders = rows
    .filter(function(r) { return r.orders; })
    .sort(function(a, b) { return new Date(b.orders.created_at) - new Date(a.orders.created_at); })
    .slice(0, 8);

  myMerchantSales = {
    totalRevenue: totalRevenue,
    totalItems: totalItems,
    lineCount: rows.length,
    topProducts: topProducts,
    recentOrders: recentOrders
  };
  return myMerchantSales;
}

function renderMerchantSalesView() {
  var body = document.getElementById('sn-merchant-body');
  var tabs = '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
    '<button class="co-btn" style="flex:1;background:#F3F4F6;color:#333;" onclick="switchMerchantView(\'products\')">Products</button>' +
    '<button class="co-btn" style="flex:1;background:var(--primary,#22C55E);color:#fff;" onclick="switchMerchantView(\'sales\')">Sales Report</button>' +
    '</div>';

  if (!myMerchantSales || myMerchantSales.error) {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
      '<div class="track-empty"><p>Could not load sales report' + (myMerchantSales && myMerchantSales.error ? ': ' + myMerchantSales.error : '') + '.</p></div>';
    return;
  }

  var s = myMerchantSales;

  var summaryCards = '<div style="display:flex;gap:10px;margin-bottom:20px;">' +
    '<div style="flex:1;background:#F0FFF4;border-radius:10px;padding:14px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Total Revenue</p>' +
    '<p style="margin:4px 0 0;font-weight:700;font-size:16px;color:var(--primary,#22C55E);">' + fmt(s.totalRevenue) + '</p></div>' +
    '<div style="flex:1;background:#F0F8FF;border-radius:10px;padding:14px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Items Sold</p>' +
    '<p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#3B82F6;">' + s.totalItems + '</p></div>' +
    '<div style="flex:1;background:#FFFBEB;border-radius:10px;padding:14px;text-align:center;">' +
    '<p style="margin:0;font-size:11px;color:#666;">Order Lines</p>' +
    '<p style="margin:4px 0 0;font-weight:700;font-size:16px;color:#F59E0B;">' + s.lineCount + '</p></div>' +
    '</div>';

  var topProductsHtml = s.topProducts.length
    ? s.topProducts.map(function(p, i) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<span style="font-size:13px;">' + (i + 1) + '. ' + p.name + '</span>' +
          '<span style="font-size:13px;color:#777;">' + p.qty + ' sold \u2022 ' + fmt(p.revenue) + '</span></div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No sales yet.</p>';

  var recentOrdersHtml = s.recentOrders.length
    ? s.recentOrders.map(function(r) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #f0f0f0;font-size:12.5px;">' +
          '<span>' + formatDate(r.orders.created_at) + '</span>' +
          '<span style="color:#777;">' + r.orders.status + ' \u2022 ' + (r.orders.payment_method === 'cod' ? 'COD' : 'GCash') + '</span></div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No orders yet.</p>';

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs +
    summaryCards +
    '<h3 style="margin:0 0 8px;font-size:14px;">Top Products</h3>' + topProductsHtml +
    '<h3 style="margin:16px 0 8px;font-size:14px;">Recent Order Activity</h3>' + recentOrdersHtml;
}

function renderMerchantDashboard() {
  var body = document.getElementById('sn-merchant-body');

  var tabs = '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
    '<button class="co-btn" style="flex:1;background:' + (merchantDashboardView === 'products' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'products' ? '#fff' : '#333') + ';" onclick="switchMerchantView(\'products\')">Products</button>' +
    '<button class="co-btn" style="flex:1;background:' + (merchantDashboardView === 'sales' ? 'var(--primary,#22C55E)' : '#F3F4F6') + ';color:' + (merchantDashboardView === 'sales' ? '#fff' : '#333') + ';" onclick="switchMerchantView(\'sales\')">Sales Report</button>' +
    '</div>';

  if (merchantDashboardView === 'sales') {
    body.innerHTML = '<h2 style="margin:0 0 4px;">My Store</h2>' + tabs + '<div class="track-empty"><p>Loading sales report...</p></div>';
    fetchMerchantSales().then(renderMerchantSalesView);
    return;
  }

  renderMerchantProductsView(tabs);
}

async function switchMerchantView(view) {
  merchantDashboardView = view;
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
      '<p style="margin:2px 0 0;color:#777;font-size:12.5px;">' + fmt(p.price) + ' \u2022 Stock: ' + p.stock_qty + ' \u2022 ' + meta.title + '</p>' +
      '<p style="margin:2px 0 0;color:#F59E0B;font-size:12px;">' + stars(Math.round(p.rating_avg || 0)) + ' ' + (p.rating_avg > 0 ? p.rating_avg + ' ' : '') + '<span style="color:#999;">(' + (p.rating_count || 0) + ')</span></p>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0;">' +
      '<button class="co-btn" style="padding:6px 10px;background:#F3F4F6;color:#333;" onclick="viewProductReviews(\'' + p.id + '\', \'' + p.name.replace(/'/g, "\\'") + '\')" title="Reviews"><i class="fas fa-comment-dots"></i></button>' +
      '<button class="co-btn" style="padding:6px 10px;background:#F3F4F6;color:#333;" onclick="stockInPrompt(\'' + p.id + '\')" title="Stock in"><i class="fas fa-plus"></i></button>' +
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

  ['pf-name', 'pf-price', 'pf-stock'].forEach(function(id) {
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

  var ok = true;
  if (!name) { document.getElementById('pf-name').closest('.co-field').classList.add('co-field--error'); ok = false; }
  if (!(price >= 0)) { document.getElementById('pf-price').closest('.co-field').classList.add('co-field--error'); ok = false; }
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
      name: name, description: desc, price: price, category: category, image_url: imageUrl, updated_at: new Date().toISOString()
    }).eq('id', editingProductId);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    if (error) { showToast('Could not save: ' + error.message, 'error'); return; }
    showToast('Product updated \u2705');
  } else {
    var stockEl = document.getElementById('pf-stock');
    var stock = stockEl ? parseInt(stockEl.value, 10) || 0 : 0;

    const { data: newProduct, error } = await supabase.from('products').insert({
      merchant_id: myMerchantId, name: name, description: desc, price: price,
      category: category, image_url: imageUrl, stock_qty: stock
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

async function stockInPrompt(productId) {
  var qty = parseInt(prompt('How many units to add?'), 10);
  if (!qty || qty <= 0) return;
  var reason = prompt('Reason (optional):', 'Restock') || 'Restock';

  var product = myMerchantProducts.find(function(x) { return x.id === productId; });
  if (!product) return;

  const { error } = await supabase.from('products')
    .update({ stock_qty: product.stock_qty + qty, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) { showToast('Could not update stock: ' + error.message, 'error'); return; }

  await supabase.from('stock_movements').insert({ product_id: productId, type: 'in', quantity: qty, reason: reason });

  showToast('Added ' + qty + ' units \u2705');
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
async function loadAvailableOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'placed')
    .is('rider_user_id', null)
    .order('created_at', { ascending: false });
  availableOrders = error ? [] : (data || []);
}

// Claim an unassigned order for this rider (handles the race where
// someone else — or the auto-assign fallback — grabbed it first) //
async function acceptOrder(orderId) {
  const { data: myProfile } = await supabase.from('profiles').select('full_name, phone').eq('id', currentUser.id).single();

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'preparing',
      rider_user_id: currentUser.id,
      rider_name: (myProfile && myProfile.full_name) || 'Rider',
      rider_phone: (myProfile && myProfile.phone) || '',
      rider_vehicle: myRiderProfile ? (myRiderProfile.vehicle_type.charAt(0).toUpperCase() + myRiderProfile.vehicle_type.slice(1)) : 'Motorcycle',
      rider_plate: myRiderProfile ? myRiderProfile.plate_number : '',
      rider_rating: (myRiderProfile && myRiderProfile.rating_count > 0) ? myRiderProfile.rating_avg : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .eq('status', 'placed')
    .is('rider_user_id', null)
    .select();

  if (error) {
    showToast('Could not accept order: ' + error.message, 'error');
    console.error('acceptOrder error:', error);
    return;
  }
  if (!data || !data.length) {
    showToast('Too late — another rider already claimed this order', 'info');
    await loadAvailableOrders();
    renderRiderDashboard();
    return;
  }

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    status: 'preparing',
    label: 'Preparing Your Order',
    description: 'Your order has been accepted by a rider and is being prepared for pickup.'
  });

  await supabase.from('riders').update({ is_available: false }).eq('user_id', currentUser.id);
  if (myRiderProfile) myRiderProfile.is_available = false;

  showToast('Order accepted \uD83D\uDEF5');
  await loadMyAssignedOrders();
  await loadAvailableOrders();
  renderRiderDashboard();
}

async function toggleMyAvailability(newState) {
  const { error } = await supabase.from('riders').update({ is_available: newState }).eq('user_id', currentUser.id);
  if (error) { showToast('Could not update availability: ' + error.message, 'error'); return; }
  myRiderProfile.is_available = newState;
  showToast(newState ? 'You\'re now available for deliveries' : 'You\'re now offline', 'info');
  if (newState) await loadAvailableOrders();
  renderRiderDashboard();
}

function renderRiderDashboard() {
  var body = document.getElementById('sn-rider-dash-body');
  var available = myRiderProfile ? myRiderProfile.is_available : false;

  var toggleHtml = '<div style="display:flex;align-items:center;justify-content:space-between;background:#F9FAFB;border-radius:10px;padding:12px 16px;margin-bottom:18px;">' +
    '<span style="font-weight:600;font-size:13.5px;">' + (available ? 'Available for deliveries' : 'Offline') + '</span>' +
    '<button class="co-btn" style="padding:6px 14px;background:' + (available ? '#FEE2E2' : 'var(--primary,#22C55E)') + ';color:' + (available ? '#DC2626' : '#fff') + ';" onclick="toggleMyAvailability(' + !available + ')">' +
    (available ? 'Go Offline' : 'Go Online') + '</button></div>';

  var activeOrders = myAssignedOrders.filter(function(o) { return o.status === 'preparing' || o.status === 'out_for_delivery'; });
  var pastOrders = myAssignedOrders.filter(function(o) { return o.status === 'awaiting_confirmation' || o.status === 'delivered'; });

  function orderCardHtml(o) {
    var itemsSummary = (o.order_items || []).map(function(it) { return it.product_name + ' x' + it.qty; }).join(', ');
    var statusInfo = getOrderStatusInfo(o.status);
    var actionBtn = '';
    if (o.status === 'preparing') {
      actionBtn = '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;" onclick="riderAdvanceOrder(\'' + o.id + '\', \'out_for_delivery\')">Mark Picked Up</button>';
    } else if (o.status === 'out_for_delivery') {
      actionBtn = '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;" onclick="riderAdvanceOrder(\'' + o.id + '\', \'awaiting_confirmation\')">Mark Delivered</button>';
    } else if (o.status === 'awaiting_confirmation') {
      actionBtn = '<p style="margin:8px 0 0;color:#F59E0B;font-size:12px;"><i class="fas fa-clock"></i> Waiting for customer to confirm receipt</p>';
    }

    return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
      '<p style="margin:0;font-weight:600;font-size:13.5px;">Order #' + o.order_code + ' \u2014 ' + statusInfo.label + '</p>' +
      '<p style="margin:4px 0 0;color:#777;font-size:12.5px;">' + itemsSummary + '</p>' +
      '<p style="margin:4px 0 0;color:#777;font-size:12.5px;"><i class="fas fa-map-marker-alt"></i> ' + (o.shipping_street || '') + ', ' + (o.shipping_city || '') + '</p>' +
      actionBtn +
      '</div>';
  }

  var availableHtml = availableOrders.length
    ? availableOrders.map(function(o) {
        var itemsSummary = (o.order_items || []).map(function(it) { return it.product_name + ' x' + it.qty; }).join(', ');
        return '<div style="padding:12px 4px;border-bottom:1px solid #f0f0f0;">' +
          '<p style="margin:0;font-weight:600;font-size:13.5px;">Order #' + o.order_code + ' \u2014 ' + fmt(o.total) + '</p>' +
          '<p style="margin:4px 0 0;color:#777;font-size:12.5px;">' + itemsSummary + '</p>' +
          '<p style="margin:4px 0 0;color:#777;font-size:12.5px;"><i class="fas fa-map-marker-alt"></i> ' + (o.shipping_street || '') + ', ' + (o.shipping_city || '') + '</p>' +
          '<button class="co-btn co-btn--next" style="width:100%;margin-top:8px;" onclick="acceptOrder(\'' + o.id + '\')">Accept Delivery</button>' +
          '</div>';
      }).join('')
    : '<p style="color:#999;font-size:13px;">No orders waiting for a rider right now.</p>';

  body.innerHTML =
    '<h2 style="margin:0 0 4px;">My Deliveries</h2>' +
    '<p class="login-sub" style="margin:0 0 16px;">' + activeOrders.length + ' active \u2022 ' + pastOrders.length + ' completed' +
    (myRiderProfile && myRiderProfile.rating_count > 0
      ? ' \u2022 <span style="color:#F59E0B;">' + stars(Math.round(myRiderProfile.rating_avg)) + '</span> ' + myRiderProfile.rating_avg + ' (' + myRiderProfile.rating_count + ')'
      : ' \u2022 New rider, no ratings yet') +
    '</p>' +
    toggleHtml +
    (available ? ('<h3 style="margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center;">Available Orders <button class="co-btn" style="padding:4px 10px;background:#F3F4F6;color:#333;font-size:12px;" onclick="loadAvailableOrders().then(renderRiderDashboard)"><i class="fas fa-sync"></i> Refresh</button></h3>' + availableHtml) : '') +
    '<h3 style="margin:16px 0 8px;font-size:14px;">Active Deliveries</h3>' +
    (activeOrders.length ? activeOrders.map(orderCardHtml).join('') : '<p style="color:#999;font-size:13px;">No active deliveries right now.</p>') +
    '<h3 style="margin:16px 0 8px;font-size:14px;">Completed</h3>' +
    (pastOrders.length ? pastOrders.map(orderCardHtml).join('') : '<p style="color:#999;font-size:13px;">No completed deliveries yet.</p>');
}

async function riderAdvanceOrder(orderId, newStatus) {
  await advanceOrderStatus(orderId, newStatus);
  showToast(newStatus === 'delivered' ? 'Order marked delivered \u2705' : 'Order marked picked up \uD83D\uDEF5');
  await loadMyAssignedOrders();
  renderRiderDashboard();
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
  restoreSession();

  await loadProducts();
  renderHomeProducts();
  renderCategoryPage();
});