// Simplified default configuration for Live Synchronized Judging
module.exports = {
  activeCompetition: 'flags', // 'flags' or 'emblems'
  activeItemNumber: 1,        // The current design number shown on projector (e.g. 1, 2, 3...)
  votingOpen: false,          // Admin controls whether voting is open or closed
  adminPassword: process.env.ADMIN_PASSWORD || 'admin2026',
  totalItems: {
    flags: 15,                // 15 Flags
    emblems: 15,              // 15 Emblems
    stamps: 15                // 15 Commemorative Stamps
  },

  // 20 Judges configuration
  judges: Array.from({ length: 20 }, (_, i) => {
    const id = i + 1;
    return {
      id: id,
      name: `Judge ${id < 10 ? '0' + id : id}`,
      pin: (1000 + id).toString(), // PINs: 1001 to 1020
      active: true
    };
  }),

  // Scores structure:
  // scores[competition][itemNumber][judgeId] = { score: 8, submittedAt: ISOString }
  scores: {
    flags: {},
    emblems: {},
    stamps: {}
  },

  // Optional Artwork Images:
  // images[competition][itemNumber] = '/uploads/flags-1-172608.png'
  images: {
    flags: {},
    emblems: {},
    stamps: {}
  }
};
