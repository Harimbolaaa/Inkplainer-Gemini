/* All artwork is bundled as editable SVG path data. No remote URLs. */
(function (root) {
  'use strict';

  const VIEW_W = 240, VIEW_H = 200;
  const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
  const ellipse = (x, y, rx, ry) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  const box = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  const rbox = (x, y, w, h, r) => {
    const k = Math.min(r, w / 2, h / 2);
    return `M${x + k} ${y}h${w - 2 * k}a${k} ${k} 0 0 1 ${k} ${k}v${h - 2 * k}a${k} ${k} 0 0 1 ${-k} ${k}h${-(w - 2 * k)}a${k} ${k} 0 0 1 ${-k} ${-k}v${-(h - 2 * k)}a${k} ${k} 0 0 1 ${k} ${-k}Z`;
  };
  const diamond = (x, y, rx, ry) => `M${x} ${y - ry}L${x + rx} ${y}L${x} ${y + ry}L${x - rx} ${y}Z`;
  const hex = (x, y, rx, ry) => `M${x - rx * .55} ${y - ry}h${rx * 1.1}L${x + rx} ${y}L${x + rx * .55} ${y + ry}h${-rx * 1.1}L${x - rx} ${y}Z`;
  const star5 = (cx, cy, r1, r2) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? r1 : r2;
      d += `${i === 0 ? 'M' : 'L'}${+(cx + Math.cos(a) * r).toFixed(1)} ${+(cy + Math.sin(a) * r).toFixed(1)}`;
    }
    return d + 'Z';
  };

  // 9 Icons8-inspired style families
  const styles = [
    { id: 'outline', name: 'Outline', stroke: '#182234', fill: 'none', strokeWidth: 3.5, description: 'Clean uniform line art with open interiors' },
    { id: 'filled', name: 'Filled', stroke: '#182234', fill: '#c7d2fe', strokeWidth: 3.5, description: 'Solid filled silhouettes with crisp strokes' },
    { id: 'duotone', name: 'Duotone', stroke: '#1e293b', fill: '#dbeafe', strokeWidth: 3.2, description: 'Two-tone layered depth with soft fill' },
    { id: 'hand-drawn', name: 'Hand-drawn', stroke: '#292524', fill: '#fef3c7', strokeWidth: 3.0, description: 'Organic sketch contour with hand-drawn accents' },
    { id: 'whiteboard', name: 'Whiteboard', stroke: '#0f172a', fill: '#e0e7ff', strokeWidth: 4.0, description: 'Bold explainer marker lines with shading strokes' },
    { id: 'rounded', name: 'Rounded', stroke: '#1e3a8a', fill: '#dcfce7', strokeWidth: 3.6, description: 'Soft capsule geometry with generous radii' },
    { id: 'sharp', name: 'Sharp', stroke: '#111827', fill: '#f3e8ff', strokeWidth: 3.4, description: 'Angular geometric precision and crisp corners' },
    { id: 'color', name: 'Color', stroke: '#1e293b', fill: '#bae6fd', strokeWidth: 3.5, description: 'Vibrant multi-accent presentation palette' },
    { id: 'minimal', name: 'Minimal', stroke: '#334155', fill: 'none', strokeWidth: 2.4, description: 'Essential distilled geometry with fine line weight' },
  ];
  const styleMap = new Map(styles.map(s => [s.id, s]));

  // 50 Categories organized across 10 Collections (50 assets per category = 2,500 Core; 200 per category = 10,000 Extended)
  const taxonomy = [
    ['Characters & People', 'Characters', 'character', 'people', [
      ['Executive Leader', 'executive', ['ceo', 'leader', 'suit', 'director', 'founder'], ['boss', 'chief', 'president']],
      ['Data Analyst', 'analyst', ['data', 'metrics', 'chart', 'specialist', 'bi'], ['statistician', 'planner', 'auditor']],
      ['Systems Engineer', 'engineer', ['hardware', 'builder', 'technical', 'ops', 'devops'], ['technician', 'mechanic', 'operator']],
      ['Solution Architect', 'architect', ['blueprint', 'structure', 'design', 'planning', 'lead'], ['drafter', 'urbanist', 'planner']],
      ['Growth Marketer', 'marketer', ['campaign', 'brand', 'funnel', 'growth', 'ads'], ['promoter', 'advertiser', 'strategist']],
      ['Lab Researcher', 'researcher', ['study', 'experiment', 'science', 'analysis', 'discovery'], ['investigator', 'scholar', 'fellow']],
      ['Startup Founder', 'founder', ['entrepreneur', 'visionary', 'pitch', 'launch', 'venture'], ['creator', 'owner', 'pioneer']],
      ['Strategy Consultant', 'consultant', ['advisor', 'client', 'briefing', 'expert', 'workshop'], ['counselor', 'specialist', 'coach']],
      ['Creative Freelancer', 'freelancer', ['remote', 'independent', 'creator', 'laptop', 'gig'], ['contractor', 'nomad', 'solo']],
      ['Team Mentor', 'mentor', ['coaching', 'guidance', 'training', 'support', 'leader'], ['tutor', 'guide', 'instructor']],
    ]],
    ['Characters & People', 'Avatars & Personas', 'avatar', 'persona', [
      ['User Profile Avatar', 'user-avatar', ['profile', 'account', 'member', 'user', 'badge'], [' identity', 'headshot', 'person']],
      ['Admin Shield Persona', 'admin-persona', ['moderator', 'admin', 'security', 'verified', 'key'], ['superuser', 'controller', 'owner']],
      ['Customer Buyer Persona', 'buyer-persona', ['shopper', 'audience', 'segment', 'target', 'client'], ['consumer', 'patron', 'guest']],
      ['Developer Hoodie Avatar', 'dev-avatar', ['coder', 'hacker', 'programmer', 'engineer', 'tech'], ['scripter', 'builder', 'geek']],
      ['Creative Director Avatar', 'director-avatar', ['glasses', 'stylist', 'artist', 'vision', 'studio'], ['curator', 'producer', 'auteur']],
      ['Support Specialist Avatar', 'agent-avatar', ['headset', 'helpdesk', 'service', 'care', 'call'], ['operator', 'rep', 'assistant']],
      ['Student Learner Persona', 'learner-persona', ['graduate', 'scholar', 'youth', 'course', 'campus'], ['pupil', 'trainee', 'intern']],
      ['Healthcare Clinician Avatar', 'clinician-avatar', ['doctor', 'nurse', 'medical', 'scrubs', 'clinic'], ['physician', 'medic', 'healer']],
      ['Executive Board Avatar', 'board-avatar', ['partner', 'investor', 'stakeholder', 'vip', 'director'], ['trustee', 'chair', 'governor']],
      ['Global Citizen Avatar', 'citizen-avatar', ['community', 'public', 'world', 'diverse', 'social'], ['resident', 'member', 'voter']],
    ]],
    ['Characters & People', 'Professions & Specialists', 'profession', 'worker', [
      ['Airline Pilot', 'pilot', ['aviation', 'captain', 'flight', 'cockpit', 'travel'], ['aviator', 'navigator', 'crew']],
      ['Executive Chef', 'chef', ['culinary', 'kitchen', 'cook', 'hat', 'restaurant'], ['baker', 'caterer', 'gourmet']],
      ['Civil Builder', 'builder', ['construction', 'hardhat', 'site', 'contractor', 'tools'], ['mason', 'carpenter', 'foreman']],
      ['Legal Counsel', 'lawyer', ['attorney', 'justice', 'court', 'contract', 'law'], ['advocate', 'solicitor', 'notary']],
      ['Registered Nurse', 'nurse', ['care', 'hospital', 'patient', 'ward', 'medical'], ['caregiver', 'paramedic', 'orderly']],
      ['Financial Auditor', 'auditor', ['accounting', 'tax', 'ledger', 'compliance', 'budget'], ['bookkeeper', 'cpa', 'controller']],
      ['Journalist Reporter', 'reporter', ['press', 'media', 'microphone', 'news', 'interview'], ['correspondent', 'anchor', 'writer']],
      ['Industrial Machinist', 'machinist', ['factory', 'manufacturing', 'plant', 'safety', 'weld'], ['fabricator', 'smith', 'miller']],
      ['Agronomist Farmer', 'farmer', ['agriculture', 'harvest', 'organic', 'field', 'crop'], ['grower', 'rancher', 'planter']],
      ['Fire Rescue Officer', 'firefighter', ['emergency', 'rescue', 'helmet', 'safety', 'hero'], ['responder', 'marshal', 'brigade']],
    ]],
    ['Characters & People', 'Teamwork & Meetings', 'teamwork', 'collaboration', [
      ['Boardroom Standup', 'standup-meeting', ['agile', 'scrum', 'daily', 'sync', 'team'], ['huddle', 'check-in', 'briefing']],
      ['Partnership Handshake', 'handshake-deal', ['agreement', 'contract', 'trust', 'alliance', 'b2b'], ['pact', 'merger', 'closing']],
      ['Brainstorm Workshop', 'brainstorm-session', ['ideation', 'whiteboard', 'sticky', 'creative', 'group'], ['jam', 'charrette', 'sprint']],
      ['Pair Programming', 'pair-programming', ['coding', 'review', 'tandem', 'mentor', 'dev'], ['co-working', 'shadowing', 'debug']],
      ['Panel Discussion', 'panel-talk', ['conference', 'speakers', 'debate', 'forum', 'stage'], ['symposium', 'roundtable', 'summit']],
      ['Remote Video Sync', 'remote-sync', ['teleconference', 'distributed', 'hybrid', 'webcam', 'call'], ['webinar', 'livestream', 'meetup']],
      ['Onboarding Welcome', 'team-onboarding', ['hr', 'welcome', 'recruit', 'training', 'culture'], ['orientation', 'induction', 'hiring']],
      ['Cross-Functional Squad', 'project-squad', ['pod', 'crew', 'taskforce', 'collaborate', 'delivery'], ['guild', 'tribe', 'unit']],
      ['Client Pitch Review', 'client-review', ['proposal', 'feedback', 'stakeholder', 'deck', 'signoff'], ['approval', 'demo', 'consult']],
      ['Victory Celebration', 'team-celebration', ['launch', 'success', 'high-five', 'milestone', 'win'], ['cheering', 'kudos', 'triumph']],
    ]],
    ['Characters & People', 'Gestures & Poses', 'gesture', 'pose', [
      ['Thumbs Up Approval', 'thumbs-up', ['like', 'approve', 'yes', 'positive', 'good'], ['confirm', 'endorse', 'ok']],
      ['Pointing Direction', 'pointing-hand', ['indicate', 'focus', 'look', 'here', 'guide'], ['direct', 'select', 'aim']],
      ['Open Palm Welcome', 'open-palm', ['greeting', 'stop', 'wave', 'hello', 'peace'], ['offer', 'present', 'invite']],
      ['Victory Peace Sign', 'victory-hand', ['two', 'peace', 'win', 'success', 'happy'], ['v-sign', 'triumph', 'cheer']],
      ['Holding Presentation Card', 'hand-card', ['badge', 'pass', 'ticket', 'offer', 'display'], ['voucher', 'credential', 'id']],
      ['Writing With Marker', 'hand-marker', ['draw', 'sketch', 'whiteboard', 'signature', 'note'], ['inscribe', 'author', 'draft']],
      ['Raising Hand Question', 'raised-hand', ['volunteer', 'ask', 'vote', 'speak', 'participate'], ['inquire', 'signal', 'answer']],
      ['Clapping Applause', 'clapping-hands', ['praise', 'bravo', 'congrats', 'encore', 'ovation'], ['acclaim', 'salute', 'kudos']],
      ['Holding Magnifier', 'hand-magnifier', ['inspect', 'examine', 'search', 'zoom', 'detective'], ['scrutinize', 'audit', 'explore']],
      ['Fist Bump Solidarity', 'fist-bump', ['respect', 'team', 'power', 'unity', 'greeting'], ['salute', 'ally', 'bond']],
    ]],

    ['Business & Strategy', 'Props', 'prop', 'object', [
      ['Executive Briefcase', 'briefcase', ['portfolio', 'luggage', 'work', 'business', 'handle'], ['attache', 'satchel', 'case']],
      ['Inspection Clipboard', 'clipboard', ['checklist', 'audit', 'form', 'survey', 'pad'], ['roster', 'manifest', 'taskboard']],
      ['Architect Desk Lamp', 'desk-lamp', ['light', 'study', 'workspace', 'beam', 'focus'], ['lantern', 'spotlight', 'fixture']],
      ['Financial Calculator', 'calculator', ['math', ' keypad', 'accounting', 'sum', 'numbers'], ['adder', 'reckoner', 'tally']],
      ['Studio Headphones', 'headphones', ['audio', 'listen', 'music', 'podcast', 'sound'], ['headset', 'earphones', 'cans']],
      ['Broadcast Microphone', 'microphone', ['voice', 'podcast', 'record', 'speech', 'stage'], ['mic', 'announcer', 'vocal']],
      ['Spiral Notebook', 'notebook', ['journal', 'notes', 'diary', 'sketchbook', 'pages'], ['pad', 'memo', 'logbook']],
      ['Wrapped Gift Box', 'gift-box', ['present', 'reward', 'bonus', 'surprise', 'ribbon'], ['package', 'hamper', 'prize']],
      ['Security Keycard', 'keycard', ['access', 'badge', 'rfid', 'pass', 'door'], ['token', 'lanyard', 'credential']],
      ['Expedition Lantern', 'lantern', ['beacon', 'guide', 'camp', 'light', 'explore'], ['torch', 'lamp', 'flare']],
    ]],
    ['Business & Strategy', 'Business & Office', 'business', 'office', [
      ['Conference Podium', 'office-podium', ['lectern', 'speech', 'keynote', 'stage', 'speaker'], ['rostrum', 'pulpit', 'stand']],
      ['ergonomic Office Chair', 'office-chair', ['seating', 'desk', 'swivel', 'workplace', 'comfort'], ['armchair', 'stool', 'seat']],
      ['Ring Binder File', 'office-binder', ['dossier', 'archive', 'catalog', 'records', 'tabs'], ['folder', 'portfolio', 'ledger']],
      ['Desktop Stapler', 'office-stapler', ['stationery', 'bind', 'paper', 'supply', 'desk'], ['fastener', 'clip', 'tool']],
      ['Rubber Approval Stamp', 'office-stamp', ['certified', 'approved', 'official', 'seal', 'ink'], ['imprint', 'endorsement', 'mark']],
      ['Employee ID Lanyard', 'office-lanyard', ['staff', 'visitor', 'badge', 'card', 'security'], ['pass', 'nametag', 'credential']],
      ['Water Cooler Dispenser', 'water-cooler', ['breakroom', 'hydration', 'office', 'chat', 'jug'], ['fountain', 'dispenser', 'refresh']],
      ['Paper Shredder', 'paper-shredder', ['confidential', 'dispose', 'privacy', 'security', 'waste'], ['destroyer', 'cutter', 'recycle']],
      ['Desk Nameplate', 'desk-nameplate', ['title', 'executive', 'plaque', 'role', 'sign'], ['marker', 'label', 'stand']],
      ['Filing Cabinet Drawer', 'filing-cabinet', ['storage', 'vault', 'documents', 'index', 'records'], ['chest', 'locker', 'archive']],
    ]],
    ['Business & Strategy', 'Finance & Banking', 'finance', 'banking', [
      ['Gold Coin Stack', 'coin-stack', ['money', 'wealth', 'capital', 'revenue', 'profit'], ['currency', 'specie', 'cash']],
      ['Banknote Bundle', 'banknote-bundle', ['cash', 'bills', 'payroll', 'liquidity', 'funds'], ['greenbacks', 'notes', 'tender']],
      ['Steel Bank Vault', 'bank-vault', ['safe', 'security', 'reserve', 'treasury', 'lock'], ['strongbox', 'depository', 'bunker']],
      ['Smart Credit Card', 'credit-card', ['payment', 'chip', 'visa', 'debit', 'checkout'], ['plastic', 'charge', 'card']],
      ['Savings Piggy Bank', 'piggy-bank', ['thrift', 'deposit', 'nest-egg', 'budget', 'coin'], ['moneybox', 'saver', 'fund']],
      ['General Ledger Book', 'ledger-book', ['balance', 'accounting', 'audit', 'debit', 'credit'], ['journal', 'register', 'folio']],
      ['Tax Invoice Statement', 'tax-invoice', ['billing', 'receipt', 'vat', 'statement', 'due'], ['remittance', 'voucher', 'bill']],
      ['Leather Bifold Wallet', 'cash-wallet', ['pocketbook', 'purse', 'finance', 'pay', 'holder'], ['billfold', 'pouch', 'case']],
      ['Stock Exchange Bell', 'market-bell', ['ipo', 'trading', 'wall-street', 'opening', 'bull'], ['chime', 'gong', 'ticker']],
      ['Classical Bank Pillars', 'bank-building', ['institution', 'central-bank', 'federal', 'loan', 'finance'], ['treasury', 'exchange', 'trust']],
    ]],
    ['Business & Strategy', 'Charts & Analytics', 'analytics', 'chart', [
      ['Vertical Bar Chart', 'bar-chart', ['histogram', 'columns', 'metrics', 'comparison', 'kpi'], ['graph', 'bars', 'stats']],
      ['Smooth Trend Line', 'line-chart', ['timeseries', 'growth', 'forecast', 'curve', 'slope'], ['plot', 'trajectory', 'trend']],
      ['Segmented Pie Chart', 'pie-chart', ['share', 'allocation', 'proportion', 'slice', 'percent'], ['circle-graph', 'breakdown', 'ratio']],
      ['Ring Donut Gauge', 'donut-chart', ['completion', 'quota', 'ring', 'progress', 'meter'], ['torus', 'dial', 'annulus']],
      ['Conversion Funnel', 'analytics-funnel', ['pipeline', 'leads', 'stages', 'retention', 'drop-off'], ['filter', 'channel', 'sieve']],
      ['Speedometer KPI Dial', 'kpi-gauge', ['velocity', 'score', 'performance', 'needle', 'benchmark'], ['tachometer', 'indicator', 'meter']],
      ['Spider Radar Plot', 'radar-chart', ['multivariate', 'skills', 'pentagon', 'profile', 'axis'], ['web-chart', 'star-plot', 'kiviat']],
      ['Candlestick Trading Plot', 'candlestick-chart', ['forex', 'stocks', 'ohlc', 'volatility', 'market'], ['tickers', 'bars', 'wick']],
      ['Scatter Correlation Grid', 'scatter-plot', ['clusters', 'regression', 'points', 'xy', 'data'], ['distribution', 'matrix', 'cloud']],
      ['Executive KPI Dashboard', 'kpi-dashboard', ['bi', 'scorecard', 'widgets', 'overview', 'report'], ['cockpit', 'console', 'panel']],
    ]],
    ['Business & Strategy', 'Strategy & Goals', 'strategy', 'goals', [
      ['Chess Knight Tactic', 'chess-knight', ['move', 'gambit', 'board', 'thinking', 'mastery'], ['horse', 'piece', 'play']],
      ['Summit Milestone Flag', 'milestone-flag', ['peak', 'achievement', 'objective', 'victory', 'goal'], ['pennant', 'standard', 'banner']],
      ['Navigator Compass', 'strategy-compass', ['direction', 'north', 'vision', 'bearing', 'guide'], ['wayfinder', 'azimuth', 'needle']],
      ['Strategic Roadmap', 'strategy-roadmap', ['waypoints', 'phases', 'journey', 'timeline', 'plan'], ['itinerary', 'course', 'route']],
      ['Champion Laurel Crown', 'victory-crown', ['leadership', 'first', 'premium', 'royalty', 'winner'], ['tiara', 'coronet', 'wreath']],
      ['Honor Ribbon Medal', 'honor-medal', ['award', 'excellence', 'first-place', 'badge', 'prize'], ['medallion', 'decoration', 'star']],
      ['Keystone Puzzle Fit', 'strategy-puzzle', ['solution', 'integration', 'synergy', 'fit', 'piece'], ['jigsaw', 'match', 'connector']],
      ['Master Key Solution', 'master-key', ['unlock', 'access', 'secret', 'breakthrough', 'answer'], ['passkey', 'opener', 'clue']],
      ['Binoculars Horizon', 'vision-binoculars', ['foresight', 'scout', 'outlook', 'future', 'search'], ['field-glass', 'spyglass', 'lens']],
      ['North Star Guiding Light', 'guiding-star', ['polaris', 'mission', 'purpose', 'aspiration', 'shine'], ['beacon', 'luminary', 'lodestar']],
    ]],

    ['Marketing & Commerce', 'Marketing & Growth', 'marketing', 'growth', [
      ['Lead Magnet Attraction', 'lead-magnet', ['inbound', 'pull', 'capture', 'prospects', 'force'], ['lure', 'draw', 'field']],
      ['Viral Share Loop', 'viral-loop', ['referral', 'network', 'spread', 'amplify', 'social'], ['word-of-mouth', 'echo', 'buzz']],
      ['Highway Billboard', 'ad-billboard', ['outdoor', 'hoarding', 'display', 'awareness', 'poster'], ['signboard', 'marquee', 'banner']],
      ['Promo Coupon Voucher', 'promo-coupon', ['discount', 'code', 'deal', 'rebate', 'cutout'], ['ticket', 'token', 'pass']],
      ['Email Campaign Blast', 'email-campaign', ['newsletter', 'outreach', 'drip', 'broadcast', 'inbox'], ['mailer', 'bulletin', 'dispatch']],
      ['SEO Search Rank', 'seo-rank', ['organic', 'keywords', 'serp', 'indexing', 'traffic'], ['optimization', 'visibility', 'top']],
      ['Launch Countdown Rocket', 'launch-booster', ['scaleup', 'traction', 'liftoff', 'accelerate', 'orbit'], ['thruster', 'missile', 'shuttle']],
      ['Influencer Spotlight', 'brand-spotlight', ['fame', 'highlight', 'stage', 'pr', 'focus'], ['limelight', 'beam', 'fame']],
      ['A/B Split Testing', 'ab-testing', ['experiment', 'variant', 'optimize', 'compare', 'conversion'], ['trial', 'multivariate', 'split']],
      ['Press Release Horn', 'press-horn', ['announcement', 'herald', 'fanfare', 'news', 'shout'], ['trumpet', 'bugle', 'siren']],
    ]],
    ['Marketing & Commerce', 'E-Commerce & Retail', 'ecommerce', 'retail', [
      ['Rolling Shopping Cart', 'shopping-cart', ['trolley', 'basket', 'checkout', 'store', 'buy'], ['wagon', 'buggy', 'carriage']],
      ['Boutique Shopping Bag', 'shopping-bag', ['tote', 'purchase', 'retail', 'fashion', 'carry'], ['sack', 'pack', 'carrier']],
      ['Awning Storefront', 'retail-storefront', ['shop', 'merchant', 'boutique', 'market', 'local'], ['emprium', 'outlet', 'stall']],
      ['Laser Barcode Scanner', 'barcode-scanner', ['upc', 'inventory', 'sku', 'checkout', 'pos'], ['reader', 'ean', 'code']],
      ['Hanging Price Tag', 'price-tag', ['label', 'cost', 'msrp', 'markdown', 'sale'], ['ticket', 'sticker', 'badge']],
      ['Itemized Receipt Roll', 'sales-receipt', ['proof', 'slip', 'transaction', 'total', 'paper'], ['stub', 'voucher', 'check']],
      ['Customer Wishlist Heart', 'wishlist-card', ['saved', 'favorite', 'bookmark', 'desire', 'list'], ['registry', 'picks', 'wants']],
      ['Flash Sale Badge', 'discount-burst', ['clearance', 'offer', 'percent-off', 'promo', 'deal'], ['bargain', 'markdown', 'special']],
      ['Contactless POS Terminal', 'pos-terminal', ['tap', 'nfc', 'reader', 'merchant', 'pay'], ['register', 'swipe', 'till']],
      ['Product Showcase Box', 'product-pedestal', ['display', 'unboxing', 'featured', 'item', 'hero'], ['plinth', 'stand', 'podium']],
    ]],
    ['Marketing & Commerce', 'Customer Support & CRM', 'support', 'crm', [
      ['Helpdesk Headset', 'support-headset', ['call-center', 'voice', 'operator', 'agent', 'assist'], ['earpiece', 'comms', 'line']],
      ['Rescue Life Buoy', 'life-buoy', ['help', 'salvage', 'emergency', 'aid', 'recovery'], ['lifesaver', 'ring', 'float']],
      ['Five-Star Rating', 'star-rating', ['review', 'satisfaction', 'csat', 'feedback', 'quality'], ['score', 'rank', 'acclaim']],
      ['SLA Response Timer', 'sla-timer', ['uptime', 'fast', 'deadline', 'pledge', 'turnaround'], ['clock', 'countdown', 'watch']],
      ['Support Ticket Stub', 'support-ticket', ['issue', 'case', 'request', 'queue', 'help'], ['incident', 'docket', 'token']],
      ['VIP Loyalty Card', 'loyalty-card', ['rewards', 'points', 'member', 'retention', 'club'], ['perk', 'tier', 'pass']],
      ['FAQ Question Book', 'faq-guide', ['knowledgebase', 'help', 'manual', 'answers', 'docs'], ['wiki', 'handbook', 'primer']],
      ['Happy Smile CSAT', 'csat-smile', ['delight', 'nps', 'sentiment', 'positive', 'joy'], ['emoji', 'grin', 'cheer']],
      ['Live Chat Widget', 'live-chat-box', ['instant', 'messenger', 'concierge', 'bot', 'support'], ['intercom', 'dialog', 'bubble']],
      ['Escalation Shield', 'escalation-care', ['priority', 'resolve', 'guarantee', 'protection', 'trust'], ['assurance', 'cover', 'safeguard']],
    ]],
    ['Marketing & Commerce', 'Sales & Funnels', 'sales', 'pipeline', [
      ['Qualified Lead Badge', 'qualified-lead', ['mql', 'sql', 'prospect', 'verified', 'contact'], ['buyer', 'opportunity', 'target']],
      ['Pipeline Stage Gate', 'pipeline-gate', ['funnel', 'crm', 'workflow', 'conversion', 'step'], ['phase', 'milestone', 'valve']],
      ['Quota Target Bell', 'quota-bell', ['commission', 'win', 'closed-won', 'revenue', 'ring'], ['gong', 'chime', 'goal']],
      ['Contract Signature Pen', 'contract-sign', ['closing', 'autograph', 'agreement', 'legal', 'deal'], ['ink', 'endorse', 'bind']],
      ['B2B Account Matrix', 'account-matrix', ['enterprise', 'territory', 'tier', 'portfolio', 'map'], ['grid', 'chart', 'segment']],
      ['Upsell Expansion Arrow', 'upsell-arrow', ['cross-sell', 'upgrade', 'expansion', 'ndr', 'lift'], ['boost', 'addon', 'scale']],
      ['Cold Outreach Phone', 'outreach-call', ['prospecting', 'dialer', 'sdr', 'pitch', 'connect'], ['ring', 'telemarketing', 'voice']],
      ['Proposal Deck Folder', 'proposal-deck', ['rfp', 'quote', 'estimate', 'tender', 'bid'], ['dossier', 'offer', 'brief']],
      ['Revenue Forecast Crystal', 'revenue-forecast', ['projection', 'arr', 'mrr', 'outlook', 'predict'], ['oracle', 'trend', 'vision']],
      ['Deal Handshake Trophy', 'closed-won', ['champion', 'success', 'award', 'celebrate', 'close'], ['victory', 'prize', 'cup']],
    ]],
    ['Marketing & Commerce', 'Branding & Advertising', 'branding', 'advertising', [
      ['Brand Identity Crest', 'brand-crest', ['logo', 'emblem', 'coat-of-arms', 'mark', 'seal'], ['insignia', 'monogram', 'shield']],
      ['Color Swatch Fan', 'swatch-fan', ['pantone', 'palette', 'theme', 'shades', 'styleguide'], ['spectrum', 'cards', 'tints']],
      ['Typography Serif Aa', 'typography-glyph', ['font', 'lettering', 'typeface', 'editorial', 'kerning'], ['script', 'glyph', 'characters']],
      ['Golden Ratio Spiral', 'golden-spiral', ['fibonacci', 'proportion', 'harmony', 'composition', 'grid'], ['nautilus', 'curve', 'canon']],
      ['Style Guide Manual', 'brand-book', ['guidelines', 'system', 'standards', 'rules', 'assets'], ['playbook', 'bible', 'kit']],
      ['Display Banner Ad', 'banner-ad', ['impression', 'ctr', 'creative', 'header', 'web'], ['skycraper', 'leaderboard', 'tile']],
      ['Podcast Sponsorship Mic', 'sponsor-spot', ['host-read', 'audio-ad', 'jingle', 'mention', 'show'], ['endorsement', 'plug', 'promo']],
      ['Packaging Mockup Tube', 'packaging-box', ['dieline', 'label', 'carton', 'container', 'shelf'], ['wrapper', 'vessel', 'bottle']],
      ['Neon Store Sign', 'neon-sign', ['open', 'glow', 'marque', 'retail', 'attract'], ['placa', 'lightboard', 'display']],
      ['Award Red Carpet Star', 'hall-of-fame', ['prestige', 'iconic', 'premier', 'celebrity', 'fame'], ['walkway', 'galas', 'vip']],
    ]],

    ['Technology & Computing', 'Devices & Hardware', 'hardware', 'device', [
      ['Touchscreen Tablet', 'pro-tablet', ['ipad', 'slate', 'stylus', 'portable', 'screen'], ['pad', 'touch', 'display']],
      ['Ultrawide Studio Monitor', 'studio-monitor', ['display', 'screen', 'desktop', '4k', 'workstation'], ['cinema', 'panel', 'vdu']],
      ['Fitness Smartwatch', 'smartwatch', ['wearable', 'wrist', 'tracker', 'pulse', 'time'], ['chronograph', 'band', 'gadget']],
      ['Mechanical Keyboard', 'mech-keyboard', ['typing', 'keys', 'input', 'switches', 'peripheral'], ['keypad', 'board', 'type']],
      ['Wireless Precision Mouse', 'wireless-mouse', ['cursor', 'click', 'scroll', 'pointer', 'ergonomic'], ['trackball', 'input', 'peripheral']],
      ['Dual-Band Wi-Fi Router', 'wifi-router', ['modem', 'signal', 'wireless', 'antenna', 'network'], ['gateway', 'access-point', 'hub']],
      ['VR Mixed Reality Headset', 'vr-headset', ['metaverse', 'goggles', 'immersive', '3d', 'spatial'], ['visor', 'hmd', 'optics']],
      ['Laser Office Printer', 'office-printer', ['printout', 'paper', 'toner', 'scanner', 'copy'], ['copier', 'plotter', 'output']],
      ['Silicon Microchip Die', 'silicon-chip', ['cpu', 'processor', 'ic', 'wafer', 'transistor'], ['asic', 'soc', 'microprocessor']],
      ['External SSD Drive', 'ssd-drive', ['storage', 'flash', 'backup', 'usb', 'disk'], ['hard-drive', 'nvme', 'memory']],
    ]],
    ['Technology & Computing', 'Software & Coding', 'software', 'coding', [
      ['Command Line Terminal', 'cli-terminal', ['shell', 'bash', 'console', 'prompt', 'script'], ['tty', 'command', 'powershell']],
      ['Code Brackets Slash', 'code-brackets', ['html', 'syntax', 'markup', 'source', 'programming'], ['tags', 'chevrons', 'elements']],
      ['Git Branch Merge', 'git-branch', ['version-control', 'commit', 'repo', 'fork', 'pull-request'], ['tree', 'history', 'vcs']],
      ['Software Bug Beetle', 'bug-defect', ['debug', 'issue', 'error', 'qa', 'patch'], ['glitch', 'fault', 'insect']],
      ['REST API Plug Socket', 'api-plug', ['webhook', 'integration', 'endpoint', 'connect', 'sdk'], ['adapter', 'interface', 'bridge']],
      ['Docker Container Cube', 'container-cube', ['kubernetes', 'microservice', 'deploy', 'pod', 'image'], ['sandbox', 'cluster', 'box']],
      ['Binary Matrix Stream', 'binary-code', ['bits', 'bytes', 'zero-one', 'digital', 'low-level'], ['machine-code', 'hex', 'data']],
      ['IDE Split Editor', 'ide-window', ['vscode', 'workspace', 'compile', 'debugger', 'tabs'], ['workbench', 'studio', 'editor']],
      ['Package Dependency Tree', 'npm-package', ['module', 'library', 'bundle', 'registry', 'semver'], ['crate', 'gem', 'archive']],
      ['Automated Test Check', 'unit-test', ['ci-cd', 'pipeline', 'assertion', 'verified', 'build'], ['spec', 'runner', 'suite']],
    ]],
    ['Technology & Computing', 'Cloud & Servers', 'cloud', 'infrastructure', [
      ['Rackmount Server Stack', 'server-rack', ['datacenter', 'blade', 'hosting', 'hardware', 'uptime'], ['cabinet', 'chassis', 'mainframe']],
      ['Traffic Load Balancer', 'load-balancer', ['proxy', 'distribute', 'routing', 'nginx', 'scale'], ['dispatcher', 'director', 'switch']],
      ['Global CDN Edge Node', 'cdn-edge', ['latency', 'cache', 'distributed', 'mesh', 'fast'], ['pop', 'mirror', 'relay']],
      ['Kubernetes Node Cluster', 'k8s-cluster', ['orchestration', 'nodes', 'swarm', 'helm', 'cloud-native'], ['fleet', 'grid', 'mesh']],
      ['Cloud Backup Vault', 'cloud-backup', ['snapshot', 'disaster-recovery', 'restore', 'archive', 'redundancy'], ['mirror', 'replica', 'vault']],
      ['Bidirectional Cloud Sync', 'cloud-sync', ['upload', 'download', 'mirror', 'realtime', 'drive'], ['refresh', 'replicate', 'link']],
      ['Serverless Function Spark', 'serverless-fn', ['lambda', 'event-driven', 'ephemeral', 'compute', 'trigger'], ['worker', 'action', 'hook']],
      ['Time-Series Telemetry', 'server-metrics', ['grafana', 'monitoring', 'cpu-load', 'prometheus', 'logs'], ['observability', 'pulse', 'trace']],
      ['Virtual Private Cloud', 'vpc-network', ['subnet', 'isolated', 'gateway', 'tunnel', 'cidr'], ['enclave', 'intranet', 'zone']],
      ['Object Storage Bucket', 'storage-bucket', ['s3', 'blobs', 'assets', 'warehouse', 'lake'], ['repository', 'container', 'bin']],
    ]],
    ['Technology & Computing', 'AI & Data Science', 'ai', 'data-science', [
      ['Deep Neural Network', 'neural-network', ['synapse', 'layers', 'deep-learning', 'weights', 'graph'], ['perceptron', 'mesh', 'nodes']],
      ['Cognitive Brain Chip', 'ai-brain', ['intelligence', 'machine-learning', 'cognitive', 'llm', 'mind'], ['cortex', 'reason', 'logic']],
      ['Autonomous Assistant Bot', 'ai-robot', ['agent', 'chatbot', 'android', 'copilot', 'automation'], ['automaton', 'droid', 'helper']],
      ['Generative Spark Wand', 'genai-spark', ['magic', 'synthesis', 'prompt', 'create', 'diffusion'], ['stars', 'inspire', 'auto']],
      ['Curated Training Dataset', 'training-data', ['corpus', 'labels', 'tables', 'records', 'samples'], ['features', 'batches', 'set']],
      ['Vector Embedding Space', 'vector-space', ['similarity', 'rag', 'cosine', 'clusters', 'projection'], ['manifold', 'latent', 'tensor']],
      ['Predictive Model Curve', 'ml-regression', ['inference', 'curve-fit', 'forecast', 'accuracy', 'loss'], ['estimator', 'classifier', 'fit']],
      ['Computer Vision Frame', 'vision-bounding', ['detection', 'ocr', 'camera', 'segmentation', 'scan'], ['recognition', 'focus', 'track']],
      ['Prompt Engineering Console', 'prompt-box', ['chat', 'instruction', 'completion', 'token', 'input'], ['query', 'dialog', 'command']],
      ['Robotic Process Pipeline', 'rpa-workflow', ['orchestrate', 'autonomous', 'triggers', 'bots', 'chain'], ['sequence', 'macro', 'engine']],
    ]],
    ['Technology & Computing', 'Cybersecurity & Privacy', 'security', 'privacy', [
      ['Biometric Fingerprint', 'fingerprint-scan', ['touch-id', 'identity', 'biometrics', 'auth', 'unique'], ['whorl', 'print', 'verify']],
      ['Network Firewall Barrier', 'firewall-wall', ['packet-filter', 'defense', 'perimeter', 'block', 'flame'], ['bastion', 'rampart', 'gate']],
      ['Retina Eye Privacy', 'eye-privacy', ['visibility', 'watch', 'surveillance', 'iris', 'incognito'], ['gaze', 'optic', 'monitor']],
      ['Encrypted Vault Document', 'encrypted-file', ['cipher', 'aes', 'pgp', 'secret', 'classified'], ['locked-doc', 'protected', 'safe']],
      ['Two-Factor Auth Token', 'mfa-token', ['2fa', 'otp', 'passcode', 'authenticator', 'device'], ['fob', 'dongle', 'key']],
      ['Zero-Trust Shield Lock', 'zero-trust', ['verify', 'policy', 'iam', 'access', 'hardened'], ['aegis', 'citadel', 'guard']],
      ['Vulnerability Bug Radar', 'threat-radar', ['pentest', 'scanner', 'siem', 'soc', 'exploit'], ['sonar', 'sweep', 'detect']],
      ['SSL Certificate Seal', 'ssl-certificate', ['https', 'tls', 'trust', 'authority', 'verified'], ['diploma', 'warrant', 'badge']],
      ['Incognito Privacy Mask', 'privacy-mask', ['anonymous', 'vpn', 'tor', 'stealth', 'proxy'], ['disguise', 'cloak', 'visage']],
      ['Incident Siren Alert', 'security-siren', ['breach', 'alarm', 'response', 'warning', 'critical'], ['beacon', 'klaxon', 'flash']],
    ]],

    ['Flowcharts & Diagrams', 'Flowcharts', 'flowchart', 'diagram', [
      ['Manual Operation Trapezoid', 'manual-input', ['human-step', 'hand-task', 'offline', 'form', 'entry'], ['keying', 'override', 'step']],
      ['CRT Display Output', 'display-node', ['screen', 'monitor', 'visual', 'readout', 'show'], ['terminal', 'view', 'indicator']],
      ['On-Page Connector Circle', 'connector-circle', ['junction', 'reference', 'link', 'jump', 'node'], ['tie', 'hub', 'dot']],
      ['Off-Page Reference Home', 'offpage-ref', ['pentagon', 'page-link', 'cross-ref', 'external', 'sheet'], ['pointer', 'tag', 'bridge']],
      ['Multi-Document Wave', 'multi-document', ['reports', 'batch', 'packets', 'copies', 'files'], ['stack', 'bundle', 'dossier']],
      ['Internal Storage Window', 'internal-storage', ['ram', 'memory', 'buffer', 'cache', 'register'], ['core', 'matrix', 'slot']],
      ['Collate Hourglass Node', 'collate-node', ['organize', 'combine', 'rank', 'order', 'bowtie'], ['sequence', 'group', 'pair']],
      ['Sort Diamond Split', 'sort-node', ['classify', 'filter', 'order', 'arrange', 'sieve'], ['grade', 'index', 'rank']],
      ['Loop Limit Hexagon', 'loop-limit', ['iteration', 'for-loop', 'while', 'repeat', 'cycle'], ['bound', 'counter', 'until']],
      ['Summing Junction Cross', 'summing-junction', ['adder', 'combine', 'logical-or', 'mix', 'intersection'], ['node', 'nexus', 'plus']],
    ]],
    ['Flowcharts & Diagrams', 'Arrows & Connectors', 'arrow', 'connector', [
      ['Bold Left Direction Arrow', 'arrow-left', ['back', 'previous', 'return', 'west', 'reverse'], ['retreat', 'rewind', 'undo']],
      ['Bold Upward Growth Arrow', 'arrow-up', ['north', 'rise', 'ascend', 'increase', 'boost'], ['climb', 'elevate', 'soar']],
      ['Bold Downward Drop Arrow', 'arrow-down', ['south', 'descend', 'download', 'lower', 'fall'], ['sink', 'plunge', 'drop']],
      ['S-Curve Flow Connector', 'curved-connector', ['spline', 'bezier', 'path', 'transition', 'smooth'], ['meander', 'bend', 'arc']],
      ['U-Turn Loopback Arrow', 'uturn-arrow', ['revert', 'rollback', 'pivot', 'turnaround', 'backtrack'], ['hairpin', 'reverse', 'flip']],
      ['Forking Split Arrows', 'split-arrows', ['diverge', 'branch', 'parallel', 'multicast', 'choice'], ['bifurcate', 'Y-arrow', 'divide']],
      ['Converging Merge Arrows', 'converge-arrows', ['unify', 'join', 'consolidate', 'gather', 'funnel'], ['fuse', 'combine', 'meet']],
      ['Circular Cycle Arrows', 'cycle-arrows', ['recycle', 'loop', 'continuous', 'iterative', 'refresh'], ['orbit', 'wheel', 'spin']],
      ['Bidirectional Axis Arrow', 'double-arrow', ['exchange', 'swap', 'width', 'span', 'mutual'], ['two-way', 'duplex', 'versus']],
      ['Corner Elbow Connector', 'elbow-arrow', ['orthogonal', 'right-angle', 'step', 'routing', 'turn'], ['dogleg', 'L-arrow', 'corner']],
    ]],
    ['Flowcharts & Diagrams', 'Mind Maps & Networks', 'mindmap', 'network', [
      ['Central Idea Hub', 'mindmap-hub', ['core', 'radiate', 'brainstorm', 'spokes', 'center'], ['nucleus', 'nexus', 'sun']],
      ['Radial Concept Cluster', 'concept-cluster', ['bubbles', 'topics', 'associations', 'cloud', 'ideas'], ['constellation', 'group', 'constellation']],
      ['Hierarchical Org Tree', 'org-tree', ['reporting', 'structure', 'taxonomy', 'parent-child', 'levels'], ['lineage', 'branches', 'pedigree']],
      ['Peer Mesh Topology', 'mesh-topology', ['decentralized', 'p2p', 'interconnected', 'web', 'grid'], ['lattice', 'fabric', 'matrix']],
      ['Triad Synergy Nodes', 'triad-nodes', ['triangle', 'three-pillars', 'trinity', 'cycle', 'balance'], ['trio', 'delta', 'triumvirate']],
      ['Fishbone Cause Diagram', 'fishbone-diagram', ['ishikawa', 'root-cause', 'factors', 'ribs', 'analysis'], ['skeleton', 'herringbone', 'causal']],
      ['Decision Tree Branches', 'decision-tree', ['choices', 'outcomes', 'probabilities', 'splits', 'paths'], ['dendrogram', 'options', 'fork']],
      ['Hub And Spoke Star', 'star-topology', ['router', 'centralized', 'clients', 'distribution', 'wheel'], ['radial', 'fanout', 'portal']],
      ['Knowledge Graph Links', 'knowledge-graph', ['ontology', 'semantic', 'entities', 'relations', 'triples'], ['schema', 'map', 'network']],
      ['Synaptic Bridge Link', 'synapse-link', ['connection', 'coupling', 'interface', 'bond', 'handshake'], ['tether', 'conduit', 'span']],
    ]],
    ['Flowcharts & Diagrams', 'Infographic Elements', 'infographic', 'presentation', [
      ['Numbered Step Ribbon', 'step-ribbon', ['banner', 'sequence', 'phase', 'badge', 'label'], ['scroll', 'strip', 'tag']],
      ['Three-Tier Pyramid', 'hierarchy-pyramid', ['maslow', 'foundation', 'levels', 'strata', 'triangle'], ['ziggurat', 'layers', 'peak']],
      ['Overlapping Venn Circles', 'venn-diagram', ['intersection', 'overlap', 'union', 'sets', 'common'], ['euler', 'rings', 'blend']],
      ['Timeline Milestone Track', 'timeline-track', ['chronology', 'history', 'schedule', 'eras', 'pins'], ['horizon', 'sequence', 'line']],
      ['Balance Comparison Scale', 'comparison-scale', ['weigh', 'pros-cons', 'equilibrium', 'versus', 'tradeoff'], ['beam', 'libra', 'justice']],
      ['Segmented Progress Ring', 'progress-ring', ['radial', 'completion', 'phases', 'wheel', 'cycle'], ['annulus', 'loop', 'dial']],
      ['Ascending Step Staircase', 'step-staircase', ['growth', 'ladder', 'progression', 'climb', 'career'], ['levels', 'terraces', 'risers']],
      ['SWOT Quadrant Matrix', 'swot-matrix', ['four-box', '2x2', 'grid', 'Boston', 'categorize'], ['quadrants', 'table', 'window']],
      ['Callout Pointer Pin', 'callout-pin', ['marker', 'annotation', 'tooltip', 'highlight', 'drop-pin'], ['tag', 'balloon', 'flag']],
      ['Comparison Versus Shield', 'versus-badge', ['matchup', 'competition', 'head-to-head', 'battle', 'rival'], ['duel', 'contest', 'vs']],
    ]],
    ['Flowcharts & Diagrams', 'Wireframes & Layouts', 'wireframe', 'layout', [
      ['Browser Hero Wireframe', 'browser-wireframe', ['website', 'landing-page', 'chrome', 'mockup', 'above-fold'], ['viewport', 'page', 'template']],
      ['Mobile App Skeleton', 'mobile-wireframe', ['ios', 'android', 'screen', 'prototype', 'vertical'], ['handset', 'frame', 'ui']],
      ['Three-Column Card Grid', 'card-grid-layout', ['gallery', 'catalog', 'tiles', 'masonry', 'features'], ['matrix', 'board', 'deck']],
      ['Sidebar Dashboard Frame', 'sidebar-layout', ['admin', 'navigation', 'workspace', 'portal', 'app'], ['shell', 'console', 'panel']],
      ['Modal Overlay Wireframe', 'modal-wireframe', ['popup', 'dialog', 'lightbox', 'prompt', 'window'], ['sheet', 'alert-box', 'card']],
      ['Kanban Board Columns', 'kanban-wireframe', ['trello', 'lanes', 'agile', 'tasks', 'backlog'], ['scrum-board', 'workflow', 'cards']],
      ['Split Screen Comparison', 'split-wireframe', ['two-column', 'dual', 'side-by-side', 'before-after', 'layout'], ['diptych', 'halves', 'pair']],
      ['Form Checkout Skeleton', 'form-wireframe', ['inputs', 'fields', 'signup', 'registration', 'survey'], ['questionnaire', 'wizard', 'sheet']],
      ['Video Player Frame', 'player-wireframe', ['media', 'streaming', 'scrubber', 'cinema', 'embed'], ['theater', 'viewer', 'deck']],
      ['Pricing Table Tiers', 'pricing-wireframe', ['plans', 'subscription', 'packages', 'saas', 'columns'], ['matrix', 'tiers', 'comparison']],
    ]],

    ['UI & Interface', 'Icons', 'icon', 'ui', [
      ['Saved Bookmark Ribbon', 'bookmark', ['save', 'read-later', 'tag', 'favorite', 'flag'], ['marker', 'clip', 'place']],
      ['Visibility Eye Icon', 'eye', ['view', 'show', 'preview', 'watch', 'look'], ['sight', 'vision', 'peek']],
      ['Social Share Nodes', 'share', ['distribute', 'send', 'export', 'connect', 'broadcast'], ['forward', 'repost', 'spread']],
      ['Filter Funnel Icon', 'filter', ['sort', 'refine', 'narrow', 'sieve', 'criteria'], ['screen', 'strainer', 'query']],
      ['Cloud Upload Arrow', 'upload', ['publish', 'send', 'import', 'backup', 'push'], ['post', 'transfer', 'store']],
      ['Category Price Label', 'tag', ['keyword', 'metadata', 'taxonomy', 'badge', 'ticket'], ['sticker', 'token', 'mark']],
      ['Hyperlink Chain Link', 'link', ['url', 'anchor', 'connect', 'attachment', 'shortcut'], ['couple', 'bind', 'nexus']],
      ['Magic Sparkles Cluster', 'sparkles', ['ai', 'new', 'clean', 'enhance', 'featured'], ['glitter', 'twinkle', 'stars']],
      ['Preference Tuning Sliders', 'sliders', ['controls', 'equalizer', 'options', 'configure', 'adjust'], ['faders', 'knobs', 'settings']],
      ['Navigation Compass Icon', 'compass', ['explore', 'safari', 'discover', 'direction', 'orient'], ['wayfinder', 'browse', 'roam']],
    ]],
    ['UI & Interface', 'Navigation & Controls', 'navigation', 'control', [
      ['Hamburger Menu Bars', 'hamburger-menu', ['drawer', 'sidebar', 'nav', 'three-lines', 'list'], ['options', 'bars', 'toggle']],
      ['Bento App Grid', 'bento-grid', ['launcher', 'apps', 'nine-dots', 'keypad', 'matrix'], ['waffle', 'catalog', 'tiles']],
      ['Sort Ascending Bars', 'sort-bars', ['order', 'rank', 'alphabetical', 'arrange', 'filter'], ['sequence', 'grade', 'list']],
      ['Fullscreen Expand Corners', 'fullscreen-icon', ['maximize', 'enlarge', 'fit', 'cinema', 'view'], ['stretch', 'zoom', 'wide']],
      ['Sync Refresh Loop', 'refresh-loop', ['reload', 'update', 'rotate', 'retry', 'again'], ['renew', 'cycle', 'sync']],
      ['External Launch Arrow', 'external-link', ['new-tab', 'popout', 'open', 'outward', 'window'], ['redirect', 'jump', 'visit']],
      ['Thumbtack Pin Marker', 'pin-tack', ['sticky', 'attach', 'keep', 'top', 'bulletin'], ['pushpin', 'fasten', 'fix']],
      ['Toggle Switch Pill', 'toggle-switch', ['on-off', 'boolean', 'enable', 'activate', 'state'], ['slider', 'flip', 'button']],
      ['Command Search Bar', 'search-bar', ['omnibox', 'find', 'input', 'spotlight', 'lookup'], ['field', 'query-box', 'prompt']],
      ['Breadcrumb Chevron Trail', 'breadcrumb-nav', ['path', 'hierarchy', 'steps', 'back', 'wayfinding'], ['trail', 'chain', 'route']],
    ]],
    ['UI & Interface', 'Files & Documents', 'file', 'document', [
      ['PDF Document Badge', 'pdf-file', ['acrobat', 'ebook', 'portable', 'print', 'report'], ['manual', 'handout', 'paper']],
      ['Spreadsheet Table File', 'spreadsheet-file', ['excel', 'csv', 'cells', 'grid', 'rows'], ['worksheet', 'ledger', 'table']],
      ['Presentation Slide File', 'slide-file', ['deck', 'keynote', 'powerpoint', 'pitch', 'projector'], ['frames', 'boards', 'show']],
      ['Compressed Zip Archive', 'zip-archive', ['bundle', 'pack', 'tar', 'compress', 'backup'], ['clamp', 'vault', 'package']],
      ['Signed Legal Contract', 'signed-contract', ['agreement', 'deed', 'charter', 'notary', 'seal'], ['compact', 'covenant', 'treaty']],
      ['Pinned Sticky Note', 'sticky-note', ['memo', 'reminder', 'post-it', 'todo', 'jot'], ['scrap', 'card', 'notice']],
      ['Markdown Code File', 'code-file', ['json', 'xml', 'script', 'config', 'readme'], ['source', 'text-file', 'doc']],
      ['Image Gallery File', 'image-file', ['png', 'jpeg', 'svg', 'photo', 'graphic'], ['picture', 'artwork', 'snapshot']],
      ['Audio Track File', 'audio-file', ['mp3', 'wav', 'music', 'voice', 'recording'], ['sound', 'clip', 'stem']],
      ['Video Movie File', 'video-file', ['mp4', 'webm', 'footage', 'clip', 'render'], ['film', 'reel', 'movie']],
    ]],
    ['UI & Interface', 'Status & Notifications', 'status', 'alert', [
      ['Verified Check Rosette', 'verified-badge', ['authentic', 'official', 'approved', 'certified', 'seal'], ['blue-check', 'trusted', 'endorsed']],
      ['Warning Caution Triangle', 'warning-triangle', ['alert', 'hazard', 'attention', 'exclamation', 'risk'], ['danger', 'caution', 'notice']],
      ['Information Circle Badge', 'info-circle', ['details', 'about', 'tooltip', 'help', 'guide'], ['notice', 'hint', 'reference']],
      ['Error Cross Octagon', 'error-octagon', ['stop', 'failed', 'critical', 'cancel', 'blocked'], ['halt', 'deny', 'reject']],
      ['Help Question Badge', 'question-badge', ['support', 'faq', 'inquire', 'unknown', 'wonder'], ['query', 'doubt', 'assist']],
      ['Hourglass Waiting Timer', 'hourglass-wait', ['loading', 'pending', 'sand', 'duration', 'hourglass'], ['glass', 'countdown', 'delay']],
      ['Notification Dot Bell', 'unread-bell', ['ping', 'update', 'inbox', 'chime', 'reminder'], ['ringer', 'alarm', 'buzz']],
      ['Battery Charge Full', 'status-battery', ['power', 'energy', 'level', 'capacity', 'charged'], ['cell', 'fuel', 'juice']],
      ['Signal Strength Bars', 'signal-bars', [' reception', 'connectivity', 'cellular', 'online', '5g'], ['carrier', 'coverage', 'link']],
      ['Shield Check Ok', 'status-protected', ['safe', 'clean', 'guarded', 'healthy', 'passed'], ['secure', 'defended', 'immune']],
    ]],
    ['UI & Interface', 'Design & Editing Tools', 'design', 'tool', [
      ['Fountain Pen Bezier Nib', 'pen-nib', ['vector', 'anchor', 'illustrator', 'path', 'draw'], ['quill', 'stylus', 'ink']],
      ['Artist Color Palette', 'color-palette', ['paints', 'swatches', 'mixing', 'studio', 'creative'], ['board', 'tints', 'hues']],
      ['Bristle Paintbrush', 'paintbrush', ['stroke', 'canvas', 'art', 'paint', 'retouch'], ['brush', 'applicator', 'wash']],
      ['Precision Drafting Ruler', 'drafting-ruler', ['measure', 'scale', 'centimeter', 'straightedge', 'align'], ['yardstick', 'gauge', 'rule']],
      ['Cutting Scissors Tool', 'cutting-scissors', ['trim', 'snip', 'split', 'clip', 'cutout'], ['shears', 'blades', 'splice']],
      ['Color Eyedropper Pipette', 'eyedropper-tool', ['sample', 'picker', 'hex', 'pipette', 'match'], ['dropper', 'probe', 'tint']],
      ['Stacked Canvas Layers', 'layer-stack', ['z-index', 'hierarchy', 'planes', 'composition', 'sheets'], ['levels', 'decks', 'overlays']],
      ['Crop Frame Marks', 'crop-marks', ['trim', 'aspect-ratio', 'framing', 'resize', 'bounds'], ['viewfinder', 'window', 'cut']],
      ['Magic Selection Wand', 'magic-wand', ['auto-select', 'smart', 'wizard', 'retouch', 'effect'], ['scepter', 'baton', 'spark']],
      ['Bezier Node Handle', 'bezier-handle', ['tangent', 'curve', 'control-point', 'spline', 'vertex'], ['anchor', 'knot', 'joint']],
    ]],

    ['Communication & Media', 'Communication & Messaging', 'communication', 'messaging', [
      ['Dual Q&A Chat Bubbles', 'qa-bubbles', ['conversation', 'dialogue', 'discussion', 'reply', 'forum'], ['thread', 'exchange', 'talk']],
      ['Paper Airplane Send', 'paper-plane', ['dispatch', 'submit', 'telegram', 'direct', 'fly'], ['dart', 'glider', 'launch']],
      ['Classic Telephone Handset', 'phone-handset', ['call', 'hotline', 'ring', 'dial', 'voice'], ['receiver', 'landline', 'tel']],
      ['At-Sign Email Symbol', 'at-symbol', ['mention', 'handle', 'address', 'contact', 'internet'], ['ampersat', 'tag', 'mail']],
      ['Inbox Tray Delivery', 'inbox-tray', ['received', 'queue', 'messages', 'drawer', 'mail'], ['basket', 'bin', 'in-tray']],
      ['Open Letter Envelope', 'open-envelope', ['invitation', 'newsletter', 'read', 'message', 'post'], ['missive', 'note', 'card']],
      ['Video Call Grid', 'video-conference', ['zoom', 'meeting', 'participants', 'webinar', 'cam'], ['telepresence', 'rooms', 'huddle']],
      ['Push Notification Card', 'push-toast', ['banner', 'popup', 'mobile-alert', 'message', 'ping'], ['card', 'notice', 'toast']],
      ['Walkie Talkie Radio', 'walkie-talkie', ['two-way', 'field', 'dispatch', 'channel', 'crew'], ['transceiver', 'handheld', 'comms']],
      ['Translation Speech Globe', 'language-translate', ['localization', 'multilingual', 'i18n', 'interpret', 'world'], ['polyglot', 'tongues', 'dict']],
    ]],
    ['Communication & Media', 'Audio, Video & Broadcast', 'media', 'broadcast', [
      ['Director Clapperboard', 'clapperboard', ['cinema', 'scene', 'take', 'action', 'production'], ['slate', 'clapboard', 'film']],
      ['Audio Waveform Pulse', 'audio-waveform', ['soundwave', 'frequency', 'voiceover', 'oscilloscope', 'track'], ['spectrum', 'peaks', 'bars']],
      ['Cinema Film Reel', 'film-reel', ['celluloid', 'footage', 'projector', 'archive', 'movie'], ['spool', 'canister', 'strip']],
      ['Hi-Fi Speaker Cone', 'speaker-box', ['monitor', 'subwoofer', 'volume', 'acoustics', 'sound'], ['amp', 'loudspeaker', 'driver']],
      ['Studio Mixing Equalizer', 'eq-mixer', ['console', 'faders', 'mastering', 'levels', 'board'], ['deck', 'synth', 'soundboard']],
      ['Live Broadcast Tower', 'broadcast-tower', ['antenna', 'radio', 'transmitter', 'signal', 'airwaves'], ['mast', 'beacon', 'relay']],
      ['Video Playlist Queue', 'media-playlist', ['episodes', 'series', 'library', 'channels', 'watch'], ['lineup', 'program', 'catalog']],
      ['Camcorder Action Lens', 'video-camera', ['recorder', 'shoot', 'broadcast', 'eng', 'tripod'], ['handycam', 'rig', 'cine']],
      ['Podcast Mic On-Air', 'on-air-sign', ['recording', 'live', 'studio', 'show', 'stream'], ['booth', 'radio', 'lamp']],
      ['Closed Caption Subtitles', 'subtitles-cc', ['accessibility', 'transcript', 'captions', 'text', 'dialogue'], ['lyrics', 'overlay', 'script']],
    ]],
    ['Communication & Media', 'Social Media & Community', 'social', 'community', [
      ['Community Group Circle', 'community-ring', ['members', 'network', 'club', 'society', 'circle'], ['guild', 'forum', 'alliance']],
      ['Heart Like Reaction', 'like-reaction', ['love', 'engagement', 'appreciate', 'kudos', 'pulse'], ['fave', 'adore', 'react']],
      ['Hashtag Topic Trend', 'hashtag-grid', ['trending', 'viral', 'topic', 'tag', 'channel'], ['pound', 'octothorpe', 'keyword']],
      ['Follower Verified Plus', 'add-follower', ['subscribe', 'join', 'friend', 'connect', 'invite'], ['recruit', 'fan', 'member']],
      ['Comment Thread Nested', 'comment-thread', ['discussion', 'replies', 'feedback', 'opinion', 'post'], ['notes', 'remarks', 'stream']],
      ['Livestream Red Badge', 'livestream-play', ['broadcast', 'simulcast', 'watch-party', 'creators', 'now'], ['on-air', 'feed', 'real-time']],
      ['Audience Poll Bars', 'community-poll', ['survey', 'voting', 'ballot', 'opinion', 'consensus'], ['referendum', 'tally', 'choice']],
      ['Creator Trophy Award', 'creator-award', ['play-button', 'milestone', 'subscribers', 'plaque', 'fame'], ['shield', 'badge', 'honor']],
      ['Story Ring Carousel', 'story-carousel', ['ephemeral', 'reels', 'shorts', 'highlights', 'status'], ['moments', 'snaps', 'clips']],
      ['Repost Amplify Loop', 'repost-arrows', ['retweet', 'boost', 'echo', 'circulate', 'quote'], ['reshare', 'pass-on', 'cycle']],
    ]],
    ['Communication & Media', 'Publishing & Editorial', 'publishing', 'editorial', [
      ['Daily Newspaper Fold', 'newspaper-press', ['journalism', 'headline', 'gazette', 'print', 'article'], ['broadsheet', 'bulletin', 'times']],
      ['Feather Writing Quill', 'feather-quill', ['poetry', 'classic', 'manuscript', 'author', 'calligraphy'], ['plume', 'pen', 'scribe']],
      ['Editorial Quote Marks', 'quote-marks', ['citation', 'testimonial', 'speech', 'excerpt', 'pull-quote'], ['inverted-commas', 'saying', 'motto']],
      ['Typewriter Mechanical Keys', 'retro-typewriter', ['novelist', 'draft', 'ribbon', 'clatter', 'story'], ['writer', 'machine', 'press']],
      ['Hardcover Book Stack', 'book-stack', ['library', 'literature', 'reading', 'volumes', 'study'], ['tomes', 'anthology', 'collection']],
      ['Blog Article Layout', 'blog-article', ['post', 'essay', 'column', 'cms', 'read'], ['entry', 'story', 'piece']],
      ['Fountain Ink Bottle', 'ink-well', ['calligraphy', 'nib', 'pigment', 'script', 'signature'], ['jar', 'reservoir', 'pot']],
      ['Magazine Cover Glossy', 'magazine-issue', ['periodical', 'digest', 'editorial', 'feature', 'catalog'], ['zina', 'journal', 'review']],
      ['Copywriting Pencil Edit', 'editorial-pencil', ['proofread', 'redline', 'revision', 'draft', 'markup'], ['stylus', 'graphite', 'correct']],
      ['Copyright Legal Seal', 'copyright-symbol', ['intellectual-property', 'rights', 'license', 'author', 'patent'], ['trademark', 'registered', 'ip']],
    ]],
    ['Communication & Media', 'Events & Scheduling', 'events', 'schedule', [
      ['Twin Bell Alarm Clock', 'alarm-clock', ['wake', 'reminder', 'deadline', 'ring', 'morning'], ['buzzer', 'alert', 'timer']],
      ['Perforated Event Ticket', 'event-ticket', ['admission', 'pass', 'concert', 'cinema', 'voucher'], ['stub', 'entry', 'coupon']],
      ['Stage Spotlight Beam', 'stage-spotlight', ['theater', 'keynote', 'concert', 'focus', 'show'], ['par-can', 'floodlight', 'beam']],
      ['Celebration Confetti Cone', 'party-popper', ['festival', 'launch', 'anniversary', 'confetti', 'joy'], ['streamer', 'cracker', 'fete']],
      ['Precision Stopwatch', 'stopwatch-lap', ['sprint', 'duration', 'benchmark', 'seconds', 'race'], ['chronometer', 'counter', 'clock']],
      ['RSVP Invitation Card', 'rsvp-invite', ['gala', 'wedding', 'summit', 'envelope', 'guest'], ['summons', 'card', 'welcome']],
      ['Exhibition Booth Stand', 'expo-booth', ['trade-show', 'conference', 'pavilion', 'kiosk', 'fair'], ['stall', 'display', 'stand']],
      ['VIP Backstage Pass', 'vip-lanyard', ['all-access', 'speaker-pass', 'press', 'credential', 'guest'], ['badge', 'ticket', 'id']],
      ['Schedule Gantt Bars', 'schedule-gantt', ['itinerary', 'agenda', 'sessions', 'tracks', 'timetable'], ['program', 'plan', 'grid']],
      ['Champagne Toast Glasses', 'toast-glasses', ['gala', 'banquet', 'reception', 'cheers', 'milestone'], ['flutes', 'celebrate', 'clink']],
    ]],

    ['Education, Science & Ideas', 'Education & Academia', 'education', 'academic', [
      ['Graduation Mortarboard', 'graduation-cap', ['degree', 'diploma', 'university', 'alumni', 'tassel'], ['academic', 'commencement', 'hat']],
      ['Classroom Chalkboard', 'chalkboard-easel', ['lesson', 'lecture', 'teaching', 'blackboard', 'math'], ['slate', 'whiteboard', 'board']],
      ['Student Campus Backpack', 'school-backpack', ['rucksack', 'books', 'supplies', 'semester', 'carry'], ['knapsack', 'satchel', 'bag']],
      ['Rolled Diploma Scroll', 'diploma-scroll', ['certificate', 'qualification', 'honors', 'parchment', 'ribbon'], ['charter', 'credential', 'degree']],
      ['Counting Frame Abacus', 'wooden-abacus', ['arithmetic', 'beads', 'counting', 'early-learning', 'math'], ['soroban', 'frame', 'tally']],
      ['Reference Globe Stand', 'desk-globe', ['geography', 'world', 'atlas', 'meridian', 'classroom'], ['sphere', 'earth', 'orb']],
      ['University Lecture Hall', 'campus-hall', ['college', 'academy', 'columns', 'faculty', 'institute'], ['rotunda', 'library', 'school']],
      ['Apple On Textbook', 'teacher-apple', ['appreciation', 'nutrition', 'elementary', 'tutor', 'desk'], ['fruit', 'gift', 'primer']],
      ['Exam Grading A-Plus', 'exam-grade', ['score', 'assessment', 'quiz', 'excellence', 'report-card'], ['test', 'mark', 'transcript']],
      ['E-Learning Laptop Cap', 'online-course', ['mooc', 'lms', 'distance-learning', 'tutorial', 'video'], ['academy', 'portal', 'class']],
    ]],
    ['Education, Science & Ideas', 'Science & Laboratory', 'science', 'laboratory', [
      ['Optical Lab Microscope', 'lab-microscope', ['biology', 'magnify', 'specimen', 'slide', 'lens'], ['optics', 'instrument', 'scope']],
      ['Erlenmeyer Flask Bubbles', 'chemistry-flask', ['reagent', 'beaker', 'experiment', 'titration', 'solution'], ['vessel', 'conical', 'potion']],
      ['Orbital Atom Nucleus', 'atom-orbits', ['physics', 'quantum', 'electrons', 'nuclear', 'particle'], ['bohr', 'molecule', 'energy']],
      ['Double Helix DNA Strand', 'dna-helix', ['genetics', 'genome', 'biotech', 'chromosome', 'life'], ['rna', 'sequence', 'heredity']],
      ['Test Tube Rack Trio', 'test-tubes', ['samples', 'assay', 'clinical', 'vials', 'biochem'], ['tubes', 'holder', 'pipette']],
      ['Astronomical Telescope', 'star-telescope', ['observatory', 'cosmos', 'lens', 'stargazing', 'tripod'], ['refractor', 'spyglass', 'optics']],
      ['Light Dispersion Prism', 'optical-prism', ['spectrum', 'refraction', 'rainbow', 'wavelength', 'beam'], ['crystal', 'wedge', 'glass']],
      ['Petri Dish Culture', 'petri-culture', ['microbiology', 'agar', 'bacteria', 'colony', 'cell'], ['plate', 'sample', 'dish']],
      ['Molecular Bond Lattice', 'molecule-bonds', ['compound', 'organic', 'formula', 'polymer', 'structure'], ['isomer', 'chain', 'ring']],
      ['Bunsen Burner Flame', 'lab-burner', ['heat', 'reaction', 'thermal', 'catalyst', 'gas'], ['torch', 'spirit-lamp', 'fire']],
    ]],
    ['Education, Science & Ideas', 'Mathematics & Geometry', 'math', 'geometry', [
      ['Isometric Wireframe Cube', 'iso-cube', ['3d', 'hexahedron', 'volume', 'spatial', 'solid'], ['block', 'box', 'prism']],
      ['Geometric Pyramid Solid', 'geo-pyramid', ['tetrahedron', 'apex', 'facets', 'polyhedron', 'vertex'], ['cone', 'spire', 'monolith']],
      ['Cylinder Radius Solid', 'geo-cylinder', ['tube', 'column', 'pi', 'cross-section', 'volume'], ['drum', 'barrel', 'roller']],
      ['Drafting Compass Divider', 'drafting-compass', ['circle-arc', 'radius', 'geometry', 'precision', 'caliper'], ['bow-compass', 'scribes', 'legs']],
      ['Angle Protractor Arc', 'protractor-arc', ['degrees', 'angle', 'semicircle', 'measure', 'trigonometry'], ['goniometer', 'scale', 'arc']],
      ['Sine Wave Axes Plot', 'sine-wave', ['calculus', 'function', 'oscillation', 'harmonic', 'cartesian'], ['cosine', 'curve', 'graph']],
      ['Pi Constant Tablet', 'pi-symbol', ['irrational', 'circle', 'formula', 'theorem', 'greek'], ['constant', 'math', 'ratio']],
      ['Matrix Brackets Array', 'matrix-array', ['linear-algebra', 'determinant', 'vectors', 'tensors', 'grid'], ['table', 'rows', 'system']],
      ['Infinity Loop Figure', 'infinity-loop', ['limitless', 'eternal', 'lemniscate', 'continuum', 'boundless'], ['forever', 'eight', 'cycle']],
      ['Right Triangle Hypotenuse', 'pythagoras-triangle', ['set-square', 'theorem', 'trigonometry', 'right-angle', 'slope'], ['wedge', 'delta', 'rule']],
    ]],
    ['Education, Science & Ideas', 'Ideas & Innovation', 'innovation', 'idea', [
      ['Gear Filament Lightbulb', 'innovation-bulb', ['invention', 'engineering', 'smart-idea', 'solution', 'patent'], ['spark', 'eureka', 'lamp']],
      ['Interlocking Puzzle Duo', 'synergy-puzzle', ['problem-solving', 'fit', 'connect', 'logic', 'strategy'], ['pieces', 'match', 'lock']],
      ['Keyhole Vision Portal', 'keyhole-portal', ['opportunity', 'secret', 'insight', 'unlock', 'access'], ['threshold', 'opening', 'view']],
      ['Labyrinth Maze Path', 'solution-maze', ['complexity', 'navigation', 'challenge', 'route', 'solve'], ['puzzle', 'circuit', 'way']],
      ['Brainstorm Lightning Cloud', 'idea-storm', ['inspiration', 'flash', 'creativity', 'breakthrough', 'energy'], ['tempest', 'spark', 'bolt']],
      ['Origami Paper Crane', 'origami-crane', ['craft', 'transform', 'folding', 'elegance', 'design'], ['bird', 'paper-art', 'sculpture']],
      ['Prototype Blueprint Gear', 'prototype-gear', ['iteration', 'mvp', 'build', 'mechanism', 'test'], ['cog', 'model', 'draft']],
      ['Sparkplug Ignition Bolt', 'ignition-spark', ['catalyst', 'kickstart', 'momentum', 'impulse', 'power'], ['trigger', 'flash', 'charge']],
      ['Periscope Over Wall', 'periscope-view', ['perspective', 'overcome', 'lookout', 'foresight', 'angle'], ['finder', 'mirror', 'lens']],
      ['Diamond Cut Brilliance', 'brilliant-gem', ['value', 'excellence', 'polish', 'clarity', 'treasure'], ['jewel', 'crystal', 'facet']],
    ]],
    ['Education, Science & Ideas', 'Research & Discovery', 'research', 'discovery', [
      ['Magnifying Glass Document', 'audit-document', ['review', 'scrutiny', 'evidence', 'clause', 'inspect'], ['case-study', 'paper', 'find']],
      ['Field Research Binoculars', 'field-study', ['observation', 'wildlife', 'survey', 'horizon', 'explore'], ['scout', 'lookout', 'optics']],
      ['Lab Observation Logbook', 'research-log', ['field-notes', 'findings', 'hypothesis', 'record', 'journal'], ['dossier', 'protocol', 'diary']],
      ['Survey Checklist Poll', 'survey-form', ['questionnaire', 'sampling', 'respondents', 'data-collection', 'study'], ['ballot', 'sheet', 'census']],
      ['Academic Citation Index', 'citation-index', ['bibliography', 'footnote', 'peer-review', 'reference', 'source'], ['quotes', 'archive', 'catalog']],
      ['Archaeology Trowel Brush', 'discovery-artifact', ['excavate', 'uncover', 'history', 'relic', 'heritage'], ['fossil', 'find', 'treasure']],
      ['Radar Sonar Sweep', 'sonar-ping', ['detection', 'location', 'scan', 'echo', 'range'], ['tracker', 'pulse', 'screen']],
      ['Compass Map Trail', 'expedition-map', ['uncharted', 'pioneer', 'quest', 'frontier', 'route'], ['atlas', 'chart', 'trek']],
      ['Sample Magnifier Loupe', 'jeweler-loupe', ['detail', 'forensic', 'grain', 'micro', 'clarity'], ['lens', 'glass', 'zoom']],
      ['Breakthrough Eureka Star', 'eureka-burst', ['revelation', 'discovery', 'insight', 'radiance', 'new'], ['nova', 'flash', 'dawn']],
    ]],

    ['Industry, Health & Lifestyle', 'Logistics & Supply Chain', 'logistics', 'supply-chain', [
      ['Express Delivery Truck', 'delivery-truck', ['freight', 'shipping', 'van', 'courier', 'transport'], ['lorry', 'hauler', 'fleet']],
      ['Container Cargo Ship', 'cargo-ship', ['maritime', 'import-export', 'vessel', 'port', 'ocean'], ['freighter', 'barge', 'steamer']],
      ['Warehouse Forklift', 'forklift-loader', ['pallet', 'inventory', 'lifting', 'fulfillment', 'depot'], ['hoist', 'stacker', 'truck']],
      ['Distribution Warehouse', 'warehouse-hub', ['storage', 'depot', 'hangar', 'distribution', 'docks'], ['storehouse', 'silo', 'center']],
      ['Wooden Shipping Pallet', 'wooden-pallet', ['skid', 'crate', 'stacking', 'bulk', 'load'], ['platform', 'base', 'rack']],
      ['Conveyor Belt Rollers', 'conveyor-line', ['assembly', 'sorting', 'automation', 'factory', 'throughput'], ['chute', 'track', 'belt']],
      ['Live Shipment Tracking', 'shipment-pin', ['gps', 'eta', 'route', 'last-mile', 'trace'], ['waypoint', 'locator', 'beacon']],
      ['Customs Clearance Seal', 'customs-stamp', ['tariff', 'border', 'manifest', 'bill-of-lading', 'duty'], ['permit', 'pass', 'cleared']],
      ['Cold Chain Snowflake Box', 'cold-chain', ['refrigerated', 'pharma', 'fresh', 'temperature', 'insulated'], ['cryo', 'chilled', 'cooler']],
      ['Harbor Gantry Crane', 'gantry-crane', ['intermodal', 'terminal', 'dockyard', 'hoist', 'container'], ['derrick', 'rig', 'lifter']],
    ]],
    ['Industry, Health & Lifestyle', 'Manufacturing & Engineering', 'manufacturing', 'engineering', [
      ['Sawtooth Factory Plant', 'factory-plant', ['mill', 'production', 'industrial', 'smokestack', 'works'], ['foundry', 'refinery', 'facility']],
      ['Robotic Welding Arm', 'robotic-arm', ['automation', 'cnc', 'assembly-line', 'actuator', 'precision'], ['manipulator', 'servo', 'bot']],
      ['Interlocking Gear Trio', 'gear-train', ['mechanism', 'transmission', 'torque', 'cogs', 'machinery'], ['sprockets', 'wheels', 'drive']],
      ['Engineer Safety Hardhat', 'safety-hardhat', ['ppe', 'construction', 'helmet', 'protection', 'site'], ['cap', 'headgear', 'shield']],
      ['Crossed Wrench Spanner', 'wrench-tool', ['maintenance', 'repair', 'mechanics', 'bolt', 'service'], ['spanner', 'ratchet', 'fix']],
      ['Rolled Blueprint Plan', 'blueprint-scroll', ['schematic', 'cad', 'specification', 'drafting', 'architecture'], ['drawing', 'layout', 'plan']],
      ['Vernier Precision Caliper', 'vernier-caliper', ['tolerance', 'micrometer', 'dimension', 'machining', 'qc'], ['gauge', 'measure', 'rule']],
      ['Hydraulic Pressure Gauge', 'pressure-manometer', ['psi', 'bar', 'valve', 'steam', 'boiler'], ['dial', 'meter', 'indicator']],
      ['Blacksmith Steel Anvil', 'steel-anvil', ['forge', 'metallurgy', 'heavy', 'craft', 'durable'], ['block', 'iron', 'smith']],
      ['Quality ISO Seal', 'iso-quality', ['standard', 'inspection', 'six-sigma', 'lean', 'certified'], ['stamp', 'grade', 'assurance']],
    ]],
    ['Industry, Health & Lifestyle', 'Real Estate & Buildings', 'real-estate', 'architecture', [
      ['Suburban Family House', 'family-house', ['residence', 'home', 'mortgage', 'property', 'roof'], ['cottage', 'villa', 'dwelling']],
      ['Glass Office Skyscraper', 'office-tower', ['headquarters', 'commercial', 'highrise', 'downtown', 'city'], ['citadel', 'building', 'plaza']],
      ['Suspension Cable Bridge', 'suspension-bridge', ['infrastructure', 'span', 'civil', 'crossing', 'landmark'], ['viaduct', 'overpass', 'arch']],
      ['Architectural Floorplan', 'room-floorplan', ['layout', 'square-footage', 'interior', 'rooms', 'blueprint'], ['plan', 'map', 'footprint']],
      ['For-Sale Yard Sign', 'realty-sign', ['listing', 'broker', 'realtor', 'escrow', 'lease'], ['placard', 'post', 'board']],
      ['Tower Construction Crane', 'tower-crane', ['development', 'high-rise', 'hoist', 'building', 'skyline'], ['derrick', 'boom', 'rig']],
      ['Classical Museum Columns', 'civic-columns', ['courthouse', 'university', 'heritage', 'portico', 'pillar'], ['temple', 'facade', 'hall']],
      ['House Key Handover', 'house-key', ['closing', 'ownership', 'move-in', 'landlord', 'rental'], ['fob', 'latchkey', 'pass']],
      ['White Picket Fence', 'garden-fence', ['boundary', 'yard', 'lot', 'suburb', 'security'], ['palisade', 'gate', 'railing']],
      ['Smart Home Automation', 'smart-house', ['iot', 'thermostat', 'connected', 'solar', 'modern'], ['domotics', 'hub', 'eco-home']],
    ]],
    ['Industry, Health & Lifestyle', 'Healthcare & Medicine', 'healthcare', 'medical', [
      ['Clinical Stethoscope', 'stethoscope', ['auscultation', 'physician', 'checkup', 'diagnosis', 'clinic'], ['doctor-tool', 'listen', 'chestpiece']],
      ['First Aid Medical Cross', 'first-aid-kit', ['emergency', 'paramedic', 'rescue', 'triage', 'red-cross'], ['medkit', 'box', 'relief']],
      ['ECG Heartbeat Monitor', 'ecg-pulse', ['cardiology', 'vitals', 'ekg', 'rhythm', 'lifeline'], ['waveform', 'heartbeat', 'monitor']],
      ['Medication Pill Capsule', 'pill-capsule', ['pharmacy', 'prescription', 'dosage', 'treatment', 'drug'], ['tablet', 'medicine', 'remedy']],
      ['Vaccination Syringe', 'medical-syringe', ['immunization', 'injection', 'vaccine', 'needle', 'dose'], ['shot', 'inoculation', 'vial']],
      ['Hospital Ambulance Van', 'ambulance-van', ['ems', 'siren', 'transport', 'trauma', 'urgent'], ['medic-rig', 'rescue', 'paramedic']],
      ['Digital Thermometer', 'thermometer-temp', ['fever', 'celsius', 'clinical', 'mercury', 'check'], ['probe', 'gauge', 'temperature']],
      ['Anatomical Heart Organ', 'cardiac-care', ['wellness', 'donor', 'cardiovascular', 'health', 'life'], ['pulse', 'vitality', 'core']],
      ['Medical Bandage Cross', 'adhesive-bandage', ['healing', 'wound', 'recovery', 'plaster', 'care'], ['strip', 'dressing', 'patch']],
      ['Patient Medical Chart', 'patient-chart', ['ehr', 'records', 'history', 'prescription', 'hospital'], ['clipboard', 'case-file', 'notes']],
    ]],
    ['Industry, Health & Lifestyle', 'Fitness, Food & Living', 'lifestyle', 'living', [
      ['Gym Hex Dumbbell', 'hex-dumbbell', ['workout', 'strength', 'barbell', 'training', 'fitness'], ['weights', 'iron', 'lift']],
      ['Sprint Running Shoe', 'running-shoe', ['marathon', 'sneaker', 'cardio', 'athletics', 'jogging'], ['trainer', 'footwear', 'track']],
      ['Road Cycling Bicycle', 'fitness-bicycle', ['commute', 'pedal', 'peloton', 'velo', 'eco-ride'], ['bike', 'cycle', 'two-wheeler']],
      ['Fine Dining Cloche', 'dining-cloche', ['restaurant', 'hospitality', 'room-service', 'platter', 'catering'], ['dome', 'cover', 'banquet']],
      ['Crossed Fork And Knife', 'dining-utensils', ['cutlery', 'meal', 'bistro', 'menu', 'cuisine'], ['silverware', 'tableware', 'feast']],
      ['Baker Croissant Pastry', 'fresh-croissant', ['bakery', 'breakfast', 'cafe', 'artisan', 'bread'], ['crescent', 'viennoiserie', 'roll']],
      ['Modern Lounge Sofa', 'living-sofa', ['couch', 'furniture', 'interior', 'comfort', 'lounge'], ['settee', 'divan', 'seating']],
      ['Cozy Reading Armchair', 'wingback-chair', ['relax', 'decor', 'upholstery', 'home', 'study'], ['recliner', 'club-chair', 'seat']],
      ['Celebration Tier Cake', 'birthday-cake', ['anniversary', 'bakery', 'candles', 'dessert', 'party'], ['pastry', 'torte', 'sweet']],
      ['Organic Crisp Apple', 'fresh-apple', ['nutrition', 'orchard', 'healthy', 'harvest', 'diet'], ['fruit', 'produce', 'snack']],
    ]],

    ['Nature, Travel & World', 'Music, Arts & Culture', 'arts', 'culture', [
      ['Acoustic Six-String Guitar', 'acoustic-guitar', ['instrument', 'strings', 'folk', 'concert', 'strumming'], ['fiddle', 'lute', 'six-string']],
      ['Beamed Eighth Notes', 'music-notes', ['melody', 'rhythm', 'song', 'symphony', 'clef'], ['quaver', 'tune', 'chords']],
      ['Grand Piano Keyboard', 'piano-keys', ['octave', 'ivory', 'composer', 'sonata', 'recital'], ['clavichord', 'synth', 'scales']],
      ['Studio Painting Easel', 'canvas-easel', ['gallery', 'fine-art', 'portrait', 'exhibition', 'frame'], ['tripod', 'stand', 'masterpiece']],
      ['Comedy Tragedy Masks', 'theater-masks', ['drama', 'acting', 'stage', 'broadway', 'performance'], ['thalia', 'melpomene', 'play']],
      ['Vinyl Turntable Record', 'vinyl-record', ['lp', 'analog', 'dj', 'album', 'grooves'], ['platter', 'disc', 'phonograph']],
      ['Pendulum Metronome', 'tempo-metronome', ['rhythm', 'bpm', 'cadence', 'timing', 'practice'], ['tick', 'pulse', 'pace']],
      ['Classical Violin Bow', 'classic-violin', ['orchestra', 'virtuoso', 'strings', 'concerto', 'viola'], ['fiddle', 'cello', 'strad']],
      ['Museum Sculpture Bust', 'marble-bust', ['statue', 'antiquity', 'curator', 'history', 'classic'], ['pedestal', 'monument', 'art']],
      ['Origami Lotus Fold', 'culture-lotus', ['harmony', 'zen', 'mindfulness', 'blossom', 'petal'], ['flower', 'meditation', 'peace']],
    ]],
    ['Nature, Travel & World', 'Nature & Ecology', 'nature', 'ecology', [
      ['Canopy Oak Tree', 'canopy-tree', ['forest', 'woods', 'growth', 'timber', 'roots'], ['arboretum', 'grove', 'foliage']],
      ['Botanical Vein Leaf', 'eco-leaf', ['organic', 'chlorophyll', 'spring', 'vegan', 'natural'], ['frond', 'foliage', 'sprout']],
      ['Twin Alpine Peaks', 'mountain-peaks', ['summit', 'alps', 'outdoor', 'ridge', 'terrain'], ['range', 'highlands', 'crag']],
      ['Radiant Sunburst Sky', 'sun-radiance', ['daylight', 'warmth', 'summer', 'dawn', 'shine'], ['sol', 'helios', 'noon']],
      ['Raincloud Shower Drops', 'rain-cloud', ['precipitation', 'monsoon', 'climate', 'watering', 'storm'], ['nimbus', 'drizzle', 'shower']],
      ['Crystalline Snowflake', 'winter-snowflake', ['frost', 'ice', 'symmetry', 'alpine', 'cold'], ['crystal', 'blizzard', 'freeze']],
      ['Wilderness Campfire', 'camp-fire', ['bonfire', 'outdoors', 'scout', 'warmth', 'flame'], ['hearth', 'blaze', 'embers']],
      ['Rolling Ocean Crest', 'ocean-wave', ['marine', 'surf', 'tide', 'coast', 'water'], ['swell', 'breaker', 'sea']],
      ['Blooming Daisy Flower', 'bloom-flower', ['garden', 'flora', 'pollen', 'petals', 'meadow'], ['blossom', 'botany', 'bud']],
      ['Pure Water Droplet', 'water-droplet', ['aqua', 'hydration', 'clean', 'resource', 'spring'], ['dew', 'tear', 'liquid']],
    ]],
    ['Nature, Travel & World', 'Energy & Sustainability', 'energy', 'sustainability', [
      ['Photovoltaic Solar Panel', 'solar-panel', ['renewable', 'sunlight', 'clean-tech', 'grid', 'watt'], ['pv-array', 'collector', 'cell']],
      ['Offshore Wind Turbine', 'wind-turbine', ['windmill', 'blades', 'generator', 'breeze', 'green-power'], ['rotor', 'tower', 'aeolian']],
      ['Three-Arrow Recycle Loop', 'recycle-symbol', ['circular-economy', 'waste', 'reuse', 'compost', 'green'], ['upcycle', 'recovery', 'eco']],
      ['EV Charging Plug', 'ev-charger', ['electric-vehicle', 'supercharger', 'mobility', 'cord', 'clean'], ['outlet', 'adapter', 'station']],
      ['Grid Storage Battery', 'megawatt-battery', ['lithium', 'capacity', 'backup', 'inverter', 'cell'], ['accumulator', 'pack', 'store']],
      ['High-Voltage Power Pylon', 'power-pylon', ['transmission', 'utility', 'electricity', 'infrastructure', 'grid'], ['tower', 'lines', 'mains']],
      ['Carbon Footprint Leaf', 'zero-carbon', ['net-zero', 'emissions', 'offset', 'climate', 'esg'], ['neutral', 'decarbonize', 'green']],
      ['Hydroelectric Dam Wave', 'hydro-power', ['turbine', 'reservoir', 'clean-energy', 'river', 'current'], ['barrage', 'sluice', 'generator']],
      ['Geothermal Earth Vent', 'geothermal-heat', ['steam', 'underground', 'sustainable', 'thermal', 'core'], ['geyser', 'magma', 'well']],
      ['Smart Meter Dial', 'smart-meter', ['consumption', 'kilowatt', 'efficiency', 'conservation', 'monitor'], ['readout', 'gauge', 'usage']],
    ]],
    ['Nature, Travel & World', 'Travel & Transportation', 'travel', 'transport', [
      ['Commercial Jet Airplane', 'jet-airplane', ['aviation', 'flight', 'airline', 'departure', 'international'], ['airliner', 'aircraft', 'plane']],
      ['High-Speed Bullet Train', 'bullet-train', ['railway', 'transit', 'locomotive', 'commuter', 'rail'], ['express', 'metro', 'coach']],
      ['Electric Sedan Car', 'sedan-car', ['automobile', 'driving', 'roadtrip', 'vehicle', 'rental'], ['coupe', 'ev', 'motor']],
      ['City Transit Bus', 'transit-bus', ['shuttle', 'public-transport', 'coach', 'route', 'tour'], ['omnibus', 'charter', 'trolley']],
      ['Regatta Sailboat Yacht', 'sailboat-yacht', ['nautical', 'cruise', 'marina', 'wind', 'voyage'], ['sloop', 'schooner', 'vessel']],
      ['Hard-Shell Rolling Suitcase', 'travel-suitcase', ['luggage', 'baggage', 'vacation', 'carry-on', 'trip'], ['valise', 'trunk', 'trolley']],
      ['International Visa Passport', 'travel-passport', ['border', 'citizenship', 'customs', 'embassy', 'id'], ['booklet', 'visa', 'travel-doc']],
      ['Crossroad Direction Sign', 'wayfinding-sign', ['destinations', 'milepost', 'guidepost', 'junction', 'tour'], ['fingerpost', 'placard', 'marker']],
      ['Hot Air Balloon', 'hot-air-balloon', ['adventure', 'basket', 'scenic', 'soar', 'festival'], ['aerostat', 'montgolfier', 'float']],
      ['Suspension Tram Gondola', 'cable-gondola', ['alpine', 'aerial', 'ski-lift', 'sightseeing', 'cabin'], ['tramway', 'funicular', 'car']],
    ]],
    ['Nature, Travel & World', 'Maps, Weather & Space', 'space', 'weather', [
      ['Ringed Planet Saturn', 'planet-saturn', ['cosmos', 'astronomy', 'orbit', 'solar-system', 'gas-giant'], ['sphere', 'rings', 'world']],
      ['Crescent Night Moon', 'crescent-moon', ['lunar', 'night', 'astronomy', 'eclipse', 'twilight'], ['orb', 'satellite', 'phase']],
      ['Orbital Comms Satellite', 'space-satellite', ['gps', 'transponder', 'solar-wings', 'aerospace', 'telemetry'], ['probe', 'spacecraft', 'orbiter']],
      ['Folded Topographic Map', 'folded-map', ['cartography', 'brochure', 'navigation', 'atlas', 'guide'], ['chart', 'plan', 'grid']],
      ['Coastal Beacon Lighthouse', 'lighthouse-beacon', ['harbor', 'safety', 'coastline', 'beam', 'maritime'], ['pharos', 'tower', 'light']],
      ['Doppler Weather Umbrella', 'rain-umbrella', ['forecast', 'protection', 'shelter', 'canopy', 'shower'], ['parasol', 'brolly', 'cover']],
      ['Blazing Tail Comet', 'space-comet', ['meteor', 'asteroid', 'shooting-star', 'velocity', 'cosmos'], ['bolide', 'fireball', 'streak']],
      ['Star Constellation Map', 'star-constellation', ['zodiac', 'celestial', 'astrolabe', 'night-sky', 'links'], ['asterism', 'dipper', 'galaxy']],
      ['Lunar Exploration Rover', 'lunar-rover', ['lander', 'mars', 'expedition', 'robotics', 'crater'], ['buggy', 'probe', 'explorer']],
      ['Cyclone Vortex Swirl', 'weather-vortex', ['hurricane', 'typhoon', 'barometer', 'wind-system', 'storm'], ['tornado', 'whirlwind', 'spiral']],
    ]],
  ];

  // Original 56 canonical assets preserved verbatim at the start of their categories
  const original56 = [];
  const addOrig = (id, name, category, collection, cls, tags, aliases, style, paths) => {
    original56.push({
      id, name, category, collection,
      classes: [cls, category.toLowerCase().replace(/[^a-z0-9]+/g, '-'), style],
      tags, aliases, style, variant: 'canonical',
      colors: ['stroke', 'fill', 'accent'],
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      vector: {
        width: VIEW_W, height: VIEW_H, stroke: '#182234', fill: '#c7d2fe', strokeWidth: 3.5,
        paths: paths.map(p => typeof p === 'string' ? { d: p, fill: false } : p),
      },
    });
  };

  const people = [
    ['presenter', 'Presenter', 'M83 88L45 62M157 88l38-35M189 48h20v12h-20Z', ['pitch', 'speaker', 'board', 'keynote', 'explain'], ['host', 'lecturer', 'demonstrator']],
    ['teacher', 'Teacher', 'M85 88L45 120M155 88l40-40M188 45h30M48 20h65v15H48Z', ['school', 'education', 'lesson', 'pointer', 'instructor'], ['professor', 'educator', 'tutor']],
    ['developer', 'Developer', 'M80 105l-20 30h120l-20-30M65 120h110v45H65ZM112 137l-8 6 8 6m16-12 8 6-8 6', ['coder', 'software', 'laptop', 'programming', 'tech'], ['engineer', 'hacker', 'programmer']],
    ['doctor', 'Doctor', 'M100 80v40q20 25 40 0V80M120 133v10M148 105h20m-10-10v20', ['medical', 'health', 'hospital', 'physician', 'clinic'], ['surgeon', 'md', 'clinician']],
    ['student', 'Student', 'M72 22l48-16 48 16-48 16ZM84 33v18m72-18v18M45 120h42v55H45Z', ['graduate', 'learning', 'book', 'campus', 'degree'], ['scholar', 'pupil', 'learner']],
    ['designer', 'Designer', 'M156 92l30 35M181 135l28-55 10 5-28 55ZM45 110h35v45H45Z', ['creative', 'ux', 'ui', 'stylus', 'art'], ['illustrator', 'artist', 'creator']],
    ['manager', 'Manager', 'M110 80l10 18 10-18M120 98l-7 33 7 10 7-10ZM166 120h45v42h-45Z', ['business', 'tie', 'briefcase', 'executive', 'lead'], ['director', 'supervisor', 'boss']],
    ['scientist', 'Scientist', 'M44 95h28m-23 0v30l-16 32h50l-16-32V95M90 42h23v14H90Zm37 0h23v14h-23ZM113 48h14', ['lab', 'flask', 'research', 'chemistry', 'glasses'], ['chemist', 'biologist', 'researcher']],
    ['customer', 'Customer', 'M44 110h43l-6 54H50ZM54 110q12-24 23 0M154 92l30 32', ['shopping', 'bag', 'buyer', 'retail', 'client'], ['shopper', 'consumer', 'patron']],
    ['speaker', 'Speaker', 'M157 84l26-32M184 42a8 8 0 1 0 0 16a8 8 0 1 0 0-16M44 142h150l-14 43H58Z', ['podium', 'conference', 'mic', 'talk', 'event'], ['orator', 'panelist', 'keynote']],
    ['runner', 'Runner', 'M88 90L55 105 30 85M153 88l30 25 30-18M110 142l-30 28-35 5M130 142l35 23 30 28', ['sport', 'sprint', 'fitness', 'fast', 'action'], ['athlete', 'jogger', 'racer']],
    ['support', 'Support Agent', 'M88 45q0-35 32-35t32 35M82 42h12v24H82Zm64 0h12v24h-12ZM152 64v15h-23', ['headset', 'helpdesk', 'service', 'call', 'care'], ['operator', 'assistant', 'rep']],
  ];
  people.forEach(([id, name, detail, tags, aliases], i) => addOrig(id, name, 'Characters', 'Characters & People', 'character', tags, aliases, 'filled', [
    { d: circle(120, 48, 27), fill: true },
    'M108 49h1m22 0h1M110 60q10 8 20 0',
    { d: 'M85 145v-38q0-30 35-30t35 30v38Z', fill: true },
    i === 10 ? 'M110 145v10m20-10v10' : 'M105 145v40m30-40v40M84 101l-20 43m92-43 20 43',
    detail,
  ]));

  const origProps = [
    ['laptop', 'Laptop', [{ d: box(45, 30, 150, 110), fill: true }, 'M25 160h190l-20-20H45ZM58 42h124v84H58Z'], ['computer', 'notebook', 'work', 'screen', 'tech'], ['macbook', 'pc', 'workstation']],
    ['phone', 'Smartphone', [{ d: box(80, 15, 80, 170), fill: true }, 'M88 35h64v118H88ZM108 25h24M116 170h8'], ['mobile', 'cellphone', 'app', 'device', 'screen'], ['iphone', 'handset', 'cellular']],
    ['bulb', 'Lightbulb', [{ d: 'M96 137v-12q-32-18-25-52 6-37 49-37t49 37q7 34-25 52v12Z', fill: true }, 'M96 150h48m-43 13h38m-31 13h24M120 15V5M55 35l-12-12m142 12 12-12M45 90H28m167 0h17M108 136V94l-12-14m36 56V94l12-14'], ['idea', 'innovation', 'light', 'creative', 'spark'], ['lamp', 'invention', 'thought']],
    ['rocket', 'Rocket', [{ d: 'M85 130q0-70 35-112 35 42 35 112l-35 20Z', fill: true }, circle(120, 78, 16), 'M85 100l-30 45h30m70-45 30 45h-30M106 152l-4 35 18-15 18 15-4-35'], ['launch', 'startup', 'space', 'growth', 'boost'], ['spaceship', 'missile', 'shuttle']],
    ['target', 'Target', [circle(120, 100, 78), circle(120, 100, 52), circle(120, 100, 25), 'M120 100l78-65m-5-10 5 10 14 2'], ['goal', 'bullseye', 'aim', 'objective', 'accuracy'], ['dartboard', 'focus', 'kpi']],
    ['trophy', 'Trophy', [{ d: 'M75 25h90v55q0 40-45 40T75 80Z', fill: true }, 'M75 42H45v25q0 25 33 25m87-50h30v25q0 25-33 25M120 120v35m-35 25h70l-10-25H95Z'], ['award', 'winner', 'champion', 'cup', 'success'], ['prize', 'victory', 'first']],
    ['calendar', 'Calendar', [{ d: box(35, 35, 170, 140), fill: true }, 'M35 70h170M75 20v30m90-30v30M65 95h20m25 0h20m25 0h20M65 125h20m25 0h20m25 0h20M65 150h20m25 0h20'], ['date', 'schedule', 'planner', 'event', 'month'], ['agenda', 'timetable', 'diary']],
    ['clock', 'Clock', [circle(120, 100, 78), 'M120 40v60l40 25M120 28v8m0 128v8M48 100h8m128 0h8'], ['time', 'hour', 'deadline', 'watch', 'schedule'], ['timer', 'chronometer', 'dial']],
    ['folder', 'Folder', [{ d: 'M25 55h75l15 20h100v95H25Z', fill: true }, 'M25 75V40h65l15 15h95v20'], ['files', 'directory', 'storage', 'archive', 'organize'], ['dossier', 'binder', 'portfolio']],
    ['chart', 'Growth Chart', ['M35 25v145h175M55 150v-35h27v35m20 0V85h27v65m20 0V50h27v100M55 95l45-35 35 5 55-45m-20 0h20v20'], ['analytics', 'finance', 'bars', 'trend', 'metrics'], ['graph', 'report', 'statistics']],
    ['package', 'Package', [{ d: 'M35 60l85-35 85 35v95l-85 30-85-30Z', fill: true }, 'M35 60l85 32 85-32M120 92v93M80 42l85 34v35M52 130l35 13'], ['box', 'delivery', 'shipping', 'parcel', 'product'], ['carton', 'crate', 'shipment']],
    ['book', 'Open Book', [{ d: 'M120 55Q80 30 25 45v120q55-15 95 10 40-25 95-10V45q-55-15-95 10Z', fill: true }, 'M120 55v120M45 70q30-5 55 5M45 95q30-5 55 5M140 75q25-10 55-5m-55 30q25-10 55-5'], ['reading', 'education', 'manual', 'knowledge', 'story'], ['textbook', 'guide', 'publication']],
    ['camera', 'Camera', [{ d: 'M30 65h45l12-25h65l12 25h46v100H30Z', fill: true }, circle(120, 115, 34), 'M175 82h16'], ['photo', 'lens', 'snapshot', 'media', 'capture'], ['dslr', 'photography', 'shooter']],
    ['megaphone', 'Megaphone', [{ d: 'M45 85h50l100-45v120L95 115H45Z', fill: true }, 'M70 115l20 55h30l-15-50M210 70l15-12m-15 42h20m-20 30 15 12'], ['marketing', 'announcement', 'promotion', 'loud', 'campaign'], ['bullhorn', 'speaker', 'broadcast']],
    ['coffee', 'Coffee Cup', [{ d: 'M50 70h120v60q0 35-60 35t-60-35Z', fill: true }, 'M170 80h20q30 30 0 50h-20M40 180h145M80 50q-15-12 0-25m30 25q-15-12 0-25m30 25q-15-12 0-25'], ['cafe', 'mug', 'break', 'morning', 'drink'], ['espresso', 'latte', 'teacup']],
    ['plant', 'Plant', [{ d: 'M80 130h80l-12 55H92Z', fill: true }, 'M120 130V55M120 105q-65 0-65-50 60 0 65 50ZM120 90q0-55 65-55 0 55-65 55Z'], ['nature', 'growth', 'pot', 'eco', 'leaf'], ['sprout', 'seedling', 'houseplant']],
  ];
  origProps.forEach(([id, name, paths, tags, aliases]) => addOrig(id, name, 'Props', 'Business & Strategy', 'prop', tags, aliases, paths.some(p => p.fill) ? 'filled' : 'outline', paths));

  [
    ['process', 'Process', box(25, 55, 190, 90), ['step', 'action', 'box', 'workflow', 'task'], ['operation', 'activity', 'block']],
    ['decision', 'Decision', 'M120 15l100 85-100 85-100-85Z', ['branch', 'condition', 'diamond', 'if-else', 'choice'], ['gateway', 'test', 'question']],
    ['database', 'Database', 'M45 50a75 25 0 1 0 150 0a75 25 0 1 0-150 0M45 50v105a75 25 0 0 0 150 0V50M45 100a75 25 0 0 0 150 0', ['storage', 'sql', 'cylinder', 'records', 'server'], ['db', 'datastore', 'warehouse']],
    ['document', 'Document', 'M40 25h160v135q-40-25-80 0t-80 0Z', ['report', 'file', 'page', 'output', 'print'], ['form', 'record', 'sheet']],
    ['terminator', 'Start / End', 'M65 55h110a45 45 0 0 1 0 90H65a45 45 0 0 1 0-90Z', ['begin', 'finish', 'pill', 'terminal', 'trigger'], ['halt', 'entry', 'exit']],
    ['cloud', 'Cloud', 'M60 150q-55-5-35-55 10-25 40-20 5-65 65-45 35-10 50 35 60-10 45 45-5 40-45 40Z', ['network', 'internet', 'remote', 'saas', 'hosting'], ['sky', 'external', 'web']],
    ['arrow', 'Right Arrow', 'M20 80h130V50l70 50-70 50v-30H20Z', ['next', 'direction', 'flow', 'forward', 'pointer'], ['east', 'proceed', 'vector']],
    ['input', 'Data Input', 'M65 50h150l-40 100H25Z', ['io', 'parallelogram', 'read', 'write', 'feed'], ['output', 'import', 'stream']],
    ['subprocess', 'Subprocess', box(25, 50, 190, 100) + 'M48 50v100m144-100v100', ['module', 'routine', 'predefined', 'function', 'call'], ['macro', 'component', 'service']],
    ['hexagon', 'Preparation', 'M65 50h110l45 50-45 50H65l-45-50Z', ['setup', 'initialize', 'config', 'polygon', 'stage'], ['init', 'preset', 'boot']],
    ['delay', 'Delay', 'M40 50h100a50 50 0 0 1 0 100H40Z', ['wait', 'pause', 'queue', 'latency', 'hold'], ['buffer', 'sleep', 'timer']],
    ['merge', 'Merge', 'M25 40h190l-95 125Z', ['combine', 'join', 'triangle', 'unify', 'funnel'], ['consolidate', 'collect', 'sync']],
  ].forEach(([id, name, d, tags, aliases]) => addOrig(id, name, 'Flowcharts', 'Flowcharts & Diagrams', 'flowchart', tags, aliases, 'filled', [{ d, fill: true }]));

  [
    ['check', 'Check', 'M45 100l45 45 105-105', ['done', 'approve', 'success', 'yes', 'tick'], ['complete', 'valid', 'ok']],
    ['star', 'Star', 'M120 15l28 56 62 9-45 44 11 62-56-30-56 30 11-62-45-44 62-9Z', ['favorite', 'rating', 'featured', 'award', 'best'], ['bookmark', 'top', 'five-star']],
    ['heart', 'Heart', 'M120 175S25 120 25 65q0-55 50-40 25 5 45 35 20-30 45-35 50-15 50 40 0 55-95 110Z', ['love', 'like', 'health', 'care', 'passion'], ['favorite', 'affection', 'pulse']],
    ['search', 'Search', circle(105, 85, 60) + 'M150 130l65 60', ['find', 'magnifier', 'lookup', 'query', 'explore'], ['zoom', 'inspect', 'lens']],
    ['home', 'Home', 'M25 95l95-75 95 75M50 80v100h140V80M100 180v-65h40v65', ['house', 'main', 'start', 'property', 'residence'], ['dashboard', 'building', 'shelter']],
    ['mail', 'Mail', box(25, 45, 190, 110) + 'M25 45l95 70 95-70', ['email', 'envelope', 'message', 'letter', 'inbox'], ['post', 'contact', 'send']],
    ['lock', 'Lock', box(55, 90, 130, 90) + 'M80 90V60a40 40 0 0 1 80 0v30M120 125v25', ['security', 'password', 'private', 'padlock', 'safe'], ['encrypted', 'protected', 'auth']],
    ['play', 'Play', 'M75 30l110 70L75 170Z', ['video', 'start', 'media', 'stream', 'run'], ['begin', 'action', 'watch']],
    ['download', 'Download', 'M120 20v110m-40-40 40 40 40-40M40 140v40h160v-40', ['save', 'export', 'fetch', 'install', 'receive'], ['pull', 'get', 'store']],
    ['bell', 'Bell', 'M55 145q20-25 20-65 0-45 45-45t45 45q0 40 20 65ZM100 165q20 30 40 0M120 35V20', ['notification', 'alert', 'alarm', 'reminder', 'ring'], ['chime', 'ping', 'update']],
    ['location', 'Location', 'M120 185S55 115 55 70a65 60 0 0 1 130 0q0 45-65 115Z' + circle(120, 70, 23), ['pin', 'map', 'gps', 'place', 'address'], ['marker', 'waypoint', 'spot']],
    ['globe', 'Globe', circle(120, 100, 80) + 'M40 100h160M120 20q-60 80 0 160 60-80 0-160M55 55q65 35 130 0M55 145q65-35 130 0', ['world', 'international', 'web', 'earth', 'global'], ['planet', 'internet', 'worldwide']],
    ['lightning', 'Lightning', 'M135 15L65 110h50l-10 75 70-100h-50Z', ['bolt', 'power', 'fast', 'energy', 'flash'], ['thunder', 'charge', 'instant']],
    ['gear', 'Settings', 'M95 25h50l5 25 25 10 22-10 25 43-22 15-5 25 15 20-35 30-20-15-25 2-15 20-40-20 5-25-15-20-25-5V75l25-5 20-20Z' + circle(120, 100, 28), ['cog', 'preferences', 'options', 'config', 'system'], ['setup', 'engine', 'control']],
    ['chat', 'Chat Bubble', 'M30 30h180v115H90l-45 35v-35H30ZM65 65h110M65 95h75', ['message', 'comment', 'talk', 'speech', 'support'], ['conversation', 'dialog', 'feedback']],
    ['shield', 'Shield', 'M120 15l75 30v55q0 55-75 85-75-30-75-85V45ZM85 100l25 25 50-55', ['security', 'protection', 'defense', 'safe', 'guard'], ['armor', 'aegis', 'trust']],
  ].forEach(([id, name, d, tags, aliases]) => {
    const isFilled = !['check', 'search', 'globe', 'download'].includes(id);
    addOrig(id, name, 'Icons', 'UI & Interface', 'icon', tags, aliases, isFilled ? 'filled' : 'outline', [{ d, fill: isFilled }]);
  });

  // Composable pictorial SVG motif generator for all 50 categories
  function subjectMotif(catIdx, subjIdx, editionIdx) {
    const s = subjIdx, e = editionIdx;
    const ox = (s % 3 - 1) * 4 + (e % 2) * 2;
    const oy = ((s >> 1) % 3 - 1) * 3;
    const cx = 120 + ox, cy = 98 + oy;
    const rad = 24 + (s % 4) * 3;

    switch (catIdx % 25) {
      case 0: // Characters & Roles
        return [
          { d: circle(cx, cy - 46, 22 + (s % 3)), fill: true },
          `M${cx - 9} ${cy - 48}h2m14 0h2M${cx - 8} ${cy - 37}q8 ${4 + (s % 3) * 2} 16 0`,
          { d: `M${cx - 32} ${cy + 40}v-34q0-26 32-26t32 26v34Z`, fill: true },
          `M${cx - 14} ${cy + 40}v34m28-34v34M${cx - 32} ${cy - 4}L${cx - 56 - s * 2} ${cy + 18 - (s % 4) * 10}M${cx + 32} ${cy - 4}L${cx + 58 + s} ${cy - 18 + (s % 3) * 12}`,
          s % 2 === 0 ? box(cx + 46, cy - 32, 26, 20 + (s % 4) * 3) : circle(cx - 58, cy + 16, 10 + (s % 3) * 2),
        ];
      case 1: // Avatars & Personas
        return [
          { d: s % 2 === 0 ? circle(cx, cy, 62) : hex(cx, cy, 64, 58), fill: true },
          { d: circle(cx, cy - 18, 22), fill: true },
          { d: `M${cx - 36} ${cy + 44}q8-34 36-34t36 34Z`, fill: true },
          `M${cx - 9} ${cy - 20}h2m14 0h2M${cx - 8} ${cy - 10}q8 6 16 0`,
          s % 3 === 0 ? `M${cx - 22} ${cy - 36}l22-12 22 12` : circle(cx + 42, cy - 40, 8 + (s % 3)),
        ];
      case 2: // Professions & Specialists
        return [
          { d: `M${cx - 28} ${cy - 54}h56l-6-16h-44Z`, fill: true },
          { d: circle(cx, cy - 34, 21), fill: true },
          { d: `M${cx - 34} ${cy + 44}v-36q0-24 34-24t34 24v36Z`, fill: true },
          `M${cx - 12} ${cy - 12}l12 22 12-22M${cx} ${cy + 10}v34`,
          `M${cx + 38} ${cy + 4}h${24 + s * 2}v${22 + (s % 3) * 4}h-${24 + s * 2}Z`,
        ];
      case 3: // Teamwork & Collaboration
        return [
          { d: circle(cx - 38, cy - 26, 18), fill: true },
          { d: circle(cx + 38, cy - 26, 18), fill: true },
          { d: `M${cx - 62} ${cy + 38}v-26q0-20 24-20t24 20v26Z`, fill: true },
          { d: `M${cx + 14} ${cy + 38}v-26q0-20 24-20t24 20v26Z`, fill: true },
          `M${cx - 14} ${cy + 4}h28M${cx - 50} ${cy + 46}h100M${cx - 20} ${cy - 54}h40v20h-40Z`,
        ];
      case 4: // Gestures & Poses
        return [
          { d: rbox(cx - 46, cy - 10, 56, 46, 12), fill: true },
          { d: rbox(cx - 12, cy - 44 - (s % 3) * 6, 22, 36, 9), fill: true },
          `M${cx + 10} ${cy - 6}h32a8 8 0 0 1 0 16h-28m24 0a8 8 0 0 1 0 15h-24m20 0a8 8 0 0 1 0 15h-26`,
          `M${cx - 64} ${cy - 14}h18v54h-18Z`,
          `M${cx} ${cy - 64}v-14m26 20l12-10m-64 10l-12-10`,
        ];
      case 5: // Props & Office Objects
        return [
          { d: rbox(cx - 58, cy - 34, 116, 82, 10), fill: true },
          `M${cx - 24} ${cy - 34}v-16h48v16M${cx - 58} ${cy + 4}h116`,
          { d: rbox(cx - 14, cy - 6, 28, 22, 4), fill: true },
          `M${cx - 38} ${cy + 26}h${30 + s * 4}m16 0h24`,
        ];
      case 6: // Business & Office
        return [
          { d: box(cx - 52, cy - 48, 104, 108), fill: true },
          { d: rbox(cx - 26, cy - 60, 52, 20, 6), fill: true },
          `M${cx - 34} ${cy - 16}h68M${cx - 34} ${cy + 6}h${44 + (s % 4) * 6}M${cx - 34} ${cy + 28}h52`,
          `M${cx - 42} ${cy - 16}l5 5 10-10m-15 27l5 5 10-10`,
        ];
      case 7: // Finance & Banking
        return [
          { d: rbox(cx - 66, cy - 40, 132, 84, 12), fill: true },
          `M${cx - 66} ${cy - 14}h132M${cx - 46} ${cy + 14}h26v16h-26Z`,
          circle(cx + 34, cy + 20, 12 + (s % 3) * 2),
          `M${cx} ${cy - 60}v14m-18-8l8 8m28-8l-8 8`,
        ];
      case 8: // Charts & Analytics
        return [
          `M${cx - 72} ${cy - 56}v114h144`,
          { d: box(cx - 54, cy + 58 - (28 + s * 3), 22, 28 + s * 3), fill: true },
          { d: box(cx - 18, cy + 58 - (54 + (s % 4) * 7), 22, 54 + (s % 4) * 7), fill: true },
          { d: box(cx + 18, cy + 58 - (82 + (s % 3) * 8), 22, 82 + (s % 3) * 8), fill: true },
          `M${cx - 48} ${cy + 6}L${cx - 8} ${cy - 18}L${cx + 28} ${cy - 44}L${cx + 58} ${cy - 54}`,
          circle(cx + 58, cy - 54, 6),
        ];
      case 9: // Strategy & Goals
        return [
          { d: circle(cx, cy, 62), fill: true },
          circle(cx, cy, 40),
          { d: circle(cx, cy, 18), fill: true },
          `M${cx} ${cy}L${cx + 56} ${cy - 52}m-16 0h16v16`,
          `M${cx - 26} ${cy + 70}h52`,
        ];
      case 10: // Marketing & Growth
        return [
          { d: `M${cx - 58} ${cy - 14}h38l72-38v96l-72-32h-38Z`, fill: true },
          `M${cx - 38} ${cy + 12}l14 42h22l-10-42`,
          `M${cx + 64} ${cy - 26}l18-12m-18 32h22m-22 20l18 12`,
          circle(cx - 58, cy - 1, 8 + (s % 3)),
        ];
      case 11: // E-Commerce & Retail
        return [
          `M${cx - 74} ${cy - 48}h22l18 74h74l16-54H${cx - 44}`,
          { d: `M${cx - 42} ${cy - 28}h100l-14 46h-74Z`, fill: true },
          circle(cx - 26, cy + 44, 11),
          circle(cx + 30, cy + 44, 11),
          `M${cx - 6} ${cy - 14}v20m-10-10h20`,
        ];
      case 12: // Customer Support & CRM
        return [
          `M${cx - 52} ${cy}a52 52 0 0 1 104 0`,
          { d: rbox(cx - 64, cy - 8, 22, 38, 8), fill: true },
          { d: rbox(cx + 42, cy - 8, 22, 38, 8), fill: true },
          `M${cx + 52} ${cy + 30}v14q0 16-24 16h-20`,
          { d: star5(cx, cy - 4, 24, 11), fill: true },
        ];
      case 13: // Sales & Funnels
        return [
          { d: `M${cx - 68} ${cy - 52}h136l-44 54v46l-48-16v-30Z`, fill: true },
          `M${cx - 46} ${cy - 26}h92M${cx - 26} ${cy}h52`,
          circle(cx, cy + 56, 12 + (s % 3)),
          `M${cx - 6} ${cy + 56}l5 5 10-10`,
        ];
      case 14: // Branding & Identity
        return [
          { d: `M${cx} ${cy - 64}l58 24v44q0 46-58 68-58-22-58-68v-44Z`, fill: true },
          { d: star5(cx, cy - 4, 28 + (s % 3) * 2, 13), fill: true },
          `M${cx - 32} ${cy + 34}h64`,
        ];
      case 15: // Devices & Hardware
        return [
          { d: rbox(cx - 64, cy - 52, 128, 84, 8), fill: true },
          box(cx - 52, cy - 40, 104, 60),
          `M${cx - 18} ${cy + 32}l-8 22h52l-8-22M${cx - 36} ${cy + 54}h72`,
          `M${cx - 28} ${cy - 10}l16-14 14 12 22-20`,
        ];
      case 16: // Software & Coding
        return [
          { d: rbox(cx - 70, cy - 52, 140, 104, 10), fill: true },
          `M${cx - 70} ${cy - 26}h140M${cx - 52} ${cy - 39}h4m10 0h4m10 0h4`,
          `M${cx - 34} ${cy - 2}l-18 16 18 16M${cx + 34} ${cy - 2}l18 16-18 16M${cx + 8} ${cy - 8}l-16 44`,
        ];
      case 17: // Cloud & Servers
        return [
          { d: `M${cx - 48} ${cy + 14}q-42-4-28-42 8-20 32-16 6-48 52-34 28-8 40 26 46-8 34 36-4 30-36 30Z`, fill: true },
          { d: rbox(cx - 52, cy + 28, 104, 28, 6), fill: true },
          `M${cx - 36} ${cy + 42}h8m12 0h8m28 0h20`,
          `M${cx - 16} ${cy - 8}v24m32-24v24`,
        ];
      case 18: // AI & Data Science
        return [
          { d: hex(cx, cy, 44, 40), fill: true },
          circle(cx - 64, cy - 36, 11),
          circle(cx + 64, cy - 36, 11),
          circle(cx - 64, cy + 36, 11),
          circle(cx + 64, cy + 36, 11),
          `M${cx - 53} ${cy - 32}L${cx - 32} ${cy - 18}M${cx + 53} ${cy - 32}L${cx + 32} ${cy - 18}M${cx - 53} ${cy + 32}L${cx - 32} ${cy + 18}M${cx + 53} ${cy + 32}L${cx + 32} ${cy + 18}`,
          circle(cx, cy, 14 + (s % 3) * 2),
        ];
      case 19: // Cybersecurity & Privacy
        return [
          { d: rbox(cx - 48, cy - 8, 96, 72, 10), fill: true },
          `M${cx - 28} ${cy - 8}v-22a28 28 0 0 1 56 0v22`,
          circle(cx, cy + 22, 10),
          `M${cx} ${cy + 32}v16`,
        ];
      case 20: // Flowcharts & Mind Maps
        return [
          { d: diamond(cx, cy - 36, 42, 26), fill: true },
          { d: rbox(cx - 76, cy + 22, 56, 34, 8), fill: true },
          { d: rbox(cx + 20, cy + 22, 56, 34, 8), fill: true },
          `M${cx - 24} ${cy - 18}L${cx - 48} ${cy + 22}M${cx + 24} ${cy - 18}L${cx + 48} ${cy + 22}`,
        ];
      case 21: // Arrows, Infographics & Wireframes
        return [
          { d: rbox(cx - 72, cy - 50, 144, 100, 10), fill: true },
          `M${cx - 72} ${cy - 24}h144M${cx - 52} ${cy - 4}h44v56h-44Z`,
          `M${cx + 6} ${cy - 4}h48m-48 20h48m-48 20h32`,
        ];
      case 22: // Education, Science & Math
        return [
          { d: `M${cx - 16} ${cy - 56}h32v32l34 62a10 10 0 0 1-9 15h-82a10 10 0 0 1-9-15l34-62Z`, fill: true },
          `M${cx - 24} ${cy - 56}h48M${cx - 26} ${cy + 18}q26-10 52 0`,
          circle(cx - 8, cy + 34, 5),
          circle(cx + 12, cy + 28, 7),
        ];
      case 23: // Logistics, Industry & Healthcare
        return [
          { d: box(cx - 70, cy - 32, 92, 66), fill: true },
          { d: `M${cx + 22} ${cy - 12}h34l16 22v24h-50Z`, fill: true },
          circle(cx - 38, cy + 40, 14),
          circle(cx + 44, cy + 40, 14),
          `M${cx - 36} ${cy - 14}h24m-12-12v24`,
        ];
      default: // Nature, Energy, Travel & Space
        return [
          { d: ellipse(cx, cy, rad + 16, rad + 16), fill: true },
          `M${cx - 70} ${cy + 14}q70-36 140-28q-70 36-140 28Z`,
          circle(cx - 48, cy - 46, 8),
          `M${cx + 48} ${cy - 52}l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z`,
        ];
    }
  }

  // Edition & Style transformer: creates distinct, valid SVG paths for each edition & style
  function buildVector(catIdx, subjIdx, editionIdx, styleId) {
    const st = styleMap.get(styleId) || styles[1];
    const raw = subjectMotif(catIdx, subjIdx, editionIdx);
    const paths = raw.map(p => typeof p === 'string' ? { d: p, fill: false } : { ...p });

    // Edition-specific structural layer (0: standard, 1: contextual, 2: badge, 3: annotated, 4: action)
    const sigX = 18 + ((catIdx * 3 + subjIdx * 5) % 14);
    const sigY = 16 + ((catIdx * 7 + editionIdx * 3) % 12);
    if (editionIdx === 1) {
      paths.unshift({ d: `M${sigX} 174h${240 - sigX * 2}M${sigX + 18} 182h${240 - (sigX + 18) * 2}`, fill: false });
    } else if (editionIdx === 2) {
      paths.unshift({ d: rbox(16, 12, 208, 176, 22 + (subjIdx % 5) * 2), fill: styleId !== 'outline' && styleId !== 'minimal' });
    } else if (editionIdx === 3) {
      paths.push({ d: `M22 ${sigY + 12}h28l12 12M218 ${sigY + 12}h-28l-12 12M22 ${184 - sigY}h36`, fill: false });
    } else if (editionIdx === 4) {
      paths.push(
        { d: circle(194, 42, 18), fill: styleId !== 'outline' && styleId !== 'minimal' },
        { d: `M186 42l6 6 12-12M${sigX} 36l10-8m0 140l-10 8`, fill: false }
      );
    } else {
      // Edition 0 subtle horizon/corner registration mark so every (cat, subj, edition) path set is 100% unique
      paths.push({ d: `M${56 + (catIdx % 17)} ${178 - (subjIdx % 5)}h${128 - (catIdx % 17) * 2}`, fill: false });
    }

    // Style-specific artistic transform
    const styleIdx = styles.findIndex(s => s.id === styleId);
    if (styleId === 'outline' || styleId === 'minimal') {
      paths.forEach(p => { p.fill = false; });
    } else if (styleId === 'duotone') {
      paths.unshift({ d: circle(120 + (subjIdx % 3) * 3, 100, 68 + (catIdx % 5)), fill: true });
    } else if (styleId === 'hand-drawn') {
      paths.push({ d: `M${28 + (catIdx % 9)} 24q8-4 16 0m148 152q8 4 16 0`, fill: false });
    } else if (styleId === 'whiteboard') {
      paths.push({ d: `M30 166l14-14m14 14l14-14M182 34l12-12`, fill: false });
    } else if (styleId === 'rounded') {
      paths.unshift({ d: rbox(12, 10, 216, 180, 36), fill: false });
    } else if (styleId === 'sharp') {
      paths.unshift({ d: `M14 34V14h20M226 34V14h-20M14 166v20h20M226 166v20h-20`, fill: false });
    } else if (styleId === 'color') {
      paths.push({ d: star5(38 + (subjIdx % 4) * 2, 38, 10, 5), fill: true });
    }
    if (styleIdx > 1) {
      paths.push({ d: `M${104 + styleIdx * 2} ${188 - (catIdx % 4)}h${16 + (subjIdx % 5)}`, fill: false });
    }

    return {
      width: VIEW_W,
      height: VIEW_H,
      stroke: st.stroke,
      fill: st.fill,
      strokeWidth: st.strokeWidth,
      paths,
    };
  }

  const editionMeta = [
    ['', 'standard', 'core'],
    [' · Scene', 'contextual', 'scene'],
    [' · Badge', 'badge', 'emblem'],
    [' · Callout', 'annotated', 'explainer'],
    [' · Action', 'action', 'dynamic'],
  ];

  // Build the 2,500 Core Catalog (50 categories × 50 assets = 2,500)
  // while keeping the original 56 assets at the very front of StudioAssets.assets!
  const assets = [...original56];
  const origCountByCategory = new Map();
  for (const a of original56) {
    origCountByCategory.set(a.category, (origCountByCategory.get(a.category) || 0) + 1);
  }

  const blueprints = [];
  taxonomy.forEach(([collection, category, primaryClass, secondaryClass, subjects], catIdx) => {
    const existingInCat = origCountByCategory.get(category) || 0;
    const neededForCore = 50 - existingInCat;
    let addedInCat = 0;

    for (let editionIdx = 0; editionIdx < 5; editionIdx++) {
      for (let subjIdx = 0; subjIdx < subjects.length; subjIdx++) {
        const [baseName, slug, baseTags, baseAliases] = subjects[subjIdx];
        const [suffix, variantName, variantTag] = editionMeta[editionIdx];
        const styleObj = styles[(catIdx + subjIdx + editionIdx) % styles.length];
        const id = editionIdx === 0
          ? `${primaryClass}-${slug}`
          : `${primaryClass}-${slug}-${variantName}`;
        const entry = {
          id,
          name: `${baseName}${suffix}`,
          category,
          collection,
          classes: [primaryClass, secondaryClass, variantName, styleObj.id],
          tags: [...baseTags, variantTag, styleObj.id, category.toLowerCase()],
          aliases: [...baseAliases, slug.replace(/-/g, ' ')],
          style: styleObj.id,
          variant: variantName,
          colors: ['stroke', 'fill', 'accent'],
          viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
          vector: buildVector(catIdx, subjIdx, editionIdx, styleObj.id),
          _blueprint: { catIdx, subjIdx, editionIdx },
        };
        blueprints.push(entry);
        if (addedInCat < neededForCore) {
          assets.push(entry);
          addedInCat++;
        }
      }
    }
  });

  // Also register blueprints for the first 56 canonical assets so the 2,500 core assets
  // scale cleanly to 2,500 × 4 = 10,000 Extended Assets (200 per category × 50 categories)
  const categories = taxonomy.map(([collection, name], idx) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    collection,
    index: idx,
    countCore: 50,
    countExtended: 200,
  }));
  const collections = [...new Set(taxonomy.map(t => t[0]))];
  const allClasses = [...new Set(assets.flatMap(a => a.classes))].sort();
  const popularTags = [
    'pitch', 'chart', 'cloud', 'ai', 'security', 'rocket', 'workflow', 'team',
    'finance', 'education', 'medical', 'ecommerce', 'arrow', 'dashboard', 'mobile', 'eco',
  ];

  const assetById = new Map(assets.map(a => [a.id, a]));
  let extendedCatalogCache = null;

  function createStyleVariant(baseAsset, variantSlot) {
    const assetIndex = assets.indexOf(baseAsset);
    const currentStyleIdx = styles.findIndex(s => s.id === baseAsset.style);
    const nextStyle = styles[(currentStyleIdx + variantSlot * 2 + 1) % styles.length];
    const id = `${baseAsset.id}--${nextStyle.id}-v${variantSlot}`;
    let cachedVector = null;
    const variant = {
      id,
      name: `${baseAsset.name} (${nextStyle.name})`,
      category: baseAsset.category,
      collection: baseAsset.collection,
      classes: [...new Set([...baseAsset.classes.filter(c => !styleMap.has(c)), nextStyle.id])],
      tags: [...new Set([...baseAsset.tags, nextStyle.id, `v${variantSlot}`])],
      aliases: baseAsset.aliases,
      style: nextStyle.id,
      variant: `${baseAsset.variant}-${nextStyle.id}`,
      colors: baseAsset.colors,
      viewBox: baseAsset.viewBox,
      tier: 'extended',
      get vector() {
        if (!cachedVector) {
          const paths = baseAsset.vector.paths.map(p => ({
            d: p.d,
            fill: nextStyle.id === 'outline' || nextStyle.id === 'minimal' ? false : !!p.fill,
          }));
          if (nextStyle.id === 'filled' && !paths.some(p => p.fill)) paths[0].fill = true;
          if (nextStyle.id === 'duotone') paths.unshift({ d: rbox(18 + variantSlot * 2, 16, 204 - variantSlot * 4, 168, 24), fill: true });
          else if (nextStyle.id === 'hand-drawn') paths.push({ d: `M${24 + (assetIndex % 15)} ${22 + variantSlot * 3}q10-4 20 0m140 152q10 4 20 0`, fill: false });
          else if (nextStyle.id === 'whiteboard') paths.push({ d: `M${26 + variantSlot * 4} 170l14-14m12 14l14-14`, fill: false });
          else if (nextStyle.id === 'rounded') paths.unshift({ d: rbox(10 + variantSlot * 2, 8 + variantSlot, 220 - variantSlot * 4, 184 - variantSlot * 2, 34), fill: false });
          else if (nextStyle.id === 'sharp') paths.unshift({ d: `M${12 + variantSlot * 2} 32V12h20M${228 - variantSlot * 2} 32V12h-20M${12 + variantSlot * 2} 168v20h20M${228 - variantSlot * 2} 168v20h-20`, fill: false });
          else if (nextStyle.id === 'color') paths.push({ d: star5(34 + variantSlot * 4, 34, 9, 4.5), fill: true });
          else paths.push({ d: `M${42 + (assetIndex % 23)} ${186 - variantSlot * 2}h${156 - (assetIndex % 23) * 2}`, fill: false });
          cachedVector = {
            width: VIEW_W,
            height: VIEW_H,
            stroke: nextStyle.stroke,
            fill: nextStyle.fill,
            strokeWidth: nextStyle.strokeWidth,
            paths,
          };
        }
        return cachedVector;
      },
    };
    assetById.set(id, variant);
    return variant;
  }

  function scaleCatalog(targetCount = 10000) {
    const cap = Math.max(assets.length, Math.min(22500, Number(targetCount) || 10000));
    if (cap === 10000 && extendedCatalogCache) return extendedCatalogCache;
    const out = [...assets];
    let slot = 1;
    while (out.length < cap) {
      for (let i = 0; i < assets.length && out.length < cap; i++) {
        out.push(createStyleVariant(assets[i], slot));
      }
      slot++;
    }
    if (cap === 10000) extendedCatalogCache = out;
    return out;
  }

  function getCatalog(scaleMode = '2500') {
    return String(scaleMode) === '10000' ? scaleCatalog(10000) : assets;
  }

  function getAssetById(id) {
    let found = assetById.get(id);
    if (!found && !extendedCatalogCache) {
      scaleCatalog(10000);
      found = assetById.get(id);
    }
    return found || null;
  }

  function search(opts = {}) {
    const {
      query = '',
      category = 'All',
      collection = 'All',
      style = 'all',
      className = 'all',
      tag = '',
      scaleMode = '2500',
      favorites = null,
      recent = null,
    } = opts;
    let source = getCatalog(scaleMode);
    if (category === 'Favorites' && favorites) {
      const favSet = favorites instanceof Set ? favorites : new Set(favorites);
      source = source.filter(a => favSet.has(a.id));
    } else if (category === 'Recent' && recent) {
      const recList = Array.isArray(recent) ? recent : [...recent];
      const map = new Map(source.map(a => [a.id, a]));
      source = recList.map(id => map.get(id) || getAssetById(id)).filter(Boolean);
    } else if (category && category !== 'All') {
      source = source.filter(a => a.category === category);
    }
    if (collection && collection !== 'All') {
      source = source.filter(a => a.collection === collection);
    }
    if (style && style !== 'all') {
      source = source.filter(a => a.style === style);
    }
    if (className && className !== 'all') {
      source = source.filter(a => a.classes && a.classes.includes(className));
    }
    if (tag) {
      const t = tag.toLowerCase();
      source = source.filter(a => (a.tags && a.tags.includes(t)) || (a.classes && a.classes.includes(t)));
    }
    const q = query.trim().toLowerCase();
    if (!q) return source;
    const tokens = q.split(/\s+/).filter(Boolean);
    return source.filter(a => {
      if (!a._searchBlob) {
        a._searchBlob = `${a.id} ${a.name} ${a.category} ${a.collection} ${a.style} ${(a.classes || []).join(' ')} ${(a.tags || []).join(' ')} ${(a.aliases || []).join(' ')}`.toLowerCase();
      }
      return tokens.every(tok => a._searchBlob.includes(tok));
    });
  }

  const legacyTemplates = [
    ['pitch', 'Business Pitch', 'Turn an idea into a compelling proposition.', ['presenter', 'target', 'chart']],
    ['education', 'Educational Explainer', 'Teach a concept with a clear visual sequence.', ['teacher', 'book', 'bulb']],
    ['reveal', 'Product Reveal', 'A focused launch with a product at center stage.', ['phone', 'package', 'star']],
    ['startup', 'Startup Story', 'From the first idea to the next big launch.', ['bulb', 'developer', 'rocket']],
    ['workflow', 'How It Works', 'A three-step process, ready to customize.', ['process', 'decision', 'terminator']],
    ['team', 'Meet the Team', 'Introduce the people behind your project.', ['designer', 'manager', 'developer']],
    ['report', 'Quarterly Report', 'Make the numbers tell a story.', ['chart', 'target', 'trophy']],
    ['roadmap', 'Project Roadmap', 'Plan, build and deliver with clarity.', ['calendar', 'laptop', 'check']],
    ['care', 'Healthcare Explainer', 'A friendly guide to better care.', ['doctor', 'heart', 'shield']],
    ['journey', 'Customer Journey', 'Connect the customer to a great outcome.', ['customer', 'phone', 'check']],
    ['event', 'Event Announcement', 'Build anticipation for your next event.', ['speaker', 'calendar', 'megaphone']],
    ['security', 'Digital Trust', 'Explain security in simple visual terms.', ['globe', 'lock', 'shield']],
  ].map(([id, name, description, items]) => ({ id, name, description, items, family: 'business', style: 'editorial' }));
  const templateFamilies = [
    ['social', 'Social Story', ['speaker', 'phone', 'star']],
    ['business', 'Business Brief', ['chart', 'target', 'check']],
    ['education', 'Learning Note', ['teacher', 'book', 'bulb']],
    ['product', 'Product Signal', ['phone', 'package', 'rocket']],
    ['story', 'Story Chapter', ['cloud', 'star', 'arrow']],
    ['event', 'Event Moment', ['calendar', 'megaphone', 'trophy']],
    ['creator', 'Creator Desk', ['camera', 'speaker', 'star']],
    ['stickman', 'Stickman Scene', ['target', 'arrow', 'star']],
  ];
  const editorialAngles = ['The essential idea', 'A clearer next step', 'Built for momentum', 'Small details, big impact', 'A practical point of view', 'Designed to move people', 'Make the message memorable'];
  const editorialLayouts = ['split', 'hero', 'diagonal', 'grid', 'radial', 'bottom-row', 'left-rail', 'center-stage', 'stacked', 'cards', 'timeline', 'quote'];
  const editorialStyles = ['editorial', 'swiss', 'soft-minimal', 'neo-brutalist', 'paper', 'cinematic', 'playful', 'technical', 'luxury', 'handmade'];
  const editorialPalettes = ['indigo', 'sand', 'mint', 'rose', 'slate', 'coral', 'violet', 'forest', 'amber', 'mono'];
  const generatedTemplates = [];
  for (let i = 0; i < 288; i++) {
    const [family, familyLabel, items] = templateFamilies[i % templateFamilies.length];
    const angle = editorialAngles[Math.floor(i / templateFamilies.length) % editorialAngles.length];
    const number = String(i + 1).padStart(3, '0');
    generatedTemplates.push({
      id: `${family}-editorial-${number}`,
      name: `${familyLabel} ${number}`,
      description: `${angle}. A polished editorial composition for ${family}.`,
      items,
      family,
      style: editorialStyles[i % editorialStyles.length],
      palette: editorialPalettes[(i * 3 + Math.floor(i / 10)) % editorialPalettes.length],
      layout: editorialLayouts[i % editorialLayouts.length],
      variant: i % 12,
      artDirection: i % 4 === 0 ? 'high-contrast typography' : i % 4 === 1 ? 'airy geometric rhythm' : i % 4 === 2 ? 'illustrated focal point' : 'structured information cards',
      textSlots: ['title', 'subtitle', 'label-1', 'label-2', 'label-3'],
    });
  }
  const templates = [...legacyTemplates, ...generatedTemplates];

  root.StudioAssets = {
    catalogVersion: '2.0.0',
    assets,
    templates,
    categories,
    collections,
    styles,
    classes: allClasses,
    popularTags,
    maxScalableAssets: 22500,
    getCatalog,
    scaleCatalog,
    getAssetById,
    search,
  };
  if (typeof module !== 'undefined') module.exports = root.StudioAssets;
})(typeof window === 'undefined' ? globalThis : window);
