/**
 * Bundled, fully-offline location dataset used by the sky card to derive
 * latitude / longitude from a country (and, where useful, a state or
 * province) selection. Coordinates are approximate centroids - typically
 * the capital city - and are accurate enough for sunrise / sunset within
 * the area (sunrise math is most sensitive to latitude, and a few hundred
 * kilometers of error rarely shifts the result by more than a couple of
 * minutes).
 *
 * The list intentionally avoids political / disputed-region opinions:
 * names follow common English short-form usage, and "regions" exist only
 * for large countries where a country-level centroid would be misleading.
 */

export interface Region {
	/** Short code stable within the country (e.g. "CA" for California). */
	code: string;
	name: string;
	lat: number;
	lon: number;
}

export interface Country {
	/** ISO 3166-1 alpha-2. */
	code: string;
	name: string;
	lat: number;
	lon: number;
	regions?: Region[];
}

const US_STATES: Region[] = [
	{ code: "AL", name: "Alabama", lat: 32.4, lon: -86.3 },
	{ code: "AK", name: "Alaska", lat: 61.2, lon: -149.9 },
	{ code: "AZ", name: "Arizona", lat: 33.4, lon: -112.1 },
	{ code: "AR", name: "Arkansas", lat: 34.7, lon: -92.3 },
	{ code: "CA", name: "California", lat: 38.6, lon: -121.5 },
	{ code: "CO", name: "Colorado", lat: 39.7, lon: -105.0 },
	{ code: "CT", name: "Connecticut", lat: 41.8, lon: -72.7 },
	{ code: "DE", name: "Delaware", lat: 39.2, lon: -75.5 },
	{ code: "DC", name: "District of Columbia", lat: 38.9, lon: -77.0 },
	{ code: "FL", name: "Florida", lat: 30.4, lon: -84.3 },
	{ code: "GA", name: "Georgia", lat: 33.7, lon: -84.4 },
	{ code: "HI", name: "Hawaii", lat: 21.3, lon: -157.8 },
	{ code: "ID", name: "Idaho", lat: 43.6, lon: -116.2 },
	{ code: "IL", name: "Illinois", lat: 39.8, lon: -89.6 },
	{ code: "IN", name: "Indiana", lat: 39.8, lon: -86.1 },
	{ code: "IA", name: "Iowa", lat: 41.6, lon: -93.6 },
	{ code: "KS", name: "Kansas", lat: 39.0, lon: -95.7 },
	{ code: "KY", name: "Kentucky", lat: 38.2, lon: -84.9 },
	{ code: "LA", name: "Louisiana", lat: 30.5, lon: -91.1 },
	{ code: "ME", name: "Maine", lat: 44.3, lon: -69.8 },
	{ code: "MD", name: "Maryland", lat: 38.9, lon: -76.5 },
	{ code: "MA", name: "Massachusetts", lat: 42.4, lon: -71.1 },
	{ code: "MI", name: "Michigan", lat: 42.7, lon: -84.6 },
	{ code: "MN", name: "Minnesota", lat: 44.95, lon: -93.1 },
	{ code: "MS", name: "Mississippi", lat: 32.3, lon: -90.2 },
	{ code: "MO", name: "Missouri", lat: 38.6, lon: -92.2 },
	{ code: "MT", name: "Montana", lat: 46.6, lon: -112.0 },
	{ code: "NE", name: "Nebraska", lat: 40.8, lon: -96.7 },
	{ code: "NV", name: "Nevada", lat: 39.2, lon: -119.8 },
	{ code: "NH", name: "New Hampshire", lat: 43.2, lon: -71.5 },
	{ code: "NJ", name: "New Jersey", lat: 40.2, lon: -74.7 },
	{ code: "NM", name: "New Mexico", lat: 35.7, lon: -105.9 },
	{ code: "NY", name: "New York", lat: 42.7, lon: -73.8 },
	{ code: "NC", name: "North Carolina", lat: 35.8, lon: -78.6 },
	{ code: "ND", name: "North Dakota", lat: 46.8, lon: -100.8 },
	{ code: "OH", name: "Ohio", lat: 40.0, lon: -83.0 },
	{ code: "OK", name: "Oklahoma", lat: 35.5, lon: -97.5 },
	{ code: "OR", name: "Oregon", lat: 44.9, lon: -123.0 },
	{ code: "PA", name: "Pennsylvania", lat: 40.3, lon: -76.9 },
	{ code: "PR", name: "Puerto Rico", lat: 18.5, lon: -66.1 },
	{ code: "RI", name: "Rhode Island", lat: 41.8, lon: -71.4 },
	{ code: "SC", name: "South Carolina", lat: 34.0, lon: -81.0 },
	{ code: "SD", name: "South Dakota", lat: 44.4, lon: -100.4 },
	{ code: "TN", name: "Tennessee", lat: 36.2, lon: -86.8 },
	{ code: "TX", name: "Texas", lat: 30.3, lon: -97.7 },
	{ code: "UT", name: "Utah", lat: 40.8, lon: -111.9 },
	{ code: "VT", name: "Vermont", lat: 44.3, lon: -72.6 },
	{ code: "VA", name: "Virginia", lat: 37.5, lon: -77.4 },
	{ code: "WA", name: "Washington", lat: 47.0, lon: -122.9 },
	{ code: "WV", name: "West Virginia", lat: 38.3, lon: -81.6 },
	{ code: "WI", name: "Wisconsin", lat: 43.1, lon: -89.4 },
	{ code: "WY", name: "Wyoming", lat: 41.1, lon: -104.8 },
];

const CA_PROVINCES: Region[] = [
	{ code: "AB", name: "Alberta", lat: 53.5, lon: -113.5 },
	{ code: "BC", name: "British Columbia", lat: 48.4, lon: -123.4 },
	{ code: "MB", name: "Manitoba", lat: 49.9, lon: -97.1 },
	{ code: "NB", name: "New Brunswick", lat: 45.95, lon: -66.6 },
	{ code: "NL", name: "Newfoundland and Labrador", lat: 47.6, lon: -52.7 },
	{ code: "NS", name: "Nova Scotia", lat: 44.65, lon: -63.6 },
	{ code: "ON", name: "Ontario", lat: 43.7, lon: -79.4 },
	{ code: "PE", name: "Prince Edward Island", lat: 46.2, lon: -63.1 },
	{ code: "QC", name: "Quebec", lat: 46.8, lon: -71.2 },
	{ code: "SK", name: "Saskatchewan", lat: 50.4, lon: -104.6 },
	{ code: "NT", name: "Northwest Territories", lat: 62.5, lon: -114.4 },
	{ code: "NU", name: "Nunavut", lat: 63.7, lon: -68.5 },
	{ code: "YT", name: "Yukon", lat: 60.7, lon: -135.0 },
];

const AU_STATES: Region[] = [
	{ code: "ACT", name: "Australian Capital Territory", lat: -35.3, lon: 149.1 },
	{ code: "NSW", name: "New South Wales", lat: -33.9, lon: 151.2 },
	{ code: "NT", name: "Northern Territory", lat: -12.5, lon: 130.8 },
	{ code: "QLD", name: "Queensland", lat: -27.5, lon: 153.0 },
	{ code: "SA", name: "South Australia", lat: -34.9, lon: 138.6 },
	{ code: "TAS", name: "Tasmania", lat: -42.9, lon: 147.3 },
	{ code: "VIC", name: "Victoria", lat: -37.8, lon: 144.96 },
	{ code: "WA", name: "Western Australia", lat: -31.95, lon: 115.9 },
];

const UK_REGIONS: Region[] = [
	{ code: "ENG", name: "England", lat: 51.5, lon: -0.1 },
	{ code: "SCT", name: "Scotland", lat: 55.95, lon: -3.2 },
	{ code: "WLS", name: "Wales", lat: 51.5, lon: -3.2 },
	{ code: "NIR", name: "Northern Ireland", lat: 54.6, lon: -5.9 },
];

const BR_STATES: Region[] = [
	{ code: "AC", name: "Acre", lat: -9.97, lon: -67.8 },
	{ code: "AL", name: "Alagoas", lat: -9.65, lon: -35.7 },
	{ code: "AP", name: "Amapá", lat: 0.04, lon: -51.05 },
	{ code: "AM", name: "Amazonas", lat: -3.1, lon: -60.0 },
	{ code: "BA", name: "Bahia", lat: -12.97, lon: -38.5 },
	{ code: "CE", name: "Ceará", lat: -3.7, lon: -38.5 },
	{ code: "DF", name: "Distrito Federal", lat: -15.8, lon: -47.9 },
	{ code: "ES", name: "Espírito Santo", lat: -20.3, lon: -40.3 },
	{ code: "GO", name: "Goiás", lat: -16.7, lon: -49.3 },
	{ code: "MA", name: "Maranhão", lat: -2.5, lon: -44.3 },
	{ code: "MT", name: "Mato Grosso", lat: -15.6, lon: -56.1 },
	{ code: "MS", name: "Mato Grosso do Sul", lat: -20.5, lon: -54.6 },
	{ code: "MG", name: "Minas Gerais", lat: -19.9, lon: -43.9 },
	{ code: "PA", name: "Pará", lat: -1.45, lon: -48.5 },
	{ code: "PB", name: "Paraíba", lat: -7.1, lon: -34.9 },
	{ code: "PR", name: "Paraná", lat: -25.4, lon: -49.3 },
	{ code: "PE", name: "Pernambuco", lat: -8.05, lon: -34.9 },
	{ code: "PI", name: "Piauí", lat: -5.1, lon: -42.8 },
	{ code: "RJ", name: "Rio de Janeiro", lat: -22.9, lon: -43.2 },
	{ code: "RN", name: "Rio Grande do Norte", lat: -5.8, lon: -35.2 },
	{ code: "RS", name: "Rio Grande do Sul", lat: -30.0, lon: -51.2 },
	{ code: "RO", name: "Rondônia", lat: -8.8, lon: -63.9 },
	{ code: "RR", name: "Roraima", lat: 2.8, lon: -60.7 },
	{ code: "SC", name: "Santa Catarina", lat: -27.6, lon: -48.5 },
	{ code: "SP", name: "São Paulo", lat: -23.55, lon: -46.6 },
	{ code: "SE", name: "Sergipe", lat: -10.9, lon: -37.1 },
	{ code: "TO", name: "Tocantins", lat: -10.2, lon: -48.3 },
];

/**
 * Country list with approximate centroid coordinates (typically the capital
 * city). Sorted alphabetically by display name.
 */
export const COUNTRIES: Country[] = [
	{ code: "AF", name: "Afghanistan", lat: 34.5, lon: 69.2 },
	{ code: "AL", name: "Albania", lat: 41.3, lon: 19.8 },
	{ code: "DZ", name: "Algeria", lat: 36.8, lon: 3.05 },
	{ code: "AD", name: "Andorra", lat: 42.5, lon: 1.5 },
	{ code: "AO", name: "Angola", lat: -8.8, lon: 13.2 },
	{ code: "AG", name: "Antigua and Barbuda", lat: 17.1, lon: -61.85 },
	{ code: "AR", name: "Argentina", lat: -34.6, lon: -58.4 },
	{ code: "AM", name: "Armenia", lat: 40.2, lon: 44.5 },
	{ code: "AU", name: "Australia", lat: -35.3, lon: 149.1, regions: AU_STATES },
	{ code: "AT", name: "Austria", lat: 48.2, lon: 16.4 },
	{ code: "AZ", name: "Azerbaijan", lat: 40.4, lon: 49.9 },
	{ code: "BS", name: "Bahamas", lat: 25.05, lon: -77.35 },
	{ code: "BH", name: "Bahrain", lat: 26.2, lon: 50.6 },
	{ code: "BD", name: "Bangladesh", lat: 23.7, lon: 90.4 },
	{ code: "BB", name: "Barbados", lat: 13.1, lon: -59.6 },
	{ code: "BY", name: "Belarus", lat: 53.9, lon: 27.6 },
	{ code: "BE", name: "Belgium", lat: 50.85, lon: 4.35 },
	{ code: "BZ", name: "Belize", lat: 17.25, lon: -88.8 },
	{ code: "BJ", name: "Benin", lat: 6.5, lon: 2.6 },
	{ code: "BT", name: "Bhutan", lat: 27.5, lon: 89.6 },
	{ code: "BO", name: "Bolivia", lat: -16.5, lon: -68.15 },
	{ code: "BA", name: "Bosnia and Herzegovina", lat: 43.85, lon: 18.4 },
	{ code: "BW", name: "Botswana", lat: -24.65, lon: 25.9 },
	{ code: "BR", name: "Brazil", lat: -15.8, lon: -47.9, regions: BR_STATES },
	{ code: "BN", name: "Brunei", lat: 4.9, lon: 114.95 },
	{ code: "BG", name: "Bulgaria", lat: 42.7, lon: 23.3 },
	{ code: "BF", name: "Burkina Faso", lat: 12.4, lon: -1.5 },
	{ code: "BI", name: "Burundi", lat: -3.4, lon: 29.4 },
	{ code: "KH", name: "Cambodia", lat: 11.55, lon: 104.9 },
	{ code: "CM", name: "Cameroon", lat: 3.85, lon: 11.5 },
	{ code: "CA", name: "Canada", lat: 45.4, lon: -75.7, regions: CA_PROVINCES },
	{ code: "CV", name: "Cape Verde", lat: 14.9, lon: -23.5 },
	{ code: "CF", name: "Central African Republic", lat: 4.4, lon: 18.6 },
	{ code: "TD", name: "Chad", lat: 12.1, lon: 15.05 },
	{ code: "CL", name: "Chile", lat: -33.45, lon: -70.7 },
	{ code: "CN", name: "China", lat: 39.9, lon: 116.4 },
	{ code: "CO", name: "Colombia", lat: 4.7, lon: -74.1 },
	{ code: "KM", name: "Comoros", lat: -11.7, lon: 43.25 },
	{ code: "CG", name: "Congo", lat: -4.3, lon: 15.3 },
	{ code: "CD", name: "Congo (DRC)", lat: -4.3, lon: 15.3 },
	{ code: "CR", name: "Costa Rica", lat: 9.95, lon: -84.1 },
	{ code: "CI", name: "Côte d'Ivoire", lat: 6.8, lon: -5.3 },
	{ code: "HR", name: "Croatia", lat: 45.8, lon: 16.0 },
	{ code: "CU", name: "Cuba", lat: 23.1, lon: -82.4 },
	{ code: "CY", name: "Cyprus", lat: 35.2, lon: 33.4 },
	{ code: "CZ", name: "Czechia", lat: 50.1, lon: 14.4 },
	{ code: "DK", name: "Denmark", lat: 55.7, lon: 12.6 },
	{ code: "DJ", name: "Djibouti", lat: 11.6, lon: 43.15 },
	{ code: "DM", name: "Dominica", lat: 15.3, lon: -61.4 },
	{ code: "DO", name: "Dominican Republic", lat: 18.5, lon: -69.9 },
	{ code: "EC", name: "Ecuador", lat: -0.2, lon: -78.5 },
	{ code: "EG", name: "Egypt", lat: 30.05, lon: 31.25 },
	{ code: "SV", name: "El Salvador", lat: 13.7, lon: -89.2 },
	{ code: "GQ", name: "Equatorial Guinea", lat: 3.75, lon: 8.8 },
	{ code: "ER", name: "Eritrea", lat: 15.3, lon: 38.9 },
	{ code: "EE", name: "Estonia", lat: 59.4, lon: 24.75 },
	{ code: "SZ", name: "Eswatini", lat: -26.3, lon: 31.1 },
	{ code: "ET", name: "Ethiopia", lat: 9.0, lon: 38.75 },
	{ code: "FJ", name: "Fiji", lat: -18.1, lon: 178.4 },
	{ code: "FI", name: "Finland", lat: 60.2, lon: 24.9 },
	{ code: "FR", name: "France", lat: 48.85, lon: 2.35 },
	{ code: "GA", name: "Gabon", lat: 0.4, lon: 9.45 },
	{ code: "GM", name: "Gambia", lat: 13.45, lon: -16.6 },
	{ code: "GE", name: "Georgia", lat: 41.7, lon: 44.8 },
	{ code: "DE", name: "Germany", lat: 52.5, lon: 13.4 },
	{ code: "GH", name: "Ghana", lat: 5.6, lon: -0.2 },
	{ code: "GR", name: "Greece", lat: 38.0, lon: 23.7 },
	{ code: "GD", name: "Grenada", lat: 12.05, lon: -61.75 },
	{ code: "GT", name: "Guatemala", lat: 14.6, lon: -90.5 },
	{ code: "GN", name: "Guinea", lat: 9.5, lon: -13.7 },
	{ code: "GW", name: "Guinea-Bissau", lat: 11.85, lon: -15.6 },
	{ code: "GY", name: "Guyana", lat: 6.8, lon: -58.15 },
	{ code: "HT", name: "Haiti", lat: 18.55, lon: -72.3 },
	{ code: "HN", name: "Honduras", lat: 14.1, lon: -87.2 },
	{ code: "HK", name: "Hong Kong", lat: 22.3, lon: 114.2 },
	{ code: "HU", name: "Hungary", lat: 47.5, lon: 19.05 },
	{ code: "IS", name: "Iceland", lat: 64.15, lon: -21.95 },
	{ code: "IN", name: "India", lat: 28.6, lon: 77.2 },
	{ code: "ID", name: "Indonesia", lat: -6.2, lon: 106.8 },
	{ code: "IR", name: "Iran", lat: 35.7, lon: 51.4 },
	{ code: "IQ", name: "Iraq", lat: 33.3, lon: 44.4 },
	{ code: "IE", name: "Ireland", lat: 53.35, lon: -6.25 },
	{ code: "IL", name: "Israel", lat: 32.1, lon: 34.8 },
	{ code: "IT", name: "Italy", lat: 41.9, lon: 12.5 },
	{ code: "JM", name: "Jamaica", lat: 18.0, lon: -76.8 },
	{ code: "JP", name: "Japan", lat: 35.7, lon: 139.7 },
	{ code: "JO", name: "Jordan", lat: 31.95, lon: 35.9 },
	{ code: "KZ", name: "Kazakhstan", lat: 51.15, lon: 71.45 },
	{ code: "KE", name: "Kenya", lat: -1.3, lon: 36.8 },
	{ code: "KI", name: "Kiribati", lat: 1.4, lon: 173.0 },
	{ code: "KW", name: "Kuwait", lat: 29.4, lon: 47.95 },
	{ code: "KG", name: "Kyrgyzstan", lat: 42.9, lon: 74.6 },
	{ code: "LA", name: "Laos", lat: 17.95, lon: 102.6 },
	{ code: "LV", name: "Latvia", lat: 56.95, lon: 24.1 },
	{ code: "LB", name: "Lebanon", lat: 33.9, lon: 35.5 },
	{ code: "LS", name: "Lesotho", lat: -29.3, lon: 27.5 },
	{ code: "LR", name: "Liberia", lat: 6.3, lon: -10.8 },
	{ code: "LY", name: "Libya", lat: 32.9, lon: 13.2 },
	{ code: "LI", name: "Liechtenstein", lat: 47.15, lon: 9.55 },
	{ code: "LT", name: "Lithuania", lat: 54.7, lon: 25.3 },
	{ code: "LU", name: "Luxembourg", lat: 49.6, lon: 6.1 },
	{ code: "MO", name: "Macau", lat: 22.2, lon: 113.55 },
	{ code: "MG", name: "Madagascar", lat: -18.9, lon: 47.5 },
	{ code: "MW", name: "Malawi", lat: -13.95, lon: 33.8 },
	{ code: "MY", name: "Malaysia", lat: 3.15, lon: 101.7 },
	{ code: "MV", name: "Maldives", lat: 4.2, lon: 73.5 },
	{ code: "ML", name: "Mali", lat: 12.65, lon: -8.0 },
	{ code: "MT", name: "Malta", lat: 35.9, lon: 14.5 },
	{ code: "MH", name: "Marshall Islands", lat: 7.1, lon: 171.4 },
	{ code: "MR", name: "Mauritania", lat: 18.1, lon: -15.95 },
	{ code: "MU", name: "Mauritius", lat: -20.2, lon: 57.5 },
	{ code: "MX", name: "Mexico", lat: 19.4, lon: -99.1 },
	{ code: "FM", name: "Micronesia", lat: 6.9, lon: 158.2 },
	{ code: "MD", name: "Moldova", lat: 47.0, lon: 28.85 },
	{ code: "MC", name: "Monaco", lat: 43.7, lon: 7.4 },
	{ code: "MN", name: "Mongolia", lat: 47.9, lon: 106.9 },
	{ code: "ME", name: "Montenegro", lat: 42.45, lon: 19.25 },
	{ code: "MA", name: "Morocco", lat: 34.0, lon: -6.85 },
	{ code: "MZ", name: "Mozambique", lat: -25.95, lon: 32.6 },
	{ code: "MM", name: "Myanmar", lat: 19.75, lon: 96.1 },
	{ code: "NA", name: "Namibia", lat: -22.6, lon: 17.1 },
	{ code: "NR", name: "Nauru", lat: -0.55, lon: 166.9 },
	{ code: "NP", name: "Nepal", lat: 27.7, lon: 85.3 },
	{ code: "NL", name: "Netherlands", lat: 52.4, lon: 4.9 },
	{ code: "NZ", name: "New Zealand", lat: -41.3, lon: 174.8 },
	{ code: "NI", name: "Nicaragua", lat: 12.15, lon: -86.3 },
	{ code: "NE", name: "Niger", lat: 13.5, lon: 2.1 },
	{ code: "NG", name: "Nigeria", lat: 9.05, lon: 7.5 },
	{ code: "MK", name: "North Macedonia", lat: 42.0, lon: 21.4 },
	{ code: "NO", name: "Norway", lat: 59.9, lon: 10.75 },
	{ code: "OM", name: "Oman", lat: 23.6, lon: 58.4 },
	{ code: "PK", name: "Pakistan", lat: 33.7, lon: 73.05 },
	{ code: "PW", name: "Palau", lat: 7.5, lon: 134.6 },
	{ code: "PS", name: "Palestine", lat: 31.9, lon: 35.2 },
	{ code: "PA", name: "Panama", lat: 8.95, lon: -79.55 },
	{ code: "PG", name: "Papua New Guinea", lat: -9.45, lon: 147.2 },
	{ code: "PY", name: "Paraguay", lat: -25.3, lon: -57.6 },
	{ code: "PE", name: "Peru", lat: -12.05, lon: -77.05 },
	{ code: "PH", name: "Philippines", lat: 14.6, lon: 121.0 },
	{ code: "PL", name: "Poland", lat: 52.2, lon: 21.0 },
	{ code: "PT", name: "Portugal", lat: 38.7, lon: -9.15 },
	{ code: "QA", name: "Qatar", lat: 25.3, lon: 51.5 },
	{ code: "RO", name: "Romania", lat: 44.4, lon: 26.1 },
	{ code: "RU", name: "Russia", lat: 55.75, lon: 37.6 },
	{ code: "RW", name: "Rwanda", lat: -1.95, lon: 30.05 },
	{ code: "KN", name: "Saint Kitts and Nevis", lat: 17.3, lon: -62.7 },
	{ code: "LC", name: "Saint Lucia", lat: 14.0, lon: -61.0 },
	{
		code: "VC",
		name: "Saint Vincent and the Grenadines",
		lat: 13.15,
		lon: -61.2,
	},
	{ code: "WS", name: "Samoa", lat: -13.85, lon: -171.75 },
	{ code: "SM", name: "San Marino", lat: 43.95, lon: 12.45 },
	{ code: "ST", name: "São Tomé and Príncipe", lat: 0.35, lon: 6.7 },
	{ code: "SA", name: "Saudi Arabia", lat: 24.7, lon: 46.7 },
	{ code: "SN", name: "Senegal", lat: 14.7, lon: -17.45 },
	{ code: "RS", name: "Serbia", lat: 44.8, lon: 20.45 },
	{ code: "SC", name: "Seychelles", lat: -4.6, lon: 55.45 },
	{ code: "SL", name: "Sierra Leone", lat: 8.5, lon: -13.2 },
	{ code: "SG", name: "Singapore", lat: 1.35, lon: 103.8 },
	{ code: "SK", name: "Slovakia", lat: 48.15, lon: 17.1 },
	{ code: "SI", name: "Slovenia", lat: 46.05, lon: 14.5 },
	{ code: "SB", name: "Solomon Islands", lat: -9.45, lon: 159.95 },
	{ code: "SO", name: "Somalia", lat: 2.05, lon: 45.3 },
	{ code: "ZA", name: "South Africa", lat: -25.75, lon: 28.2 },
	{ code: "KR", name: "South Korea", lat: 37.6, lon: 127.0 },
	{ code: "SS", name: "South Sudan", lat: 4.85, lon: 31.6 },
	{ code: "ES", name: "Spain", lat: 40.4, lon: -3.7 },
	{ code: "LK", name: "Sri Lanka", lat: 6.95, lon: 79.85 },
	{ code: "SD", name: "Sudan", lat: 15.6, lon: 32.5 },
	{ code: "SR", name: "Suriname", lat: 5.85, lon: -55.2 },
	{ code: "SE", name: "Sweden", lat: 59.3, lon: 18.1 },
	{ code: "CH", name: "Switzerland", lat: 46.95, lon: 7.45 },
	{ code: "SY", name: "Syria", lat: 33.5, lon: 36.3 },
	{ code: "TW", name: "Taiwan", lat: 25.05, lon: 121.5 },
	{ code: "TJ", name: "Tajikistan", lat: 38.55, lon: 68.8 },
	{ code: "TZ", name: "Tanzania", lat: -6.8, lon: 39.3 },
	{ code: "TH", name: "Thailand", lat: 13.75, lon: 100.5 },
	{ code: "TL", name: "Timor-Leste", lat: -8.55, lon: 125.6 },
	{ code: "TG", name: "Togo", lat: 6.15, lon: 1.2 },
	{ code: "TO", name: "Tonga", lat: -21.15, lon: -175.2 },
	{ code: "TT", name: "Trinidad and Tobago", lat: 10.65, lon: -61.5 },
	{ code: "TN", name: "Tunisia", lat: 36.8, lon: 10.2 },
	{ code: "TR", name: "Turkey", lat: 39.9, lon: 32.85 },
	{ code: "TM", name: "Turkmenistan", lat: 37.95, lon: 58.4 },
	{ code: "TV", name: "Tuvalu", lat: -8.5, lon: 179.2 },
	{ code: "UG", name: "Uganda", lat: 0.35, lon: 32.6 },
	{ code: "UA", name: "Ukraine", lat: 50.45, lon: 30.5 },
	{ code: "AE", name: "United Arab Emirates", lat: 24.45, lon: 54.4 },
	{
		code: "GB",
		name: "United Kingdom",
		lat: 51.5,
		lon: -0.1,
		regions: UK_REGIONS,
	},
	{
		code: "US",
		name: "United States",
		lat: 38.9,
		lon: -77.0,
		regions: US_STATES,
	},
	{ code: "UY", name: "Uruguay", lat: -34.9, lon: -56.2 },
	{ code: "UZ", name: "Uzbekistan", lat: 41.3, lon: 69.2 },
	{ code: "VU", name: "Vanuatu", lat: -17.7, lon: 168.3 },
	{ code: "VA", name: "Vatican City", lat: 41.9, lon: 12.45 },
	{ code: "VE", name: "Venezuela", lat: 10.5, lon: -66.9 },
	{ code: "VN", name: "Vietnam", lat: 21.0, lon: 105.85 },
	{ code: "YE", name: "Yemen", lat: 15.35, lon: 44.2 },
	{ code: "ZM", name: "Zambia", lat: -15.4, lon: 28.3 },
	{ code: "ZW", name: "Zimbabwe", lat: -17.85, lon: 31.05 },
];

/** Sentinel value: the user wants to enter precise coordinates manually. */
export const CUSTOM_LOCATION_CODE = "_custom";

export function findCountry(code: string | null): Country | null {
	if (!code || code === CUSTOM_LOCATION_CODE) return null;
	return COUNTRIES.find((c) => c.code === code) ?? null;
}

export function findRegion(
	country: Country | null,
	code: string | null,
): Region | null {
	if (!country || !code) return null;
	return country.regions?.find((r) => r.code === code) ?? null;
}

/**
 * Resolve a country / region selection to lat/lon. Returns `null` if the
 * country code is unknown (e.g. user picked "Custom" - the caller should
 * fall back to user-entered coords).
 */
export function resolveCoords(
	countryCode: string | null,
	regionCode: string | null,
): { lat: number; lon: number } | null {
	const country = findCountry(countryCode);
	if (!country) return null;
	const region = findRegion(country, regionCode);
	if (region) return { lat: region.lat, lon: region.lon };
	return { lat: country.lat, lon: country.lon };
}
