/**
 * Macro & geopolitical risk assessment engine.
 * Rule-based system mapping sectors, countries, and symbols to known risk factors.
 */

// ── Sector-level macro / geopolitical risks ─────────────────────────

const SECTOR_MACRO_RISKS: Record<string, string[]> = {
  energy: [
    "Crude oil price volatility directly impacts margins and revenue",
    "OPEC+ production decisions can cause sudden price swings",
    "Geopolitical tensions in Middle East affect global supply chains",
    "Energy transition and ESG regulations may force capex reallocation",
    "Carbon tax and emission regulations increasing compliance costs",
  ],
  technology: [
    "Rising interest rates reduce present value of future earnings, pressuring valuations",
    "US-China tech decoupling risks affecting supply chains and market access",
    "AI regulation and data privacy laws (GDPR, DPDP Act) increasing compliance burden",
    "Semiconductor supply chain concentration in Taiwan (TSMC) is a geopolitical risk",
    "Antitrust scrutiny on big tech may limit growth through M&A",
  ],
  "information technology": [
    "Rising interest rates reduce present value of future earnings, pressuring valuations",
    "US-China tech decoupling risks affecting supply chains and market access",
    "AI regulation and data privacy laws increasing compliance burden",
    "Currency fluctuation risk for IT services companies with offshore revenue",
    "H-1B visa policy changes impact staffing and margins for Indian IT firms",
  ],
  pharmaceuticals: [
    "Drug pricing regulations and generic competition eroding brand margins",
    "FDA/CDSCO approval delays can significantly impact revenue timelines",
    "Patent cliff risk as blockbuster drugs lose exclusivity",
    "Geopolitical risks affecting API supply from China",
    "Currency fluctuations affecting export-dependent pharma companies",
  ],
  healthcare: [
    "Government policy changes on healthcare spending and insurance coverage",
    "Drug pricing reform proposals creating uncertainty",
    "Clinical trial failures can cause significant value destruction",
    "Pandemic preparedness spending may fluctuate with political priorities",
    "Regulatory approval timelines remain unpredictable across markets",
  ],
  automobile: [
    "EV transition requiring massive capex while ICE revenue declines",
    "Semiconductor shortage risk remains structurally elevated",
    "Steel and aluminum tariffs increasing input costs",
    "Emission norms (BS-VI, Euro 7) driving up compliance costs",
    "Consumer credit tightening may reduce auto loan availability and demand",
  ],
  "consumer cyclical": [
    "Consumer spending sensitive to inflation and employment trends",
    "EV transition requiring massive capex for auto companies",
    "Raw material price volatility affecting margins",
    "Rising interest rates dampening discretionary spending",
    "Supply chain disruptions from geopolitical events",
  ],
  metals: [
    "Global trade war and tariff escalation directly impacting demand and pricing",
    "China economic slowdown reduces demand for industrial metals",
    "Environmental regulations increasing mining and smelting costs",
    "Energy costs (coal, gas) as major input cost for smelting operations",
    "Currency depreciation in producing countries affects competitive dynamics",
  ],
  "basic materials": [
    "Commodity price cycles creating revenue volatility",
    "Environmental and mining regulations increasing costs",
    "China demand fluctuations dominating global pricing",
    "Trade tariffs and sanctions affecting cross-border flows",
    "ESG mandates requiring significant operational changes",
  ],
  banking: [
    "Interest rate cycle directly impacts net interest margins",
    "Credit quality deterioration risk during economic slowdown",
    "Regulatory capital requirements (Basel III/IV) constraining growth",
    "Digital disruption from fintech and neobanks eroding fee income",
    "Geopolitical sanctions affecting cross-border banking operations",
  ],
  "financial services": [
    "Interest rate sensitivity across lending and investment portfolios",
    "Regulatory tightening on lending standards and capital adequacy",
    "Credit cycle risk with potential for rising NPAs during downturns",
    "Fintech disruption compressing margins in traditional services",
    "Cybersecurity threats and regulatory penalties for data breaches",
  ],
  fmcg: [
    "Input cost inflation (palm oil, wheat, packaging) squeezing margins",
    "Rural demand sensitivity to monsoon and agricultural output in India",
    "Intense competition from D2C brands and private labels",
    "Currency depreciation increasing import costs for raw materials",
    "Regulatory changes on food labeling and packaging norms",
  ],
  "consumer defensive": [
    "Input cost inflation squeezing margins despite pricing power",
    "Changing consumer preferences toward health-conscious products",
    "Private label competition from retail chains",
    "Supply chain and logistics cost volatility",
    "Regulatory changes in food safety and labeling standards",
  ],
  telecom: [
    "Massive 5G capex requirements with uncertain ROI timeline",
    "Regulatory spectrum auction costs impacting balance sheets",
    "Intense price competition limiting ARPU growth",
    "Government regulation on data localization and privacy",
    "Geopolitical risks around equipment suppliers (Huawei ban)",
  ],
  "communication services": [
    "5G infrastructure investment requiring sustained high capex",
    "Content costs escalating in streaming and media",
    "Regulatory scrutiny on market dominance and content moderation",
    "Advertising revenue cyclicality tied to economic conditions",
    "Data privacy regulations affecting targeted advertising models",
  ],
  "real estate": [
    "Interest rate hikes directly increase borrowing costs and reduce demand",
    "Regulatory changes in RERA compliance increasing project costs in India",
    "Commercial real estate demand shift due to hybrid/remote work trends",
    "Liquidity crunch risk in developer financing during tight monetary policy",
    "Property tax and stamp duty changes affecting transaction volumes",
  ],
  utilities: [
    "Regulatory tariff revisions affecting revenue predictability",
    "Transition to renewable energy requiring significant capex",
    "Coal supply and pricing volatility for thermal power generators",
    "Government subsidy and payment delays from state utilities (India-specific)",
    "Environmental compliance costs increasing with stricter emission norms",
  ],
  industrials: [
    "Capex cycle dependency on government infrastructure spending",
    "Steel and cement price fluctuations affecting project margins",
    "Labour cost inflation and availability challenges",
    "Regulatory and environmental clearance delays impacting timelines",
    "Global trade slowdown reducing export order books",
  ],
};

const INDIA_SPECIFIC_RISKS: string[] = [
  "INR/USD exchange rate volatility affecting FII flows and export competitiveness",
  "RBI monetary policy decisions (repo rate, CRR) impacting liquidity and credit growth",
  "Monsoon variability affecting rural demand and agricultural commodity prices",
  "Government fiscal deficit and borrowing program influencing bond yields and liquidity",
  "Geopolitical tensions with neighboring countries (China, Pakistan border issues)",
  "GST and tax policy changes creating compliance uncertainty",
  "FII/FPI flow reversals during global risk-off events",
  "Crude oil import dependency (85%+) making economy vulnerable to oil shocks",
];

const US_SPECIFIC_RISKS: string[] = [
  "Federal Reserve interest rate decisions and quantitative tightening impacting valuations",
  "US Treasury yield curve dynamics signaling recession or growth expectations",
  "US-China trade tensions and tariff escalation affecting corporate earnings",
  "Federal debt ceiling negotiations creating market uncertainty",
  "US election cycle policy uncertainty affecting sector-specific regulations",
  "Dollar strength impacting multinational earnings through translation effects",
  "Student loan and consumer debt levels affecting spending capacity",
  "Commercial real estate and regional banking stress as potential systemic risks",
];

// ── Sector-level raw material / supply chain risks ──────────────────

const SECTOR_RAW_MATERIAL_RISKS: Record<string, string[]> = {
  energy: [
    "Crude oil price swings (Brent/WTI) directly drive revenue and margins",
    "Natural gas pricing volatility affecting integrated operations",
    "Refining margin (crack spread) fluctuations impact downstream profitability",
    "Pipeline and transportation infrastructure bottlenecks",
    "Drilling equipment and services cost inflation during upcycles",
  ],
  technology: [
    "Semiconductor chip shortage risk from concentrated TSMC/Samsung manufacturing",
    "Rare earth element supply dependency on China (>60% global supply)",
    "Lithium and cobalt price volatility affecting device battery costs",
    "Silicon wafer supply constraints during demand surges",
    "Copper prices affecting PCB and wiring component costs",
  ],
  "information technology": [
    "Server and data center hardware cost fluctuations",
    "Cloud infrastructure pricing changes from hyperscalers",
    "Semiconductor supply chain risks for hardware-dependent IT companies",
    "Electricity costs for data center operations rising globally",
    "Fiber optic cable and networking equipment supply chain risks",
  ],
  pharmaceuticals: [
    "API (Active Pharmaceutical Ingredient) supply concentration in China and India",
    "Solvent and chemical reagent price volatility",
    "Packaging material (glass vials, syringes) supply constraints",
    "Cold chain logistics costs for biologics and vaccines",
    "Lab equipment and reagent cost inflation",
  ],
  healthcare: [
    "Medical device component supply chain risks",
    "Pharmaceutical raw material price fluctuations",
    "Surgical equipment and disposable supply costs",
    "Diagnostic reagent and test kit material costs",
    "PPE and medical consumable supply chain volatility",
  ],
  automobile: [
    "Steel prices (HRC/CRC) as 30-40% of vehicle material cost",
    "Aluminum price volatility for lightweighting initiatives",
    "Semiconductor chip shortage impacting production volumes",
    "Lithium, nickel, cobalt prices for EV battery manufacturing",
    "Rubber and tire raw material costs (natural rubber, carbon black)",
    "Platinum/palladium prices for catalytic converters",
  ],
  "consumer cyclical": [
    "Steel and aluminum prices affecting manufacturing costs",
    "Semiconductor and electronics component availability",
    "Battery material costs for EV manufacturers",
    "Cotton and textile raw material prices for apparel",
    "Logistics and freight cost volatility",
  ],
  metals: [
    "Iron ore price volatility (>60% of steel production cost)",
    "Coking coal prices affecting steelmaking economics",
    "Energy costs (electricity, natural gas) for smelting operations",
    "Alumina and bauxite pricing for aluminum production",
    "Zinc and copper concentrate availability and pricing",
    "Scrap metal pricing and availability dynamics",
  ],
  "basic materials": [
    "Mining input costs (fuel, explosives, chemicals) affecting extraction economics",
    "Energy prices as major cost component for processing",
    "Water availability and treatment costs for mining operations",
    "Transportation and logistics costs for bulk materials",
    "Environmental remediation and tailings management costs",
  ],
  banking: [
    "Not directly exposed to raw material risks",
    "Indirect exposure through loan book to commodity-sensitive sectors",
    "Gold price movements affecting gold loan portfolios",
    "Real estate valuations impacting mortgage collateral values",
  ],
  "financial services": [
    "Indirect exposure through lending portfolio to commodity sectors",
    "Gold and precious metals pricing affecting gold loan business",
    "Real estate price fluctuations impacting collateral values",
    "Technology infrastructure and data center operational costs",
  ],
  fmcg: [
    "Palm oil prices affecting food product and soap/detergent margins",
    "Wheat, rice, and grain prices impacting packaged food costs",
    "Milk and dairy procurement costs for dairy products",
    "Packaging costs (corrugated boxes, plastic, glass, tin)",
    "Sugar prices affecting beverages and confectionery",
    "Crude oil derivatives affecting packaging and transport costs",
  ],
  "consumer defensive": [
    "Agricultural commodity prices (grains, oils, dairy) as primary inputs",
    "Packaging material costs (plastics, paper, aluminum)",
    "Transportation and distribution fuel costs",
    "Sugar and sweetener prices for beverage companies",
    "Cotton and fiber prices for personal care product packaging",
  ],
  telecom: [
    "Fiber optic cable and copper wire costs for network buildout",
    "Cell tower steel and construction material costs",
    "Electronic equipment and antenna component pricing",
    "Energy costs for tower operations (diesel, electricity)",
    "Spectrum as a finite resource with auction-driven pricing",
  ],
  "communication services": [
    "Data center infrastructure and server costs",
    "Network equipment and fiber optic material costs",
    "Energy costs for network and data center operations",
    "Content production costs for media companies",
    "Satellite and transmission equipment costs",
  ],
  "real estate": [
    "Cement prices directly impacting construction costs",
    "Steel (TMT bars, structural steel) as major construction input",
    "Sand and aggregate availability and pricing",
    "Brick and block material costs",
    "PVC, copper, and electrical fitting costs",
    "Timber and finishing material price volatility",
  ],
  utilities: [
    "Coal prices and availability for thermal power generation",
    "Natural gas pricing for gas-based power plants",
    "Solar panel and wind turbine component costs for renewable capacity",
    "Transformer and transmission equipment costs",
    "Water availability for thermal cooling systems",
  ],
  industrials: [
    "Steel and metal input costs for capital goods manufacturing",
    "Electrical components and motor costs",
    "Cement and construction material for infrastructure projects",
    "Fuel and energy costs for heavy equipment operations",
    "Specialized alloy and composite material pricing",
  ],
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Assess macro and geopolitical risks for a stock based on its sector and country.
 * Returns an array of risk description strings.
 *
 * @param symbol  - Yahoo Finance ticker (used to detect .NS/.BO suffix)
 * @param sector  - Company sector from Yahoo Finance profile
 * @param country - Company country from Yahoo Finance profile
 */
export function assessMacroRisks(
  symbol: string,
  sector: string,
  country: string
): string[] {
  const risks: string[] = [];
  const sectorLower = (sector || "").toLowerCase();

  // Find matching sector risks
  let matched = false;
  for (const [key, sectorRisks] of Object.entries(SECTOR_MACRO_RISKS)) {
    if (sectorLower.includes(key) || key.includes(sectorLower)) {
      risks.push(...sectorRisks);
      matched = true;
      break;
    }
  }

  // Generic fallback if no sector match
  if (!matched) {
    risks.push(
      "General market volatility and macroeconomic cycle risk",
      "Interest rate changes affecting cost of capital and valuations",
      "Regulatory and policy changes creating compliance uncertainty",
      "Global supply chain disruption risk from geopolitical events",
      "Currency fluctuation risk affecting international operations"
    );
  }

  // Country-specific risks
  const countryLower = (country || "").toLowerCase();
  const isIndian =
    countryLower === "india" ||
    symbol.endsWith(".NS") ||
    symbol.endsWith(".BO");
  const isUS =
    countryLower.includes("united states") ||
    countryLower === "us" ||
    countryLower === "usa";

  if (isIndian) {
    risks.push(...INDIA_SPECIFIC_RISKS.slice(0, 4));
  } else if (isUS) {
    risks.push(...US_SPECIFIC_RISKS.slice(0, 4));
  } else {
    // Generic global risks
    risks.push(
      "Geopolitical tensions (US-China, Russia-Ukraine) may disrupt global trade",
      "Emerging market currency and capital flow volatility"
    );
  }

  return risks;
}

/**
 * Assess raw material and supply chain risks for a stock based on its sector.
 * Returns an array of risk description strings.
 *
 * @param symbol - Yahoo Finance ticker (unused currently, reserved for symbol-specific logic)
 * @param sector - Company sector from Yahoo Finance profile
 */
export function assessRawMaterialRisks(
  symbol: string,
  sector: string
): string[] {
  const sectorLower = (sector || "").toLowerCase();

  for (const [key, risks] of Object.entries(SECTOR_RAW_MATERIAL_RISKS)) {
    if (sectorLower.includes(key) || key.includes(sectorLower)) {
      return risks;
    }
  }

  // Generic fallback
  return [
    "General input cost inflation affecting operating margins",
    "Supply chain disruption risk from geopolitical events and natural disasters",
    "Transportation and logistics cost volatility",
    "Energy cost fluctuations affecting production and distribution",
    "Currency fluctuations affecting imported raw material costs",
  ];
}
