// Small, realistic reference data for the simulator. IDs and shapes follow the Immigration ICD (Name / Id / Sequence).
const list = (names, extra = () => ({})) => names.map((Name, i) => ({ Name, Id: i + 1, Sequence: i + 1, ...extra(Name, i) }));

export const NATIONALITIES = [
  ["INDIA", "IND"], ["PEOPLES REPUBLIC OF CHINA", "CHN"], ["TAIWAN", "TWN"], ["RUSSIAN FEDERATION", "RUS"], ["KAZAKHSTAN", "KAZ"],
  ["SAUDI ARABIA", "SAU"], ["UNITED ARAB EMIRATES", "ARE"], ["UNITED KINGDOM", "GBR"], ["GERMANY", "DEU"], ["FRANCE", "FRA"],
  ["JAPAN", "JPN"], ["REPUBLIC OF KOREA", "KOR"], ["UNITED STATES OF AMERICA", "USA"], ["AUSTRALIA", "AUS"], ["UZBEKISTAN", "UZB"],
].map(([Name, CountryCode], i) => ({ Id: i + 1, Name, CountryCode, Sequence: i + 1 }));

export const MASTERS = {
  salutation: [{ Name: "Mr", Id: 1, Sequence: 1 }, { Name: "Miss", Id: 2, Sequence: 2 }, { Name: "Mrs", Id: 3, Sequence: 3 }, { Name: "Master", Id: 4, Sequence: 4 }, { Name: "Ms", Id: 14, Sequence: 14 }],
  gender: [{ Name: "Male", Id: 1, Sequence: 1 }, { Name: "Female", Id: 2, Sequence: 2 }],
  passportType: [{ Name: "Ordinary", Id: 1, Sequence: 1 }],
  occupation: list(["COMMERCIAL TRADER", "EMPLOYEE", "STUDENT", "RETIRED", "SELF EMPLOYED", "OTHER"]),
  airlines: [{ Name: "Thai Airways", Id: 1, Sequence: 1 }, { Name: "Others", Id: 2, Sequence: 2 }],
  arrivalAirport: list(["Suvarnabhumi International Airport", "Don Mueang International Airport", "Phuket International Airport", "Chiang Mai International Airport"]),
  placeOfStay: list(["Hotel", "Guest house", "Friend / relative", "Apartment / rental"]),
  city: list(["BANGKOK", "PHUKET", "CHIANG MAI", "CHON BURI"]),
  purposeOfVisit: [{ Name: "Business", Id: 4, Sequence: 1 }, { Name: "Tourism", Id: 5, Sequence: 2 }, { Name: "Visiting friends or relatives", Id: 6, Sequence: 3 }],
  yearlyIncome: [{ Name: "Less than 20,000 US$", Id: 1, Sequence: 1 }, { Name: "20,001 - 60,000 US$", Id: 2, Sequence: 2 }, { Name: "More than 60,000 US$", Id: 3, Sequence: 3 }, { Name: "No Income", Id: 4, Sequence: 4 }],
  flightType: [{ Name: "Charter", Id: 1, Sequence: 1 }, { Name: "Schedule", Id: 2, Sequence: 2 }],
  nationality: NATIONALITIES,
  documentList: [
    { Name: "Passport Cover page", Id: 1, Sequence: 1, Extension: "Jpeg", MaxKb: 1024 },
    { Name: "Photo", Id: 2, Sequence: 2, Extension: "Jpeg", MaxKb: 100 },
    { Name: "Return flight ticket", Id: 3, Sequence: 3, Extension: "Jpeg,Pdf", MaxKb: 1024 },
    { Name: "Accommodation booking", Id: 4, Sequence: 4, Extension: "Jpeg,Pdf", MaxKb: 1024 },
    { Name: "Proof of funds", Id: 5, Sequence: 5, Extension: "Jpeg,Pdf", MaxKb: 1024 },
    { Name: "Travel insurance", Id: 6, Sequence: 6, Extension: "Jpeg,Pdf", MaxKb: 1024 },
    { Name: "Additional document", Id: 7, Sequence: 7, Extension: "Jpeg,Pdf", MaxKb: 1024 },
    { Name: "Passport visa page", Id: 8, Sequence: 8, Extension: "Jpeg,Pdf", MaxKb: 1024 },
  ],
};

// district / subDistrict sub-lists (city id -> districts, district id -> sub-districts)
export const DISTRICTS = { 1: ["Phra Nakhon", "Pathum Wan", "Bang Rak", "Watthana"], 2: ["Mueang Phuket", "Kathu", "Thalang"], 3: ["Mueang Chiang Mai", "Mae Rim"], 4: ["Mueang Chon Buri", "Bang Lamung"] };
export const SUB_DISTRICTS = { default: ["Sub-district A", "Sub-district B", "Sub-district C"] };

export const districtsOf = (cityId) => list(DISTRICTS[cityId] ?? [], (_n, i) => ({ CityId: Number(cityId), Id: Number(cityId) * 100 + i + 1, PinCode: null }));
export const subDistrictsOf = (districtId) => list(SUB_DISTRICTS.default, (_n, i) => ({ DistrictId: Number(districtId), Id: Number(districtId) * 10 + i + 1 }));

export const SIM_PACKAGES = [
  { package_code: "SVR-002", package_category: "SIM", package_name: "15-day Unlimited 5G SIM", package_detail: "15 days unlimited 5G data, free social apps, 100 THB international call credit. Pick up at the airport counter.", package_price_thb: "600.00", package_price_usd: "18.00", package_price_cny: "122.00", package_image: null, terms_of_use: "For prepaid tourist SIM use only. Pick-up at Suvarnabhumi Airport.", ref_link: null },
  { package_code: "ESIM-015", package_category: "ESIM", package_name: "15-day Unlimited 5G eSIM", package_detail: "Digital eSIM: scan the QR code, active when you land. Device must support eSIM.", package_price_thb: "399.00", package_price_usd: "11.00", package_price_cny: "80.00", package_image: null, terms_of_use: "Phone must be eSIM-compatible and network-unlocked.", ref_link: null },
];
export const VIP_PACKAGES = [
  { package_code: "SVR-010", package_category: "SERVICE", package_name: "VIP in-airport: Butler + buggy", package_detail: "Butler holding your name sign at the gate plus golf-cart ride to the immigration checkpoint (up to 3 persons).", package_price_thb: "2000.00", package_price_usd: "60.00", package_price_cny: "397.00", package_image: null, terms_of_use: "For up to 3 customers.", ref_link: null },
  { package_code: "SVR-011", package_category: "SERVICE", package_name: "VIP fast track + lounge", package_detail: "Dedicated fast-track lane and lounge access.", package_price_thb: "2700.00", package_price_usd: "79.00", package_price_cny: "540.00", package_image: null, terms_of_use: "Subject to airport availability.", ref_link: null },
];
export const BHS_PACKAGES = [
  { package_code: "HEALTH-CHK-01", package_category: "HEALTH", package_name: "Basic health check-up", package_detail: "Basic blood panel and doctor consultation.", package_price_thb: "2900.00", package_price_usd: "84.00", package_price_cny: "600.00", package_image: null, terms_of_use: "Bring your passport and voucher.", ref_link: null },
  { package_code: "HEALTH-SPA-01", package_category: "HEALTH", package_name: "Thai spa and wellness package", package_detail: "Two-hour massage and herbal sauna.", package_price_thb: "1900.00", package_price_usd: "55.00", package_price_cny: "390.00", package_image: null, terms_of_use: "Reservation is made by us after payment.", ref_link: null },
];
export const INSURANCE_PLANS = [{ PlanCode: "GTA0501", name: "Travel PA + medical, up to USD 50,000", net_thb: "290.00" }];
