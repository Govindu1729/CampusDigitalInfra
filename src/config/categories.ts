// IITGN Maintenance Request System - Category and Domain Hierarchy
// Replaces legacy copy-pasted category pages with a single data-driven structure.

export interface CategoryConfig {
  slug: string;
  name: string;
  shortDescription: string;
  icon: string;
  locationType: "apartment" | "hostel" | "academic" | "general";
  hasCorridor?: boolean;
  allowedDomains: string[];
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  housing: {
    slug: "housing",
    name: "Faculty & Staff Housing",
    shortDescription: "Apartments, corridors, residential quarters, and staff housing blocks",
    icon: "Home",
    locationType: "apartment",
    hasCorridor: true,
    allowedDomains: ["Electrical", "Civil", "Carpentry", "Plumbing"],
  },
  hostel: {
    slug: "hostel",
    name: "Student Hostels",
    shortDescription: "Aibaan, Beauki, Chimair, Duven, Emiet, Firpeal, Griwiksh, Hiqom, etc.",
    icon: "Building2",
    locationType: "hostel",
    allowedDomains: ["Electrical", "Civil", "Air-Conditioning", "Water-Cooler", "Plumbing", "Carpentry"],
  },
  jeet_hostel: {
    slug: "jeet_hostel",
    name: "JEET Hostel Blocks",
    shortDescription: "JEET Hostel Blocks A, B, C, and D residential student rooms",
    icon: "BedDouble",
    locationType: "hostel",
    allowedDomains: ["Electrical", "Civil", "Air-Conditioning", "Water-Cooler", "Plumbing"],
  },
  academic: {
    slug: "academic",
    name: "Academic Complex & Labs",
    shortDescription: "Lecture halls, classrooms, faculty offices, student labs, and research facilities",
    icon: "GraduationCap",
    locationType: "academic",
    allowedDomains: ["Electrical", "Civil", "Air-Conditioning", "Water-Cooler", "Plumbing", "Network/IT"],
  },
  infrastructure: {
    slug: "infrastructure",
    name: "Campus Infrastructure & Central Facilities",
    shortDescription: "Central Arcade, Sports Complex, Guest House, Research Park, roads, street lights",
    icon: "Landmark",
    locationType: "general",
    allowedDomains: ["Electrical", "Civil", "Plumbing", "Air-Conditioning", "Water-Cooler"],
  },
};

export const HOSTEL_LIST = [
  "Aibaan",
  "Beauki",
  "Chimair",
  "Duven",
  "Emiet",
  "Firpeal",
  "Griwiksh",
  "Hiqom",
  "Ijokha",
  "Jurqia",
  "Kyzeel",
  "Lekhaag",
  "Dining Block (Central)",
];

export const JEET_BLOCKS = ["Block A", "Block B", "Block C", "Block D"];

export const ACADEMIC_BLOCKS = [
  "Academic Complex 1 (AB 1)",
  "Academic Complex 2 (AB 2)",
  "Academic Complex 3 (AB 3)",
  "Academic Complex 4 (AB 4)",
  "Central Library & Information Centre",
  "Research Park & Innovation Centre",
  "Central Arcade",
  "Sports Complex & Gymnasium",
  "Institute Guest House",
  "Student Activity Centre (SAC)",
];

// Curated list of typical housing units (Block/Apartment format e.g. 01/101 ... 34/405)
export const HOUSING_APARTMENTS = [
  "01/101", "01/102", "01/201", "01/202", "01/301", "01/302", "01/401", "01/402",
  "02/101", "02/102", "02/201", "02/202", "02/301", "02/302", "02/401", "02/402",
  "03/101", "03/102", "03/201", "03/202", "03/301", "03/302", "03/401", "03/402",
  "04/101", "04/102", "04/201", "04/202", "04/301", "04/302", "04/401", "04/402",
  "05/101", "05/102", "05/201", "05/202", "05/301", "05/302", "05/401", "05/402",
  "06/101", "06/102", "06/201", "06/202", "06/301", "06/302", "06/401", "06/402",
  "07/101", "07/102", "07/201", "07/202", "07/301", "07/302", "07/401", "07/402",
  "08/101", "08/102", "08/201", "08/202", "08/301", "08/302", "08/401", "08/402",
  "09/101", "09/102", "09/201", "09/202", "09/301", "09/302", "09/401", "09/402",
  "10/101", "10/102", "10/201", "10/202", "10/301", "10/302", "10/401", "10/402",
  "11/101", "11/102", "11/201", "11/202", "11/301", "11/302", "11/401", "11/402",
  "12/101", "12/102", "12/201", "12/202", "12/301", "12/302", "12/401", "12/402",
  "13/101", "13/102", "13/201", "13/202", "13/301", "13/302", "13/401", "13/402",
  "14/101", "14/102", "14/201", "14/202", "14/301", "14/302", "14/401", "14/402",
  "15/101", "15/102", "15/201", "15/202", "15/301", "15/302", "15/401", "15/402",
  "20/101", "20/102", "20/201", "20/202", "20/301", "20/302", "20/401", "20/402",
  "25/101", "25/102", "25/201", "25/202", "25/301", "25/302", "25/401", "25/402",
  "30/101", "30/102", "30/201", "30/202", "30/301", "30/302", "30/401", "30/402",
  "34/101", "34/102", "34/201", "34/202", "34/301", "34/302", "34/401", "34/405",
];

// Cascading tree: Domain -> SubDomain1 -> SubDomain2 options
export const DOMAIN_CASCADE: Record<
  string,
  { sub1: Record<string, string[]> }
> = {
  Electrical: {
    sub1: {
      "Ceiling Fan / Exhaust": ["Not Rotating", "Slow Speed / Capacitor", "Noise / Grinding", "Regulator Faulty", "New Installation"],
      "Tubelight / LED Batten": ["Flickering / Choke", "Not Glowing", "Starter Fault", "Holder Broken", "Tube Replacement"],
      "Power Socket / Switch": ["Sparking / Loose", "Burned Out", "Switch Jammed", "3-Pin 16A Power Point", "Earth Leakage"],
      "Main MCB / DB": ["Frequent Tripping", "No Power in Room", "Phase Out", "Burn Smell from DB"],
      "Wiring / Conduits": ["Exposed Wiring", "Short Circuit", "Burnt Cable", "Extension Board"],
    },
  },
  Civil: {
    sub1: {
      "Seepage / Dampness": ["Roof Leakage during Rain", "Bathroom Wall Seepage", "Ceiling Peeling Off", "Efflorescence / White Salt"],
      "Wall Paint / Plaster": ["Plaster Coming Off", "Paint Chipping", "Deep Structural Crack", "Hairline Crack"],
      "Flooring & Tiles": ["Broken Floor Tile", "Wall Tile Dislodged", "Grouting Required", "Skirting Damaged"],
      "Door / Window Glass": ["Window Panes Broken", "Mesh Net Torn", "Glass Crack", "Glazing Bead Loose"],
    },
  },
  "Plumbing": {
    sub1: {
      "Taps & Faucets": ["Continuous Dripping", "Tap Handle Broken", "Low Water Pressure", "Mixer Tap Fault"],
      "Drainage & Waste Pipe": ["Washbasin Choked", "Bathroom Floor Trap Blocked", "Kitchen Sink Overflow", "Foul Smell"],
      "Toilet / Flush Tank": ["Flush Button Broken", "Continuous Overflow", "Jet Spray Leakage", "Health Faucet Damaged"],
      "Water Supply Pipeline": ["Pipe Burst / Gushing", "Geyser Inlet / Outlet Leak", "Overhead Tank Overflow"],
    },
  },
  "Air-Conditioning": {
    sub1: {
      "Split AC Unit": ["No Cooling / Warm Air", "Water Dripping Indoors", "Loud Compressor Noise", "Display Error Code"],
      "Remote Controller": ["Remote Not Working", "Temperature Stuck", "Batteries Corroded", "Sensor Issue"],
      "Filters & Servicing": ["Dust Clogged Filter", "Foul Odour", "Gas Leakage", "Coil Freezing / Ice Formation"],
    },
  },
  "Water-Cooler": {
    sub1: {
      "Drinking Water Cooler": ["Not Cooling / Warm Water", "Water Tap Broken", "Continuous Tap Leak", "Compressor Noise"],
      "RO Purification System": ["Filter Choked / Low Flow", "TDS High", "UV Lamp Red Alert", "Waste Water Overrun"],
    },
  },
  "Carpentry": {
    sub1: {
      "Doors & Locks": ["Main Door Jammed", "Tower Bolt Broken", "Godrej Lock Jammed", "Handle Loose / Fallen"],
      "Cupboards & Wardrobes": ["Hinge Broken", "Sliding Door Off Track", "Key Broken in Lock", "Shelf Collapsed"],
      "Furniture / Bed / Table": ["Study Chair Broken", "Bed Leg Loose", "Study Table Drawer Jammed"],
    },
  },
  "Network/IT": {
    sub1: {
      "LAN / Ethernet Port": ["RJ-45 Port Broken", "No Link Light", "Slow Speed / Packet Loss"],
      "Wi-Fi AP / Telephony": ["Intercom Not Working", "AP Power Off", "Cabling Disconnected"],
    },
  },
};
